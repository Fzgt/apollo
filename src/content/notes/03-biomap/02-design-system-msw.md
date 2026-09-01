---
title: "② 设计系统：行为、样式、展示、Mock"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ② 设计系统：行为、样式、展示、Mock

> **简历原句**
>
> Built the design system on **Radix UI, Storybook and CVA** over **MSW mocks**, variants typed off the styles.
>
> ---
>
> 基于 **Radix UI、Storybook 和 CVA** 构建设计系统，以 **MSW mocks** 为底层支撑，组件 variant 类型直接从样式定义推导。

## 先把词说清

**Radix UI**：一套**无样式（headless / unstyled）**的 React 交互组件库。**只给行为，不给外观。**

**primitive（原语）**：最小的、可组合的构件。这里指 `Dialog`、`DropdownMenu` 这种「只管交互逻辑」的组件。

**CVA（class-variance-authority）**：把「一个组件有哪些视觉分支」写成一份配置，并**从这份配置直接推导出 TypeScript 类型**的小库。

**variant（视觉变体）**：同一个组件的不同外观分支，比如 Button 的 `default` / `destructive` / `outline`。

**Storybook**：把每个组件的每个状态**从业务页面里拆出来单独跑**的展示工具。

**MSW（Mock Service Worker）**：在**网络层**拦截请求的 mock 库。浏览器里用 Service Worker，测试里用 Node server，**两边共用同一组 handler**。

**ARIA（Accessible Rich Internet Applications）**：一组 HTML 属性，告诉读屏软件「这是什么、现在是什么状态」，比如 `aria-expanded`。

## 这条要讲清什么

设计系统的价值不是「我们封装了一个 Button」，而是**把一个组件拆成四件互不重叠的事**：交互行为、视觉变体、独立展示、数据环境。**每件事各有一个真相源（source of truth），样式和类型不维护两份。**

这条 bullet 一共提了四个工具，讲的时候必须让它们**各归各位、串成一条链**，而不是并排念四个名字。

## 四个工具各管什么

**Radix UI 管行为。** 它提供的是无样式的交互 primitive：焦点管理、键盘操作、Esc 关闭、ARIA 角色和状态由它兜底，**长什么样完全由你决定**。

**CVA 管样式契约。** 把视觉 variant 写成一份配置，**并且从这份配置直接推导出 TypeScript 的 props 类型**。

**Storybook 管展示。** 把组件的每一个状态从业务页面里拆出来单独跑，**不需要先进到某个页面、造出某个特定数据才能看见**。

**MSW 管数据环境。** 它在网络层拦截真实请求，**让页面和测试共用同一组 mock handler**。

**四个连起来是一条链：行为 → 样式契约 → 状态目录 → 数据环境。**这句话背下来，被问「这四个东西是什么关系」的时候直接答。

## variants typed off the styles 是什么意思

```ts
const buttonVariants = cva('inline-flex items-center justify-center rounded-md', {
  variants: {
    variant: { default: '...', destructive: '...', outline: '...',
               secondary: '...', ghost: '...', link: '...' },
    size:    { default: 'h-10 px-4', sm: 'h-9 px-3', lg: 'h-11 px-8', icon: 'h-10 w-10' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

// ↓ 类型不是手写的，是从上面那份配置推导出来的
interface ButtonProps extends VariantProps<typeof buttonVariants> {}
```

结果是 **`variant` 这个 prop 的类型自动就是那六个字符串的联合**。新增一个样式分支，调用端的类型自动多一个合法值；删掉一个，**所有旧用法立刻编译报错**。

**关键在于：这份类型只有一份。**不需要另外手写一个联合类型跟在旁边慢慢漂移——而「**手写一份类型跟样式对不上**」正是设计系统里最常见的腐烂方式。

**边界也要主动说清**：它只管 TypeScript 的**调用端（compile-time）**。从接口或者 JSON 进来的运行时字符串，**仍然要自己校验**，类型系统在运行时不存在。

## 为什么用 Radix，不自己写 Dialog 和 Dropdown

**难的从来不是画一个浮层。**难的是：焦点进入弹窗之后要被**圈住（focus trap）**、Esc 要能关闭、Tab 循环不能跑到背景里去、方向键要能在菜单项之间导航、`aria-expanded` 和 `aria-controls` 这些状态要跟着同步、嵌套弹层的层级关系要正确。

