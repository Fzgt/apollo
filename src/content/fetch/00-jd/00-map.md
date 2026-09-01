---
title: 这场面试考什么
section: Fetch
icon: paw-print
---

# 这场面试考什么

> 2026-09-10 周四 10:00，一小时，对面是联创兼 CTO Foo Xin 加一个工程师。他们手上的简历是 **v42**，不是桌面上那份 v72。
>
> 这一篇定优先级，后面四篇按优先级展开。**2026-09-01 重排过一次**：第一版把设计系统、design tokens、无障碍抬成了主考点，那是跑偏的。

## 结论：主干是 React + TypeScript + 前端性能

岗位名就叫 **Frontend Engineer (React)**。About you 一节里唯一的硬要求只有一句：

> **Strong React + TypeScript fundamentals**

其余的 taste、product thinking、curiosity 全是软条件，design systems / mobile / performance tuning 三样明确写在 **Bonus** 里。而**性能在这份 JD 里出现三处**：Frontend 那行、独占一条的 "Make the app feel fast"、以及 Bonus 里的 performance tuning。

所以复习的权重是：

| 层 | 内容 | 说明 |
| --- | --- | --- |
| **主干** | React + TypeScript 基础 | JD 唯一的硬要求，也是最容易被现场追问细节的一块 |
| **主干** | 前端性能优化 + 我自己做过的性能工作 | JD 提三次；我弹药最足的一块，要主动往这里带 |
| **配角** | 前端地基四词：routing / state management / observability / feature flags | 大概率是 CTO 本人写的，一面很可能从这里问 |
| **锦上添花** | 设计系统、AI 界面、测试与架构 | 有实证、能讲，但不是主战场；各准备一个 90 秒的故事就够 |
| **不考** | 算法、数据结构、刷题 | JD 从头到尾一个字没提 |

## 五处在问「你凭什么判断」

这份 JD 有五处在问判断力：quality bar（标准由你定并且往上抬）、great taste（布局、间距、动效）、product thinking（在乎用户目标而不只是实现）、constructive feedback（在 Figma 里给设计师提意见）、debate with founders（鼓励跟创始人争论）。

**他们要的不是"给需求就写代码"的人，是能对好坏下判断并且说得出理由的人。** 只会答"我加了 `React.memo`"的候选人，和能答"这里我没加 memo，因为重渲染本身不贵，贵的是重渲染里那次布局计算，我改的是那个"的候选人，在 CTO 眼里是两种人。

**这条对答题方式的要求：每个技术回答后面挂一句取舍。** 不是"我用了 X"，是"我在 X 和 Y 之间选了 X，因为当时的约束是 Z，代价是 W"。

## 主备场：四个词对四段经验

JD 那句 `Make the app feel fast: performance, rendering, loading states, perceived speed` 的四个词，正好是四个不同层，也正好对上我四段不同的经验。**这是我的答题纸**，展开在《前端性能》那篇：

| JD 的词 | 层 | 我的证据 |
| --- | --- | --- |
| performance | 加载与体积 | 百度 P2 白屏排查链；Webpack SplitChunksPlugin 分包 + 持久化缓存 |
| rendering | 渲染与帧 | 手写 `useVirtualList` + `IntersectionObserver`，5M 日 PV 信息流 30→60 FPS |
| loading states | 等待期的界面 | BioMap 的 TanStack Query 三层，loading / error 编排 |
| perceived speed | 主观快慢 | 悬停预取，详情页零请求打开；Beyz 逐 token 流式 |

## 三个真空白，提前想好说法

- **React Native**——零经验，别装。最近的桥是小度那套 H5 嵌原生壳 + jsBridge。
- **Accessibility**——简历上零。靠 Radix 接住（焦点管理、ARIA、键盘契约都在里面），承认自己没做过系统审计。
- **GCP**——我是 AWS。概念可迁移，前端岗不致命，但不要声称用过。

另外两个半空白：**Core Web Vitals 的现场数据**（我只有实验室数据）和 **feature flags**（只有 Beyz 的套餐门禁可作类比）。

## 开场和收尾的两件事

- **v42 简历抬头没有签证行**，只有 email / 电话 / GitHub，没有 485、没有 LinkedIn、没有 Sydney。**从 PDF 上看不出我有工作权，自我介绍要主动带一句 485 全职工作权。**
- **面试前自己走一遍他们的报价流程**（`get.fetchpet.com.au/quote`，Next.js 跑在 GCP；官网 `www.fetchpet.com.au` 是 Framer 搭的，两回事）。带 2–3 条具体观察进去——loading state、键盘可达性、感知速度。**这是唯一能证明我真看过他们产品的东西**，也是 JD 要的 craft。反问可以问：Framer 官网和 Next 产品之间设计系统怎么统一、token 谁维护。

## 一页对照表（按新权重排）

| JD 的要求 | 我手上的证据 | 强度 |
| --- | --- | --- |
| **React + TypeScript fundamentals** | 三段公司经历 + 两个完整项目全在 React/TS 上 | 强，但要能讲原理不只是用法 |
| **性能：rendering** | 虚拟列表 30→60 FPS；WinterFell 的雾 freeze 与实例化合并 | 强 |
| **性能：perceived speed** | 悬停预取，详情页零请求打开；Beyz 逐 token 流式 | 强 |
| **性能：加载与体积** | Webpack 3→5，分包 + 持久化缓存，体积 −15%、热构建 −70% | 强，但数字要说得出怎么量的 |
| **性能：loading states** | 只有 TanStack Query 的 loading/error 编排，没有骨架屏/乐观更新的记录 | **半空白，靠判断标准补** |
| **性能：现场指标（CWV / RUM）** | 无，只有实验室数据 | **空白，必须准备说法** |
| 地基：state management | TanStack Query 三层封装、cache key 单源、mutation 驱动失效 | 强 |
| 地基：routing patterns | 有实践但不在简历上（Apollo、Periplus 的 URL 状态） | 中 |
| 地基：observability | 只有 Beyz 的 token 用量计量，不是同一件事 | **弱** |
| 地基：feature flags | 无，只有 Beyz 的套餐门禁可作类比 | **空白** |
| AI 界面：structured outputs / explainability | Periplus 的 claims 绑引文、证据与判断分离、独立验证阶段 | 强 |
| AI 界面："what happened" 状态 | Beyz 的 interim/finalized 对账、四状态机、逐 token 流式 | 强 |
| 设计系统：components | BioMap 的 Radix + Storybook + CVA | 强（当故事讲，不当课题复习） |
| 设计系统：tokens / a11y | 只有 Tailwind theme 原始层；a11y 靠 Radix | 弱，承认边界即可 |
| 测试 / 架构 | Periplus 406 个测试、脚本化接缝、黄金集；Beyz 的 CI 门禁 | 强 |
| cross-browser | WinterFell 的 WebGPU→WebGL2 降级 | 强 |
| 3–5 年经验 | 两年多 + 两个完整项目，用 JD 自己写的 "or equivalent through projects" 接 | 中 |

**最后一行 Bonus 写着 "build something cool for Fetch"**——投递时没做，九天够做一个部署到 Vercel 的小东西。
