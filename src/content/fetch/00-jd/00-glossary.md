---
title: JD 术语逐条讲解
section: Fetch
icon: paw-print
---

# JD 术语逐条讲解

> 这一篇只做一件事：把 Fetch 那份 JD 里的每一个技术名词拆开讲明白——它是什么、具体包含哪些东西、一般用来解决什么问题——然后指出我简历（v42）上哪一条能接住它，哪一条接不住。
>
> 面试是 2026-09-10 周四上午 10:00，对面是联创兼 CTO Foo Xin 加一个工程师。他们手上的简历是 v42，不是桌面上那份 v72。

## 他们主要关注什么

先给结论。这份 JD 从头到尾没有一个字提到算法、数据结构或者刷题，但它有五处在问「你凭什么判断」：quality bar（质量标准由你来定并且要往上抬）、great taste（布局、间距、动效的品味）、product thinking（在乎用户目标而不只是实现）、constructive feedback（在 Figma 里给设计师提意见）、以及 debate with founders（鼓励你跟创始人争论）。

**这意味着他们招的不是一个"给需求就写代码"的人，而是一个能对 UI 好坏下判断并且说得出理由的人。** 一个只会答"我用了 React.memo"的候选人和一个能答"这里我没有用 memo，因为重渲染本身不贵，贵的是重渲染里那次布局计算，我改的是那个"的候选人，在 CTO 眼里是两种人。

JD 的技术要求可以归成四组，后面按这四组展开：

1. **设计系统**——components、tokens、accessibility patterns
2. **速度感**——performance、rendering、loading states、perceived speed
3. **前端地基**——routing patterns、state management、observability、feature flags
4. **AI 功能的界面**——structured outputs、explainability、清晰的 "what happened" 状态

---

## 一、设计系统（Design System）

### 1.1 设计系统是什么

设计系统是一套**被共同遵守的界面构建规则加上实现这套规则的代码**。它不等于组件库。组件库是「有哪些能用的零件」，设计系统还要回答「这些零件为什么长这样、什么时候该用哪个、改一处怎么让全站跟着变」。

一个完整的设计系统一般包含四层，从下往上：

| 层 | 内容 | 典型载体 |
| --- | --- | --- |
| 令牌层（tokens） | 颜色、间距、字号、圆角、阴影、动效时长的取值 | CSS 变量、Tailwind theme、Figma variables |
| 基础元素层（primitives） | Box、Stack、Text 这类只管布局和排版的原子 | React 组件 |
| 组件层（components） | Button、Input、Dialog、Table 等有交互语义的零件 | React 组件 + 文档 |
| 模式层（patterns） | 表单怎么排、空状态怎么写、错误怎么提示、页面骨架长什么样 | 文档 + 示例页 |

**JD 那句 "Help evolve our design system (components, tokens, accessibility patterns)" 正好点了其中三层。** 注意它用的动词是 evolve（演进）不是 build（从零建），说明他们已经有一套，要的是能在既有约束里往前推的人。这一点在面试里可以直接说出来：我会先读他们现有的 token 命名和组件边界，而不是上来就重写。

### 1.2 Tokens（设计令牌）——他点名要我讲的第一个词

**设计令牌是把界面里所有"魔法数字"抽出来、起上名字、存成一份数据的做法。** 代码里不再出现 `#1E88E5` 和 `16px`，只出现 `color.action.primary` 和 `space.4`。

它解决三个具体问题：

- **改一处全站生效。** 品牌色调整不需要全局搜索替换十六进制值。
- **主题可以切换。** 暗色模式不是再写一套样式，而是同一套语义名字指向另一组取值。
- **跨平台共用一份真相。** Fetch 的技术栈里有 React Native，Web 的 CSS 变量在 RN 里不存在；令牌以 JSON 存在，编译时分别产出 Web 的 CSS 变量和 RN 的 JS 对象，两端才可能长得一样。

#### 令牌的三层结构

这是被追问时最该讲清楚的部分。成熟的令牌体系一定是三层，不是一层：

```
第一层 原始层（primitive / global / core）
  blue-500 = #1E88E5      grey-900 = #111827      space-4 = 16px
  只是给取值起名字，不带任何用途含义

第二层 语义层（semantic / alias）
  color.action.primary        -> blue-500
  color.text.default          -> grey-900
  color.feedback.danger       -> red-600
  space.inline.md             -> space-4
  带用途含义。暗色主题在这一层重新指向别的原始值

第三层 组件层（component-specific）
  button.primary.background   -> color.action.primary
  input.border.invalid        -> color.feedback.danger
  只有当某个组件需要脱离语义层单独调整时才建
```

**为什么必须有第二层：** 如果按钮直接写 `blue-500`，那么"把主按钮从蓝色改成绿色"就要逐个组件改；有了语义层，只改 `color.action.primary` 的指向。反过来，**为什么第一层不能省**：语义层需要一个受控的调色板做后盾，否则每次新增语义都会引入一个没人审过的新颜色。

被问到"你们的 token 层长什么样"，如果对方期待的是这三层，而你只能描述一层，回答就露了。

#### 令牌有哪些类别

| 类别 | 常见条目 |
| --- | --- |
| 颜色 | 背景、前景（文字）、边框、图标、状态色（成功/警告/危险/信息）、交互态（hover/active/disabled/focus） |
| 间距 | 4/8/12/16/24/32… 的间距阶梯，分内边距（padding）与外边距（gap） |
| 排版 | 字体族、字号阶梯、字重、行高、字间距 |
| 圆角 | none / sm / md / lg / full |
| 边框 | 宽度、样式 |
| 阴影（elevation） | 层级越高阴影越大，用来表达"浮起来多少" |
| 层级（z-index） | 下拉菜单、弹窗、吐司通知各占哪一层，避免各处随手写 9999 |
| 动效 | 时长（fast 120ms / base 200ms / slow 320ms）、缓动曲线 |
| 断点 | sm / md / lg / xl 的像素阈值 |
| 尺寸 | 图标尺寸、控件高度、内容最大宽度 |
| 不透明度 | disabled 态、遮罩层 |

