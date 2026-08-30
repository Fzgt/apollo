---
title: "② 设计系统：行为、样式、展示和 Mock"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ② 设计系统：行为、样式、展示和 Mock

> **简历原句**
>
> 基于 **Radix UI、Storybook 和 CVA** 构建设计系统，以 **MSW mocks** 为底层支撑，组件 variant 类型直接从样式定义推导。

> ⚠️ **证据边界**：本机没有 Digital OS 的设计系统代码。`Prometheus` 是后来的示例，可以帮助复习 Radix、CVA、Storybook 和 MSW，但不能证明 BioMap 当时的组件数量、Storybook 配置或 MSW handlers。

## 这条要讲清什么

我把组件的交互、视觉变体、独立展示和接口 mock 分开处理。这样组件行为更稳定，样式和 TypeScript 类型不会维护两份，前端也能在真实接口未完成时继续开发。

## 第一层：必须答顺

### 1. 四个工具分别做什么？

- **Radix UI**：提供 Dialog、Dropdown 等无样式组件的交互和无障碍行为。
- **CVA**：集中定义 `variant`、`size` 等样式分支，并从定义中生成 TypeScript 类型。
- **Storybook**：单独展示组件和不同状态，不需要先进入完整业务页面。
- **MSW**：在网络层拦截请求，为开发和测试提供 mock API。

Storybook 和 MSW 是两项不同能力。除非原项目真的做过配置，不要说 Storybook 一定加载了同一组 MSW handlers。

### 2. “variants typed off the styles”是什么意思？

先用 CVA 定义允许的 variant，再用 `VariantProps` 生成组件 props。新增或删除一个样式分支时，TypeScript 类型会一起变化，不需要再手写一份字符串联合类型。

这只能检查 TypeScript 代码里的值。接口或 JSON 传进来的字符串仍然需要运行时校验。

### 3. 为什么使用 Radix，而不是从零写 Dialog？

Dialog 难的不是外观，而是键盘操作、焦点管理、Esc 关闭、ARIA 属性和屏幕阅读器支持。Radix 处理基础行为，团队再按产品设计添加样式。

### 4. Storybook 解决什么问题？

开发和设计可以直接查看 Button、Dialog 等组件的 variant、size 和 disabled 状态。组件问题可以在脱离业务页面的情况下复现和讨论。

不要主动说做了自动视觉回归或 loading story，除非你记得 BioMap 确实有这些内容。

### 5. MSW 怎样帮助前后端并行？

MSW 拦截真实的 HTTP 请求，所以页面仍使用正式的请求代码。前端可以先按约定的接口格式开发，后端完成后关闭 mock 即可，不需要改页面逻辑。

## 第二层：概念补充

### Radix 的 `asChild` 需要注意什么？

子组件需要接收传入的 props，并把 ref 转发到底层元素。换成链接或其他元素以后，也要确认 HTML 语义和键盘操作仍然正确。

### MSW 和直接 mock 一个函数有什么区别？

MSW 在网络边界处理请求，可以一起检查 URL、method、payload 和响应。直接 mock 函数更简单，但可能跳过真实请求流程。

### 怎样避免设计系统越来越重？

只有重复出现并且接口稳定的组件才进入设计系统。只属于一个业务的组件先留在 feature 内，确认多个地方需要后再抽出来。

## 当前不能证明的内容

- 本机无法核对 BioMap 设计系统的真实组件、stories 和 MSW 配置。
- `Prometheus` 的浏览器和测试环境共用 handlers，但它的 Storybook 没有接入 MSW；旧笔记把三者说成共用一套，是错的。
- 不要把 `Prometheus` 的 Storybook 8 或 MSW 2 写法说成 2022 年 BioMap 的具体 API。

## 30 秒回答

> 我把设计系统分成四部分：Radix 负责基础交互和无障碍，CVA 集中管理视觉 variants 并生成 TypeScript props，Storybook 单独展示组件状态，MSW 为开发和测试提供接口 mock。这样样式和类型只有一个来源，组件可以独立评审，前端也不用等后端接口全部完成才开始工作。

## 自检

1. 能否用一句话说清四个工具的职责？
2. 能否解释 `VariantProps` 删除了哪一份重复定义？
3. 能否说清 Storybook 与 MSW 是两项不同能力？
4. 能否避免把后来的 Storybook 8 / MSW 2 示例说成 BioMap 源码？
