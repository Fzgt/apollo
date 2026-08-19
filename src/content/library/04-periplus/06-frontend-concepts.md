---
title: 前端概念版
section: Periplus
icon: workflow
---

# 前端工程概念面试预习笔记(知识点版)

> 定位:这篇不是项目走查(项目走查已经有 `LEARNING_NOTES_PERIPLUS_FRONTEND.md` 了),而是以简历这行"Frontend: React, Next.js, Vue, Angular, TanStack Query, Zustand, React Three Fiber, Three.js"为锚点,把背后**通用的、可迁移的前端概念**按主题过一遍。前端对这位候选人来说是次要方向,这篇笔记的目标是"扫一遍能讲清楚原理和取舍",不是每个点都往深了刨。

---

## 1. React vs Vue vs Angular:心智模型与响应式系统

三者都在解决同一个问题——"数据变了,UI 怎么自动跟着变"(声明式渲染),但响应式实现方式不同:

- **React**:单向数据流 + 显式重渲染。状态变化触发组件函数重新执行,通过 Virtual DOM diff 得到最小更新集合。心智模型是"UI = f(state)",没有自动依赖追踪,细粒度优化靠 `memo`/`useMemo`/`useCallback` 手动介入(或 React 19 的 Compiler 自动做)。
- **Vue**:基于 Proxy(Vue 3)的响应式系统,自动追踪依赖——读了哪个响应式变量、组件就订阅哪个,变量变了只重新渲染受影响的部分,不需要像 React 那样手动 memo。模板语法(SFC)天生对 diff 更友好。
- **Angular**:更"重"的框架体系,自带依赖注入、RxJS 驱动的响应式、双向绑定(`[(ngModel)]`)、强约定的模块化结构,适合大型企业级团队协作,学习曲线陡但规范性强。

**权衡**:React 灵活但需要团队自律(状态设计、渲染优化);Vue 心智负担小、上手快,但生态和 TS 深度集成不如 React 生态成熟;Angular 开箱即用但重、灵活性差。React 目前生态最大,招聘市场也最主流,这也是简历上把它放第一位的原因。

**可能追问**:
1. React 的 Virtual DOM diff 和 Vue 的响应式依赖追踪,本质区别是什么?各自的性能特征在什么场景下会反过来?
2. React 19 的 Compiler 想解决什么问题?和 Vue 的自动依赖追踪是不是殊途同归?
3. 如果让你评估一个新项目该选 React 还是 Vue,你会看哪些维度?

---

## 2. 客户端状态 vs 服务端状态:TanStack Query 为什么独立于 Zustand/Redux 存在

这是现代 React 数据层里最容易被问到的一组概念。

- **客户端状态(client state)**:只存在于前端、和后端无关的状态,比如表单输入、弹层开关、当前 Tab。特点是前端"独占所有权"。
- **服务端状态(server state)**:数据的"真相"存在后端,前端只是拿到一份**缓存的快照**,存在过期(stale)、需要重新拉取、可能被其他用户/其他标签页改动等问题。

Redux/Zustand 这类库设计初衷是管理**客户端状态**,如果硬拿来存服务端数据,你得自己手写 loading/error 状态、缓存失效、去重、重试、轮询——TanStack Query 专门为服务端状态设计,把"一份带 `queryKey` 的缓存"做成一等公民,自带这些能力,本质上不是一个"状态管理库",而是一个**异步数据同步引擎**。

**Periplus 印证**:Periplus 前端没有引入 Redux/Zustand,因为几乎全部状态都是服务端数据(trip 创建、run 状态、结果),TanStack Query 的 cache 就是唯一的数据源,真正的本地 UI 状态少到 `useState` 就够用。

**可能追问**:
1. 为什么说 TanStack Query 的 `queryKey` 本质上是一种缓存的"地址"?
2. 如果一个页面同时有服务端数据和大量跨组件共享的客户端状态,你会怎么组合这两类工具?
3. Query 的乐观更新(optimistic update)和普通 `refetch` 相比,解决了什么用户体验问题、又带来什么风险?

---

## 3. 全局状态管理:Context / Zustand / Redux 怎么选

