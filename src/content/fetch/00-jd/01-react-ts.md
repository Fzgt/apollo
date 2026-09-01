---
title: React + TypeScript 基础
section: Fetch
icon: paw-print
---

# React + TypeScript 基础

> JD 里唯一的硬要求：**Strong React + TypeScript fundamentals**。fundamentals 这个词的意思是可能问原理，不只是"你用过什么"。
>
> 这一篇按"被问到会答不上来"的概率排序，不按教科书顺序。

## 一、React 的心智模型

### 1.1 一次更新到底发生了什么

```
state 变了
  → Render 阶段：React 重新调用组件函数，拿到新的元素树，
                 和上一次做 diff（reconciliation，协调）。纯计算，不碰 DOM
  → Commit 阶段：把差异写进真实 DOM，跑 layout effect，浏览器接着 Layout / Paint
```

**要记住的一句：组件重新渲染本身通常不贵，贵的是重新渲染里做的事。** 一个返回十个节点的组件重跑一千次也不卡；一个在渲染里排序两万条数据、或提交一次大规模 DOM 改动的组件，跑一次就掉帧。这句话是后面所有性能回答的地基（见《前端性能》）。

### 1.2 state 是一次快照，不是一个变量

这是最能区分"会用"和"懂"的一题：

```jsx
const [count, setCount] = useState(0);

function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}
// 结果是 1，不是 3
```

**因为这一次渲染里的 `count` 是被闭包捕获的常量 0，三次调用都是 `setCount(0 + 1)`。** 要累加必须用函数式更新：

```jsx
setCount((c) => c + 1); // 三次调用得到 3
```

同一个坑的另一副面孔是 **`setTimeout` 里读到旧值**、以及**事件处理器里读到旧的 props**。答"用函数式更新"只是手段，能说出"state 是本次渲染的快照"才是原理。

**批处理（batching）**：React 18 起，同一个事件里的多次 setState 会合并成一次重渲染，而且**扩展到了 Promise、`setTimeout`、原生事件回调里**（React 17 只在 React 事件里批）。需要立刻拿到 DOM 更新后的结果时用 `flushSync`，但那是逃生舱，用它等于放弃批处理。

### 1.3 不可变更新

state 必须换新引用，改原对象 React 认不出来：

```jsx
// 不生效
items.push(next); setItems(items);
// 生效
setItems([...items, next]);
```

原因就是 diff 靠的是引用比较（`Object.is`）。这一条同时解释了为什么 `useMemo`/`React.memo` 会失效——上游随手造了个新对象。

### 1.4 `useEffect`：它是同步外部系统用的，不是"生命周期"

**Effect 的定义：把 React 之外的东西（订阅、DOM API、计时器、第三方库、浏览器事件）和 React 的 state 同步起来。** 大多数人写的 effect 其实不该存在：

| 你想做的事 | 该不该用 effect | 该怎么做 |
| --- | --- | --- |
| 从 props/state 算出一个值 | **不该** | 渲染时直接算，贵才 `useMemo` |
| 用户点击后发一次请求 | **不该** | 写在事件处理器里 |
| 页面进来取数据 | 可以，但更该 | 交给 TanStack Query / RSC / 路由 loader |
| 订阅 WebSocket、`resize`、`IntersectionObserver` | **该** | effect + 清理函数 |
| props 变了要重置内部 state | **不该** | 改组件的 `key`，让 React 重建这棵子树 |

**清理函数（cleanup）是 effect 的一半。** 订阅要退订、计时器要清、请求要能被取消（`AbortController`），否则组件卸载后 setState 会内存泄漏、竞态会让旧响应覆盖新响应。

**StrictMode 在开发环境故意把 effect 挂载→卸载→再挂载一次**，就是为了逼出没写清理的 effect。被问"为什么我的请求发了两次"，这是标准答案。

**依赖数组**：里面要写 effect 内部用到的每一个响应式值。空数组不是"只跑一次"的许可证，是一个断言——"我用到的东西永远不变"。撒谎就得到过期闭包。

### 1.5 `useRef` 与 `useState` 的分工

- 改了要重新渲染 → `useState`
- 改了不该重新渲染（DOM 节点、计时器 id、上一次的值、不参与渲染的可变量）→ `useRef`
- **渲染期间不能读写 ref**，那是副作用；ref 只在事件处理器和 effect 里用