#### 落地形态

- **CSS 自定义属性（CSS variables）**：`--color-action-primary: #1E88E5`。运行时可切换，暗色主题只要在 `[data-theme="dark"]` 上重新赋值即可，不需要重新加载样式表。
- **Tailwind 的 theme 配置**：`theme.extend.colors` 里写的每一项本质上就是令牌，`bg-primary` 这个类名就是令牌的消费方式。
- **Style Dictionary**（Amazon 开源）：把一份 JSON 令牌编译成 CSS、SCSS、iOS、Android、React Native 多种产物，是跨平台那条路的标准工具。
- **Figma Variables**：设计侧的令牌。理想状态是设计和代码消费同一份 JSON，靠 Tokens Studio 这类插件同步。

#### 这一条和我的简历

**我手上有的是 Tailwind 的 theme 和 CVA 的 variant，这两个都不是完整的令牌层，我得先在心里把这件事分清楚，回答才不会心虚。**

- Tailwind 的 `theme.extend` 确实是令牌，但通常只有原始层，很少有人在里面建语义层。
- **CVA（class-variance-authority）解决的是"一个组件有哪些变体"，不是"这些变体的取值从哪来"。** `variant: { primary, secondary, ghost }` 是组件 API 的形状问题；`primary 到底是哪个蓝` 才是令牌问题。这两件事经常被混为一谈，混了就答错。

**能直接说的答法：** 在 BioMap 我建的是 Radix UI + Storybook + CVA 这一套，组件层和变体 API 是完整的，令牌那一层当时停在 Tailwind theme 的原始值上，没有做语义层，主题切换的需求也没出现过。如果现在做，我会先把语义层补上，因为它是暗色模式和跨平台（你们有 React Native）唯一便宜的做法。

**这个答法的价值在于它没有假装。** 承认停在哪一层，同时说得出下一层是什么、为什么需要——这比含糊地说"我们有一套 design token"强，因为后者一追就穿。

### 1.3 Modern component patterns（现代组件模式）

JD 在 Frontend 那行写了 "modern component patterns"。这指的是一组组件 API 的设计手法，核心问题都是同一个：**怎么让组件既好用又不在需求变化时被迫加第 20 个 prop。**

- **受控与非受控（controlled / uncontrolled）**：值由外部 state 管还是组件自己管。好的组件两种都支持，靠 `value` + `onChange` 和 `defaultValue` 区分。
- **复合组件（compound components）**：`<Select>` `<Select.Trigger>` `<Select.Content>` `<Select.Item>`。结构交给使用者拼，组件之间靠 Context 通信。它解决的是"我要在触发器和内容之间插一个自定义东西"这类需求——没有它就只能不断加 prop。
- **无头组件（headless components）**：只提供行为、状态和无障碍属性，不带任何样式。Radix UI、Headless UI、TanStack Table 都是这一路。**它是设计系统的理想底座**，因为样式由你的令牌决定，行为和无障碍由库负责。
- **`asChild` / 多态组件（polymorphic）**：让组件把自己的行为"贴"到你传进来的元素上，避免 `<a>` 外面又包一层 `<button>` 这种嵌套错误。Radix 的 `asChild` 就是这个。
- **插槽（slots）**：`<Card header={...} footer={...}>`，把结构开放出去。
- **状态归属下沉**：把 state 放在真正需要它的最小子树里，是组件模式问题，也是性能问题（见第二部分）。

**和我的简历：** BioMap 那条 "Built a design system on Radix UI, Storybook and CVA" 里的 Radix 就是无头组件；用过 Radix 就等于消费过复合组件和 `asChild`。被问到"你怎么设计组件 API"，讲 Radix 的复合结构是最短路径。

### 1.4 Accessibility patterns（无障碍模式）——他点名要我讲的第二个词

#### 先纠正一个最常见的误解

**无障碍不是"给盲人加的功能"，它是"不用鼠标、不看屏幕、或者看不清屏幕的人也能完成同一个任务"。** 受影响的人群包括：用键盘的人（含临时不能用鼠标的人和熟练用户）、用屏幕阅读器的人、色觉障碍者、老花或低视力者、手部精细动作困难者、以及前庭功能敏感（动效会引发眩晕）的人。

对 Fetch 这样一个宠物保险产品来说，还有一层现实原因：**保险是受监管行业，理赔流程（claims）里的表单和进度是最容易被无障碍投诉的地方。** 澳洲适用的标准是 WCAG（Web Content Accessibility Guidelines），业界基线是 **WCAG 2.1 AA**。

WCAG 的四条原则缩写为 **POUR**：

- **Perceivable 可感知**——信息必须能被感知到，不能只靠颜色、只靠声音传达。
- **Operable 可操作**——所有功能键盘都能到达并操作。
- **Understandable 可理解**——行为可预测，错误说得清楚。
- **Robust 健壮**——用标准的语义结构，辅助技术才解析得了。

#### "Patterns" 具体指哪些

这个词不是泛指。W3C 有一份 **ARIA Authoring Practices Guide（APG）**，里面把常见控件逐个写成"模式"：每种控件该用什么 role、该有哪些 aria 属性、键盘该怎么响应。JD 里的 accessibility patterns 就是这套东西。

按面试里最可能被问到的顺序列：

**① 对话框 / 模态（Dialog）**
- 打开时焦点移进对话框，关闭时**焦点回到原来那个触发按钮**（这一条最常被漏）。
- Tab 键在对话框内循环，出不去，叫**焦点陷阱（focus trap）**。
- Esc 关闭。
- 容器 `role="dialog"` `aria-modal="true"`，标题用 `aria-labelledby` 指过去。
- 背景内容用 `inert` 属性或 `aria-hidden` 屏蔽，屏幕阅读器不该读到底下的东西。

