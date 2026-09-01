---
title: 配角：设计系统 · AI 界面 · 其余名词
section: Fetch
icon: paw-print
---

# 配角：设计系统 · AI 界面 · 其余名词

> 这三块都不是主战场，但各有一个 90 秒的故事要准备好。**设计系统这一块 2026-09-01 压缩过**——第一版按复习课题写，展开了 token 三层结构和十个 ARIA 模式，那是把配角当主角。

## 一、设计系统：一个故事，不是一门课

JD 里它出现三次（Frontend 那行的 "modern component patterns"、"Help evolve our design system (components, tokens, accessibility patterns)"、以及 What you'll help build 里的 "A consistent component library and design system that scales"）。**它是 Bonus，但它是我唯一有实证的那张牌**——所以定位是：能讲一个具体的故事，不用背理论。

**注意动词是 evolve（演进）不是 build（从零建）**，说明他们已经有一套，要的是能在既有约束里往前推的人。这句可以直接说出口：我会先读他们现有的 token 命名和组件边界，而不是上来就重写。

### 我的 90 秒版本（BioMap）

我建的是 **Radix UI + Storybook + CVA**：

- **Radix 是无头组件（headless）**——只给行为、状态和无障碍属性，不带样式。选它的一部分原因就是无障碍：对话框的焦点陷阱和焦点归还、菜单的漫游 tabindex 这类东西，自己写很容易只做对一半。
- **CVA 管的是"一个组件有哪些变体"，不是"这些变体的取值从哪来"。** `variant: { primary, secondary, ghost }` 是组件 API 的形状问题；`primary 到底是哪个蓝` 才是令牌问题。**这两件事经常被混为一谈，混了就答错。**
- **Storybook 是组件的合同页**：变体、边界情形、空态错误态都在里面，设计师和后端都能直接看。

### "Modern component patterns" 指的是这几个词

JD 在 Frontend 那行写了 modern component patterns，核心问题只有一个：**怎么让组件既好用，又不在需求变化时被迫加第 20 个 prop。**

- **受控 / 非受控**：`value` + `onChange` 还是 `defaultValue`，好的组件两种都支持。
- **复合组件（compound components）**：`<Select>` `<Select.Trigger>` `<Select.Content>` `<Select.Item>`，结构交给使用者拼，内部靠 Context 通信。它解决的正是"我要在触发器和内容之间插点东西"这类需求。
- **无头组件（headless）**：Radix、Headless UI、TanStack Table。**设计系统的理想底座**——样式归令牌管，行为和无障碍归库管。
- **`asChild` / 多态组件**：把行为"贴"到传进来的元素上，避免 `<a>` 外面又包 `<button>` 这种嵌套错误。
- **插槽（slots）**：`<Card header={...} footer={...}>`。

**被问"你怎么设计组件 API"，讲 Radix 的复合结构是最短路径**——用过它就等于消费过复合组件和 `asChild`。

### 被追问 tokens 时的诚实版本

令牌体系成熟的形态是三层：**原始层**（`blue-500 = #1E88E5`，只起名字）→ **语义层**（`color.action.primary → blue-500`，带用途，暗色主题在这一层换指向）→ **组件层**（`button.primary.background`，只在需要脱离语义层时才建）。

**我停在第一层。** Tailwind 的 `theme.extend` 确实是令牌，但通常只有原始值；语义层我没做，主题切换的需求当时也没出现过。

**能直接说的答法：** 组件层和变体 API 是完整的，令牌那层停在 Tailwind theme 的原始值上，没做语义层。如果现在做，我会先把语义层补上——它是暗色模式和跨平台（你们有 React Native）唯一便宜的做法：令牌以 JSON 存在，编译期分别产出 Web 的 CSS 变量和 RN 的 JS 对象，两端才可能长得一样。

**这个答法的价值在于它没有假装。** 承认停在哪一层，同时说得出下一层是什么、为什么需要——比含糊地说"我们有一套 design token"强，因为后者一追就穿。

