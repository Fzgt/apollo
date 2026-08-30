---
title: 面试概念清单
section: 面试通用
icon: mic-2
---

# 面试概念清单

> 对着简历过一遍；**不在简历上的条目一样留着**——纸上没写不等于不会被问到相邻话题。Skills 行没有 `Go`，也没有 `Evals`。

只列概念名，不解释。先自己过一遍，会的划掉，不会的留着——留下来的才是后面要 focus 的。

**标记**

- ★ 简历原文出现，追问几乎必到
- ○ 简历没写，但从某条 bullet 顺一步就会被问到
- ⚠ 只在 Skills 行出现，本机没有代码支撑——被问到只能靠概念答，答不住就该从 Skills 里删

**来源标记**：`[Beyz]` `[BioMap]` `[百度]` `[Periplus]` `[WinterFell]` `[Skills]`

---

## 一、前端

### 1.1 语言与类型

- ★ TypeScript：泛型、条件类型、映射类型、`infer`、`Pick`/`Omit`/`Exclude`、字面量类型
- ★ discriminated union、类型收窄（narrowing）、穷尽性检查
- ○ 结构化类型（duck typing）、协变/逆变、`unknown` vs `any` vs `never`
- ○ `satisfies`、`as const`、declaration merging、模块增强、`.d.ts`
- ○ `tsconfig` 的 strict 家族、`noUncheckedIndexedAccess`、类型体操的边界
- ★ 端到端类型安全（前后端共享类型）[Beyz][Periplus]
- ○ JS 事件循环、宏任务/微任务、闭包、原型链、`this` 绑定
- ○ ESM vs CommonJS、tree shaking 的前提条件
- ○ `Proxy`/`Reflect`、`WeakMap`、Generator、async iterator
- ○ `AbortController`、`structuredClone`、可选链/空值合并

### 1.2 React

- ★ 函数组件、Hooks 规则、依赖数组
- ★ `useState` `useEffect` `useMemo` `useCallback` `useRef` `useReducer` `useContext`
- ○ `useLayoutEffect`、`useTransition`、`useDeferredValue`、`useSyncExternalStore`、`useId`
- ★ React 18 [BioMap]：并发渲染、自动批处理、StrictMode 双调用
- ○ Fiber、reconciliation、diff 算法、key 的作用与滥用
- ★ 自定义 Hook 设计（`useVirtualList` 是你自己写的）[百度]
- ○ stale closure（闭包陷阱）、依赖数组漏项
- ○ `React.memo`、重渲染溯源、React Profiler
- ○ 受控/非受控组件、状态提升、组合优于继承、render props、HOC
- ○ Error Boundary、Suspense、lazy
- ★ Server Components / Server Actions / `'use client'` `'use server'` [Beyz]
- ○ hydration、hydration mismatch、streaming SSR

### 1.3 Next.js [Beyz]

- ★ App Router vs Pages Router、路由分段、layout/template、动态路由
- ★ typed server actions、服务端校验与授权边界（plan gate 落在这）
- ★ Route Handlers、webhook 端点、edge runtime vs node runtime
- ○ SSR / SSG / ISR / CSR 的取舍、RSC payload
- ○ Next 的四层缓存：Request Memoization、Data Cache、Full Route Cache、Router Cache
- ○ `revalidate`、`dynamic`、`generateStaticParams`
- ○ Metadata API、`next/image`、字体优化
- ○ 中间件（middleware）与鉴权前置

### 1.4 数据层与状态管理

- ★ TanStack Query 三层封装：API 函数 → queryOptions 工厂 → 类型化 hooks [BioMap]
- ★ queryKey 设计与单一数据源、mutation 驱动的失效（invalidation）
- ★ 路由级 preload、hover prefetch
- ○ `staleTime` vs `gcTime`、`invalidateQueries` vs `refetch` vs `setQueryData`
- ○ 乐观更新与回滚、structural sharing、`select`、请求去重
- ○ infinite query、suspense mode、离线与重试策略
- ★ server state vs client state 的界线
- ★ Zustand [Skills]：store 切片、selector、`shallow`、middleware（persist/immer）
- ★ tRPC [Beyz]：procedure/router、input 校验、context、middleware
- ○ Redux/RTK、SWR、Jotai（对比用，用来解释你为什么没选）
- ○ Drizzle 的类型推导如何一路传到前端 [Beyz]