**② 菜单与下拉（Menu / Menu button）**
- 上下方向键在项之间移动，Home/End 跳首尾，Esc 关闭并把焦点还给触发器。
- 用**漫游 tabindex（roving tabindex）**：整个菜单只有一个项的 `tabindex="0"`，其余是 `-1`，这样 Tab 键把整个菜单当作一站，方向键才是内部导航。

**③ 标签页（Tabs）**
- `role="tablist"` / `role="tab"` / `role="tabpanel"`，用 `aria-controls` 和 `aria-selected` 串起来。
- 方向键切换，同样是漫游 tabindex。

**④ 折叠面板（Accordion / Disclosure）**
- 触发器是真正的 `<button>`，带 `aria-expanded` 和 `aria-controls`。
- **一个纯展开收起的东西不需要 `role`，只需要按钮加 `aria-expanded`**——这是最容易过度使用 ARIA 的地方。

**⑤ 组合框 / 自动补全（Combobox）**
- 最难的一个。输入框保持焦点，方向键移动的是"活动项"，用 `aria-activedescendant` 告诉屏幕阅读器当前是哪一项，列表用 `role="listbox"`，`aria-expanded` 表示展开状态。

**⑥ 表单**
- 每个输入都要有真正关联的 `<label for>`；placeholder 不是 label。
- 说明文字用 `aria-describedby` 关联。
- 出错时 `aria-invalid="true"`，错误信息也用 `aria-describedby` 关联，并且**放在实时区域里让屏幕阅读器读出来**。
- 错误不能只用红色表示——那是"只靠颜色传达信息"，直接违反 WCAG。

**⑦ 实时区域（Live regions）与吐司通知（Toast）**
- `aria-live="polite"` 表示"等用户说完再念"，用于保存成功、搜索结果数变化。
- `aria-live="assertive"` 或 `role="alert"` 表示"立刻打断"，只用于真正的错误。
- 异步加载完成、表单提交结果、理赔状态变化，都属于这一类。**这是 AI 功能界面和无障碍的交叉点**（见第四部分）。

**⑧ 跳转链接（Skip link）**
- 页面第一个可聚焦元素是"跳到主内容"，默认视觉隐藏、聚焦时出现。键盘用户不必每页 Tab 过整个导航。

**⑨ 焦点可见（Focus visible）**
- `outline: none` 而不给替代焦点样式，是最普遍也最严重的无障碍错误之一。用 `:focus-visible` 可以做到"鼠标点击不显示焦点环、键盘操作显示"。

**⑩ 动效与前庭安全**
- `@media (prefers-reduced-motion: reduce)` 下把位移和缩放动画换成淡入淡出或直接去掉。JD 里 great taste 提到 motion，能顺带说出这一条会显得成熟。

#### 不属于"控件模式"但一样会被问的基线

- **对比度**：正文文字与背景的对比度至少 **4.5:1**；大号文字（约 18pt 或 14pt 加粗以上）以及界面控件的边界、图标等图形对象至少 **3:1**。
- **语义化 HTML 优先**：能用 `<button>` 就不要用 `<div onClick>`。原生元素自带角色、键盘行为和焦点管理，**ARIA 的第一条规则就是"能不用 ARIA 就不用"**。
- **图片替代文字**：有信息的图给 `alt`，纯装饰的图给 `alt=""`（留空而不是省略，省略会让屏幕阅读器去念文件名）。
- **标题层级**：`h1` 到 `h6` 不跳级，屏幕阅读器用户靠标题列表导航整页。
- **触控目标尺寸**：WCAG 2.2 的 AA 级要求最小 24×24 CSS 像素，AAA 级和移动端通行做法是 44×44。
- **响应缩放**：页面放大到 200% 不能丢内容或功能。

#### 怎么检测

- **eslint-plugin-jsx-a11y**：写代码时就拦掉一部分（缺 alt、`onClick` 挂在非交互元素上）。
- **axe-core / @axe-core/react**：运行时自动检查，能覆盖约三到四成问题，剩下的必须人工。
- **Lighthouse 的 Accessibility 分**：跑得快，但分数高不等于可用。
- **键盘走查**：把鼠标拿开，只用 Tab / Shift+Tab / Enter / Space / 方向键 / Esc 走完一条主流程。**这是最便宜也最有效的一招，面试里说这句比背 ARIA 属性名更有分量。**
- **屏幕阅读器实测**：macOS 的 VoiceOver（Cmd+F5）、Windows 的 NVDA。

#### 这一条和我的简历

**我简历上一个 accessibility 的字都没有，但我有一张牌：Radix UI。**

Radix 的全部价值就是把上面这些模式做进去——焦点陷阱、焦点归还、漫游 tabindex、`aria-*` 的正确挂载、Esc 和方向键的键盘契约，都是它替使用者实现的。所以事实是：**我交付过带有这些行为的界面，只是我没有从零手写过它们的实现。**

**能直接说的答法：** 我在 BioMap 选 Radix 作为底座，一部分原因就是无障碍——对话框的焦点陷阱和焦点归还、菜单的漫游 tabindex 这类东西，自己写很容易只做对一半。我自己写代码时守的是语义化元素优先和键盘走查这两条。系统性的审计（axe、屏幕阅读器实测）我还没有在生产项目上做过完整一轮。

**为什么这样答是安全的：** 它说清了我实际做过什么，也说清了边界在哪。如果对方追问"那你打算怎么补"，答案是现成的：先上 `eslint-plugin-jsx-a11y` 挡住低级错误，再对理赔这条主流程做一次纯键盘走查，两件事都不需要排期就能做。

---

## 二、"Make the app feel fast"——四个词是四件不同的事

