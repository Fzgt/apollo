---
title: React / 性能 / 前端基础的英文说法
section: 面试英语
icon: gauge
---

# 讲 React 和性能时，母语者用的词

> 只收**你这场面试真会用到**的。每个词配一句能直接念出口的话。
> 读法有坑的标了音，那几个词你念错的概率不低。

## React 本身

| 说法 | 意思 / 用法 |
|---|---|
| **re-render** | 名词动词都行。`an unnecessary re-render` / `it re-renders on every keystroke` |
| **render** vs **paint** | render = React 算出该长什么样；paint = 浏览器真画到屏幕上。**别混用**，混用会被追问 |
| **mount / unmount / remount** | `the component remounts every time the route changes` |
| **memoize** | 动词。`we memoized the callback so the child could bail out` |
| **bail out** | React「决定不重渲染了」。`React bails out if the props are referentially equal` |
| **referentially equal** | 同一个引用。比说 "the same object" 准 |
| **stale closure** | 闭包抓住了旧值。`a stale closure kept reading the first page number` |
| **prop drilling** | 一层层往下传 props |
| **lift state up** | 把状态提到共同父组件 |
| **derived state** | 能算出来的状态就别存。`that's derived state — we compute it during render` |
| **server state vs client state** | **这场面试的关键词**。`server state goes to React Query; only client state needs Zustand` |
| **hydration** | SSR 后接管 DOM。`a hydration mismatch` = 服务端和客户端渲染结果对不上 |

## 性能：做的动作

| 动词 | 例句 |
|---|---|
| **profile** | `I profiled it before touching anything.` |
| **instrument** | 埋点。`we instrumented the app so we could see it in production` |
| **narrow it down** | `I narrowed it down to one layout thrash in the scroll handler.` |
| **virtualize / windowing** | `we virtualized the list — only about twenty rows exist at a time` |
| **code-split** | `we code-split the route` / `split the bundle by route` |
| **lazy-load** | `the detail view is lazy-loaded` |
| **prefetch** | `we prefetch on hover, so the detail page opens with zero requests` |
| **debounce / throttle** | debounce = 停下来才做；throttle = 固定频率做。**别说反** |
| **ship it behind a flag** | 挂在开关后面上线（JD 里的 feature flags 就是这个） |

## 性能：描述问题

| 说法 | 什么时候用 |
|---|---|
| **bottleneck** | 卡在哪。`the bottleneck was layout, not the network` |
| **jank / stutter / drop frames** | 卡顿。`the feed stuttered` / `we were dropping frames` —— 比 "it was not smooth" 专业得多 |
| **block the main thread** | `that parse was blocking the main thread for 200 milliseconds` |
| **layout thrash** | 读写 DOM 交替导致反复重排 |
| **white screen / blank screen** | 你百度那个白屏问题就说 `a blank screen on first load` |
| **regression** | 本来好的被改坏了。`we shipped a culling regression` |
| **baseline** | 改之前的基准。`we took a baseline first, so we could prove it moved` |
| **root cause** | `the root cause was a font that blocked rendering` |

## 数字怎么念（别念错）

```text
30 frames per second        → 口语可以说 "thirty FPS"，两种都行
900 milliseconds            → "nine hundred milliseconds" 或 "under a second"
2.4s → 900ms                → "it went from two point four seconds to under a second"
5 million daily page views  → "five million page views a day"
70%                         → "seventy per cent" 或 "about two thirds"（不确定就说约数）
```

**约数比精确数安全**：记不清就说 `roughly` / `about` / `on the order of`。报一个精确数字然后被追问细节答不上来，是最容易翻车的地方。

## 五个读音陷阱

| 词 | 正确读法 |
|---|---|
| **cache** | 读作 **cash**。不是「卡谢」，没有法语尾音 |
| **suite** | 读作 **sweet**。`a test suite` |
| **queue** | 读作字母 **Q**。后面 ueue 不发音 |
| **schema** | **SKEE-ma**。复数 schemas 就行 |
| **threshold** | **THRESH-hold**，中间没有 t 音 |

顺带两个已经在生词本里的：**halves**（l 不发音，近似 have + z）、**duplicate**（名词/形容词重音在前，动词重音在后）。

## 三个中式英语高频坑

| ❌ | ✅ |
|---|---|
| I spend two weeks **to** optimize it. | I spent two weeks **optimizing** it. |
| It has some **problem**. | There were **a couple of issues**. |
| The performance **is not good**. | The page **felt slow** / it **dropped frames**. |

第三条最重要：**讲现象，不讲评价**。"performance is not good" 传不出任何信息，"the list stuttered when you scrolled fast" 一句话就让对方看到画面。
