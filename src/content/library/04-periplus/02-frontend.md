---
title: 前端走查
section: Periplus
icon: workflow
---

# Periplus 前端(web/)扫盲笔记

> 目的:Periplus 不是简历上的重点技术栈(前端亮点在 WinterFell / WebGPU 那个项目),但面试时如果被顺口问到"这个项目前端怎么搭的",要能讲清楚**基本结构**,不用深挖每个库的原理。这篇只覆盖"扫盲"级别的内容。
>
> **有一处权重高于其余:** 更早的简历在正文里承诺过"类型化的 stage 契约一路带到 React 客户端,客户端类型由 OpenAPI schema 生成"。也就是说,本文第 2 节(`openapi-typescript` 那条链路)现在是简历正文承诺的内容,不再是"顺口被问到才讲",**必须能主动讲清楚:契约在哪定义、类型怎么生成、生成物怎么被消费、schema 改了不重新生成会发生什么**。其余章节(TanStack Query、MSW)仍是扫盲级。

---

## 1. 技术栈全貌

仓库路径:`periplus/web`,是一个独立的 SPA(单页应用),通过 Vite 构建。

| 层 | 用的什么 | 备注 |
|---|---|---|
| UI 框架 | React 19 | 用的是最新的 React,配合 `react-dom` |
| 路由 | React Router v7(`react-router-dom`) | 用的是传统的 `<Routes>/<Route>` 声明式写法,不是它的 data router / loader 模式 |
| 状态管理 / 数据获取 | TanStack Query v5(`@tanstack/react-query`) | 项目里没有 Redux/Zustand 这类全局状态库,服务端数据全靠 Query 的 cache 兜底,本地 UI 状态就用 `useState`/表单库自己的状态 |
| 表单 | React Hook Form + `@hookform/resolvers/zod` | 表单校验规则用 Zod schema 声明,通过 resolver 桥接给 RHF |
| 校验/类型 | Zod v4 | 只用于**表单**这一处的运行时校验;和后端通信的类型走的是另一条路(见第 2 节) |
| 构建工具 | Vite 8(`@vitejs/plugin-react` + `@tailwindcss/vite`) | 开发服务器自带一个 `/api` 反向代理转发到本地后端 `127.0.0.1:8000` |
| 样式 | Tailwind CSS v4 | 通过 Vite 插件接入,没有单独的 `tailwind.config.js`(v4 的新模式) |
| 动画 | GSAP | 少量装饰性动效(如提交按钮的加载态旋转图标),读取 `prefers-reduced-motion` 决定要不要播放 |
| UI 基础组件 | Radix UI(Dialog、Popover) | 用来做无障碍(a11y)基础的弹层组件,自己的 `DatePicker`/`TagInput` 等是在 Radix 上包了一层业务外观 |
| 测试 | Vitest + Testing Library + MSW + Playwright | 单元/组件测试用 Vitest,端到端测试用 Playwright(见第 4 节) |
| Lint | oxlint | 一个用 Rust 写的高性能 ESLint 替代品 |

**目录结构速览(`web/src/`)**:

```
app/         QueryClient 的工厂函数(带全局默认配置)
routes/      页面级组件,一个路由一个文件(TripInputPage / RunProgressPage / RunResultPage / ArticlePage)
api/         和后端通信的全部逻辑(见第 2 节)
hooks/       零散的自定义 hook(如 useMediaQuery)
lib/         纯函数工具(格式化日期、stage 文案映射、verdict 颜色映射等)
schemas/     Zod 表单校验 schema
components/  可复用 UI 组件(AppShell、DatePicker、Stepper、TagInput、StageRoute……)
mocks/       浏览器端 MSW worker(开发时预览用,见第 4 节)
test/        测试基础设施:fixtures、MSW handlers、Testing Library 封装
```

App 的入口(`main.tsx`)在最外层套了 `<Router><QueryClientProvider><App /></QueryClientProvider></Router>`,`App.tsx` 里就是四条 `<Route>`,外加一条 `*` 通配符兜底跳转回首页。整个应用一共只有 4 个页面,是一条线性流程:填表单 → 提交生成 trip → 轮询进度 → 看结果 → 看生成的文章。

---

## 2. 前后端类型安全是怎么打通的(重点)

这是这个项目在"工程规范"上最值得一提的地方,虽然不如 tRPC 那种运行时也打通,但对于**普通 REST API + FastAPI 后端**场景是一个很实用的折中方案。

### 核心工具:`openapi-typescript`