### 1.6 `key` 与协调

同一位置、同一类型的元素，React 复用实例并只更新属性；类型变了或 key 变了，**整棵子树卸载重建，内部 state 全丢**。

- 列表用**稳定 id** 做 key。用数组下标，中间插一项会让后面所有项被当成"内容变了"，重建一片，还会把输入框里已经输入的内容错位。
- 反过来，**故意改 key 是重置一棵子树状态的正规做法**（切换用户时重置整个表单）。

### 1.7 受控与非受控

值由外部 state 管（`value` + `onChange`）叫受控；组件自己管（`defaultValue`）叫非受控。**好的组件两种都支持**——这是"modern component patterns"里最基础的一条，也是被问组件 API 设计时最短的切入点。

顺带一个真实取舍：**表单全受控意味着每次按键整个表单重渲染**。React Hook Form 之所以快，就是默认走非受控 + ref 订阅。这是一个能同时展示 API 设计和性能判断的答案。

### 1.8 Context 不是状态管理器

Context 解决的是"传递"，不是"存储"。**一个 Context 的 value 变了，所有消费它的组件都会重渲染，不管它们读的是 value 里的哪个字段。** 解法是按变化频率拆 Context（`user` 和 `theme` 分开），或用 `useMemo` 稳住 value 的引用。高频变化的全局状态该用 Zustand / Jotai 这种带选择器订阅的库。

### 1.9 自定义 Hook

自定义 hook 就是一个会调用别的 hook 的函数，**它复用的是逻辑不是状态**——两个组件用同一个 `useX`，各自持有独立的一份 state。这是"我怎么组织代码"这类问题的标准答案，比讲文件夹结构有内容。

### 1.10 错误边界

React 里唯一还必须用 class 写的东西（或者用 `react-error-boundary`）。它捕获渲染期、生命周期、构造函数里的错误，**捕获不到事件处理器、异步代码、SSR 里的错误**——这条边界很常被问。它同时是《前端地基》里 observability 的第一环。

### 1.11 Next.js 侧要能说清的几条

Fetch 的栈是 TypeScript / React / Next.js / NestJS / GCP，产品报价流就是 Next：

- **Server Components 默认不进客户端 bundle**，只有标了 `'use client'` 的那棵子树才进。**这是 2026 年最直接的体积优化手段。**
- `'use client'` 是一条**边界**不是一个文件属性：它下面 import 的所有东西都进客户端包。
- **Server Component 可以把 Client Component 当壳，用 children 塞进去**——这样重的服务端内容不必变成客户端组件。
- **Server Actions**：从客户端直接调服务端函数，表单不必手写 API 路由。
- **流式 SSR**：HTML 分块到达，先出骨架再出数据，对应 `<Suspense>` 边界的粒度选择。

## 二、TypeScript 基础

### 2.1 结构化类型（structural typing）

TS 比的是形状不是名字。两个不同名字但字段一致的类型互相兼容。对象字面量直接赋值时会额外做**多余属性检查**（excess property check），这就是"我明明多传了个字段却报错、先赋给变量再传就不报"的原因。

### 2.2 用判别联合建模状态，别用一堆 boolean

**这是我在这场面试里最该主动展示的 TS 用法**，因为它同时解决 JD 里的两件事：loading states 和 AI 功能的 "what happened" 状态。

```ts
// 坏：四个 boolean 能表达 16 种组合，其中 12 种是非法状态
type Bad = { loading: boolean; error: boolean; empty: boolean; data?: Item[] };

// 好：非法状态无法被表达（make illegal states unrepresentable）
type Result<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function render(r: Result<Item[]>) {
  switch (r.status) {
    case 'success': return <List items={r.data} />;  // 这里 data 一定存在
    case 'error':   return <Retry message={r.error.message} />;
    case 'loading': return <Skeleton />;
    case 'idle':    return null;
  }
}
```

**接我的简历：Beyz 那条"四状态机丢弃重叠的生成"，本质就是这个模型。** 讲状态管理、讲 loading states、讲 AI 界面，都可以从这里进。