JD 这一条原文是 `Make the app feel fast: performance, rendering, loading states, perceived speed`。**注意动词是 feel（感觉），不是 be。** 这四个词经常被当成同义词，其实分工完全不同：

| 词 | 管的是 | 衡量方式 |
| --- | --- | --- |
| performance | 总量：加载了多少字节、执行了多少毫秒 | LCP、TTFB、bundle 大小 |
| rendering | 过程：浏览器和 React 各自重复做了多少无用功 | 帧率、长任务、React Profiler |
| loading states | 等待期间屏幕上是什么 | 有没有骨架屏、有没有布局跳动 |
| perceived speed | 用户觉得有多快（可以和真实耗时无关） | INP、首次反馈时间、用户抱怨量 |

**这四件事的答题顺序应该是：先讲浏览器怎么渲染（原理），再讲怎么量（指标），再讲 React 层能做什么（手段），最后讲等待期的处理（体验）。** 下面按这个顺序。

### 2.1 浏览器渲染原理——从 URL 到像素

这是所有前端性能讨论的地基。被问"页面为什么卡"时，如果不能指出卡在哪一步，答案只能是猜。

**第一阶段：拿到东西**

1. DNS 解析、TCP/TLS 握手、发出请求，服务器返回第一个字节——**这段时间叫 TTFB（Time To First Byte）**。
2. HTML 边下载边解析成 **DOM 树**。
3. 解析过程中遇到 `<script>`（不带 `async` / `defer`）会**阻塞解析**，因为脚本可能改 DOM。遇到 `<link rel="stylesheet">` 会**阻塞渲染**，因为不知道最终样式就画出来会闪。
4. CSS 解析成 **CSSOM 树**。

**第二阶段：算出来**

5. **Style**：DOM 与 CSSOM 合并，为每个节点算出最终生效的样式。
6. **Layout（布局，也叫 reflow）**：算每个节点的几何位置和尺寸。这一步的代价随节点数增长，是最贵的一步之一。
7. **Paint（绘制）**：把每个节点变成绘制指令（画什么颜色、什么形状、什么文字）。
8. **Composite（合成）**：把分好的图层按顺序合成为最终画面，这一步在 GPU 上做。

**第三阶段：谁在干活**

- **主线程（main thread）**负责：JavaScript 执行、Style、Layout、Paint。**这三件事和 JS 抢的是同一个线程**——所以一段跑很久的 JS 会让页面既不响应点击也不重绘。
- **合成线程（compositor thread）**负责把已有图层挪位置、改透明度。它不依赖主线程。

**由此得出前端性能最重要的一条经验规则：**

```
改 width / height / top / left / margin  -> 触发 Layout -> Paint -> Composite（最贵）
改 background-color / box-shadow / color -> 跳过 Layout，触发 Paint -> Composite（中等）
改 transform / opacity                   -> 只走 Composite（最便宜，可以在合成线程上跑满 60fps）
```

**所以动画一律用 `transform` 和 `opacity`。** 用 `left` 做位移动画，每一帧都要重新布局整页；用 `transform: translateX()`，主线程哪怕正忙，动画也照样流畅。

**几个必须能解释的名词：**

- **帧预算**：屏幕 60Hz 意味着每 **16.7 毫秒**要交付一帧。一帧里 JS、Style、Layout、Paint 全部要做完，实际留给 JS 的通常只有 10ms 左右。超了就掉帧。
- **长任务（long task）**：主线程上连续执行超过 **50 毫秒**的任务。期间任何点击、输入都得排队，是界面"点了没反应"的直接原因。
- **强制同步布局 / 布局抖动（layout thrashing）**：在 JS 里读一个几何属性（`offsetWidth`、`getBoundingClientRect()`）会强迫浏览器立刻算一次布局，因为它必须给出最新值。如果在循环里"读一下、写一下、再读一下"，就会在一帧内触发几十次布局。

  ```js
  // 坏：读 -> 写 -> 读 -> 写，每次读都强制重算布局
  for (const el of items) {
    el.style.height = el.offsetHeight * 2 + 'px';
  }

  // 好：先全部读完，再全部写
  const heights = items.map((el) => el.offsetHeight);
  items.forEach((el, i) => { el.style.height = heights[i] * 2 + 'px'; });
  ```

- **图层（layer）与 `will-change`**：把元素提升为独立合成层，改动它就不必重绘其他内容。代价是显存和合成开销，**滥用 `will-change` 会让内存暴涨反而更慢**，它是给"马上就要动"的元素用的，不是给所有元素挂上的。
- **`requestAnimationFrame` 与 `setTimeout`**：前者在浏览器下一次绘制前调用，天然和帧对齐；后者的时机和绘制无关，会造成动画抖动。

### 2.2 性能指标——量什么，用什么量

**Core Web Vitals（核心网页指标）** 是 Google 定义的三个用户体验指标，也是绝大多数团队实际在盯的三个数：

| 指标 | 全称与含义 | 好 | 需改进 | 差 |
| --- | --- | --- | --- | --- |
| **LCP** | Largest Contentful Paint，视口内最大那块内容（通常是主图或标题）画出来的时刻 | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| **INP** | Interaction to Next Paint，页面整个生命周期里，用户交互到界面下一次绘制的响应延迟（取接近最差的那档） | ≤ 200ms | 200–500ms | > 500ms |
| **CLS** | Cumulative Layout Shift，页面内容意外位移的累计量 | ≤ 0.1 | 0.1–0.25 | > 0.25 |

**INP 在 2024 年 3 月正式取代了 FID（First Input Delay）。** 这是个容易露馅的细节：还在把 FID 当核心指标讲，会显得知识停在几年前。FID 只量"第一次交互的排队时间"，INP 量的是"所有交互从按下到画面更新的完整时长"，严格得多。

**辅助指标：**