三者都能"跨组件共享状态",但适用场景不同:

- **Context**:React 内置,适合"低频变化、多层传递"的场景(主题、语言、当前用户)。缺点是 Provider 下所有消费组件在 context 值变化时都会重渲染,不适合高频更新的状态。
- **Zustand**:极简的外部 store,基于订阅而非 Context,组件只订阅自己用到的那一小片状态(selector),避免无关重渲染;没有 Redux 的 boilerplate(不需要 action type、reducer、dispatch 样板),适合中小型项目的全局状态。
- **Redux(尤其 Redux Toolkit)**:更强的可预测性和可调试性(时间旅行、中间件生态、严格的单向数据流),适合大型团队、复杂状态派生逻辑多、需要强规范约束的项目,但心智和样板成本更高。

一个实用的经验法则:**先问这份状态是不是服务端数据**(是→TanStack Query),**再问是不是低频、面窄的配置类状态**(是→Context 够了),**都不是、且状态复杂/更新频繁**才需要 Zustand/Redux 这类专门的全局 store。

**可能追问**:
1. 为什么说"滥用 Context 存高频状态"是常见的性能坑?怎么规避(拆分 Context、`useSyncExternalStore` 等)?
2. Zustand 和 Redux 在"要不要中间件生态""要不要严格单向流"这两点上分别怎么取舍?
3. 如果项目一开始只用 Context,后来状态变复杂了,你会怎么判断"该升级到 Zustand 了"?

---

## 4. 长任务的前后端通信:轮询 vs WebSocket vs SSE

后端有一个耗时的异步任务(比如多阶段 pipeline),前端需要知道进度/结果,常见三种方案:

- **轮询(polling)**:前端每隔固定时间发一次请求问状态,直到终态。实现简单、无状态、对基础设施要求最低(普通 HTTP 请求即可),缺点是有请求浪费和延迟(最坏情况要等一个轮询周期才发现状态变化)。
- **SSE(Server-Sent Events)**:服务端主动推送,基于普通 HTTP 长连接、单向(server→client),浏览器原生 `EventSource` 支持断线自动重连,适合"只需要服务端往前端推消息"的场景,比 WebSocket 轻量。
- **WebSocket**:全双工长连接,适合双向高频通信(聊天、协作编辑),但需要额外维护连接生命周期、心跳、断线重连、后端要专门支持这种长连接协议,基础设施成本最高。

选型本质是拿"实现/运维复杂度"换"实时性"。任务耗时短、并发量可控、不需要双向通信时,轮询往往是性价比最高的选择;需要频繁、低延迟更新且后端已有相应基础设施时才值得上 SSE/WebSocket。

**Periplus 印证**:Periplus 用 TanStack Query 的 `refetchInterval` 做每秒轮询,直到 run 状态进入终态才停止——因为任务是分钟级、请求量可控,轮询几行代码就能实现,不需要额外维护长连接。

**可能追问**:
1. 轮询的"最坏延迟"和"请求浪费"分别怎么优化(动态调整轮询间隔、指数退避)?
2. SSE 和 WebSocket 在"是否需要客户端主动发消息"这一点上分别适合什么场景?
3. 如果后端还没准备好 WebSocket/SSE 基础设施,但产品要求"秒级实时",你会怎么权衡?

---

## 5. 编译期类型安全 vs 运行时校验:一个容易被问穿的边界

这是"前后端类型打通"这类方案(`openapi-typescript`、tRPC、GraphQL Codegen)绕不开的核心概念,**编译期安全 ≠ 运行时安全**。

- **编译期类型安全**:TypeScript 只在"写代码、编译"这个阶段起作用。像 `openapi-typescript` 这类工具是把后端的 OpenAPI/Swagger 文档静态转换成 TS 类型声明,给业务代码做类型标注,好处是后端字段一变、引用处编译直接报错,IDE 有自动补全。但它对"运行时实际拿到的数据"完全没有约束力——`response.json() as T` 本质是一个**类型断言**,不是校验,编译器信的是你写的类型,不是网络上真实返回的字节。
- **运行时校验**:用 Zod/Yup/io-ts 这类库,在拿到数据的那一刻真正解析一遍(`schema.parse(data)`),校验失败可以立刻抛错或走兜底逻辑,能捕获"后端 bug 导致字段类型不符""接口版本没对齐"这类线上真实会发生的问题。

