---
title: "④ 设计系统与 MSW"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ④ 设计系统与 MSW

> **简历原句**
>
> Built a **design system on Radix UI, Storybook and CVA**, plus an **MSW mock layer** that let **frontend delivery run independent of backend progress**.
>
> ---
>
> 基于 Radix UI、Storybook 与 CVA 搭建设计系统，并用 MSW mock 层让前端交付不再被后端进度卡住。

## 这条 bullet 在讲什么

**两半的分量不一样，别平均用力：**

| | 面试价值 | 为什么 |
|---|---|---|
| **设计系统** | 中 | 是「知道该用什么工具、以及为什么」的题，能讲清就够 |
| ⭐ **MSW** | **高** | **它是一道有明确正确答案的设计题** —— 「拦截位置决定你在测什么」，而且能和 [Periplus 的 seam](/docs?section=periplus&item=scripted-seams) 串成一条通用原则 |

⭐ **而且这条和 [② 架构边界](/docs?section=biomap&item=architecture-boundaries) 是同一个思想的第二次应用**：那边是「让用错的依赖方向做不到」，这边是「让前端交付不依赖后端进度」—— **两条都是把一个靠人自觉维持的约定，换成一个工具兜住的约束。**

## 30 秒口播稿

> 设计系统那部分是标准配置：**Radix 提供行为不提供样式**（键盘导航、焦点管理、无障碍这些最容易做错的部分），**CVA 把尺寸 × 变体 × 状态的组合写成一份带类型的配置**，Storybook 做独立开发环境。
>
> ⭐ **更值得讲的是 MSW。** 它和常见的假接口做法有个根本区别：**它不替换你的代码，它拦在网络层。** 浏览器里注册一个 Service Worker，请求发出去之后被截住返回假数据 —— **你的 API 函数、axios 拦截器、请求头组装、错误映射全都是真跑的，只有最后一跳没出去。**
>
> **换成「把 hook 换成假的」或者「把 axios 整个替换掉」，这些代码全被跳过了 —— 你测的就不再是真实的请求路径。**
>
> 配合它那个内存数据库，**假接口是有状态的：POST 一条评论，GET 就能查到它** —— 所以后端接口还没写，前端已经能开发、能演示、能测完整交互流程。

## 一、⭐ 为什么 MSW 优于假的 fetch（题眼：拦截位置决定你在测什么）

### 先说 MSW 是什么

**MSW（Mock Service Worker）是一个假接口（mock）工具**，但它和常见做法有个根本区别：⭐ **它不替换你的代码，它拦在网络这一层。**

- 在浏览器里，它注册一个 **Service Worker**（浏览器提供的一种在网页和网络之间的代理，proxy），**请求发出去之后被它截住，返回你写好的假数据**
- 在测试环境（Node）里，它直接接管底层的 HTTP 模块

⭐ **关键是：你的代码完全不知道它存在** —— 该发的请求照发，只是最后一跳没出去。

### 拦截位置决定测什么

```
组件 → 自定义 hook → API 函数 → axios/fetch → ❶ 网络层 → 服务器
      ↑ mock 这里    ↑ 这里      ↑ 这里         ↑ MSW 拦这里
```

| Mock 的位置 | 下面这些还是不是真的 |
|---|---|
| **把 hook 换成假的** | ❌ API 函数、请求组装、拦截器、序列化 —— **全跳过了** |
| **把 API 函数换成假的** | ❌ axios 实例、基础地址、请求头、拦截器、错误映射 —— **全跳过** |
| **把 axios 整个替换掉** | ⚠️ 请求配置和拦截器逻辑**还是没跑到** |
| ⭐ **MSW（网络层）** | ✅ **上面全部真实执行**，只有最后一跳没出去 |

⭐ **一句话：MSW 拦在网络层，所以你测的是真实的请求路径。**

> ⭐ **这和 [Periplus 的 scripted seam](/docs?section=periplus&item=scripted-seams) 是完全同一个原则** —— 那边替换模型调用时**只覆写了「把请求发出去」那一个方法**，提示词组装、格式校验、修复重试全都还在真跑；抓网页那边换的是 HTTP 客户端的传输层，**robots 解析、限流、重定向跟随全是真测的**。
>
> **两个项目串起来是一条可以直接说出口的通用原则：「替换点要放在最接近进程边界的位置。越靠外，被测的真实代码越多。」**

### 三条 MSW 独有的收益

| 收益 | 说明 |
|---|---|
| **同一套假接口，浏览器和测试通用** | 开发和 Storybook 用浏览器那套，测试用 Node 那套，**假接口的逻辑只写一份** |
| **前端能完全独立跑起来** | 后端接口还没写，前端已经能开发、能演示、能截图 —— ⭐ **这就是简历里 `let frontend delivery run independent of backend progress` 的字面意思** |
| ⭐ **假数据是有状态的** | 用的是一个**内存数据库**，不是写死的 JSON。**POST 一条评论，GET 就能查到它** —— **能测完整的交互流程，而不只是渲染** |