- **FCP（First Contentful Paint）**：第一个文字或图像出现的时刻。
- **TTFB**：服务器第一个字节。LCP 差先看 TTFB，是后端慢还是前端慢。
- **TBT（Total Blocking Time）**：所有长任务超出 50ms 的部分之和。它是实验室里 INP 的代理指标。
- **FPS 与掉帧**：滚动和动画的流畅度。
- **bundle 体积**与首屏 JS 体积：直接决定解析执行时间。

**实验室数据（lab）与现场数据（field）的区别，这条一定要能说清：**

- **实验室**：Lighthouse、Chrome DevTools 的 Performance 面板。在你自己机器上、模拟网络下跑一次。**优点是可复现、能定位；缺点是那不是用户的机器。**
- **现场（RUM，Real User Monitoring）**：用 `web-vitals` 这个库在真实用户浏览器里采集，上报到自己的后端或者监控平台。**优点是真实；缺点是拿不到调用栈，只知道慢不知道为什么慢。**

**两者要一起用：现场数据告诉你"哪个页面在真实用户那里慢"，实验室数据告诉你"它慢在哪一行"。** 面试里被问"你怎么做性能优化"，用这个框架开头比直接报手段列表专业得多。

**工具：**

- Chrome DevTools → Performance 面板（火焰图、长任务、Layout Shift 标记）
- Lighthouse / PageSpeed Insights
- `web-vitals` npm 包（采集 LCP / INP / CLS 上报）
- React DevTools 的 **Profiler**（哪个组件渲染了多少次、每次多久）
- Coverage 面板（有多少下载的 JS/CSS 实际没被执行）

### 2.3 React 性能优化

#### 先讲模型，不然优化手段全是背的

React 的更新分两个阶段：

1. **Render 阶段**：state 变了，React 重新调用组件函数，拿到新的元素树，和上一次的对比（reconciliation，协调）。**这一步是纯计算，不碰 DOM。**
2. **Commit 阶段**：把对比出的差异真正写进 DOM。**这一步会触发浏览器的 Layout 和 Paint。**

**最重要的一句话：组件重新渲染本身通常并不贵，贵的是重新渲染里做的事。** 一个返回十个节点的组件重跑一千次也不会卡；一个在渲染里排序两万条数据、或者提交了一次大规模 DOM 改动的组件，跑一次就掉帧。

**所以优化的第一步永远是用 Profiler 找出"哪次渲染贵"，而不是无差别地给所有组件套 `memo`。**

#### 手段一：结构性优化（不写任何 memo 就能生效，优先做）

**状态下沉（state colocation）**：把 state 放在真正用它的最小子树里。一个只影响输入框的 state 放在页面顶层，会让整页每次按键都重渲染。

**内容提升（把子树作为 children 传下去）**：

```jsx
// 优化前：count 一变，<ExpensiveTree /> 跟着重渲染
function Page() {
  const [count, setCount] = useState(0);
  return (
    <div onClick={() => setCount(count + 1)}>
      <p>{count}</p>
      <ExpensiveTree />
    </div>
  );
}

// 优化后：ExpensiveTree 的元素在 Page 外层创建，
// Counter 重渲染时它的 children 引用没变，React 直接跳过
function Page() {
  return (
    <Counter>
      <ExpensiveTree />
    </Counter>
  );
}
```

**这个技巧值得记住，因为它不需要任何 API，纯靠组件结构。** 面试里说得出这一条，比说 `useMemo` 有说服力得多。

**`key` 用对**：列表用稳定的 id 做 key。用数组下标当 key，在中间插入一项时会让后面所有项被认为"内容变了"，导致整片重建，还会丢掉输入框里已经输入的内容。反过来，**故意改 key 是重置一棵子树状态的正规做法**。

**Context 的广播问题**：一个 Context 的 value 变了，所有消费它的组件都会重渲染，不管它们用的是 value 里的哪个字段。解决办法是按变化频率拆成多个 Context（例如把 `user` 和 `theme` 分开），或者把 value 用 `useMemo` 稳住引用。

#### 手段二：记忆化（memoization）

- **`React.memo(Component)`**：props 浅比较没变就跳过重渲染。**只有当父组件频繁重渲染、而这个子组件确实渲染得贵时才有意义。**
- **`useMemo(fn, deps)`**：缓存一次计算结果。用于真正昂贵的计算（排序、过滤大数组），或者用于**稳住一个对象/数组的引用**，好让下游的 `memo` 生效。
- **`useCallback(fn, deps)`**：稳住函数引用，同理。

**什么时候不该用：** 每个 `useMemo` 和 `useCallback` 自己也要存依赖数组、做比较，有成本。给一个渲染只要 0.1ms 的组件套 `memo`，纯粹是让代码更难读还更慢。**能说出"我不用 memo 的理由"，在这场面试里比会用更有分量**——因为 JD 要的是判断力。

**React 19 的 React Compiler**：编译期自动插入记忆化，目标就是让开发者不必手写 `memo` / `useMemo` / `useCallback`。知道有这回事、知道它改变的是"要不要手动优化"这个前提，就够了。

#### 手段三：并发特性（直接对应 INP 指标）

这是 React 18 之后最值钱的一组 API，也是最能和 JD 那句 "make the app feel fast" 对上的：

- **`useDeferredValue(value)`**：让一个值"延后"更新。搜索框里，输入框自己用最新值（打字永远跟手），下面那个渲染两千条结果的列表用延后的值。**用户感觉不到列表慢，因为他在看自己打的字。**
- **`useTransition()` / `startTransition()`**：把一次状态更新标记为"不紧急"，React 可以打断它去先处理用户输入。切换标签页、切换筛选条件这类操作适用。
- **`<Suspense>`**：为异步内容声明一个边界和它的兜底 UI。