两者不是二选一,而是分别覆盖开发期和运行期两道防线。像 tRPC 之所以被认为"更彻底",是因为它把 schema 定义为运行时对象(通常配合 Zod),同一份 schema 同时提供编译期类型和运行时校验,不需要额外补一层。

**Periplus 印证**:Periplus 用 `openapi-typescript` 生成类型给 `api/client.ts` 做标注,拿到的是纯编译期安全;真正做运行时校验的只有前端表单那一处(Zod + React Hook Form),和后端通信这条链路上没有对响应体做 `safeParse`,这个边界在项目里是刻意的权衡(零后端改动成本换取类型),而不是没意识到。

**可能追问**:
1. 举一个"编译期类型对、运行时数据错"导致线上 bug 的具体场景。
2. 如果要给一个纯 REST + `openapi-typescript` 的项目补上运行时校验,你会怎么落地(生成 Zod schema、还是在 `response` 里手动 parse 关键字段)?
3. tRPC/GraphQL Codegen 相比 `openapi-typescript` 这种"静态生成一次"的方案,在"强绑定"这一点上强在哪?

---

## 6. Next.js 的 SSR/SSG/ISR vs 纯 SPA(CRA/Vite)

纯 SPA(Vite/CRA 打包)是浏览器先下载一个几乎空的 HTML + 一堆 JS,JS 跑起来后才渲染出内容——首屏白屏时间长、对 SEO 不友好(爬虫不一定等 JS 执行完),但架构简单,适合纯内部工具/需要登录后才用的应用。Next.js 提供了几种"提前渲染"的策略来解决这个问题:

- **SSR(Server-Side Rendering)**:每次请求时,服务端实时把 React 组件渲染成 HTML 再返回,首屏快、SEO 友好,但每个请求都要服务端算一遍,服务端压力和延迟随流量线性增长。
- **SSG(Static Site Generation)**:构建时(build time)就把页面渲染成静态 HTML,请求时直接返回静态文件,性能最好(可以直接上 CDN),但内容更新需要重新构建部署,适合博客、文档这类内容变化不频繁的页面。
- **ISR(Incremental Static Regeneration)**:SSG 和 SSR 的折中——静态页面按设定的时间间隔在后台重新生成,用户大部分时候拿到的是缓存的静态页,但内容会定期自动更新,不需要每次改动都重新全量部署。

选型本质看"内容是否因人而异""更新频率""SEO 要不要"。纯客户端 SPA 是这条谱系的一端(全部渲染都在浏览器、构建/部署最简单);Next.js 让你可以按页面粒度混用这几种策略。

**可能追问**:
1. 一个需要登录后才能看、内容因人而异的仪表盘,适合 SSR/SSG/ISR 里的哪一种,为什么?
2. ISR 的"重新生成"是谁触发的?如果两个请求同时撞上"该重新生成"的时刻,Next.js 怎么处理,避免用户看到半吊子页面?
3. Next.js App Router 的 Server Components 和传统 SSR 相比,多解决了什么问题(比如减少发到浏览器的 JS 体积)?

---

## 7. React Three Fiber / Three.js:声明式包一层命令式 WebGL

Three.js 是对浏览器原生 WebGL API 的一层封装,提供场景(Scene)、相机(Camera)、网格(Mesh)、材质(Material)、光照这些概念,但用法是**命令式**的——手动 `new THREE.Mesh(...)`、手动挂到 scene 上、手动在 `requestAnimationFrame` 循环里更新属性、手动清理。这套命令式代码和 React 声明式("UI 是状态的函数")的心智模型是冲突的。

React Three Fiber(R3F)做的事情,是把 Three.js 的对象树映射成 React 组件树——写 `<mesh><boxGeometry /><meshStandardMaterial /></mesh>` 这样的 JSX,底层由 R3F 的自定义 renderer(基于 `react-reconciler`)去调用真正的 Three.js API 创建/更新/销毁对象,状态变化时该增删哪些 3D 对象由 React 的 diff 机制接管,不用自己手写命令式的增删改逻辑,还能直接复用 React 生态(状态管理、hooks、组件复用)来组织 3D 场景。

