---
title: 三期四期知识点梳理
section: 课程与旧笔记
icon: file-text
---

# 三期 / 四期高阶实战 —— 索引

> 原始笔记是跟课随手记的口语速记。技术内容已经按主题重新整理成六篇独立文章，这一页只留**课程本身的脉络**、作业、书单，以及没有进博客的边角内容。

---

## 技术内容去哪了

课程覆盖的六个主题各自成篇，每篇都补齐了当时笔记里省略的细节，并订正了这几年已经过时的说法：

| 主题 | 文章 |
|---|---|
| Serverless 架构 —— BFF/SFF、Cloudflare Workers vs AWS Lambda、IPFS、Service Worker 与 Workbox、边缘 SSR | [#79 Serverless 与边缘部署](https://github.com/Fzgt/Blog/issues/79) |
| Monorepo 工具链 —— pnpm 软硬链原理、workspace、Lerna / Nx / Rush 分工、verdaccio 私仓、lockfile 拆分取舍 | [#80 Monorepo 与私仓](https://github.com/Fzgt/Blog/issues/80) |
| 状态管理库全景 —— Redux / MobX / Recoil / Jotai / Zustand / Valtio / XState、状态撕裂与 `useSyncExternalStore` | [#78 React 状态管理库全景](https://github.com/Fzgt/Blog/issues/78) |
| Webpack 拆包 —— runtime 抽离、cacheGroups、单 entry 为什么拆不动、体积判断标准、lazy compilation | [#81 Webpack 拆包实战](https://github.com/Fzgt/Blog/issues/81) |
| React 18 并发特性 —— useTransition / useDeferredValue、RSC、流式渲染、Next.js vs Remix、React Query、路由预加载 | [#82 React 18 并发特性与现代 SSR](https://github.com/Fzgt/Blog/issues/82) |
| 组件库开发体验 —— Storybook、Tailwind 原子化的真实收益与代价、MSW | [#83 组件库开发体验](https://github.com/Fzgt/Blog/issues/83) |

**六篇里订正的过时说法**（原笔记录于 2022 年）：Recoil 已于 2025 年 1 月归档不再维护；Jotai v2 起可以脱离 React 使用，"只能在组件内用"不再成立；Redux 的样板代码批评针对的是 RTK 之前的写法；MobX 6 起装饰器非必需，但它至今没解决状态撕裂；XState v5 换成 Stately Editor 且与 v4 不兼容。详见 [#78](https://github.com/Fzgt/Blog/issues/78) 末尾的汇总表。

---

## 课程脉络

**三期高阶实战**按主题推进：Serverless（Cloudflare / AWS / IPFS）→ 前端架构 + 后端架构（小程序 Serverless）→ 状态管理库综述 + pnpm → 私仓搭建与 pnpm + Lerna 初始化 → 进阶发包 → 重复渲染与精英班回顾 → Zustand + Immer → 主流前端技术回顾 → 性能监控 SDK → Webpack 拆包 → 手写 React。

**四期高阶实战**收敛到三条线：私仓（verdaccio / lerna / pnpm / nx / rush）、状态管理（Jotai / Zustand / XState）、组件库（Storybook / Tailwind / React 18）。

精英班五个月的整体安排：阶段一主流前端技术；阶段二图形学、Web AI、Rust、Python、区块链入门、V8；阶段三区块链、合约、DApp。GraphQL 单独留意。

---

## 作业

**一、Serverless 全链路实操**

1. 用 CRA 创建 React + TS 项目
2. 创建 Cloudflare Worker 写一个接口，输出一段 JSON，用 esbuild 编译后上线
3. 加一个 task，每三分钟变化一次输出数据
4. 前端用 Git 连 Workers Pages 部署，请求上面那个 Worker
5. 前端用 Workbox 做离线缓存 —— 目标是**服务端关不关都不影响页面可用**

配套思考题：网络层的 HTTP 强缓存、本地缓存（localStorage）、Workbox 的离线全缓存，三者在项目里各自怎么用，核心区别是什么？（答案整理在 [#79](https://github.com/Fzgt/Blog/issues/79) 第四节）

**二、自我盘点**：把这些年下来自己的优点、缺点、拿得出手的技术点整理成一份文档。

---

## 面试相关的课堂建议

- **技术栈里必须有一个真正专精的东西。** 什么都能聊两句、一深入就熄火，是面试里最致命的点。反过来，只要有一块细节比面试官还熟，这场就赢了。
- **简历上要有跟 Node 沾边的项目**，并且能把基于 SFF 的东西讲明白。写了 Node 基本必问 **libuv 原理**和**部署同构 JS 时最大的问题是什么**。
- **高级前端的深度方向**：Chrome / WebKit / V8 三件套的设计架构。Chrome 官方的 YouTube 频道（Chrome Labs / Chrome for Developers）是一手资料。
- **可以写进简历的架构**：混合云 + 消息队列 + 多级缓存的小程序 Serverless 架构 —— 同时回答了成本、抗突发 QPS、抗 DDoS 和防爬四个问题。展开见 [#79](https://github.com/Fzgt/Blog/issues/79) 第六节。
- **要聊 Vue 的话**，思路和表达方式参考课程里那段（FRP 函数响应式编程是切入点之一）。

---

## 没有进博客的边角内容

### 单元测试

- 项目里有意打印的 `console.error`（比如测异常分支），在 Node 环境跑单测时可能直接被判定失败。可以在 Jest 里提前 mock / 拦截所有 `console.error`。
- **给别人用的工具类库，测试覆盖率要求接近 100%** —— 今天出 bug 明天报错，没人敢用。这是单测存在的核心意义之一。

Jest 常用配置项速查：

| 配置 | 作用 |
|---|---|
| `verbose` | 展示编译细节 |
| `testEnvironment` | 测试环境（node / jsdom） |
| `collectCoverage` / `collectCoverageFrom` | 是否收集覆盖率、收集哪些文件 |
| `coverageReporters` | 覆盖率产物格式（html / json） |
| `testPathIgnorePatterns` | 忽略哪些路径 |
| `testRegex` | 匹配测试文件 |
| `transform` | 遇到 ts 文件调度 ts-jest |
| `moduleFileExtensions` | 哪些扩展名可以省略 |
| `setupFilesAfterEnv` | 往全局注入 Jest 本身没有的东西 |

TS 配置直接 `extends` 社区的 **`@tsconfig/recommended`**，比手动粘贴强 —— 它会跟着 TS 版本更新，你只需要升这个包的版本。

### 语言与运行时

- **Atomics**：JS 的线程锁相关 API，配合 `SharedArrayBuffer` 做多线程同步。
- **TensorFlow.js / Web AI**：把别人训练好的模型直接在浏览器里加载运行。
- **class component**：未来可能被官方逐步淘汰，新项目直接函数组件 + hooks。
- **TS 里不用再写 `React.FC`**：现在的类型定义默认就把函数组件当 FC 处理，显式声明是多此一举。

### 学习渠道

- 资讯：dev.to、bestofjs、Twitter
- 练习：[type-challenges](https://github.com/type-challenges/type-challenges)（TS 类型体操）、[bigfrontend.dev](https://bigfrontend.dev/)（手写题）
- 性能：[web.dev](https://web.dev/) 的性能系列建议通读
- Storybook 的新玩法看它自己的 [blog](https://storybook.js.org/blog/)

### 书单

《非暴力沟通》《疯狂的程序员》《编程之美》《编程珠玑》《自制编译器》—— 其中《编程之美》讲的是场景式面试题，面试准备阶段值得翻。
