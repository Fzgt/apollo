---
title: "② 设计系统：组件契约，而不是组件目录"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ② 设计系统：组件契约，而不是组件目录

> **简历原句**
>
> 基于 **Radix UI、Storybook 和 CVA** 构建设计系统，以 **MSW mocks** 为底层支撑，组件 variant 类型直接从样式定义推导。

> ⚠️ **证据边界**：本机没有 Digital OS 的设计系统仓库。下面的代码锚点来自后来 `Prometheus` 里的参考实现；它能证明设计方法，不是 BioMap 生产源码。

## 这条真正要证明什么

设计系统的价值不是“封装了 Button”，而是建立一套稳定契约：交互和无障碍由 primitive 托底，视觉变体只有一个真相源，组件状态能独立展示，接口数据也能在后端未就绪时被稳定模拟。

## 第一层：必须答顺

### 1. Radix UI、CVA、Storybook、MSW 各自负责什么？

- **Radix UI**：提供无样式的交互 primitive，包括焦点管理、键盘操作、ARIA 角色和状态。
- **CVA**：把视觉 variant 写成一份配置，并从这份配置推导 TypeScript props。
- **Storybook**：把组件状态隔离出来，供开发、评审和回归查看。
- **MSW**：在网络层拦截真实请求，让页面、测试和 Storybook 共用同一组 mock handlers。

它们不是四个并列名词，而是一条链：行为 → 样式契约 → 状态目录 → 数据环境。

### 2. “variants typed off the styles”是什么意思？

参考实现的 `Button` 和 `Badge` 都先用 `cva` 定义 `variant`、`size` 等样式分支，再用 `VariantProps<typeof ...>` 生成组件 props。新增或删除样式变体时，调用端类型会跟着变化，不需要再维护一份容易漂移的手写联合类型。

这能拦住 TypeScript 调用端的非法值，但不会自动校验从接口或 JSON 进入的运行时字符串。

### 3. 为什么选 Radix，而不是从零写 Dialog、Dropdown？

真正难的不是画一个浮层，而是焦点圈定、Esc 关闭、键盘导航、ARIA 状态和嵌套交互。Radix 把这些底层行为做成 primitive，我只定义视觉和产品规则，减少重复实现无障碍细节的风险。

### 4. Storybook 在团队里解决什么问题？

它让组件的 default、disabled、loading、不同 size 和 variant 不必依附某个业务页面才能被看见。设计和开发讨论的是同一个可运行状态，回归时也更容易确认究竟是组件坏了还是页面集成坏了。

### 5. MSW 为什么放在设计系统这一条里？

它只是支撑层，不是这条的主角。参考实现中浏览器 worker 与测试 server 共用 `handlers`，handler 又连接同一个内存数据模型；因此页面、Storybook 和测试看到一致的接口形状。它让前端状态可独立演示，也降低“每个环境各写一套假数据”的漂移。

## 第二层：继续追问时再讲

### Radix 的 `asChild` 有什么代价？

`asChild` 会把行为和 props 合并到子元素上。自定义子组件必须透传 props 并转发 ref；换掉底层元素后，语义是否仍然可访问也由调用者负责。Radix 提供底层行为，不会替产品补齐标签文案。

### MSW 和直接 mock `fetch` 有什么区别？

MSW 在网络边界拦截请求，应用仍走生产使用的请求代码。这样能同时验证 URL、method、payload 和响应处理；直接替换某个客户端函数更轻，但更容易跳过真实集成路径。

### 怎样防止设计系统变成“组件坟场”？

只收纳重复且稳定的契约。业务特有组件先留在 feature 内；出现明确复用后再上提。每个公共组件都要有清楚的 variant、状态和退出路径，而不是为了“统一”把所有页面细节塞进去。

## 当前实现的缺口

- 本机可核对的是 `Prometheus` 的 Button、Badge、Dialog、stories 和 MSW handlers，不是 Digital OS 源码。
- TypeScript 的 variant 类型不等于运行时校验。
- 无障碍 primitive 仍需要正确的标签、文案和产品层测试。
- MSW 能解除开发阻塞，但 mock 合约仍可能与真实后端漂移，需要接口契约或集成环境对账。

## 30 秒回答

> 我把设计系统看成组件契约，不是组件文件夹。Radix 负责焦点、键盘和 ARIA 等底层行为；CVA 把视觉 variants 放在一个真相源里，再由 TypeScript 直接推导 props；Storybook 展示每个状态；MSW 则让这些状态能用统一接口数据独立运行。这样新增 variant 时样式和类型一起变，组件也不必等具体页面或后端完成才能评审。

## 自检

1. 能否用一句话分别说清 Radix、CVA、Storybook、MSW 的职责？
2. 能否解释 `VariantProps` 消除了哪一份重复真相？
3. 能否说出 `asChild` 对 props、ref 和语义的要求？
4. 能否说明 MSW 为什么只是支撑层，以及它不能解决什么？