### 1.5 渲染性能

- ○ LCP（BioMap 旧版写过 `< 500ms`，已因无测量证据从简历删除）
- ○ Core Web Vitals 全家：LCP / CLS / INP（原 FID）/ TTFB，字段数据 vs 实验室数据
- ★ 虚拟列表：可视区计算、定高 vs 不定高、overscan、DOM 节点数控制 [百度]
- ★ `IntersectionObserver` 与滚动事件的取舍、滚动锚定
- ★ 60 FPS、16.6ms 帧预算、掉帧的定位方式
- ○ 重排（reflow）/重绘（repaint）/合成（composite）、图层、`transform`/`opacity` 走合成
- ○ 长任务、主线程阻塞、`requestIdleCallback`、Web Worker
- ○ 关键渲染路径、`preload`/`prefetch`/`preconnect`、code splitting
- ○ 图片格式与懒加载、字体 FOIT/FOUT、CDN、HTTP 缓存头

### 1.6 构建与依赖工程

- ★ Webpack 3 → 5 迁移的破坏性变更 [百度]
- ★ `SplitChunksPlugin`、runtime chunk 提取、共享依赖复用
- ★ 持久化缓存（filesystem cache）、构建耗时的度量方式
- ○ loader vs plugin、Tapable 钩子、构建生命周期
- ○ tree shaking 与 `sideEffects`、source map 各档位、模块联邦
- ★ Vite [Skills]：esbuild 预构建、原生 ESM dev server、Rollup 产物、HMR 原理
- ★ `package-lock.json` 被重新生成的机制、lockfileVersion、npm 随 Node 版本走 [百度]
- ★ 语义化版本、caret 的风险、`npm ci` vs `npm install`、版本锁定策略
- ○ peerDependencies、幽灵依赖、pnpm 的硬链接/隔离
- ○ bundle 分析、体积预算、monorepo（Turborepo/workspace）

### 1.7 测试与代码质量

- ★ Playwright [Skills][WinterFell]：定位器、自动等待、trace、headless Chromium 驱动
- ★ Jest / Vitest [Skills]：mock、spy、jsdom、快照测试的滥用
- ★ MSW mock 层：拦截原理、handler 组织、契约漂移风险 [BioMap]
- ★ 自定义 ESLint 规则、模块边界约束、AST 与 rule 编写 [BioMap]
- ○ Testing Library 哲学、测试金字塔/奖杯
- ○ CI 上的 flaky test、并行与 worker、重试策略
- ★ Storybook、CVA（变体 API）[BioMap]
- ○ 视觉回归测试、覆盖率指标的意义与局限

### 1.8 浏览器与 Web API

- ★ `getDisplayMedia`：标签页/系统音频捕获、权限、与 `getUserMedia` 的区别 [Beyz]
- ★ MediaStream、音轨、麦克风暂停与保活
- ○ AudioContext、AudioWorklet vs ScriptProcessor、采样率与重采样、PCM/Opus
- ★ WebSocket [Beyz][Skills]：握手、心跳保活、断线重连与退避、二进制帧、背压
- ○ WebSocket vs SSE vs 长轮询的取舍
- ★ `IntersectionObserver` [百度]；○ `ResizeObserver`、`MutationObserver`
- ★ jsBridge / WebView 与原生通信、iOS 与 Android 差异、URL Scheme [百度]
- ○ 同源策略、CORS 与预检、Cookie 的 SameSite/HttpOnly/Secure
- ○ XSS、CSRF、CSP、点击劫持
- ○ localStorage/sessionStorage/IndexedDB、Service Worker、PWA
- ○ 埋点与数据上报：`sendBeacon`、采样、页面卸载时机 [百度]

