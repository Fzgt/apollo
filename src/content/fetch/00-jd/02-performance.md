---
title: 前端性能（主备场）
section: Fetch
icon: paw-print
---

# 前端性能

> JD 里性能出现三处，是这场面试我弹药最足、也最该主动带过去的一块。
>
> **答题顺序固定：先讲浏览器卡在哪一步（原理），再讲拿什么量（指标），再讲 React 层能做什么（手段），最后讲等待期的体验。** 上来就报手段列表是背书，先问"量到什么"才是工程。

## "Make the app feel fast" 是四件事

JD 原文 `Make the app feel fast: performance, rendering, loading states, perceived speed`。**注意动词是 feel（感觉），不是 be。** 这四个词经常被当成同义词，其实分工完全不同：

| 词 | 管的是 | 衡量方式 | 我的证据 |
| --- | --- | --- | --- |
| performance | 总量：加载了多少字节、执行了多少毫秒 | LCP、TTFB、bundle 大小 | 百度 P2 白屏排查链；Webpack 分包 + 持久化缓存 |
| rendering | 过程：浏览器和 React 各自重复做了多少无用功 | 帧率、长任务、React Profiler | 手写 `useVirtualList`，5M 日 PV 信息流 30→60 FPS |
| loading states | 等待期间屏幕上是什么 | 有没有骨架屏、有没有布局跳动 | BioMap TanStack Query 三层的 loading / error 编排 |
| perceived speed | 用户觉得有多快（可以和真实耗时无关） | INP、首次反馈时间 | 悬停预取，详情页零请求打开；Beyz 逐 token 流式 |

**这张表就是答题纸：他问哪个词，我从对应那一行进去。**

## 浏览器渲染原理——从 URL 到像素

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

## 性能指标——量什么，用什么量

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

## React 性能优化

### 先讲模型，不然优化手段全是背的

React 的更新分两个阶段：

1. **Render 阶段**：state 变了，React 重新调用组件函数，拿到新的元素树，和上一次的对比（reconciliation，协调）。**这一步是纯计算，不碰 DOM。**
2. **Commit 阶段**：把对比出的差异真正写进 DOM。**这一步会触发浏览器的 Layout 和 Paint。**

**最重要的一句话：组件重新渲染本身通常并不贵，贵的是重新渲染里做的事。** 一个返回十个节点的组件重跑一千次也不会卡；一个在渲染里排序两万条数据、或者提交了一次大规模 DOM 改动的组件，跑一次就掉帧。

**所以优化的第一步永远是用 Profiler 找出"哪次渲染贵"，而不是无差别地给所有组件套 `memo`。**

### 手段一：结构性优化（不写任何 memo 就能生效，优先做）

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

### 手段二：记忆化（memoization）

- **`React.memo(Component)`**：props 浅比较没变就跳过重渲染。**只有当父组件频繁重渲染、而这个子组件确实渲染得贵时才有意义。**
- **`useMemo(fn, deps)`**：缓存一次计算结果。用于真正昂贵的计算（排序、过滤大数组），或者用于**稳住一个对象/数组的引用**，好让下游的 `memo` 生效。
- **`useCallback(fn, deps)`**：稳住函数引用，同理。

**什么时候不该用：** 每个 `useMemo` 和 `useCallback` 自己也要存依赖数组、做比较，有成本。给一个渲染只要 0.1ms 的组件套 `memo`，纯粹是让代码更难读还更慢。**能说出"我不用 memo 的理由"，在这场面试里比会用更有分量**——因为 JD 要的是判断力。

**React 19 的 React Compiler**：编译期自动插入记忆化，目标就是让开发者不必手写 `memo` / `useMemo` / `useCallback`。知道有这回事、知道它改变的是"要不要手动优化"这个前提，就够了。

### 手段三：并发特性（直接对应 INP 指标）

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

### 手段四：加载与体积

- **代码分割**：`React.lazy` + `<Suspense>` 按路由拆包。首屏只下载首屏要的 JS。
- **列表虚拟化**：只渲染视口内的行。
- **图片**：`loading="lazy"`、现代格式（WebP / AVIF）、`srcset` 按屏幕给不同尺寸、**给图片写死宽高比以避免 CLS**。
- **字体**：`font-display: swap` 避免文字空白期；预加载关键字体。
- **Next.js 侧**：Server Components 让不需要交互的部分完全不进客户端 bundle；流式 SSR（streaming）让 HTML 分块到达，先出骨架再出数据。

## Loading states（加载态）

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

## Perceived speed（感知速度）