**什么时候值得把 3D 放进 React 里**:场景需要和应用的其余状态(表单、路由、业务数据)紧密联动、需要用 React 的组件化方式复用/编排 3D 元素时,R3F 的价值才体现出来;如果只是一个孤立的、不需要和外部状态频繁交互的可视化模块,直接写原生 Three.js(甚至用现成的 3D 库/编辑器)可能更简单,引入 R3F 反而多一层抽象和心智负担。

**可能追问**:
1. R3F 的 renderer 和 `react-dom` 的 renderer 本质上是同一套机制(`react-reconciler`)在做两件不同的事,这句话怎么理解?
2. 在 React 组件里频繁更新 3D 物体的位置(比如做动画)时,为什么不建议直接把坐标存进 React state 触发重渲染,而是用 `useFrame` 直接改 `ref` 上的属性?
3. 3D 场景该用 React 组件树管理,还是该整体当成一个"黑盒 canvas"从外部命令式驱动?这个决策你会看哪些因素?

---

## 8. 测试策略:用 MSW 在网络层做统一 mock

前端测试里,"要不要真的发网络请求"是绕不开的问题。两种主流思路:

- **Mock 业务函数本身**(比如 `vi.mock('./api/client')`):简单粗暴,但把真实的请求构造、错误处理、状态码分支逻辑全都绕过去了,这部分代码没有被真正测到。
- **在网络层拦截**(MSW,Mock Service Worker):不 mock 业务代码,而是拦截真实发出的 `fetch`/`XHR` 请求,按 URL/method 匹配后返回写死的响应。业务代码走的是完整的真实路径(请求怎么构造、响应怎么解析、错误怎么转换),只是请求的"终点"被换成了假数据,测试因此更接近真实运行时行为。

MSW 的另一个价值是**同一套 handler 可以跨场景复用**:单元测试(Vitest)用 Node 端的 `setupServer`,组件/集成测试也走同一套 handler 保证行为一致,甚至可以在浏览器里用 `setupWorker` 跑成"无需真实后端的可交互 demo/本地预览",一份 fixture 多处用,不用为每个场景单独维护假数据。

**Periplus 印证**:Periplus 的 `handlers.ts` 同时被 Vitest 的 Node 端 `server.ts`(单元/组件测试)和浏览器端 `browser.ts`(`?mock=1` 本地预览)复用,测试里连 `client.ts` 对非 2xx 状态码、`detail` 字段的解析逻辑都被真实跑到,而不是被绕过。

**可能追问**:
1. MSW 拦截的是"网络层",这和拦截"模块导入层"(`vi.mock`)相比,分别会漏测哪些代码路径?
2. 如果后端接口有 100 个,要不要给每个接口都写 MSW handler?你会怎么控制这块的维护成本(比如从 OpenAPI 文档自动生成 mock)?
3. 端到端测试(Playwright,真实浏览器打真实/mock 后端)和 MSW 拦截的组件测试,分别在测试金字塔里承担什么角色,为什么不能互相替代?

---

## 本文档与项目版笔记的分工

`LEARNING_NOTES_PERIPLUS_FRONTEND.md` 回答的是"Periplus 前端具体怎么搭的"——目录结构、用到哪些库、`openapi-typescript`/TanStack Query/MSW 在这个项目里的具体接线方式,适合应对"聊聊这个项目前端"这类项目走查式追问;这篇文档回答的是"这些技术选型背后的通用概念是什么、为什么存在、和其他方案比优劣在哪",覆盖简历那行技术栈里 Periplus 没有直接用到、但同样可能被问到的部分(Vue/Angular 对比、Zustand/Redux、Next.js 渲染策略、React Three Fiber),目的是让候选人在被问到"原理层面"的问题时,不管是不是这个项目里实际写过的技术,都能讲出清晰的取舍逻辑,而不是被问到项目之外就卡壳。
