---
title: "#5 · 500+ → ~20 DOM nodes"
section: Day 1 · 数字口径
icon: calculator
day: 1
level: 前置
status: done
---

# #5 · `500+ → roughly 20 DOM nodes`

> **材料说明**：百度代码不在本机，材料是 `LEARNING_NOTES_BAIDU.md` + 回忆。
>
> 但和 [#4](/docs?section=numbers&item=n04-daily-pv) 性质**完全相反**：5M+ PV 是别人的系统报给你的，**这一条是你自己拿浏览器量出来的**。所以它要答的是「我用什么工具、在什么条件下量的」——而这个数字**能当场在任何一个虚拟列表页面上复现给面试官看**。

## 对应简历原句

Baidu 第 2 条 bullet（v40）：

> Built a virtualized React feed serving 5M+ daily page views on a custom useVirtualList hook over IntersectionObserver, **cutting live DOM nodes from 500+ to roughly 20** and scroll from 30 to a stable 60 FPS.

---

## 一、这两个数字真正在讲什么

大多数人会把重点放在「500 变成 20，少了 25 倍」。**这不是重点。**

真正的重点是**复杂度的量级变了**：

| | DOM 数量随什么增长 | 复杂度 |
|---|---|---|
| **优化前**（全量渲染） | 随**已加载的数据条数**增长 | **O(n)** |
| **优化后**（虚拟列表） | 随**视口高度**增长，跟数据量无关 | **O(1)** |

这一点很关键，因为它顺带解释了 `500+` 里那个加号：

**优化前的 DOM 数不是一个固定值，它是「用户滚到第几屏」的函数。** 这是个无限滚动的 feed——滚 10 屏是 200 条，滚 30 屏是 600 条，滚一晚上理论上没有上限。所以 `500+` 是**某一次观测的样本**，不是天花板。

> **面试里这么讲**：「优化前的问题不是 500 这个数大，而是它会一直涨。虚拟列表把它从随数据量增长变成了只随视口高度增长——用户滚一万条，DOM 里还是那二十来个。」

**这个说法比「减少了 25 倍」有力得多**，因为它说的是性质，不是一次测量。

---

## 二、「20」是算出来的，不是拍脑袋定的

按笔记里那份 `useVirtualList` 骨架，渲染多少个 item 是一个确定的公式：

```ts
const visibleCount = Math.ceil(containerHeight / itemHeight);        // 视口能放几个
const startIndex   = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
const endIndex     = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);
```

所以：

```
渲染数 = visibleCount + overscan × 2 + 1
       = ceil(视口高度 / item 高度) + overscan × 2 + 1
```

**三个输入决定输出**：视口高度、item 高度、overscan。

代入笔记里的例子（`containerHeight 600`、`itemHeight 80`、`overscan 3`）：

```
visibleCount = ceil(600 / 80) = 8
渲染数 = 8 + 3×2 + 1 = 15
```

要凑到 ~20，大概是视口能放 12–13 个 item 的情况。**这就是为什么简历写的是 `roughly 20` 而不是 `20`——`roughly` 是诚实的，因为它本来就不是定值。**

### overscan 是个取舍，不是越小越好

`overscan` 是在可视区上下**多渲染**几个作为缓冲：

| overscan | DOM 数 | 快速滚动时 |
|---|---|---|
| 小（0–1） | 更少 | **白闪**——新 item 还没挂载，用户先看到空白 |
| 大（5–10） | 更多 | 平滑，但 DOM 和内存回去了 |

**所以「20」这个数本身就是这个取舍的产物。** 面试官如果问「为什么不干脆降到 10？」，答案就是白屏——降到只渲染可见区，快速滚动时用户会看到撕裂。

---

## 三、怎么统计（这一节是重点）

### 方法一：控制台一行，最快但最糙

```js
document.querySelectorAll('*').length
```

**问题有两个：**

1. **它数的是整页所有元素**，包含导航栏、侧边栏、弹窗、埋点插入的隐藏节点——和列表无关的一大堆
2. **它只返回 Element，不含文本节点和注释节点**

更准的写法是只数列表容器里的项：

```js
document.querySelector('#feed-list').children.length          // 直接数子元素
document.querySelectorAll('[data-index]').length              // 或按渲染时打的标记数
```

### 方法二：Chrome DevTools → Performance Monitor（推荐）

`Cmd+Shift+P` → 输入 `Show Performance Monitor`。

它有一条实时曲线就叫 **DOM Nodes**。**这个工具是证明这条 bullet 最有说服力的方式**：一边滚动一边看那条线——

- 优化前：随着滚动**单调上升**，一路涨
- 优化后：**一条平线**，滚多久都不动

**「一条平的曲线」比任何数字都直观。** 如果要给面试官现场演示，用这个。

### 方法三：Performance 面板录制

录一段滚动，Summary 区域会给出 Nodes 计数，还能和 Layout / Recalculate Style 的耗时对上——**这是把「DOM 少了」和「所以帧率上去了」串起来的证据**，第 6 项 FPS 那条会用到。

### 方法四：Memory 面板 heap snapshot

用来验证**回收有没有泄漏**：滚过去的 item 应该被真的移除，而不是变成 detached DOM 挂在内存里。快照里搜 `Detached` 就能看到。

**这条是加分项**——虚拟列表最隐蔽的 bug 就是「移出了 DOM 但被闭包引用着没释放」，滚久了内存爆掉。能主动提说明你真跑过。

### ⚠️ 两个工具口径不一样，报数前要说清用的哪个

| 工具 | 数的是什么 |
|---|---|
| `querySelectorAll('*').length` | **只有 Element** |
| DevTools 的 `DOM Nodes` | **所有 Node**，含文本节点、注释节点 |

一个文字多的 feed 卡片，光文本节点就能占一半。**同一个页面用这两种方法量，结果能差近一倍。** 被追问「你怎么量的」，答「DevTools Performance Monitor 的 DOM Nodes」和答「`querySelectorAll('*')`」是两个不同的数，别混着说。

---

## 四、按「审什么」逐条过

### ① 怎么统计的

见上一节。**准备一个主答案 + 一个备选**：

> 主要看 DevTools 的 Performance Monitor，因为它能实时看曲线——优化前那条线随滚动一直涨，优化后是平的。要精确数就在控制台数列表容器的子元素。

### ② 不同 viewport 下变不变

**变，而且是确定性地变。** 直接把公式讲出来：

```
渲染数 = ceil(视口高度 / item 高度) + overscan × 2 + 1
```

- 视口越高 → 渲染越多（手机竖屏 < 桌面全屏）
- item 越矮 → 渲染越多（紧凑列表 > 大卡片）

**还有一层**：这个 feed 的卡片**高度本来就不一致**（有的带封面图有的不带）。笔记里第 ⑥ 段专门讲了动态高度的两种处理（预估+`ResizeObserver` 测量修正、offset table + 二分查找）。高度不定意味着 `visibleCount` 本身随滚动位置浮动——**这是 `roughly` 的第二个来源**。

### ③ 不同 overscan 下变不变

**变，而且是线性的**——overscan 每加 1，渲染数加 2。见上面那张取舍表。

**这三问合起来的答法**

> 20 不是一个固定值，是 `ceil(视口高度/item高度) + overscan×2 + 1` 算出来的。视口更高、item 更矮、overscan 调大，这个数都会涨。我们的卡片高度还不固定，所以滚动过程中它本身就有浮动——简历上写 `roughly` 就是这个意思。真正稳定的不是这个数，是它**不随数据量增长**。

---

## 五、口径问题：`20` 到底是节点数还是条目数

**这条今天必须自己定掉。**

简历写的是 `cutting live DOM nodes from 500+ to roughly 20`——`DOM nodes`，节点。

但笔记里自己写的是（第 ② 段）：

> **用户在视口里同时能看到的其实就 10–20 个 item**

**10–20 是 item 数，不是 node 数。**

一个 feed 卡片——封面图、标题、时长角标、作者头像、作者名、播放量、外层包装 div——**本身就是 8–15 个 DOM 节点**。所以：

| 如果 20 是…… | 那么对应的另一个量是 |
|---|---|
| 20 个 **item** | 约 **160–300 个 DOM 节点** |
| 20 个 **DOM 节点** | 只有 **2–3 个 item**（视口里放不下这么少） |

**后者不成立**——视口里明显不止两三张卡片。所以 `20` 几乎肯定是**条目数**，被写成了「DOM nodes」。

同理 `500+` 如果是条目数，对应的真实 DOM 节点数是 **4000+**。

**好消息是比例没错**：25:1 这个倍数无论按哪个口径都成立。**问题只在名词用错了。**

**两条出路，选一条：**

1. **改措辞**（推荐，成本最低）：`cutting live DOM nodes from 500+ to roughly 20` → `cutting mounted list items from 500+ to roughly 20`，或 `rendered rows`。一个词的改动，数字全对。
2. **重算**：按每卡片约 10 个节点折算成真实节点数，改成 `from ~5,000 to ~200 DOM nodes`。数字更唬人，但你得能解释这个折算是怎么来的——**风险更大，不推荐**。

**在没改之前**，被问到「20 个节点？一个卡片就不止 20 个吧」，老实答：*「说的是渲染出来的列表条目数，节点口径上我写得不够准。」* **这比硬圆好得多。**

---

## 六、一句话答法

> 优化前是全量渲染，DOM 数等于已加载的条数，随着无限滚动一直涨，观测到过 500+ 这个量级。改成虚拟列表后只渲染视口内加上下缓冲，数量由 `ceil(视口高度/item高度) + overscan×2 + 1` 决定，稳定在二十上下、不随数据量变。用 DevTools 的 Performance Monitor 看 DOM Nodes 曲线最直观——优化前一路涨，优化后是条平线。要提醒一句，那个「20」指的是渲染出来的列表条目数，不是严格意义的 DOM 节点数。
