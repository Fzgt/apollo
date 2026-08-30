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

## 这条要讲清什么

设计系统的价值不是"我们封装了 Button"，而是把一个组件拆成四件互不重叠的事：交互行为、视觉变体、独立展示、数据环境。每件事各有一个真相源，样式和类型不维护两份。

## 第一层：必须答顺

### 1. 四个工具分别负责什么？

- **Radix UI**：无样式的交互 primitive。焦点管理、键盘操作、Esc 关闭、ARIA 角色和状态由它兜底。
- **CVA**（class-variance-authority）：把视觉 variant 写成一份配置，并从这份配置推导 TypeScript props。
- **Storybook**：把组件的每个状态从业务页面里拆出来单独展示。
- **MSW**：在网络层拦截真实请求，让页面和测试共用同一组 mock handlers。

链条是：**行为 → 样式契约 → 状态目录 → 数据环境**。

### 2. "variants typed off the styles"是什么意思？

先用 `cva` 定义允许的样式分支，再用 `VariantProps` 从这份定义生成组件 props：

```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:     'border border-input bg-background hover:bg-accent',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:       'hover:bg-accent hover:text-accent-foreground',
        link:        'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 rounded-md px-3 text-xs',
        lg:      'h-10 rounded-md px-8',
        icon:    'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;
```

`VariantProps<typeof buttonVariants>` 直接把 `variant` 推成 `'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'`。新增一个样式分支，调用端类型自动多一个合法值；删掉一个，所有旧用法立刻报错。

**这份类型只有一份，不需要另写一个手工联合类型跟着漂移。**

注意边界：它只管 TypeScript 调用端。从接口或 JSON 进来的运行时字符串，仍然需要自己校验。

### 3. 为什么用 Radix，不自己写 Dialog、Dropdown？

难的从来不是画一个浮层。难的是：焦点进入弹窗后被圈住、Esc 关闭、Tab 循环不跑到背景、方向键在菜单里导航、`aria-expanded` / `aria-controls` 这些状态同步、嵌套弹层的层级。Radix 把这些做成 primitive，我只负责视觉和产品规则，不用重复实现一遍无障碍细节还很可能做错。

### 4. Storybook 在团队里解决什么问题？

组件的 default、disabled、loading、各种 size 和 variant，不必先进到某个业务页面、造出某个特定状态才能看见。设计和开发看的是同一个可运行的状态；出问题时也能马上分清是组件坏了还是页面集成坏了。

### 5. MSW 为什么放在这条里？

它是底层支撑，让上面三件事能独立跑起来。浏览器的 worker 和测试的 server 共用同一组 `handlers`，handlers 又连着同一份内存数据模型：

```ts
// mocks/handlers.ts —— 一份 handlers
export const handlers = [...postsHandlers, ...commentsHandlers];

// mocks/browser.ts —— 开发环境
export const worker = setupWorker(...handlers);

// mocks/server.ts —— 测试环境
export const server = setupServer(...handlers);
```

结果是页面和测试看到完全一致的接口形状，不会出现"开发用一套假数据、测试用另一套"的漂移。前端也不用等后端接口做完才能开工，接好了把 mock 关掉即可，页面代码一行不用改。

## 第二层：概念补充

### Radix 的 `asChild` 有什么代价？

`asChild` 会把 Radix 的行为和 props 合并到你给的子元素上，而不是再套一层 DOM。代价是：子组件必须把 props 透传下去、必须 `forwardRef`，否则行为直接失效。换掉底层元素（比如 button 换成 a）之后，语义和键盘行为是否还正确，也由调用方负责。

### MSW 和直接 mock 掉一个函数有什么区别？

MSW 在网络边界拦截，应用仍然走生产用的那条请求代码，所以 URL、method、payload、响应处理一起被验证。直接替换客户端函数更省事，但跳过了真实集成路径，接口签名改了测试也不会红。

### 怎样防止设计系统变成"组件坟场"？

只收纳重复出现且契约稳定的东西。只服务一个业务的组件先留在 feature 内部，等确实出现第二、第三个用处再上提。每个公共组件都要有清楚的 variant、状态和退出路径，而不是为了"统一"把所有页面细节塞进去。

## 30 秒回答

> 我把设计系统拆成四层职责。Radix 提供无样式的交互 primitive，负责焦点、键盘和 ARIA。CVA 把视觉 variant 集中成一份配置，组件 props 用 `VariantProps` 直接从这份配置推导，样式和类型永远只有一个真相源。Storybook 让每个状态脱离业务页面单独展示。底下用 MSW 在网络层拦截请求，浏览器和测试共用同一组 handlers，所以组件不用等后端就能独立开发、评审和测试。新增一个 variant 时，样式和类型一起变，不会漏。

## 自检

1. 能否一句话说清 Radix、CVA、Storybook、MSW 各自的职责？
2. 能否解释 `VariantProps` 消除掉的是哪一份重复定义？
3. 能否说出 `asChild` 对 props 透传和 ref 的要求？
4. 能否说清 MSW 为什么在网络层拦截，比直接 mock 函数多验证了什么？
5. 能否说明 variant 类型不等于运行时校验？