**核心命题：用户对快慢的判断，取决于他等待时的确定性和反馈，而不只是秒表读数。** 一个 800ms 但立刻给出反馈、有骨架、内容渐次出现的页面，主观上比一个 500ms 但白屏到最后一刻的页面快。

具体手段：

- **预取（prefetch）**：在用户还没点之前就把数据或代码取回来。悬停时预取详情页、视口内预取下一页、Next.js 的 `<Link>` 默认预取路由 chunk。
- **乐观更新**：见上。
- **即时反馈**：按钮按下的瞬间就有状态变化（禁用、变色、出现内联 spinner），哪怕请求还要 500ms。**没有反馈的按钮会被重复点击**，这既是体验问题也是数据问题。
- **渐进呈现**：先出文字再出图、先出首屏再出下面，而不是全部就绪才一次性显示。
- **流式传输（streaming SSR）**：服务端先把外壳的 HTML 发出去，数据好了再补。
- **占位内容优于空白**：模糊图预览（blur-up）、主色块占位。

---

## 我自己做过的性能工作，逐条对位

**这一块要主动讲，不要等他问。** 括号里是 v42 简历上的出处：

| JD 的词 | 我的证据 | 出自 |
| --- | --- | --- |
| rendering / FPS | 手写 `useVirtualList` 建在 `IntersectionObserver` 上，任何滚动深度活动 DOM 节点保持在 100 左右，滚动从 30 FPS 到稳定 60 FPS | 百度，5M+ 日 PV 的信息流 |
| perceived speed | TanStack Query 三层封装 + 悬停预取，详情页**一个请求都不发就打开** | BioMap |
| performance（体积与构建） | Webpack 3→5 迁移，跨 10+ 个不兼容的包，拆出 vendor 与 runtime chunk 并开持久化缓存，体积降约 15%、热构建时间降 70% | 百度 |
| rendering（渲染管线的真实故障） | 定位到雾（distance fog）以 JSX 声明导致每次颜色变化都重建雾对象，而雾属于材质的 program key，渲染器在一帧内重编译了场景里每一个材质；用一个"每帧统计管线构建数"的探针证实，改成复用同一个 fog 对象后消失 | WinterFell |
| rendering（绘制批次） | 每段障碍物合并为两个 `InstancedMesh` 共享一套矩阵，无头 Chromium 每帧采样渲染器统计：draw call 从 129 降到 76，提交三角形数升 2.6 倍；代价是每个 mesh 只有一个包围盒，失去逐实例视锥剔除 | WinterFell |
| cross-browser | 单个 `WebGPURenderer` 在支持 WebGPU 的机器上走 WebGPU，不支持的走它自己的 WebGL2 后端，观感在降级后仍然成立而不是悄悄劣化 | WinterFell |
| polishing the last 10% | 上面那个雾的 freeze bug 就是标准范例：现象诡异、根因在渲染管线深处、修法只有一行 | WinterFell |

### WinterFell 那两条要翻译再讲

**three.js / WebGPU 的工具不可迁移，别当 React 性能答案原样搬。** 能迁移的是方法论，讲的时候要落在这两句上：

- **先量再改**：靠一个"每帧统计管线构建数"的探针把猜测变成证据——这和前端里"先接 RUM、再用 Performance 面板定位"是同一件事。
- **承认取舍**：draw call 降了，但三角形涨 2.6 倍、丢了逐实例剔除。**主动说出代价，比报一个漂亮数字更有说服力**，而 JD 要的正是这种判断。

### 三个缺口和该怎么答

- **loading states 我简历上一个字都没有。** 没有骨架屏、没有 Suspense 边界、没有乐观更新的记录。**最容易被问也最好补**——答法是把上面那张「选哪种加载态」的表当成我的判断标准讲出来："我按内容结构是否已知来选骨架还是 spinner，短请求延迟 200ms 再显示"。**说标准本身就是 taste 的展示。**
- **Core Web Vitals 我没有在生产环境采集上报过。** 我量过的是 FPS、draw call、构建时间、bundle 体积——全是实验室数据，没有现场数据。诚实的说法：我的性能工作偏渲染和构建，用户侧 RUM 没落地过；要做的话第一步是接 `web-vitals` 把 LCP / INP / CLS 打到后端，先有现场数据再决定优化谁。**这条同时接住 JD 里的 observability。**
- **`useVirtualList` 几乎必被追问"为什么不用现成库"**，"手写"两个字自带挑衅。要准备好：当时的取舍是什么、动态高度怎么处理、和 react-window / TanStack Virtual 比差在哪。

**所有数字都要说得出怎么量的。** "体积降 15%、热构建降 70%"被问"怎么量的"答不上来，比数字小得多更致命——那是编造的信号。