### 1.9 样式与设计系统

- ★ Tailwind [Skills]：原子化、JIT、设计令牌、`@apply` 的取舍
- ★ Radix UI [BioMap]：无样式组件（headless）、可访问性原语、Portal、焦点管理
- ★ 设计系统：组件 API 设计、变体、主题、令牌分层
- ○ CSS 层叠与特异性、BFC、Flexbox、Grid、容器查询、CSS 变量
- ○ 可访问性：语义化标签、ARIA、键盘导航、焦点陷阱、对比度

### 1.10 Vue / Angular

- ★ Vue 3 + TS [BioMap]：Composition API、`ref` vs `reactive`、`watch` vs `watchEffect`
- ★ Vue 2 [百度]：Options API、`Object.defineProperty` 响应式、数组变更检测的坑
- ★ Vue 2 与 Vue 3 的核心差异（Proxy 响应式、多根节点、生命周期改名）
- ○ Pinia / Vuex、Vue Router、虚拟 DOM 与 diff、`key`
- ○ SDK 集成（Luckysheet）、大型第三方组件的封装与卸载 [BioMap]
- ○ CLI 脚手架：模板、代码生成、约定式目录 [BioMap]
- ⚠ Angular [Skills]：模块、依赖注入、RxJS、变更检测、Zone.js、Signals —— **已有代码**：`~/Desktop/projects/Golang/Code/concept-tracker`、`~/Desktop/projects/Python/job-tracker`（Angular 22 默认 zoneless，别按 Zone.js 讲）

---

## 二、后端

### 2.1 Node 生态

- ★ NestJS [Beyz]：模块、依赖注入、Provider、守卫/拦截器/管道/异常过滤器
- ★ Fastify adapter vs Express、为什么选 Fastify
- ○ DTO、`class-validator`、生命周期钩子、Nest 的微服务与队列
- ○ Node 事件循环阶段、libuv、Stream 与背压、`cluster`/`worker_threads`
- ★ PM2：守护、重启策略、日志、多实例 [Beyz]
- ○ 内存泄漏排查、堆快照、GC 基本模型

### 2.2 Python 生态

- ★ FastAPI [Periplus]：Pydantic v2、依赖注入、`async def` vs `def`、后台任务
- ★ 自动生成 OpenAPI schema → 前端类型生成的链路 [Periplus]
- ○ ASGI vs WSGI、uvicorn、并发模型、GIL、asyncio（task/gather/超时/取消）
- ★ pytest [Periplus]：fixture、参数化、monkeypatch、collect、461 个测试怎么组织
- ○ SQLAlchemy、Alembic 迁移、连接池
- ⚠ Django [Skills]：ORM、中间件、DRF、admin —— **已有代码**：`~/Desktop/projects/Python/job-tracker/server`

### 2.3 API 与协议

- ★ 类型化的阶段契约（stage contract）与编排器解耦 [Periplus]
- ★ OpenAPI → 客户端类型生成、契约漂移的防护 [Periplus]
- ★ tRPC vs REST vs GraphQL 的取舍 [Beyz]
- ○ REST 设计：资源建模、幂等性、状态码、分页、版本化
- ⚠ GraphQL [Skills]：schema/resolver、N+1 与 DataLoader、over/under-fetching、订阅
- ○ HTTP/1.1 vs 2 vs 3、keep-alive、TLS 握手
- ○ WebSocket 服务端：连接管理、房间、水平扩展与粘性会话

### 2.4 数据库与检索

- ★ PostgreSQL [Beyz][Periplus]：索引类型、`EXPLAIN`、事务与隔离级别、MVCC、锁
- ★ pgvector [Periplus]：向量列、距离度量（cosine/L2/内积）、IVFFlat vs HNSW、召回率与参数、维度
- ★ 把运行状态、阶段产物、证据缓存落库的设计（断点续跑的前提）[Periplus]
- ★ Drizzle ORM [Beyz]：schema 定义、类型推导、迁移、与 Prisma 的差别
- ○ 连接池、慢查询定位、JSONB、部分索引、迁移的向前兼容
- ○ SQL：join、聚合、窗口函数、事务、死锁
- ⚠ MongoDB [Skills]：文档模型、聚合管道、索引、事务
- ○ Redis：缓存模式（cache-aside）、分布式锁、过期与淘汰策略

