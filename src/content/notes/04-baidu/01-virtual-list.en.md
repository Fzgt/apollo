---
title: "① The virtualized feed"
section: Baidu
---

# ① The virtualized feed

> **Resume line**
>
> Built a **virtualized React feed** serving **5M+ daily page views** on a custom **useVirtualList** hook over **IntersectionObserver**: **live DOM nodes stay near 100 at any scroll depth**, scroll **from 30 to a stable 60 FPS**.

## What this bullet is about

**In one line: an infinite-scroll feed grows its DOM forever, and once it reaches a few hundred nodes the frame rate collapses.**

⭐ **But the real value of this bullet is not "I built a virtual list" — there are libraries for that. It is that you can account for all three numbers: 5M PV is not your achievement, it is your environment; ~100 nodes is something you measured yourself; 60 FPS is three optimisations stacked.**

**The three numbers are of completely different kinds, and blurring them gets you caught:**

| Number | Kind | Who measured it |
|---|---|---|
| **5M+ daily PV** | **Scale credential** | The analytics system — **you only read the report** |
| **DOM nodes ~100** | **Optimisation result** | **You**, with DevTools |
| **30 → 60 FPS** | **Optimisation result** | **You**, with DevTools |

## The 30-second version

> This is a feed page, on the order of five million page views a day. **The problem is that infinite scroll makes the DOM grow without limit** — ten screens is over two hundred rows, and after a while it is five hundred or more, at which point scrolling drops straight to thirty frames per second.
>
> The key realisation: **the user can only see about a dozen rows at once; the rest merely need to pretend to exist**. So I wrote a `useVirtualList` that renders only the visible range plus a few rows of buffer above and below, with an outer container stretched to the full height to keep the scrollbar honest, and each row positioned with `transform: translateY`.
>
> ⭐ **The real win is not "how many nodes went away", it is that the complexity class changed** — before, DOM count grew with the number of rows loaded, O(n); after, it grows only with viewport height and is independent of the data, **so the user can scroll ten thousand rows and the DOM still holds the same twenty-odd nodes**. Scrolling went back to a stable 60 fps.

## 1. ⭐ First, why more nodes means slower

**The browser goes through five steps to render each frame** — this pipeline is the foundation under every front-end performance problem:

| Step | What it does | What its cost scales with |
|---|---|---|
| **JS** | Runs your code and mutates the DOM | Amount of code |
| **Style** | Works out which CSS rules finally apply to each node | ⭐ **Node count** |
| **Layout** (reflow) | Computes each node's **position and size** | ⭐ **Node count** (the most expensive step) |
| **Paint** | Draws each node into pixels | Pixel area |
| **Composite** | Assembles the painted layers and hands them to the GPU | Layer count |

**"Reflow" = recomputing the geometry of every node.** It is expensive because ⭐ **one node's position affects the position of every node after it**, so the cost scales linearly with total node count.

⭐ **That is why 500 nodes drop frames**: not because "nodes use memory", but because **every single frame's Layout has to walk all 500 of them.**

## 2. ⭐ Why it lands on exactly "30" (that number is not a guess)

**Saying this out loud raises your credibility noticeably.**

A display refreshes on a fixed cadence (vsync; at 60 Hz that is once every 16.67 ms). The browser has to hand over the frame **before the next vsync**.

⭐ **Once a frame misses, it is not delivered "slightly late" — it waits for the next vsync.** So the actual frame interval jumps from 16.67 ms to **33.3 ms**, which is exactly **30 FPS**.

```
frame under 16.67 ms         → 60 FPS
frame 16.67 – 33.3 ms        → drops to 30 FPS (not 45, not 50)
frame 33.3 – 50 ms           → drops to 20 FPS
```

⭐ **So "30 FPS" is a harmonic of 60, the typical steady state when frames are being dropped.** It says each frame at the time cost between 16.67 and 33.3 ms — over budget, but not by much.

**It also answers "why does it land back on exactly 60": push each frame back under 16.67 ms and it returns to 60 automatically, with no intermediate state.**

> **60 FPS = a 16.67 ms budget per frame, and the browser spends part of that itself, so what is really left for your JS is around 10 ms.**

## 3. The two layers of a virtual list (the spacer is the point)