### 无障碍：承认边界，靠 Radix 和两条基线接住

**我简历上一个 accessibility 的字都没有。** 事实是：我交付过带有这些行为的界面（焦点陷阱、焦点归还、漫游 tabindex、`aria-*` 的正确挂载、Esc 和方向键的键盘契约都在 Radix 里），只是没有从零手写过它们的实现，也没有做过系统性审计。

**说得出这三条就够了，不用背 ARIA 属性名：**

- **语义化元素优先**——能用 `<button>` 就不要 `<div onClick>`。原生元素自带角色、键盘行为和焦点管理。**ARIA 的第一条规则就是"能不用 ARIA 就不用"。**
- **键盘走查**——把鼠标拿开，只用 Tab / Shift+Tab / Enter / Space / 方向键 / Esc 走完一条主流程。**最便宜也最有效的一招，说这句比背属性名有分量。**
- **`outline: none` 而不给替代焦点样式，是最普遍的无障碍错误**；`:focus-visible` 能做到鼠标点击不显示焦点环、键盘操作显示。

被追问"那你打算怎么补"，答案是现成的：先上 `eslint-plugin-jsx-a11y` 挡低级错误，再对理赔这条主流程做一次纯键盘走查，两件事都不需要排期。**顺带一句现实理由：保险是受监管行业，理赔表单是最容易被无障碍投诉的地方**，澳洲的基线是 WCAG 2.1 AA。

## 二、AI 功能的界面

JD 原文：`UI for AI-powered features (structured outputs, explainability, clear "what happened" states)`。

**这是我和这个岗位对位最准的一块，而且 v42 简历上全都在。**

### Structured outputs（结构化输出）

指让模型输出严格符合某个 schema 的 JSON，而不是自由文本。做法是把 JSON Schema 交给模型（OpenAI 的 Structured Outputs、工具调用的参数定义），或者用 Zod / Pydantic 在应用层校验并在失败时重试。

**它为什么是个前端问题：** 只有输出是结构化的，界面才能渲染成组件而不是一坨 markdown。一段自由文本只能塞进气泡框；一个带类型的对象可以变成卡片、表格、可点的链接、可编辑的表单。**"AI 功能的 UI 做得好不好"，一半取决于输出结构设计得好不好。**

**我的证据：** 技能栏上直接写着 Structured Outputs。Periplus 里研究阶段产出的是**绑定到原文精确引文的 claims**，那就是结构化输出的实例——每条断言是一个带来源的对象，不是一段话。

### Explainability（可解释性）

指让用户看得见"这个结论从哪来"。在界面上表现为：引用来源并可点开、显示置信度、显示模型用了哪些输入、允许用户展开中间步骤。

**为什么保险公司特别在乎这个：** 理赔决定如果由 AI 参与，用户必须能看到依据，否则不会信任，监管上也过不去。JD 把 explainability 和 claims 写在同一份文档里，不是巧合。

**我的证据，逐字对得上：**

- Periplus **把证据和判断分开**：研究阶段产出绑定精确原文引文的 claims，**一个独立的验证阶段**对它们做裁决，而且**由应用代码而不是提示词**强制执行引文归属和时效窗口。**没有支撑引文的断言不会进入下一阶段。**
- 这正是 explainability 的工程实现：不是让模型自己说"我很确信"，而是让系统在结构上保证每个结论都能追到来源。

**这一段是我全场最值钱的两分钟，应该主动讲，不要等他们问。**

### 清晰的 "what happened" 状态

指 AI 功能运行中和结束后，界面必须让用户知道系统当前处于什么状态：在想、在检索、在生成、已完成、失败了、结果被替换了。**AI 功能天然是异步、长时、可能失败、可能被打断的，这些状态如果不显式表达，界面就会看起来像坏了。**

要处理的具体情形：