### 2.5 认证、支付与 Webhook [Beyz]

- ★ Stripe Checkout Session、试用（trial）、一次性买断 vs 订阅
- ★ webhook 签名校验、六个订阅事件、事件幂等、乱序与重放
- ★ entitlement（权益）模型：谁能写、买断不可被降级的约束怎么落地
- ★ 短期凭证：60 秒、usage-scoped key、最小权限、前端永不持长期密钥
- ○ 密钥轮换、服务端代签、凭证泄漏的爆炸半径
- ○ JWT vs session、OAuth2 / OIDC、RBAC
- ○ 对账、退款、争议、SCA/3DS、税与货币
- ○ 计量与配额：按请求记 token 用量、配额扣减的一致性

### 2.6 并发、可靠性与状态

- ★ 请求锁 + 防御性兜底、2,000+ 峰值 QPS 的含义（测的是哪一层）[百度]
- ★ 幂等性与防重复提交、乐观锁 vs 悲观锁
- ★ 四状态机丢弃重叠生成：状态建模、竞态、取消传播 [Beyz]
- ★ 断点续跑：从最后一个完成阶段恢复、阶段产物持久化 [Periplus]
- ★ 预算控制：单次运行的 token 预算与时间预算 [Periplus]
- ○ 限流（令牌桶/漏桶）、熔断、退避重试、超时分层
- ○ 一致性与最终一致、事务边界、补偿/Saga
- ○ 可观测性：结构化日志、指标、分布式追踪、告警阈值

### 2.7 部署与 CI/CD

- ★ Docker [Beyz]：镜像分层、多阶段构建、体积优化、健康检查
- ★ GitHub Actions [Beyz]：workflow/job/step、缓存、矩阵、secrets、CI 门禁（lint/typecheck/build）
- ★ cron 触发的定时任务：漂移、重复触发、幂等、时区
- ○ EC2 上的部署形态、进程守护、零停机重启、回滚
- ⚠ AWS [Skills]：EC2/S3/IAM 的基本模型；⚠ Cloudflare：CDN、Workers、缓存规则
- ⚠ Jenkins [Skills]：pipeline、agent、与 GitHub Actions 的差别
- ○ 蓝绿/金丝雀发布、发布检查清单、版本锁定（你那条 P2 的后续动作）[百度]
- ⚠ Go [Skills]：goroutine、channel、select、context、GC —— **已有代码**：`~/Desktop/projects/Golang/Code/concept-tracker`（手写 SQL，和 job-tracker 的 Django ORM 正好成对照）

---

## 三、图形学 [WinterFell]

### 3.1 渲染管线基础

- ★ draw call：为什么贵、和三角形数的权衡
- ★ 剔除：视锥剔除（frustum culling）、背面剔除、遮挡剔除
- ★ bounding volume（包围盒/包围球）与剔除粒度
- ○ 顶点着色器 → 光栅化 → 片元着色器、深度测试、混合、MSAA
- ○ 状态切换成本、批处理（batching）、GPU 与 CPU 瓶颈的判定
- ○ LOD、几何合并、纹理图集

### 3.2 WebGL / WebGPU

- ★ WebGPURenderer 同时驱动 WebGPU 与自带 WebGL2 backend 的意义
- ★ 为什么 TSL 节点管线在经典 WebGLRenderer 上跑不了
- ★ 降级策略：能力检测、fallback 不静默劣化
- ○ WebGPU：pipeline、bind group、command encoder、显式资源管理、计算着色器
- ○ WebGL2 的能力边界、扩展、上下文丢失
- ○ 浏览器支持矩阵、`navigator.gpu` 检测