**The naive idea — "just render the visible ten" — has an immediate problem: the scrollbar disappears**, because the page only contains ten rows' worth of height and the browser believes that is all there is.

**So it splits into two layers:**

```
outer container (stretched to the full height: row count × row height)  ← ⭐ purely to fool the scrollbar; called the spacer
  └── each inner row (position: absolute + transform: translateY(that row's offset))
```

⭐ **The outer layer's job is to pretend to be ten thousand rows tall; the inner layer's job is to draw only the ten you can see.**

### Why `transform` and not `top` (memorise this)

| What you change | Which steps it triggers |
|---|---|
| `top` / `left` / `width` / `height` | ⚠️ **Layout → Paint → Composite** (the whole pipeline, most expensive) |
| `background-color` / `box-shadow` | Paint → Composite |
| ⭐ `transform` / `opacity` | **Composite only** (the GPU moves the layer; the CPU barely participates) |

**Why**: changing `top` changes where the element sits in the document flow, **which affects other elements** → reflow required. ⭐ **Changing `transform` moves an already-painted image somewhere else; in the document flow it never moved** → it affects nobody, so the browser can hand the translation straight to the GPU.

## 4. "~100" was calculated, not invented

**How many rows get rendered is a definite formula:**

```
rows rendered = ceil(viewport height / item height) + overscan × 2 + 1
```

Substituting typical mobile values (viewport 600, item height 80, overscan 3): `ceil(600/80) = 8`, then `8 + 3×2 + 1 = 15` — **fourteen or fifteen rows**.

⭐ **Note that this is rows, not nodes.** Multiply by the nodes per card to reach the 100 on the resume: one feed card (outer div + image container + `img` + duration badge + right column + title + footer + author + play count) is **eight or nine elements at minimum**, so `14 × 8 ≈ 110`.

### overscan is a trade-off; smaller is not better

`overscan` (the **buffer**) means rendering a few extra rows above and below the visible range:

| overscan | DOM count | On fast scroll |
|---|---|---|
| Small (0–1) | Fewer | ⚠️ **Blank flash** — the new rows have not mounted yet and the user sees empty space |
| Large (5–10) | More | Smooth, but the DOM and memory come back |

⭐ **So "around one hundred" is itself the product of that trade-off.** When asked "why not set overscan to 0 and cut the node count further", the answer is the blank flash.

## 5. How the three numbers were measured (this section is the important one)

### DOM node count

| Method | Note |
|---|---|
| `document.querySelectorAll('*').length` | Fastest and crudest — **it counts the whole page**, and **only Elements, not text nodes** |
| `document.querySelector('#feed-list').children.length` | Counts only the items inside the list container: **accurate** |
| ⭐ **DevTools → Performance Monitor** | There is a live line labelled **DOM Nodes**. **Watch it while you scroll: before, it climbs monotonically; after, it is a flat line** |
| Memory panel heap snapshot | Verifies **that reclamation actually happens** — search `Detached` to see whether scrolled-past rows were really removed |

⭐ **"A flat line" is more convincing than any number. If you want to demo it live to an interviewer, use the Performance Monitor.**

> ⚠️ **The two tools count different things, and you must say which before quoting a number**: `querySelectorAll('*')` **counts Elements only**; DevTools' `DOM Nodes` **counts all Nodes, including text nodes and comments**. **On the same page the two can differ by nearly a factor of two.** The 100 on the resume is **the Element count inside the list container.**

### FPS

| Tool | Use |
|---|---|
| **Rendering → Frame Rendering Stats** | A live overlay in the top-left corner; **a qualitative check you can finish in thirty seconds** |
| ⭐ **A Performance panel recording** | **The most convincing evidence** — the FPS strip at the top (red = dropped frames), the Frames track (actual duration of each frame), the Main track (what the main thread was doing during the dropped frames) |
| **Performance Monitor** | `CPU usage` / `Layouts per sec` / `Style recalcs per sec` — **direct proof that the layout stage is what is being hammered** |
| Counting frames yourself with `requestAnimationFrame` | Runs **on a real device in real conditions**. ⚠️ **But it is on the main thread too, so when the main thread is saturated it is delayed as well, which makes the number optimistic under heavy load** |
| `PerformanceObserver` watching long tasks | **A single task holding the main thread for more than 50 ms is a long task, and one of them means three consecutive dropped frames.** This lens is more useful than FPS — **it points straight at the code that stalled** |