`package.json` 里有这条脚本:

```json
"generate:api": "openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.generated.ts"
```

流程是:
1. 后端(FastAPI,能自动生成 `/openapi.json`,也就是 OpenAPI/Swagger 规范文档)先跑起来。
2. 前端跑 `npm run generate:api`,这个 CLI 工具会**请求这个 OpenAPI JSON 文档**,把里面描述的所有 path、请求体、响应体的 JSON Schema,静态转换成一份纯 TypeScript 类型声明文件 `src/api/schema.generated.ts`(接近 1000 行,文件头写着"auto-generated,不要手改")。
3. 这份生成文件里主要是两类类型:`paths`(每个路径的请求/响应类型)和 `components['schemas']`(后端所有 Pydantic 模型对应的 TS 类型,比如 `RunSummary`、`TripBriefCreate`、`Itinerary`、`Claim`、`Evidence`、`Verdict` 等)。

### 怎么被消费

`src/api/contracts.ts` 是"手写的薄封装层",把生成文件里那些冗长的类型重新导出成好用的别名:

```ts
import type { components } from './schema.generated'

export type ApiSchemas = components['schemas']
export type TripBriefCreate = ApiSchemas['TripBriefCreate']
export type RunSummary = ApiSchemas['RunSummary']
export type RunResultView = ApiSchemas['RunResultView']
// ... 等等
```

然后 `src/api/client.ts` 里的 `ApiClient` 接口、每个请求函数的入参出参,全部用这些类型标注。业务代码(页面、hooks)只 import `contracts.ts` 里的类型,从不直接碰生成文件。

**这套方案解决的问题**:
- 后端一改字段名、加字段、改枚举值,前端只要重新跑一次 `generate:api`,所有引用了这个类型的地方**编译期直接报错**,不用等到运行时接口对不上才发现。
- 不需要额外维护一份"前端专用的 interface",避免前后端类型"手动同步、越漂越远"的经典问题。

**要认清它的边界**(面试容易被追问到):这是**编译期**类型安全,不是运行时校验。如果后端真的返回了和 schema 不符的数据(比如线上一个 bug 导致某字段是 `null` 但类型标了非空),前端**不会报错**,只会在运行时用错类型悄悄出问题——因为 `schema.generated.ts` 只是拿来做 TS 类型标注,`client.ts` 里 `response.json() as Promise<T>` 是一个**类型断言**,没有真的对响应体做运行时校验(不像 tRPC/Zod 那样"类型 + 运行时校验"两件事一起做)。这点和 tRPC 或者"后端返回体也过一遍 Zod parse"的方案是有本质区别的,能讲出这个区别是加分项。

### 请求层怎么发请求

`api/client.ts` 里就是一个很朴素的 `fetch` 封装(没用 axios):
- 统一加 `/api` 前缀(开发环境靠 Vite 的 proxy 转发到真实后端,`vite.config.ts` 里配置了 `/api` → `http://127.0.0.1:8000`,并且 rewrite 去掉 `/api` 前缀)。
- 统一处理错误:非 2xx 时尝试解析后端返回的 `detail` 字段——如果是字符串就是普通错误信息,如果是数组(FastAPI/Pydantic 校验失败时的典型格式,元素形如 `{loc, msg, type}`)就是字段级校验错误列表,包成一个自定义的 `ApiError` 类(带 `status` 和 `issues`)抛出去。
- 有一个很有意思的细节:整个 client 还支持一个 `isDemo`(`import.meta.env.MODE === 'demo'`)开关,demo 模式下所有请求直接返回写死的 fixture 数据,不发真实网络请求——这是给"纯前端静态托管演示"用的(`build:demo` 脚本 + `HashRouter`),不依赖后端就能跑一个可交互的 demo。

---

## 3. 数据获取/缓存策略:TanStack Query

项目里**没有** Redux / Zustand 这类全局状态库,服务端来的数据统一交给 TanStack Query(v5)管理,这是当前 React 生态处理"服务端状态"的主流方案。

### 它解决什么问题

如果不用 Query,自己手写 `useEffect + fetch + useState(loading/error/data)`,会重复写大量样板代码,而且没有缓存、没有请求去重、组件之间共享同一份数据很麻烦、轮询/重试这类逻辑也要自己实现。Query 把"服务端数据"当成一种**带 key 的缓存**来管理,一个 `queryKey` 唯一标识一份数据,多个组件订阅同一个 key 会自动共享同一份缓存,不会重复发请求。

### 项目里的具体用法