**这些都是无障碍（accessibility / a11y）的细节，实现起来琐碎，做错了又不容易被发现。**Radix 把它们做成了 primitive，我只负责视觉和产品规则，**不用重新实现一遍——而且大概率实现得比它差**。

## Storybook 在团队里解决什么问题

组件的 `default`、`disabled`、`loading`，各种 size 和 variant，**不必先进到某个业务页面、造出某个特定状态才能看见**。设计和开发看的是**同一个可运行的状态列表**，评审的时候指着说就行。

出问题的时候它还有第二个用途：**能立刻分清是组件坏了还是页面集成坏了。**组件在 Storybook 里是好的，那问题就在页面这一侧。

## MSW 为什么放在这条里

**它是底层支撑，让上面三件事能独立跑起来。**浏览器里的 worker 和测试里的 server **共用同一组 handler**，handler 又连着同一份内存里的数据模型。

结果是**页面和测试看到完全一致的接口形状**，不会出现开发用一套假数据、测试用另一套假数据、两边慢慢分叉的情况。前端也不用等后端接口做完才能开工；**接口好了把 mock 关掉即可，页面代码一行都不用改。**

## 概念补充

**Radix 的 `asChild` 有什么代价。** `asChild` 会把 Radix 的行为和 props **合并到你给的子元素上**，而不是再套一层 DOM 节点。代价是**子组件必须把 props 透传下去、必须转发 ref（forward ref）**，否则行为直接失效，**而且失效得很安静**。另外把底层元素换掉之后——比如 `button` 换成 `a`——语义和键盘行为是否还正确，**责任在调用方**。

**MSW 和直接 mock 掉一个函数有什么区别。** **MSW 在网络边界拦截**，应用仍然走生产用的那条请求代码，所以 **URL、method、payload、响应处理是一起被验证的**。直接替换客户端函数更省事，但**跳过了真实的集成路径，接口签名改了测试也不会红**——这是**最危险的一类假绿（false green）**。

**怎样防止设计系统变成组件坟场。** **只收纳重复出现并且契约稳定的东西。**只服务一个业务的组件先留在 feature 内部，等确实出现第二个、第三个用处再上提。每个公共组件都要有清楚的 variant、状态和**退出路径（escape hatch）**，而不是为了统一把所有页面的细节都塞进去。

## 30 秒回答

> 我把设计系统拆成四层职责。Radix 提供无样式的交互 primitive，负责焦点、键盘和 ARIA。CVA 把视觉 variant 集中成一份配置，组件的 props 类型直接用 VariantProps 从这份配置推导，样式和类型永远只有一个真相源。Storybook 让每个状态脱离业务页面单独展示。底下用 MSW 在网络层拦截请求，浏览器和测试共用同一组 handler，所以组件不用等后端就能独立开发、评审和测试。新增一个 variant 的时候，样式和类型一起变，不会漏。

## 英文怎么说

**四层职责的说法**：**Radix owns behaviour, CVA owns the style contract, Storybook owns the state catalogue, MSW owns the data environment**。

「样式和类型只有一个真相源」是 **one source of truth for both the styles and the types**。`asChild` 的代价说 **the child has to forward its props and its ref**。MSW 的价值说 **it intercepts at the network boundary, so the app still runs its production request code**。承认边界时说 **the variant type is compile-time only; runtime strings still need validating**。

**术语对照**：无样式组件 headless / unstyled ／ 原语 primitive ／ 视觉变体 variant ／ 真相源 source of truth ／ 焦点圈住 focus trap ／ 无障碍 accessibility (a11y) ／ 转发 ref forward ref ／ 网络边界 network boundary ／ 假绿 false green ／ 退出路径 escape hatch ／ 状态目录 state catalogue。

## 自检

1. 能否一句话说清 Radix、CVA、Storybook、MSW 各自的职责，并串成一条链？
2. 能否解释 `VariantProps` 消除掉的是哪一份重复定义？
3. 能否说出 `asChild` 对 props 透传和 ref 的要求，以及失效为什么很安静？
4. 能否说清 MSW 为什么在网络层拦截，比直接 mock 函数多验证了什么？
5. 能否说明 variant 类型不等于运行时校验？
