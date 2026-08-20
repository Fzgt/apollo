---
title: "Day 5 · 把约定变成约束"
tier: must
section: BioMap · Day 5
icon: microscope
day: 5
level: B
status: done
---

# Day 5 · 必看 · 把约定变成约束

> 🔴 **必看**。covers bullet ②（React 18 架构 + ESLint 边界）和 ④（设计系统 + MSW），回答 **Q4**（为什么 MSW 优于假 fetch）。
>
> **这两条 bullet 表面上没关系，其实是同一个思想的两次应用**——把它们合起来讲，比分开讲各自强一倍。

## 对应简历原句

> ② **Led the React 18 and TypeScript architecture for Digital OS**, the team's core consumer-facing product, **enforcing feature boundaries with custom ESLint rules**.
>
> ④ Built a **design system on Radix UI, Storybook and CVA**, plus an **MSW mock layer** that let frontend delivery run independent of backend progress.

---

## 统领这一天的一句话

> **「文档是约定，ESLint 是约束。」**

**约定靠人记得住，约束靠工具挡得住。** 团队一大、人一换，约定就会漂——**唯一能不漂的是「做不到」。**

**这个思想在这两条 bullet 里出现了两次：**

| | 约定（会漂） | 约束（挡得住） |
|---|---|---|
| **架构边界** | README 里画一张依赖方向图 | **`import/no-restricted-paths`——违规直接编译报错** |
| **前后端解耦** | "接口先约定好，后端慢慢写" | **MSW 在网络层拦截——前端跑的是真实请求路径** |

> **面试里先把这句话抛出来，再用两个例子落地。** 这比逐条介绍 ESLint 规则高一个层次——因为它展示的是**判断力**，不是工具熟练度。

---

## 一、架构边界：ESLint 怎么强制依赖方向

#### ① 我当时怎么做的

参照实现 `Prometheus/.eslintrc.cjs`，注释里画了依赖方向图（`:116-124`）：

```
  app/ ──→ features/ ──→ components/
               │              hooks/
               │              lib/
               │              types/
               └──→           utils/

箭头方向是允许的依赖方向，反向一律禁止。
```

**然后用 `import/no-restricted-paths` 把这张图变成五个 zone（`:126-172`）：**

| Zone | 规则 | 挡住什么 |
|---|---|---|
| **1–3** | `features/blog` 不能从 `features/` 导入（除了自己） | **feature 之间互相引用** |
| **4** | `features/` 不能从 `app/` 导入 | **下层反向依赖上层** |
| **5** | `components/ hooks/ lib/ types/ utils/` 不能从 `features/`、`app/` 导入 | **共享层被业务污染** |

**外加 `import/no-cycle: 'error'`（`:182`）禁止循环导入。**

### ② 原理：为什么这三条边界值钱

**Zone 1–3（feature 隔离）解决的是「大泥球」**：

```
blog 引了 comments 的一个工具函数
  → comments 引了 blog 的一个类型
    → 两个 feature 焊死了
      → 想删掉 comments？删不掉
      → 想让新人只改 blog？他得先读懂 comments
```

**Feature 之间要通信，只能通过上层（app/）编排，或者下沉到共享层。** 这样每个 feature 都是**可独立删除、可独立理解**的单元。

**Zone 5（共享层不能反向引用）解决的是「共享层变成垃圾场」**：`components/Button` 一旦引了 `features/blog` 的东西，它就不再通用了。

**`no-cycle` 解决的是真实的运行时 bug**：注释写了三条——模块初始化顺序不确定、可能拿到 `undefined`（模块还没初始化完）、难以维护。**第二条是真的会炸的**。

#### ③ 生产级会怎么做

| 做法 | 说明 |
|---|---|
| **CI 里跑 lint** | 规则不进 CI 等于没有——这一点在 [Day 4](/docs?section=beyz&item=d4-deploy) 讲 CI gate 时是同一个道理 |
| **`dependency-cruiser`** | 比 ESLint 规则更强：能生成依赖图、能定义更复杂的架构规则、能输出可视化 |
| **Nx / Turborepo 的 tag 约束** | monorepo 规模下用 `tags` + `implicitDependencies` 声明边界，工具链原生支持 |
| **规则要和目录结构一起演进** | 加了新 feature 就要加 zone——**否则规则会慢慢变成摆设** |

> **答法**：「依赖方向本来是写在 README 里的一张图，但文档拦不住任何人。我们用 `import/no-restricted-paths` 定了五个 zone 把它变成 lint 错误：feature 之间不能互相引用、features 不能引 app、共享层不能反向引 features 和 app，再加 `no-cycle`。**核心是那句——文档是约定，ESLint 是约束。** 约定靠人记，约束靠工具挡；团队一换人，只有约束不会漂。」

---

## 二、Q4：为什么 MSW 优于假 fetch

#### ① 我当时怎么做的

`Prometheus/src/testing/mocks/`：`@mswjs/data` 建内存数据库（`db.ts:42-69` 定义 post / comment 两个 model），handlers 定义接口行为，两个入口：

```ts
setupWorker(...handlers)   // browser.ts:26  浏览器里用 Service Worker 拦
setupServer(...handlers)   // server.ts:14   Node 里在网络层拦
```

**测试里还开了严格模式：**

```ts
// setup-tests.ts:37
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
```

**没有匹配 handler 的请求直接报错**——不会静默穿透到真实网络。