`src/api/queries.ts` 是所有 Query hook 的集中定义处:

```ts
export const runKeys = {
  all: ['runs'] as const,
  detail: (runId: string) => ['runs', runId] as const,
  result: (runId: string) => ['runs', runId, 'result'] as const,
}

export function useCreateTrip() {
  return useMutation({ mutationFn: (brief) => api.createTrip(brief) })
}

export function useRunSummary(runId: string) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: () => api.getRun(runId),
    refetchInterval: (query) => {
      const summary = query.state.data
      return summary && isTerminalStatus(summary.status) ? false : 1_000
    },
  })
}

export function useRunResult(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: runKeys.result(runId),
    queryFn: () => api.getResult(runId),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}
```

几个值得讲的点:
- **`queryKey` 工厂函数模式**(`runKeys.detail(id)`):这是 Query 官方推荐的写法,把 key 集中管理,避免各处手写数组字面量导致拼错或缓存对不上。
- **轮询(polling)**:提交行程后是一个异步后台任务(research → verify → plan → write → edit → illustrate 六个 stage),前端用 `refetchInterval` 每 1 秒轮询一次任务状态,**直到状态进入终态**(`succeeded`/`failed`/`cancelled`,由 `isTerminalStatus` 判断)才停止轮询——这是一个很典型的"长任务轮询"场景,用 Query 的 `refetchInterval` 回调(可以读到当前缓存数据)几行代码就搞定了,不用自己写 `setInterval` + 清理逻辑。
- **`enabled` 参数**:`useRunResult` 只有在外部传入 `enabled=true` 时才会真正发请求,用来做"依赖前一个请求结果才决定要不要发下一个请求"的编排(等 run 状态变成 succeeded 才去拉最终结果)。
- **`staleTime: Infinity`**:结果数据一旦拿到就认为永远新鲜,不会被自动重新请求——因为一个已完成 run 的结果是不可变的历史数据,没必要重复拉。
- **全局默认配置**在 `src/app/queryClient.ts` 里:自定义了 `retry` 策略(4xx 客户端错误不重试,其它错误最多重试到第 2 次)和关闭了 `refetchOnWindowFocus`(默认 Query 会在窗口重新聚焦时自动重新请求,这里显式关掉了)。测试里每次都用 `createQueryClient()` 现造一个全新实例,保证测试之间缓存不互相污染。

---

## 4. 测试策略:MSW 让前端测试不依赖真实后端

这一块是这个项目测试体系的核心思路,值得讲清楚。

### 分层

1. **Vitest + Testing Library**:组件/页面级测试,跑在 `jsdom` 环境里(`vite.config.ts` 里 `test.environment: 'jsdom'`)。
2. **MSW(Mock Service Worker)**:拦截测试运行时发出的真实 `fetch` 请求,返回写死的假数据,而不是真的打到网络上或者后端服务。
3. **Playwright**:端到端测试(`test:e2e` 脚本),会启动真实浏览器跑真实页面。

### MSW 怎么接进来的

- `src/test/mocks/handlers.ts`:定义一组 `http.get/post(...)` handler,针对项目里用到的几个接口(`POST /api/trips`、`GET /api/runs`、`GET /api/runs/:runId`、`GET /api/runs/:runId/result`)返回写死的 fixture 数据(`src/test/fixtures.ts` 里维护了一整套"运行中/成功/失败/校验失败"等各种状态的假数据)。
- `src/test/mocks/server.ts`:用 `setupServer(...handlers)`(MSW 的 Node 环境入口)包装成一个 server 实例。
- `src/test/setup.ts`(Vitest 全局 setup 文件):在 `beforeAll` 里 `server.listen()`,每个测试后 `resetHandlers()`,全部测试跑完后 `server.close()`——这是 MSW 官方推荐的标准生命周期写法。同时还 stub 了 `window.matchMedia`,因为 jsdom 没实现这个 API,而组件里要读 `prefers-reduced-motion` 来决定要不要跑 GSAP 动画。
- **好处**:测试代码里组件该怎么调 `fetch` 还是怎么调,不需要 mock 掉 `api.createTrip` 这些业务函数本身,MSW 是在"网络层"拦截的,所以测试更接近真实运行时行为(比如 `client.ts` 里对非 2xx 状态码、`detail` 字段解析这些错误处理逻辑也一起被测到了),而不需要一个真的跑着的后端。

### 两种"用假数据跑起来"的场景,容易搞混,值得分清楚