⭐ **DOM node count, layout time and frame rate should all appear in the same Performance recording — that is a complete causal chain rather than three isolated numbers.**

### ⚠️ An FPS number is meaningless without the device and the scenario

| What to state | Why |
|---|---|
| ⭐ **Which machine it was measured on** | The same page is a solid 60 on a flagship and struggles to hold 30 on a budget phone. **If you used DevTools CPU throttling (4×/6× slowdown) to simulate a low-end device, say so** — it is the standard lab technique and saying it earns you points |
| **Slow steady scroll or a fast fling** | **Fast scrolling is the stress test**; a slow scroll may not drop a single frame |
| ⭐ **At what scroll depth** | **That pre-optimisation 30 FPS was certainly measured after the list had accumulated a few hundred rows** — with only twenty or thirty rows loaded, even rendering all of them is fine |

### ⭐ How to defend the word `stable`

`a stable 60 FPS` is **a stronger claim than "60 FPS"**: it promises there is no variance. And ⭐ **FPS is a metric you cannot simply average**:

| | How it feels |
|---|---|
| A steady 30 | A bit heavy, but **even** |
| Bouncing between 10 and 60, averaging 30 | ⚠️ **Obviously janky** |

⭐ **What users perceive as "laggy" comes from frame-time variance, not from mean frame rate.** So modern performance work looks at **frame-duration percentiles (p95/p99), long-task counts and dropped-frame counts**, and **INP** in the field.

> ⭐ **How to answer**: "By stable I mean that in the Performance recording of the scroll there are no red dropped-frame markers and no frame in the Frames track exceeds 16.67 ms — **not that the average reached 60**." **Defining `stable` as "no long frames" rather than "a high average" is both accurate and sounds professional.**

## 6. ⭐ Quantified attribution: which steps actually raised the frame rate

**This is the hardest-edged part of the bullet — every line has matching evidence in DevTools:**

| # | What was done | Why it got faster | Where to see it in DevTools |
|---|---|---|---|
| 1 | **DOM from 500+ to a constant ~100** | Layout time from ~10 ms to ~0.5 ms | `Layouts/sec` in the Performance Monitor |
| 2 | **`transform` instead of `top`** | Composite only, done by the GPU, no main-thread pressure | Paint events drop noticeably in a recording |
| 3 | **`passive: true` on scroll** | Tells the browser "I will not call `preventDefault()`", so **it can start scrolling immediately instead of waiting for the JS to finish** | The scroll handler no longer blocks compositing in a recording |
| 4 | ⭐ **IntersectionObserver instead of scroll + `getBoundingClientRect()`** | The latter **forces a synchronous layout** on every scroll event | ⭐ **DevTools flags it for you** — a yellow triangle on the Main track plus `Forced reflow is a likely performance bottleneck` |

**Item 4 deserves its own explanation**: ⭐ **a "forced synchronous layout" (also called layout thrashing) is when your JS reads a geometry property (say `getBoundingClientRect()`) and the browser, to give you an accurate answer, is forced to run Layout synchronously right then.** `IntersectionObserver` lets the browser compute this asynchronously on its own schedule and notify you, **which sidesteps that step entirely**.

⭐ **And that warning is not something you inferred, it is the browser's own report** — "before the change DevTools was continuously reporting forced reflow, and after switching to IntersectionObserver the warning disappeared" is concrete evidence you can produce.

## 7. 5M PV: it is the environment, not the achievement

⭐ **That number is not your achievement, it is your working environment.** The same virtual list on a personal blog and on a feed doing five million page views a day mean completely different things as engineering.

**The resume uses `serving` correctly** — it describes carrying the load, it does not claim to have produced it. ⚠️ **Do not say brought or grew when speaking either.**

### What PV means, and how it differs from the neighbouring metrics

| Metric | One person opening it 10 times counts as |
|---|---|
| **PV** (page views) | **10** |
| **UV** (unique visitors) | 1 |
| **DAU** (daily active users) | 1 |
| **Impressions** | ⚠️ One page load can produce **dozens** |