### ② 原理：拦截的位置决定了测的是什么

**这是这一问的题眼。**

```
组件  →  自定义 hook  →  API 函数  →  axios/fetch  →  ❶ HTTP 网络层  →  服务器
       ↑ mock 这里     ↑ mock 这里    ↑ mock 这里      ↑ MSW 拦这里
```

| Mock 的位置 | 下面这些还是不是真的 |
|---|---|
| **mock 掉 hook** | ❌ API 函数、请求组装、拦截器、序列化——全跳过了 |
| **mock 掉 API 函数** | ❌ axios 实例、baseURL、header、拦截器、错误映射——全跳过 |
| **`jest.mock('axios')` / 假 fetch** | ⚠️ 拦在客户端库这层，**请求配置和拦截器逻辑还是没跑到** |
| **MSW（网络层）** | ✅ **上面全部真实执行**，只有最后一跳没出去 |

> **一句话：MSW 拦在网络层，所以你测的是真实的请求路径。**
>
> **这和 [Periplus 的 scripted seam](/docs?section=numbers&item=n14-server-tests) 是完全同一个原则**——`ScriptedClient` 只覆写了 `_chat`，prompt 组装、schema 校验、重试全都还在真跑；抓网页那边换的是 `httpx` 的传输层，robots、限流、重定向全是真测的。
>
> **两个项目串起来讲这一点，非常有力：「seam 要放在最接近进程边界的位置，越靠外，被测的真实代码越多。」**

### 还有三条 MSW 独有的收益

| 收益 | 说明 |
|---|---|
| **同一套 handler，浏览器和 Node 通用** | `setupWorker` 给开发和 Storybook，`setupServer` 给测试。**mock 逻辑只写一份** |
| **前端能独立跑起来** | 后端接口还没写，前端已经能开发、能演示、能截图——**这就是简历里 `let frontend delivery run independent of backend progress` 的字面意思** |
| **`@mswjs/data` 给的是有状态的 mock** | 不是写死的 JSON：POST 一条评论，GET 就能查到它。**能测完整的交互流程，而不只是渲染** |

#### ③ 生产级会怎么做

| 做法 | 说明 |
|---|---|
| **`onUnhandledRequest: 'error'`** | ✅ 已经做了。**没这条，漏配的接口会静默打到真实网络，测试变成不确定的** |
| **handler 从 OpenAPI 生成** | 保证 mock 的形状和真实接口一致——**MSW 最大的风险是 mock 和真实接口漂移** |
| **契约测试（contract testing）** | Pact 之类，让前后端对同一份契约做双向验证。**MSW 保证前端"按约定跑得通"，契约测试保证"约定没被后端改掉"** |

> ⚠️ **必须主动交代的风险**：**MSW 的 mock 会和真实接口漂移。** 后端改了字段名，你的测试全绿、线上全炸。**说出这一点，比只讲 MSW 的好处更能证明你真用过。**

---

## 三、设计系统：Radix + CVA + Storybook（简版）

**这半条的面试价值低于前两块，知道怎么讲清楚就够。**

| 工具 | 解决什么 | 一句话 |
|---|---|---|
| **Radix UI** | **无样式（headless）原语** | 键盘导航、焦点管理、ARIA、点外面关闭——**这些是最容易做错、也最不该重复造的部分**。Radix 只给行为，样式全是你的 |
| **CVA**（class-variance-authority） | **变体的类型安全** | 把 `size × variant × state` 的组合写成配置，`VariantProps` 自动导出类型。**避免手拼 className 字符串** |
| **design tokens** | 单一来源 | 颜色/间距/圆角定义一次，主题切换只换 token |
| **Storybook** | 组件的独立开发环境和文档 | **配合 MSW 就能脱离后端做交互演示** |

**`asChild` 这个模式值得单独提**（`Prometheus/src/components/ui/button/index.tsx`）：用 Radix 的 `Slot` 把样式"套"到子元素上，**这样 `<Button asChild><Link/></Button>` 渲染出来是一个 `<a>` 而不是 `<button>` 套 `<a>`**——语义正确，无障碍也正确。

> **答法**：「Radix 给的是行为不是样式——键盘、焦点、ARIA 这些最容易做错的部分交给它，样式我们自己控。CVA 把变体组合变成类型安全的配置，不用手拼 className。**整套的目的是让『用错』变难**，和 ESLint 边界是同一个思路。」

---

## 一页速查

| 面试官问 | 赢的答法骨架 |
|---|---|
| 怎么保证架构不腐化 | **「文档是约定，ESLint 是约束」** → 五个 zone + `no-cycle` → 生产级进 CI、上 dependency-cruiser |
| 为什么 feature 之间不能互相引用 | 否则焊死：删不掉、新人改一个要读懂两个。**要通信就上层编排或下沉共享层** |
| 为什么 MSW 不用假 fetch | **拦截位置决定测什么**：MSW 在网络层，上面的 API 函数、拦截器、序列化全真跑。**和 Periplus 的 seam 同一原则** |
| MSW 有什么风险 | ⚠️ **mock 和真实接口会漂移** → handler 从 OpenAPI 生成 + 契约测试 |
| `onUnhandledRequest` 干什么 | 漏配的请求直接报错，**不会静默打到真实网络** |
| 设计系统为什么用 Radix | **它给行为不给样式**——键盘、焦点、ARIA 最容易做错，不该重复造 |