- **流式输出**：逐 token 显示，用户看到进展而不是等待。
- **中间态与最终态的区分**：临时结果和确定结果不能长得一样。
- **打断与替换**：用户改了输入，上一次还没结束的生成怎么办。
- **失败与重试**：失败要说清是超时、被拒还是没有可用证据。
- **可访问性的交叉点**：流式内容对屏幕阅读器是灾难——每来一个 token 都播报一次是不可用的。正确做法是用 `aria-live="polite"` 且只在段落或整段完成时更新，或者提供"读完整结果"的入口。

**我的证据（Beyz，v42 上写得很细）：**

- 转写的**临时结果（interim）和确定结果（finalized）在客户端做对账（reconcile）**——这正是"中间态和最终态要区分"这件事的工程实现。
- **一个四状态机丢弃重叠的生成**——这正是"用户改了输入、上一次生成还在路上"这个问题的解法。
- 语音停顿事件（utterance-end）触发 GPT-4o 的回答，**逐 token 流式返回**。

**把 4.1、4.2、4.3 串成一个回答，是我能给出的最强的一段：Periplus 负责"结论可追溯"，Beyz 负责"过程可理解"，两个项目正好覆盖 JD 那一行的三个词。**

---

## 三、其余名词

- **TypeScript / React**：JD 写的是 "Strong React + TypeScript fundamentals"，fundamentals 意味着问原理不只是用法——单独一篇《React + TypeScript 基础》，那是主干。
- **Next.js**：React 的全栈框架。要能说清 App Router、Server Components（不进客户端 bundle）、Server Actions、流式 SSR。**我在 Beyz 用的就是 Next.js + tRPC + Drizzle，付费链路整条在上面，这是硬经历。**
- **React Native**：用 React 写原生移动应用。**我没有。** 但设计令牌那一节里"跨平台共用一份令牌"的论述，正是 Web 经验能迁移过去的部分，被问到时往这里接。
- **GCP（Google Cloud Platform）**：我用的是 AWS（Beyz 部署在 EC2，PM2 托管，GitHub Actions 发布）。云平台之间概念可迁移，不必回避，但也不要声称用过 GCP。
- **Figma**：JD 要求"能和设计师在 Figma 里协作并给出建设性反馈"。重点不是会用 Figma，是**看得懂设计稿里的间距和层级，并且能指出哪里在实现上代价过高或者哪里不一致**。
- **Responsiveness（响应式）**：断点、流式布局、容器查询（container queries）、移动优先、触控目标尺寸、安全区域。
- **Cross-browser behaviour（跨浏览器行为）**：Safari 一贯是最麻烦的那个（日期输入、滚动、`100vh` 与移动端地址栏、Flex/Grid 的边角）。**我这里有一张很硬的牌：WinterFell 的 WebGPU→WebGL2 降级不是"我在三个浏览器上测了一下"，而是"能力不同的机器上观感不掉"，这是跨浏览器问题最难的一种形态。**
- **Testing / review / thoughtful architecture**：Periplus 的 406 个服务端测试、每个外部依赖背后的脚本化接缝（无 API key 无网络也能跑完整系统、约一秒）、按黄金集（golden set）而不是靠肉眼评估流水线；Beyz 那个仓库的第一道 CI 门禁（lint、typecheck、build）；BioMap 用自定义 ESLint 规则强制功能边界。**这一块我比多数同级候选人强，要主动说。**
- **"Ship outcomes, not tickets"**：他们在说不要"做完就交"的执行者，要在乎结果的人。呼应的是 product thinking 那条。
- **"We say steward not owner"**：他们对"责任"的措辞选择——责任是真的，但用"受托者"而不是"所有者"来表达。这属于文化信号，不必技术性回应，但在反问环节里可以拿它做一个真诚的问题。
- **3–5 年经验**：我三段公司经历加起来两年多。**JD 紧接着写了 "or equivalent through projects"，那就是留给我的口子。** 不要自己去算年数，被问到就用这个框：三段公司经历，加上两个从第一行代码做到部署的完整项目。

---