### 3.3 three.js / React Three Fiber

- ★ TSL（three shading language）节点系统、`pass`、后处理链
- ★ bloom pass、tone mapping、HDR、阈值参数
- ★ 材质的 program key 与 shader 重编译：什么会触发全场景重编译
- ★ 雾（fog）属于材质 program key 的一部分——你那个卡顿 bug 的根因
- ★ R3F：JSX 声明式重建对象的代价 vs 直接 mutate 现有对象
- ★ `useFrame`、渲染循环、Canvas、R3F reconciler
- ○ 场景图、`Object3D`、Mesh/Geometry/Material、相机、灯光、纹理与采样器
- ○ `renderer.info`（draw call / triangle 统计）、每帧管线构建计数探针
- ○ 资源释放：`dispose`、内存泄漏、纹理与几何体的生命周期

### 3.4 实例化与性能测量

- ★ `InstancedMesh`：共享矩阵集、per-instance 变换、代价是丢失逐实例剔除
- ★ 129 → 76 draw call、三角形提交 2.6×：这组数字怎么采的
- ★ headless Chromium 逐帧采样渲染器统计的做法
- ○ 帧时间 vs FPS、百分位（p95/p99）、微基准的陷阱
- ○ GPU instancing 的替代方案：合并几何、BatchedMesh、剔除自己实现

### 3.5 物理与循环

- ★ Cannon [WinterFell]：刚体、碰撞体、broadphase
- ○ 固定时间步、累加器、插值/外推、物理与渲染解耦
- ○ 连续碰撞检测、穿透、休眠

### 3.6 数学

- ○ 向量/矩阵、模型-视图-投影、坐标系与手性、NDC
- ○ 四元数、欧拉角与万向锁、`slerp`/`lerp`
- ○ 法线矩阵、齐次坐标、投影矩阵与近/远平面、深度精度
- ○ 曲线与缓动、噪声（Perlin/Simplex）

### 3.7 程序化生成

- ★ 1,020 个布局的可达性扫描：横向可达距离 vs 该关速度
- ★ 约束保证（最窄间隙 ≥ 15 单位）与随机散布对照组
- ○ 种子与可复现随机、参数扫描、失败样本的定位
- ○ 难度曲线、可玩性验证、生成器的回归测试

### 3.8 色彩与后期

- ○ 线性空间 vs sRGB、color management、gamma
- ○ tone mapping 算子、曝光
- ○ 雾类型（linear / exp2）与调色板切换的关系

---

## 四、AI [Periplus][Beyz]

### 4.1 LLM 基础

- ★ token 与 tokenizer、上下文窗口、成本模型（输入/输出计价）
- ★ 流式输出：逐 token 返回、SSE vs WebSocket、TTFT
- ★ 每请求 token 用量记账与按套餐配额 [Beyz]
- ○ temperature / top-p / 采样、停止条件、seed 与确定性
- ○ system/user/assistant 角色、prompt 结构、few-shot
- ○ function calling / tool use、并行工具调用
- ○ 幻觉、知识截止、长上下文衰减（lost in the middle）
- ○ 模型选型与降级（provider 不可用时怎么办）

### 4.2 RAG 与检索

- ★ 证据与判断分离：research 阶段只产出「claim + 原文引文」，verification 阶段裁决
- ★ 引用成员校验、时效窗口——由应用代码而非 prompt 强制
- ★ 无引文的 claim 不得前进：这条约束落在哪一层
- ★ embedding、向量检索、pgvector 证据缓存
- ○ 分块（chunking）策略与重叠、元数据过滤
- ○ 相似度度量、召回 vs 精排、rerank、混合检索（BM25 + 向量）
- ○ 上下文压缩、检索失败模式（漏检、噪声、过期）
- ○ grounding、attribution、引用可验证性

### 4.3 结构化输出

- ★ Structured Outputs [Skills]：JSON mode、schema 约束、Pydantic 校验
- ○ 约束解码、重试与修复策略、部分解析
- ○ schema 演进与向后兼容