⭐ **The easiest place to get caught**: one load of a feed scrolls dozens of items past the user, **so at 5M page views the impression count could be 50 million or more**. If the number you remember was actually impressions, **`page views` is the wrong term and the figure is inflated tenfold**.

### Where it comes from: it is not measured, it is instrumented

⭐ **No front-end API can tell you how many times a page was opened today.** The only way is to send a record to the server on each open and have the back end aggregate:

```
user opens the page → analytics SDK reports → log server → warehouse / stream aggregation → BI report gives daily PV
```

⭐ **You (the front end) own only the first segment. 5M was read off a report, not computed by you — and you must say so, because it determines how the attribution is phrased.**

**Internal products used internal instrumentation and a BI dashboard, not the public Baidu Analytics product.** ⚠️ **If you cannot remember what the internal platform was called, say "internal instrumentation and a BI dashboard" — never invent a system name; being caught inventing one is far worse than not remembering.**

**Why PV is inherently undercounted**: ad blockers block analytics domains, users who bounce instantly leave before the SDK loads, and network requests fail. ⭐ **So real traffic is generally ≥ the PV in the report — writing `5M+` with the plus sign on a resume is legitimate.**

### How to phrase ownership

- ✅ "The feed I owned **served** 5M+ daily page views"
- ❌ "I **brought in** 5M+ page views"

⭐ **The better answer translates the scale into an engineering constraint**: "At that volume one dropped frame affects millions of users, so any change has to be rolled out gradually and has to have performance monitoring. **That is also why we did not just pull in a third-party virtual list library and instead wrote a hook we controlled.**" — **which turns the number from bragging into the basis of a technical decision.**

## 8. Why write it yourself instead of using a library (expected follow-up)

> "Honestly: **at the time it was more a team constraint than a technical judgement** — bringing in a third-party library required an evaluation process, while this requirement had clear edges and a fixed item structure. **The cost of writing it yourself is that dynamic heights, keyboard navigation and accessibility are all corners you have to fill in, whereas a mature library has handled them.** If I did it today I would start with TanStack Virtual, unless its API blocked some customisation I needed."

⭐ **Volunteering "I would pick a library now" is far more credible than insisting "hand-rolled was better".**

**One honest addition**: this feed's cards **were not a uniform height to begin with** (some carry a cover image, some do not), so `visibleCount` itself floats with scroll position — ⭐ **that is the second source of the `near` in `near 100`**. The standard treatment for dynamic heights is "estimated height + `ResizeObserver` correction" or "an offset table + binary search".

## Glossary

| 中文 | English |
|---|---|
| 虚拟列表 | **virtualized list** (*a virtualized React feed*) |
| 信息流 | **feed** |
| 无限滚动 | **infinite scroll** |
| 视口 | **viewport** |
| 渲染流水线 | **the rendering pipeline** |
| 重排 | **layout / reflow** |
| 重绘 | **paint / repaint** |
| 合成 | **compositing** |
| 强制同步布局 | **forced synchronous layout · layout thrashing** |
| 掉帧 | **dropped frames** |
| 长帧 | **long frame** |
| 帧预算 | **frame budget** (*16.67 ms per frame*) |
| 长任务 | **long task** |
| 主线程 | **main thread** |
| 撑高度的占位容器 | **spacer** |
| 缓冲条数 | **overscan** |
| 白闪 | **blank flash** |
| 存活节点 | **live DOM nodes** |
| 节点 ↔ 元素 | **node ↔ element** (⚠️ node includes text nodes; the two can differ by nearly 2×) |
| 分离节点（泄漏） | **detached DOM nodes** |
| 降速模拟 | **CPU throttling** (*4× slowdown*) |
| 快速甩动 | **fling / flick scroll** |
| 方差 | **variance** (*jank comes from frame-time variance*) |
| 卡顿 | **jank** |
| 埋点 / 上报 | **instrumentation · report** |
| 曝光量 | **impressions** (⚠️ do not confuse with page views) |

> ⭐ **The three easiest to get wrong**:
>
> 1. "The complexity class changed" is **DOM count stopped growing with the data and became a function of viewport height** — more convincing than saying "O(n) to O(1)"
> 2. Define "a stable 60 fps" as **no frame over 16.67 ms**, not "the average was 60"
> 3. "Carrying 5M PV" uses **serving**; ⚠️ never `brought` or `grew`