```jsx
const [query, setQuery] = useState('');
const deferredQuery = useDeferredValue(query);

return (
  <>
    {/* 输入永远即时响应 */}
    <input value={query} onChange={(e) => setQuery(e.target.value)} />
    {/* 重活用延后的值，React 会在有空的时候做 */}
    <SearchResults query={deferredQuery} />
  </>
);
```

**这一段是我准备里性价比最高的部分：它把"性能"和"感知速度"连起来了，正好是 JD 那句话的两个词。**

#### 手段四：加载与体积

- **代码分割**：`React.lazy` + `<Suspense>` 按路由拆包。首屏只下载首屏要的 JS。
- **列表虚拟化**：只渲染视口内的行。
- **图片**：`loading="lazy"`、现代格式（WebP / AVIF）、`srcset` 按屏幕给不同尺寸、**给图片写死宽高比以避免 CLS**。
- **字体**：`font-display: swap` 避免文字空白期；预加载关键字体。
- **Next.js 侧**：Server Components 让不需要交互的部分完全不进客户端 bundle；流式 SSR（streaming）让 HTML 分块到达，先出骨架再出数据。

### 2.4 Loading states（加载态）

JD 把它单列出来，说明他们在乎的不只是快，还有**等待期间屏幕上是什么**。

**选择哪种加载态，是有标准的：**

| 情形 | 该用什么 | 理由 |
| --- | --- | --- |
| 已知结构的内容（列表、卡片、详情页） | **骨架屏（skeleton）** | 提前把版式画出来，内容到达时不发生位移，用户的眼睛已经知道去哪看 |
| 结构未知或很小的区域 | 加载指示器（spinner） | 骨架画不出来时的退路 |
| 耗时可预估的长任务（上传、导出） | 进度条 | 只有能给出真实百分比时才用，假进度条被识破后信任成本很高 |
| 用户主动触发且结果几乎必定成功（点赞、标记已读） | **乐观更新（optimistic update）** | 立刻改 UI，失败再回滚。感知延迟为零 |
| 后台刷新已有数据 | 保留旧数据 + 一个细微的刷新指示 | 把已有内容换成骨架屏是倒退，用户会觉得变慢了 |

**几个容易做错、做对了很显功力的细节：**

- **骨架屏的尺寸必须和真实内容一致。** 否则内容到达时发生位移，CLS 变差——为了体验加的东西反而扣了指标。
- **短请求不要显示 spinner。** 低于约 200ms 的加载闪一下 spinner 比不闪更烦。做法是延迟触发：请求发出后等 200ms 还没回来才显示。
- **spinner 一旦显示就要有最短存在时间**（例如 300ms），否则会出现"闪一下就没了"的抽搐感。
- **Suspense 边界的粒度决定体验。** 整页一个边界＝整页一起等；每个卡片一个边界＝内容陆续出现。太细会变成满屏骨架块乱闪，太粗又回到白屏，这是一个要凭判断拿捏的取舍——**JD 要的 taste 正是这类判断。**
- **错误态和空态和加载态一样重要。** JD 明确写了 `empty states` 和 `progress states`。一个组件至少有四个状态：加载中、有数据、空、出错。只画了第一和第二个状态的组件，是没做完的组件。

### 2.5 Perceived speed（感知速度）

**核心命题：用户对快慢的判断，取决于他等待时的确定性和反馈，而不只是秒表读数。** 一个 800ms 但立刻给出反馈、有骨架、内容渐次出现的页面，主观上比一个 500ms 但白屏到最后一刻的页面快。

具体手段：

- **预取（prefetch）**：在用户还没点之前就把数据或代码取回来。悬停时预取详情页、视口内预取下一页、Next.js 的 `<Link>` 默认预取路由 chunk。
- **乐观更新**：见上。
- **即时反馈**：按钮按下的瞬间就有状态变化（禁用、变色、出现内联 spinner），哪怕请求还要 500ms。**没有反馈的按钮会被重复点击**，这既是体验问题也是数据问题。
- **渐进呈现**：先出文字再出图、先出首屏再出下面，而不是全部就绪才一次性显示。
- **流式传输（streaming SSR）**：服务端先把外壳的 HTML 发出去，数据好了再补。
- **占位内容优于空白**：模糊图预览（blur-up）、主色块占位。

---

### 2.6 第二部分全部内容和我的简历怎么对上

**这是我在这场面试里弹药最足的一块。** 逐条列，括号里是原文出处：

| JD 的词 | 我的证据 | 出自 |
| --- | --- | --- |
| rendering / FPS | 手写 `useVirtualList` 建在 `IntersectionObserver` 上，任何滚动深度活动 DOM 节点保持在 100 左右，滚动从 30 FPS 到稳定 60 FPS | 百度，5M+ 日 PV 的信息流 |
| perceived speed | TanStack Query 三层封装 + 悬停预取，详情页**一个请求都不发就打开** | BioMap |
| performance（体积与构建） | Webpack 3→5 迁移，跨 10+ 个不兼容的包，拆出 vendor 与 runtime chunk 并开持久化缓存，体积降约 15%、热构建时间降 70% | 百度 |
| rendering（渲染管线的真实故障） | 定位到雾（distance fog）以 JSX 声明导致每次颜色变化都重建雾对象，而雾属于材质的 program key，渲染器在一帧内重编译了场景里每一个材质；用一个"每帧统计管线构建数"的探针证实，改成复用同一个 fog 对象后消失 | WinterFell |
| rendering（绘制批次） | 每段障碍物合并为两个 `InstancedMesh` 共享一套矩阵，无头 Chromium 每帧采样渲染器统计：draw call 从 129 降到 76，提交三角形数升 2.6 倍；代价是每个 mesh 只有一个包围盒，失去逐实例视锥剔除 | WinterFell |
| cross-browser behaviour | 单个 `WebGPURenderer` 在支持 WebGPU 的机器上走 WebGPU，不支持的走它自己的 WebGL2 后端，观感在降级后仍然成立而不是悄悄劣化 | WinterFell |
| polishing the last 10% | 上面那个雾的 freeze bug 就是标准范例：现象诡异、根因在渲染管线深处、修法只有一行 | WinterFell |