### 一个已经做对的配置

```js
server.listen({ onUnhandledRequest: 'error' })
```

**「没有匹配到任何假接口的请求，直接报错」。**

⭐ **没这一条的话，漏配的接口会静默地打到真实网络上** —— **测试结果就变成不确定的了**（网络好的时候过，网络差的时候挂）。

### ⚠️ 必须主动交代的风险

> ⭐ **MSW 的假接口会和真实接口漂移。后端改了一个字段名，你的测试全绿、线上全炸。**

**生产级的补法**：让假接口从后端的 OpenAPI 描述**自动生成**（保证形状一致），再配**契约测试** —— ⭐ **MSW 保证前端「按约定跑得通」，契约测试保证「约定没被后端偷偷改掉」。**

> **说出这一点，比只讲 MSW 的好处更能证明你真用过。**

## 二、设计系统：四个工具各解决什么

| 工具 | 一句话 |
|---|---|
| **Radix UI** | ⭐ **只给行为，不给样式**（这类库叫 **headless**，无头组件库）—— 键盘导航、焦点管理、无障碍属性、点外面关闭，**这些是最容易做错、也最不该重复造的部分**。样式全是你自己的 |
| **CVA** | 把「尺寸 × 变体 × 状态」的组合写成一份配置，**类型自动导出** —— 不用手拼样式类名字符串 |
| **design tokens** | 颜色、间距、圆角**定义一次**，主题切换只换这一份定义 |
| **Storybook** | 组件的独立开发环境和文档，**配合 MSW 就能脱离后端做交互演示** |

### ⭐ 为什么选 headless 而不是现成的组件库

**这是这半条最可能被追问的地方。**

**现成组件库（Ant Design、MUI）给你行为 + 样式。** 问题在于：**产品有自己的设计语言时，你会花大量时间去覆盖它的样式** —— 而覆盖是脆弱的，**库一升级就可能全崩**。

⭐ **Radix 这类库把「难做对的部分」和「必须定制的部分」切开了**：行为、焦点管理、无障碍这些**做错了用户会真的用不了**，交给库；样式**必须跟着产品走**，自己写。**这个切法本身就是答案。**

### `asChild` 值得单独提

它让你把样式「套」到子元素上，所以 `<Button asChild><Link/></Button>` **渲染出来是一个 `<a>` 标签，而不是一个 `<button>` 里套一个 `<a>`**。

⭐ **后者是无效的 HTML** —— 交互元素不能嵌套交互元素，屏幕阅读器和键盘操作都会出问题。**能说出「为什么不能套」比说出「有个 asChild 属性」有价值得多。**

> ⭐ **整套设计系统的目的和 [② 架构边界](/docs?section=biomap&item=architecture-boundaries) 一样 —— 让「用错」变难。** 组件把无障碍做进去了，用的人不需要记得加 `aria` 属性；变体用类型约束了，写错的变体名编译就报错。

## 三、本篇术语英文对照

| 中文 | 英文 |
|---|---|
| 假接口 / 打桩 | **mock**（动词 *to mock*） |
| 拦截 | **intercept**（*MSW intercepts at the network layer*） |
| 网络层 | **the network layer** |
| 请求路径 | **request path**（*you exercise the real request path*） |
| 拦截器 | **interceptor** |
| 序列化 | **serialisation** |
| 有状态的假数据 | **stateful mocks** |
| 内存数据库 | **in-memory database** |
| 未匹配的请求 | **unhandled request** |
| 漂移 | **drift**（⭐ *mocks drift from the real API*） |
| 契约测试 | **contract testing** |
| 自动生成 | **generated**（*generated from the OpenAPI schema*） |
| 无头组件库 | **headless UI library** |
| 行为 ↔ 样式 | **behaviour ↔ styling** |
| 焦点管理 | **focus management** |
| 键盘导航 | **keyboard navigation** |
| 无障碍 | **accessibility（a11y）** |
| 屏幕阅读器 | **screen reader** |
| 变体 | **variant**（CVA = class variance authority） |
| 设计令牌 | **design tokens** |
| 覆盖样式 | **override styles** |

> ⭐ **三个最容易说错的**：
>
> 1. 「拦在网络层」说 **intercepts at the network layer** —— 整条 bullet 的题眼
> 2. 「假接口会和真接口漂移」用 **drift**：*mocks drift from the real API*
> 3. 「只给行为不给样式」说 **behaviour without styling**，这类库叫 **headless**