### 4.4 编排与 Agent

- ★ 六阶段流水线：research / verification / planning / writing / editing / illustration
- ★ 编排器只认类型化阶段契约（不认阶段内部实现）
- ★ 运行状态与阶段产物持久化、崩溃后从最后完成阶段恢复
- ★ 每次运行的 token 与时间预算
- ★ **agentic workflow vs multi-agent system**：控制流由代码写死还是由模型决定——本项目 `STAGE_ORDER` 是硬编码 tuple、零 tool call，属前者；简历的措辞按此选定，**简历索性把 “agentic workflow” 换成了更朴素的 “Six-stage LLM pipeline”，同一个判断走得更远**
- ○ 多智能体 vs 单模型多轮：收益与代价
- ○ 阶段并发、限流、失败重试与死信
- ○ 人类介入（human-in-the-loop）、审批点

### 4.5 评测（Evals）

- ★ golden set（黄金集）：冻结 brief、冻结检索页面、冻结时钟
- ★ 断言区间而非字面输出——为什么不能比对字符串
- ★ 指标：证据缺口率、引用完整性、token 成本
- ★ prompt 或控制流改动 → before/after 逐指标 diff
- ★ 脚本化接缝（seam）：模型 provider、搜索、页面抓取、时钟全部可替换 → 无 key 无网络可跑
- ★ 461 个测试、1.5 秒跑完：确定性从哪来
- ○ 离线评测 vs 线上评测、A/B、影子流量
- ○ LLM-as-judge 及其偏差、人工标注、标注一致性
- ○ 回归门禁：指标劣化是否阻断合并

### 4.6 可靠性与安全

- ○ 提示注入（prompt injection）、间接注入（网页内容里的指令）、越狱
- ○ 输出过滤、PII、数据留存与合规
- ○ 供应商依赖、速率限制、退避、缓存、成本失控的防线

### 4.7 语音与实时识别 [Beyz]

- ★ Deepgram 流式识别：interim（临时）vs finalized（最终）转写
- ★ 客户端侧的转写对账（reconcile）——为什么需要
- ★ utterance-end 事件触发生成：端点检测的意义
- ★ 麦克风暂停期间保活 socket
- ○ VAD（语音活动检测）、端点检测阈值与延迟取舍
- ○ 词错误率（WER）、说话人分离（diarization）、领域词表
- ○ 音频编码、分片大小与延迟、丢包与重传

---

## 附录：⚠ 汇总——只在 Skills 行出现、本机无代码

~~Go~~、~~Angular~~、~~Django~~、MongoDB、AWS、Cloudflare、Jenkins。

（GraphQL 已从这份名单删除：Skills 行里没有这个词，此前是照更早的版本抄下来的。）

Go / Angular / Django 三个已经有本机代码撑着（concept-tracker、job-tracker），从这份名单里划掉——讲法和追问答案在 `skills/LEARNING_NOTES_SKILLS_DAY13.md`。

**剩下四个 —— 2026-08-18 已定：留在简历上。** 既然留着，就必须能用概念答住：知道它解决什么问题、什么时候选它、和你实际用过的东西差在哪。最低限度的答法写在上面那份笔记第 9 节。被追问细节时的标准句式是「这条我是了解层面，实际做过的是 X」。**装成用过才是真的会被拆穿。**（AWS 其实不算零支撑：Beyz 的邮件服务部署在 EC2 上，那条 bullet 就写着。）

---

## 建议的过法

1. 先只做一件事：从头到尾划掉「一眼就能讲三分钟」的条目。
2. 剩下的分两堆——★ 的是必须补的，○ 的是有余力再补。
3. ★ 里再挑出**数字类**的（5M PV、30→60 FPS、2,000 QPS、15%、70%、129→76、1,020、461、1.5 秒、60 秒、二十个场景；2.6×、15 单位、六事件、500ms 已下简历，但相邻话题仍会问）——这些一定被追问「怎么测的」。
4. 过完这一遍再进项目串讲和模拟追问。