配套技巧：在 `switch` 的 `default` 里放一个 `assertNever`，将来加了新状态而漏处理时，**编译期就红**：

```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled: ${JSON.stringify(x)}`);
}
```

### 2.3 `unknown` 而不是 `any`，然后收窄

`any` 关闭检查并会向外传染；`unknown` 是"我还不知道是什么"，用之前必须收窄。收窄手段：`typeof`、`in`、`Array.isArray`、判别字段、类型守卫 `x is Foo`、断言函数 `asserts x is Foo`。

**外部数据（API 响应、`localStorage`、模型输出）一律先校验再当类型用**——这就是 Zod 的位置：

```ts
const Claim = z.object({ text: z.string(), sourceUrl: z.string().url() });
type Claim = z.infer<typeof Claim>;   // 类型从 schema 推出来，只有一份真相
```

**这条直接接 Periplus**：schema 约束模型输出、应用代码而不是提示词强制引文归属，运行期校验和编译期类型来自同一个 schema。JD 里的 structured outputs 就是这件事。

### 2.4 泛型：约束比参数重要

```ts
// 只接受"有 id 的东西"，并且返回值的类型跟着入参走
function byId<T extends { id: string }>(items: T[]): Record<string, T> { ... }
```

泛型组件同理：

```tsx
function Select<T>(props: { items: T[]; getLabel: (item: T) => string; onPick: (item: T) => void }) { ... }
```

被问"泛型什么时候该用"，答案是：**当输入和输出的类型之间存在关系时**。只是想"接受任意类型"那是 `unknown`。

### 2.5 常用工具类型

`Partial` / `Required` / `Pick` / `Omit` / `Record` / `ReturnType` / `Awaited` / `Parameters` / `NonNullable`。会用是及格线；能说出它们靠映射类型和条件类型实现，是加分。

`keyof`、索引访问 `T['field']`、`typeof` 取变量的类型——**这三个组合起来就是"类型跟着数据走"**，别手写第二份类型定义。

### 2.6 `as const` 与 `satisfies`

```ts
const ROUTES = { home: '/', quote: '/quote' } as const;   // 值变字面量类型，只读
type Route = (typeof ROUTES)[keyof typeof ROUTES];        // '/' | '/quote'

const theme = { primary: '#1E88E5' } satisfies Record<string, string>;
// satisfies：既检查它符合约束，又保留字面量的精确类型（不会被拓宽成 string）
```

**`as` 是断言，是关掉检查；`satisfies` 是检查。** 能讲清这个区别，比背工具类型有用。而且这条直接回答"你什么时候用 `as`"——答案应该是"尽量不用，除非我比编译器更清楚，且我知道它不做运行期检查"。

### 2.7 React 里的 TS

```tsx
// 复用原生元素的全部属性，别手写一遍
type ButtonProps = React.ComponentProps<'button'> & { variant?: 'primary' | 'ghost' };

// ReactNode = 任何能渲染的东西（推荐）；ReactElement = 必须是一个元素
type Props = { children: React.ReactNode };

// 事件类型
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
```

`useState` 大多数时候让它自己推断；只有初始值是 `null` 或空数组时才显式给：`useState<Item[]>([])`、`useState<User | null>(null)`。

### 2.8 严格模式相关

`strict` 打开是默认前提。值得提一句的是 **`noUncheckedIndexedAccess`**：开了之后 `arr[0]` 的类型是 `T | undefined`，逼你处理越界。它不是所有项目都开，但知道它存在说明想过类型安全的边界在哪。

## 三、现场可能被问的实操

一小时的一面，除了讨论，可能有一段小的现场编码或读代码。最可能的几种：

- **给一段有 bug 的组件让我找问题**——过期闭包、缺依赖、缺清理、用下标当 key，是四个最常见的种子。
- **写一个 `useDebounce` 或 `useLocalStorage`**——考的是清理函数、依赖数组、ref 的用法。
- **把一堆 boolean 重构成判别联合**——正好是 2.2。
- **看一个卡的列表让我说怎么优化**——先问怎么量，再答结构性优化，再答虚拟化，最后才是 memo。顺序本身就是答案（见《前端性能》）。

**答任何一题的收尾都补一句取舍。** 这场面试考的是判断，不是记忆。