- **测试用(Node 端)**:`src/test/mocks/server.ts`,给 Vitest 单元/组件测试用,拦截的是 Node 环境里的网络请求。
- **本地预览用(浏览器端)**:`src/mocks/browser.ts` 用 `msw/browser` 的 `setupWorker`,复用同一份 `handlers.ts`。这是给 `npm run dev` 时手动加 `?mock=1` 查询参数用的——不需要真的后端跑着,就能在浏览器里用假数据把整个 UI 流程点一遍,方便本地调界面/截图。这段逻辑通过 `import.meta.env.DEV` 判断,生产构建时会被 Vite 直接摇树优化掉,不会打进正式产物。

### 具体测什么

`src/test/msw.test.ts` 直接测 `api.ts` 里的请求函数(拿到假数据是否符合预期、404/422 错误是否被正确转成 `ApiError`)。`src/routes/TripInputPage.test.tsx` 这类页面级测试则是用 Testing Library 的 `userEvent` 模拟真实用户点击/输入(比如填写目的地、选日期、点提交按钮),断言页面上出现的校验错误文案或者路由是否正确跳转——这类测试通过 `renderWithProviders.tsx` 里的 `renderRoutes` 封装,把被测组件包进 `MemoryRouter` + 一个全新的 `QueryClientProvider`,让页面里用到的 `useParams`/`useNavigate`/Query hooks 都能正常工作。

---

## 5. 预期面试追问

1. **"这个项目为什么不用 tRPC 或者 GraphQL,而是 REST + openapi-typescript?"**
   预期答法:后端是 FastAPI,天然自带 OpenAPI 文档生成,这套方案零后端改动成本就能拿到类型;缺点是只有编译期类型安全,没有运行时校验,也没有 tRPC 那种"改了后端接口前端立刻编译报错"的强绑定(需要手动重新跑生成脚本)。

2. **"`schema.generated.ts` 里的类型和真实后端返回的数据不一致会怎样?"**
   预期答法:不会报错。`response.json() as Promise<T>` 只是类型断言,没有运行时校验,数据形状不对会在业务代码里悄悄出 bug(比如访问一个实际是 `undefined` 的字段)。如果要补上运行时安全网,可以把这份生成类型转成/配合 Zod schema 在 `request()` 里做一次 `safeParse`。

3. **"为什么用 TanStack Query 而不是 Redux 之类的全局状态库?"**
   预期答法:项目里几乎所有状态都是"服务端数据"(run 状态、结果),没有复杂的跨页面客户端状态需要一个通用 store,Query 专门为"服务端状态"设计,自带缓存/去重/轮询/重试,比自己拿 Redux 手搭一套请求状态机更省事;真正需要的本地 UI 状态(表单值、弹层开关)用 `useState`/RHF 自己的状态就够了。

4. **"轮询进度这里,为什么不用 WebSocket 或 SSE?"**
   预期答法:项目用的是简单轮询(`refetchInterval`,1 秒一次直到终态),原因大概是任务耗时不长、总请求量可控,轮询实现简单、不需要额外维护长连接;如果要往 WebSocket/SSE 优化,可以谈一下取舍(实时性更好但要处理连接生命周期、断线重连、后端要多维护一种通信方式)。

5. **"MSW 和直接 `vi.mock('./api/client')` 比,好在哪?"**
   预期答法:`vi.mock` 是在模块层面替换掉整个 API client,测试就绕过了 `client.ts` 里真实的 fetch 调用、错误处理、状态码分支逻辑,等于这部分代码没被测到;MSW 是拦截"网络请求"这一层,业务代码路径(包括错误解析逻辑)原样跑一遍,测试更接近真实运行时,而且同一套 handler 还能给浏览器端 mock 复用(`src/mocks/browser.ts`),一份 fixture 两处用。

6. **"这个项目的表单校验,Zod 和 React Hook Form 具体是怎么配合的?"**
   预期答法:`schemas/tripBrief.ts` 定义了一个 `tripBriefSchema`(带一个 `.refine` 做跨字段校验:结束日期不能早于开始日期),通过 `zodResolver(tripBriefSchema)` 传给 `useForm`,提交时 RHF 会自动跑这个 schema,校验失败的字段错误会挂到 `formState.errors` 上,由输入框旁边的 `<span>` 显示;此外后端返回的 422 校验错误(`ApiError.issues`)也会在提交失败后通过 `setError` 反向写回表单的错误状态,做到"前端校验 + 后端校验失败信息"统一展示在同一套 UI 上。