**缺口，必须提前想好怎么答：**

- **loading states 我简历上一个字都没有。** 没有骨架屏、没有 Suspense 边界、没有乐观更新的记录。**这是最容易被问且最好补的一条**，答法是把 2.4 那张表当成我的判断标准讲出来——"我会按内容结构是否已知来选骨架还是 spinner，短请求延迟 200ms 再显示"，这本身就是 taste 的展示。
- **Core Web Vitals 我没有在生产环境采集上报过。** 我量过的是 FPS、draw call、构建时间、bundle 体积——都是实验室数据，没有现场数据。诚实的说法是：我做过的性能工作偏渲染和构建，用户侧的 RUM 采集我没有落地过；如果要做，第一步是接 `web-vitals` 把 LCP / INP / CLS 打到后端，先有现场数据再决定优化谁。
- **`useVirtualList` 那条几乎必被追问"为什么不用现成库"**，因为"手写"两个字自带挑衅。要准备好答案：当时的取舍是什么、动态高度怎么处理、和 react-window / TanStack Virtual 比差在哪。
- **所有数字都要说得出怎么量的。** "体积降 15%、热构建降 70%" 被问"怎么量的"答不上来，比数字小得多更致命——那是编造的信号。

---

## 三、前端地基（Frontend foundations）

JD 原文：`Frontend foundations: routing patterns, state management, observability, feature flags`。

### 3.1 Routing patterns（路由模式）

指的不是"用哪个路由库"，而是一组决定：

- **文件路由还是配置路由**：Next.js 的 App Router 是文件即路由；React Router 是显式配置。
- **嵌套路由与布局**：哪些 UI 在路由切换时保持不变（导航、侧栏），哪些替换。
- **数据加载时机**：进路由前先取数（loader，避免"渲染再取数"的瀑布），还是渲染后在组件里取。
- **URL 作为状态**：筛选条件、分页、当前选中项放进查询参数，这样刷新和分享链接都能还原。**这是最能体现产品意识的一条。**
- **代码分割边界**：按路由拆包。
- **受保护路由**：未登录时的重定向和回跳。

**和我的简历：** Apollo 这个站本身就是例子——每个页签停在哪个地址被记住，笔记的选中项写进查询参数所以刷新还在原处。Periplus 的 React 客户端也是。不过这些不在简历上，属于可以主动带出来的例子。

### 3.2 State management（状态管理）

关键在于**先分类，再选工具**。这是最容易答得平庸的题，而分类答法能立刻拉开差距：

| 状态类型 | 特征 | 该用什么 |
| --- | --- | --- |
| **服务端状态** | 来自后端，会过期，需要缓存、重新验证、去重、失效 | TanStack Query、SWR、RTK Query |
| **客户端全局状态** | 纯前端，跨组件共享（主题、侧栏开合、当前用户偏好） | Zustand、Jotai、Redux、Context |
| **URL 状态** | 应该能被分享和刷新还原（筛选、分页、Tab） | 路由的查询参数 |
| **表单状态** | 局部、高频变化、有校验 | React Hook Form，或就用 `useState` |
| **组件局部状态** | 只有一个组件用 | `useState` / `useReducer` |

**"我用 Redux 管所有东西"是错误答案**，因为把服务端状态放进 Redux 意味着要手写缓存失效、重新验证和竞态处理——这些正是 TanStack Query 已经解决的。

**和我的简历：** 我的技能栏上写着 TanStack Query 和 Zustand，正好是上表第一行和第二行的代表。BioMap 那条"三层封装：API 函数、queryOptions 工厂、类型化 hooks，单一来源的 cache key，由 mutation 驱动失效"就是服务端状态管理的完整答案，**而且 cache key 单一来源和 mutation 驱动失效这两个词组说明我踩过缓存不一致的坑**。这条 bullet 应该主动讲。

### 3.3 Observability（可观测性）

**指"线上出问题时，你能不能不靠复现就知道发生了什么"。** 前端的可观测性通常包含四块：

1. **错误监控**：Sentry 这类工具捕获未处理异常和 Promise rejection，带上 source map 还原堆栈、用户会话、面包屑（用户点了什么才炸的）。
2. **真实用户性能监控（RUM）**：采集 Core Web Vitals 上报，按路由、设备、地区分组。
3. **产品分析 / 埋点**：用户走到哪一步流失了。对 Fetch 来说就是理赔流程的每一步转化。
4. **结构化日志与追踪**：给一次用户操作打上 trace id，前端的请求和后端的处理能串起来。

**三个概念的分工要说清**：日志（发生了什么）、指标（多少、多快）、追踪（一次请求经过了哪些环节）。

**和我的简历：** 我有的只有 Beyz 那条"记录每请求的 token 用量，支撑按套餐的配额"——**那是计量（metering），本质是计费，不是可观测性**，但它是同一类工作：在生产路径上采集结构化数据并让它可被查询。这是我唯一能拿来对位的东西，得说准，不能吹成"我做过可观测性"。

**没做过的部分怎么答**：Sentry 这类前端错误监控我没有在生产项目上接过。我知道它要解决什么——线上白屏和偶发错误，没有堆栈和面包屑就只能靠复现，而复现往往做不到。真要接，我会先把未捕获异常和 Promise rejection 打上去，配 source map，再按路由分组看错误率。

### 3.4 Feature flags（功能开关）

**指把"代码是否部署"和"功能是否对用户可见"这两件事分开的机制。** 一个布尔开关（或者按用户分组的规则）决定某段代码路径是否生效，改开关不需要重新部署。

用途有四种，讲清楚这四种就说明是真懂而不是听说过：

1. **发布开关（release toggle）**：功能还没做完就可以合进主干，开关关着。这让**主干开发（trunk-based development）**成为可能，避免长期分支和地狱级合并。
2. **灰度发布（canary / percentage rollout）**：先对 1% 用户打开，观察错误率和指标，再逐步放到 100%。**出事时关开关就回滚了，比重新部署快一个数量级。**
3. **A/B 实验**：两个版本同时在线，按指标判优劣。
4. **权限开关（permission toggle）**：某些功能只对内部员工或特定套餐可见。

**代价必须一起说**：每个开关都是一个分支，分支会相乘。**开关是有生命周期的，功能全量之后要有人删掉它**，否则代码里会积累几十个永远为 true 的判断。这一点是区分"用过"和"想过"的地方。

常见工具：LaunchDarkly、Statsig、PostHog、Unleash（开源）、GrowthBook（开源）。

**和我的简历：** 完全空白，简历上没有任何一条能对上。**但有一个相邻的东西可以说：Beyz 的"套餐门禁（plan gate）"——按用户套餐决定能不能用某个功能，在类型化的 server action 里做校验。** 这在机制上就是一个按用户属性求值的开关，只是它是业务权限，不是发布控制。可以这样接：我没有用过 LaunchDarkly 这类平台，但我做过按用户套餐分流的功能门禁；发布开关我理解它真正的价值在于把部署和发布解耦，让回滚变成改一个值而不是回滚一次部署。

---

## 四、AI 功能的界面

JD 原文：`UI for AI-powered features (structured outputs, explainability, clear "what happened" states)`。

**这是我和这个岗位对位最准的一块，而且 v42 简历上全都在。**

### 4.1 Structured outputs（结构化输出）

指让模型输出严格符合某个 schema 的 JSON，而不是自由文本。做法是把 JSON Schema 交给模型（OpenAI 的 Structured Outputs、工具调用的参数定义），或者用 Zod / Pydantic 在应用层校验并在失败时重试。

**它为什么是个前端问题：** 只有输出是结构化的，界面才能渲染成组件而不是一坨 markdown。一段自由文本只能塞进气泡框；一个带类型的对象可以变成卡片、表格、可点的链接、可编辑的表单。**"AI 功能的 UI 做得好不好"，一半取决于输出结构设计得好不好。**

**我的证据：** 技能栏上直接写着 Structured Outputs。Periplus 里研究阶段产出的是**绑定到原文精确引文的 claims**，那就是结构化输出的实例——每条断言是一个带来源的对象，不是一段话。

### 4.2 Explainability（可解释性）

指让用户看得见"这个结论从哪来"。在界面上表现为：引用来源并可点开、显示置信度、显示模型用了哪些输入、允许用户展开中间步骤。

**为什么保险公司特别在乎这个：** 理赔决定如果由 AI 参与，用户必须能看到依据，否则不会信任，监管上也过不去。JD 把 explainability 和 claims 写在同一份文档里，不是巧合。

**我的证据，逐字对得上：**

- Periplus **把证据和判断分开**：研究阶段产出绑定精确原文引文的 claims，**一个独立的验证阶段**对它们做裁决，而且**由应用代码而不是提示词**强制执行引文归属和时效窗口。**没有支撑引文的断言不会进入下一阶段。**
- 这正是 explainability 的工程实现：不是让模型自己说"我很确信"，而是让系统在结构上保证每个结论都能追到来源。

**这一段是我全场最值钱的两分钟，应该主动讲，不要等他们问。**

### 4.3 清晰的 "what happened" 状态

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

## 五、其余名词

- **TypeScript / React**：不用解释，但要注意 JD 写的是 "Strong React + TypeScript fundamentals"——fundamentals 意味着可能问到基础原理（闭包、hooks 的依赖数组、泛型），不只是框架用法。
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

## 六、一页对照表

| JD 的要求 | 我手上的证据 | 强度 |
| --- | --- | --- |
| 设计系统：components | BioMap 的 Radix + Storybook + CVA | 强 |
| 设计系统：tokens | 只有 Tailwind theme 层，没有语义层 | **弱，要承认边界** |
| 设计系统：accessibility patterns | 用过 Radix（模式都在里面），自己没做过审计 | **弱，靠 Radix 接住** |
| 性能：rendering | 虚拟列表 30→60 FPS；WinterFell 的雾 freeze 与实例化合并 | 强 |
| 性能：perceived speed | 悬停预取，详情页零请求打开 | 强 |
| 性能：loading states | 无 | **空白，必须准备说法** |
| 性能：现场指标（Core Web Vitals / RUM） | 无，只有实验室数据 | **空白，必须准备说法** |
| 前端地基：routing patterns | 有实践但不在简历上 | 中 |
| 前端地基：state management | TanStack Query 三层封装、cache key 单源、mutation 驱动失效 | 强 |
| 前端地基：observability | 只有 Beyz 的 token 用量计量，不是同一件事 | **弱** |
| 前端地基：feature flags | 无，只有 Beyz 的套餐门禁可作类比 | **空白** |
| AI 界面：structured outputs | Periplus 的 claims 绑定引文；技能栏直写 | 强 |
| AI 界面：explainability | Periplus 的证据/判断分离与独立验证阶段 | **最强** |
| AI 界面："what happened" 状态 | Beyz 的 interim/finalized 对账、四状态机、逐 token 流式 | 强 |
| 可靠可维护：testing / architecture | Periplus 406 个测试、脚本化接缝、黄金集评测；Beyz 第一道 CI | 强 |
| cross-browser behaviour | WinterFell 的 WebGPU→WebGL2 降级 | 强 |
| polishing the last 10% | WinterFell 的雾 freeze 根因定位 | 强 |
| 3–5 年经验 | 两年多 + 两个完整项目，用 JD 自己给的 "or equivalent through projects" 接 | 中 |
