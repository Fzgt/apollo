---
title: 百度 · 五条 bullet
section: 百度
icon: landmark
---

# 百度 —— 简历五条 bullet

> 目的:百度那段技术密度最高(虚拟列表、Webpack 迁移、P2 事故复盘都是硬货),但当时做完就忘。这篇按 bullet 拆开,**把每条背后的底层机制彻底讲清楚**,让你面试时能一层一层往下答。
>
> 每条 bullet 分五段:**原文** / **核心技术点** / **实现原理** / **你当时大概是怎么做的** / **面试预期追问**。
>
> **编号和简历对齐**（2026-09-07 重排：五条顺序完全照现简历 Baidu section —— 虚拟列表 / Webpack / 白屏 / 提现 / jsBridge）。每条开头引的是**该条更早的措辞**，和现简历有出入处以站内笔记为准。
>
> **已处理（2026-08-19）**：提现那条原本带着 `without a single dollar of financial loss`。零资损是财务对账的结论，不是前端能测出来的东西——已经不在简历上，换成请求锁、幂等 key、不确定按失败处理这三个可证的动作。下面正文里引的原句已同步更新。
>
> 另：百度的代码不在本机，这段全靠这份笔记 + 回忆，所以它的分量比另外两份重。

---

## Bullet 1 ⭐ 虚拟列表 —— DOM 节点恒定 ~100,30 FPS → 60 FPS


> 旧版原文：Built a virtualized React feed serving 5M+ daily page views on a custom useVirtualList hook over IntersectionObserver: live DOM nodes stay near 100 at any scroll depth, scroll from 30 to a stable 60 FPS.
>
> （React 16.8 / Webpack 4 / 好看视频这些背景不在简历上，讲的时候仍然可以补，但纸上不承诺。）

**这是你简历上技术密度最高的一条,面试官会往死里问。这一节我讲最深。**

### 核心技术点

#### ① 为什么 500 个 DOM 节点会掉帧
浏览器渲染流水线(**必背**):

```
JS → Style(样式计算) → Layout(布局) → Paint(记录绘制指令)
   → Layerize(分层) → Raster(栅格化) → Composite(合成) → Display(上屏)
```

每一帧(16.67ms 才能保持 60 FPS)内必须走完这条流水线。

- **JS**:执行你的代码,React 触发 reconciliation,状态更新
- **Style**:计算每个元素最终的 CSS 属性(继承、层叠、选择器匹配)
- **Layout(Reflow)**:计算每个元素的**几何信息**(位置、大小)。⭐ 500 个 DOM 节点意味着 500 个几何计算,单次 layout 可能就要 5–10ms
- **Paint**:⚠️ **不画像素**,产出的是一份**绘制指令列表**(display list / paint ops)——「这里画个圆角矩形、这里画一行文字」。成本随绘制项的数量和复杂度涨
- **Layerize(分层)**:决定切成几个合成层。⚠️ **层不是 Paint 生成的,这是单独一步,而且排在 Paint 之后** —— Chrome 官方 RenderingNG 架构文档的阶段清单原文就是 `… Layout → Pre-paint → Paint → Commit → Layerize → Raster …`,分层吃的正是 paint 产出的那份 display list(由 PaintArtifactCompositor 处理)
- **Raster(栅格化)**:把绘制指令真正跑成**位图图块(tile)**,在 raster 线程或 GPU 上做。**文字栅格化、阴影、圆角慢在这一步,不是 paint**
- **Composite**:合成线程把栅格化好的图块生成 **draw quads**、打包成一帧(compositor frame)交给 GPU 进程合成上屏

**背这一句就够**:Paint 记录绘制指令,Raster 把指令栅格化成图块位图,Composite 由合成线程把图块拼成一帧交给 GPU 上屏。**说「Paint 画像素、Paint 产生图层」是错的,这两句最常被拿来判断你是背的还是懂的。**

**⚠️ 那张流传最广的老图跟这里是反的,先把话说在前面。** 中文博客里到处都是的那张 Chrome 帧流水线图,主线程一排画的是 `Recalc Styles → Layout → Update Layer Tree → Paint → Composite` —— **分层在 Paint 前面**。图没画错,它画的是 CompositeAfterPaint 重构**之前**的架构:那个年代先决定切几层,再往每一层里分别记录绘制指令。重构之后 `Update Layer Tree` 这个阶段本身就不存在了,改成整份文档先 paint 成一份 display list,再由 PaintArtifactCompositor 据此分层。

被拿这张图质疑时就这么答:「那张图是 CompositeAfterPaint 之前的,老架构确实先分层再 paint;现在反过来,先 paint 出 display list 再据此分层,`Update Layer Tree` 这个阶段已经没了。」**主动点名 CompositeAfterPaint 比顺序本身值钱** —— 顺序谁都可能记反,知道它哪一年为什么改的没几个。

**⚠️ 这不是首屏问题,是累积问题 —— 讲错因果会被当场看穿。**

首屏只挂十来张卡、一百来个节点,**跟优化后没区别,一点都不卡**。掉帧是滚出来的:

1. **DOM 只增不减** —— 无限滚动每加载一页就往列表尾部追加,滚出视口的旧卡片一张都没卸。滚十屏两百多条,刷几分钟五百条以上。
2. **每一帧的成本随节点数线性涨** —— Style 要给每个节点算样式,Layout 要给每个节点算几何。500 个节点单次 layout 就是 5–10ms,加上 JS 和 raster,一帧 16.7ms 的预算直接爆掉。
3. **所以体感是渐进的** —— 用户的感受是「刚打开挺顺,刷两三分钟开始顿,再刷就卡死」,**不是一进来就卡**。这句一定要说,它证明你是在现场看过这个问题,不是背的。
4. **内存跟着涨** —— 每个节点 KB 级,五百张卡连带图片是几十 MB,低端机上还会触发 GC 停顿,雪上加霜。

**一句话因果**:DOM 数随已加载条数无上界增长 → 每帧 Style/Layout 成本线性上涨 → 单帧超过 16.7ms → 越滚越掉帧。**虚拟列表真正改掉的是这个增长关系,不是某一个数字。**

#### ② 虚拟列表的核心思想
**用户一屏里同时能看到的其实就四到六张卡**,那 DOM 里就只留视口内的这几张,其余的"假装存在"就够了。

```
数据(1000+ 条,无上界)
    ↓
可视区域 ← 用户一屏看到 4~6 张卡
    ↓
DOM 里只留可视区的卡 + 上下各几张 overscan ≈ 9 张
```

渲染张数是算出来的:

```
渲染卡片数 = 一屏可见张数 + overscan × 2
```

一屏 5 张、上下各缓冲 2 张,就是 `5 + 4 = 9 张`。

⚠️ **用「一屏能看几张」当输入,别背像素值。** 面试官问的一定是「一屏几张」,不会问「你卡片多高」;报一个具体的 px 反而要你为它负责。

⚠️ **「卡片数」不是「节点数」,简历上那个 100 说的是节点。** 一张 feed 卡片里有外层容器、封面容器、封面图、角标、标题、作者行、头像、作者名、播放/点赞数、更多按钮,**十来个元素起步**。所以 **9 张 × 十来个元素 ≈ 100 个节点**,这才是简历上那句 `live DOM nodes stay near 100`。

**三个关键数字,别混**:
- 数据条数:1000+,**无上界**
- **同时挂载的卡片数:~9**
- **DOM 节点数:~100(= 9 张 × 每张十来个元素)**

**定高是这里的前提。** 这个 feed 里图文和视频两种落地页的卡片是统一高度的,所以每张卡的偏移量能直接乘出来。被追问「不定高怎么办」:先用估算高度占位,卡片挂载后量出真实高度写进缓存,再回填后面卡片的偏移 —— 代价是滚动条总长会抖。

**overscan 是取舍,不是越小越好**:调到 0,节点更少,但快速滑动时下一张还没挂载,用户先看到空白(白闪);调到 5~10,滑动平滑,但 DOM 数和内存又回去了。被问"为什么不把 overscan 调到 0 让节点更少",答案就是白闪。

滚动时:
1. 计算滚动位置
2. 算出"当前该显示第 300~308 张"
3. 把滚出缓冲区的旧卡片卸掉,把新进来的挂上
4. 用 `translateY` 把每张卡放到它该在的滚动位置

#### ③ 撑开滚动条的 spacer 技术
问题:DOM 里只有九张卡,浏览器怎么知道要有 1000 条那么长的滚动条?

解决:**外层容器 height 设为 `1000 × itemHeight`**(所有 item 加起来的总高度),内层 item 用 `position: absolute` + `translateY` 定位。

```html
<div style="position: relative; height: 200000px"> <!-- 撑开滚动条 -->
  <div style="position: absolute; transform: translateY(60000px)">第 300 条</div>
  <div style="position: absolute; transform: translateY(60200px)">第 301 条</div>
  ...
</div>
```

#### ④ 为什么用 `transform: translateY` 而不是 `top`
**这个必问,一定要背下来。**

| 属性 | 触发什么 |
|---|---|
| `top` / `left` / `width` / `height` / `margin` / `padding` | Layout(重排,最贵)+ Paint + Composite |
| `color` / `background` / `border-radius` | Paint(重绘)+ Composite |
| `transform` / `opacity` | **只有 Composite**(GPU 加速,跳过 Layout 和 Paint) |

滚动时几百次位置变化,如果用 `top`,每次都 layout + paint,直接卡死。用 `transform` 只 composite,GPU 做,主线程无压力。

**深入原理**:`transform` 会创建 GPU 合成层(compositor layer),浏览器把这个元素单独栅格化到一张 GPU 纹理上,滚动时只是改这层的变换矩阵重新拼帧,**既不重新 paint 也不重新 raster**。

⭐ **加分的半句**:改 `transform` 可以**完全跑在合成线程上,不需要主线程参与**——所以主线程被长任务卡住时,合成层上的 transform 动画照样流畅。这半句大部分人答不到,被问「为什么 transform 只走 composite」时补上去。

**副作用**:大量 layer 也会耗内存,不能滥用 `will-change: transform`。

#### ⑤ IntersectionObserver 是什么
以前的做法:监听 `scroll` 事件,里面用 `getBoundingClientRect()` 判断元素是否在视口。**每次滚动都可能触发几十次判断,主线程压力大,而且 `getBoundingClientRect` 会强制 layout**。

`IntersectionObserver`:浏览器提供的原生 API,在**元素进入/离开视口**时异步回调你,不阻塞主线程,不触发 layout。

```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // 元素进入视口
      loadMore(); // 或触发懒加载
    }
  });
}, {
  root: null, // 默认视口
  rootMargin: '100px', // 提前 100px 触发
  threshold: 0 // 只要露出一点就触发
});

observer.observe(document.querySelector('#loader'));
```

**在虚拟列表里的用法**(你的场景):
- 一种做法:观察每个 item,判断哪些 item 进入视口 → 动态挂载
- 另一种做法:只观察一个"哨兵"(sentinel)元素在列表底部,进入视口时触发下一页加载(**无限滚动的经典模式**)
- 你的简历说"通过自定义 useVirtualList Hook 结合 IntersectionObserver 实现虚拟列表渲染"—— 大概率是第二种(哨兵触发加载)+ 自己算 visible range 做窗口化

#### ⑥ 60 FPS 预算(⭐ 核心概念)
- 60 FPS = 1000ms / 60 = 16.67ms 一帧
- 浏览器留给 JS 的时间实际只有 ~10ms(其余要留给 Style/Layout/Paint/Composite/浏览器自己)
- **超过 16.67ms 就掉帧**,连续掉帧用户感知为"卡"
- **RAIL 模型**:
  - **R**esponse:用户交互 100ms 内响应
  - **A**nimation:每帧 16ms
  - **I**dle:主线程留出空闲给浏览器
  - **L**oad:首屏 1s 内交互可用

### 实现原理(深入)

#### 完整的 useVirtualList Hook 实现骨架
```ts
function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 3
) {
  const [scrollTop, setScrollTop] = useState(0);

  // 算出可见 item 的索引范围
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

  // 生成 visible items(带 index 和 offset)
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push({
      index: i,
      item: items[i],
      offsetTop: i * itemHeight,
    });
  }

  // 总高度撑开滚动条
  const totalHeight = items.length * itemHeight;

  // 滚动监听(节流)
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return { containerRef, totalHeight, visibleItems };
}
```
用法:
```tsx
const { containerRef, totalHeight, visibleItems } = useVirtualList(list, 80, 600);

return (
  <div ref={containerRef} style={{ height: 600, overflow: 'auto' }}>
    <div style={{ height: totalHeight, position: 'relative' }}>
      {visibleItems.map(({ index, item, offsetTop }) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetTop}px)`,
            height: 80,
          }}
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  </div>
);
```

#### 动态高度(item 高度不固定)的处理
上面的实现假设每个 item 都是 80px,但真实场景(feed 卡片有的带图有的不带图)高度不一样。

**方案 1:预估 + 测量修正**
- 用一个"平均高度"作为初始估计
- item 挂载后用 `ResizeObserver` 或 ref `.offsetHeight` 测量真实高度
- 存进一个 `sizeMap`,后续用真实高度算 offset

**方案 2:偏移量表(offset table)**
- 维护数组 `offsets[i] = 前 i 个 item 高度累加`
- 二分搜索:滚动到某个位置时,找 `offsets[i] <= scrollTop < offsets[i+1]`

TanStack Virtual 就是这么做的(`measureElement` 就是方案 1 + 2 的结合)。

#### 为什么 `passive: true` 很重要
`el.addEventListener('scroll', fn, { passive: true })` 里的 `passive: true`:
- 告诉浏览器"我在 handler 里不会调 `event.preventDefault()`"
- 浏览器可以**立即开始滚动**,不等你 JS 执行完
- 不加的话,浏览器要"等你 JS handler 跑完看你会不会 preventDefault",拖慢滚动响应

**面试冷问**:"你的 useVirtualList 里 scroll 监听为什么加 passive?"—— 就答上面这段。

#### 30 FPS → 60 FPS 的量化归因
面试官可能问"具体是哪一步让 FPS 提升了?":
1. **DOM 节点数量下降**:五百多个 → 恒定一百上下(渲染 9 张卡 × 每卡十来个元素),layout 时间从 ~10ms 降到 ~0.5ms,单帧 JS/Layout 阶段释放
2. **`translateY` 替代 `top`**:每次滚动只做 composite,GPU 处理,主线程无压力
3. **`passive: true`**:scroll 事件不阻塞浏览器合成
4. **IntersectionObserver 替代 scroll 判断**:去掉每次滚动的 `getBoundingClientRect`,避免强制同步布局(FSL,forced sync layout)

### 选型:为什么不用现成的库(⭐ 大概率是开场第一问)

轮子是现成的,你为什么造一个 —— 这条答不上,后面讲得再深也扣分。

**先堵死两条错误答案:**

- **别说「当时还没有」**。react-window `1.0.0` 是 **2018-07-22** 发的;2021 年整年在用的稳定版是 `1.8.6`(2020-10-29),下一版 1.8.7 要等到 2022-04。你写那段代码时它已经上线三年、停在一个一年半没动的稳定版上。
- **别说「没有别的方案」**。2021 年至少四个可选,面试官随口就能报出两个。

| 库 | 2021 年可用版本 | 形态 | 对这个场景的关键点 |
|---|---|---|---|
| **react-window** | 1.8.6(2020-10) | 组件 | 行业默认答案。**要求自己的定高滚动容器** |
| **react-virtualized** | 9.22.3(2020-12) | 组件 | 同作者的全功能版,**有 `WindowScroller`,能跟着页面滚动** |
| **react-virtual** | 2.x(2021 全年在更新) | **headless hook** | 只返回索引和 offset,DOM 和容器你自己管 —— **和你写的 `useVirtualList` 是同一形态** |
| **react-virtuoso** | 2.x | 组件 | 主打自动测量不定高 |

（`@tanstack/react-virtual` 是 **2022-02** 才改的名,v3 也在 2022 年之后。2021 年只有 react-virtual v2,别把两者说混。）

**react-window 的核心约束**:它要你给一个定高的滚动容器 —— `<FixedSizeList height={600} itemCount={...} itemSize={80}>`,滚动条落在那个 div 上,不在页面上。

**这个场景**:小度 App 里的 H5 首页 feed,滚动的是整个页面。下拉刷新、吸顶、触底加载都挂在页面滚动上。把滚动收进一个定高 div,这几样得跟着一起改。

**开场就答这两句,别多说:**

> 当时看过 react-window 和 react-virtualized。react-window 要接管滚动容器,跟页面级滚动打架;react-virtualized 的 WindowScroller 能解,但那个库比我需要的功能重太多,为一个首页 feed 引进来不划算。核心逻辑就一百行,自己写更可控。

**三个追击点,预置好答案:**

- **「那定高呢?」** → 定高不是问题,那正是 react-window 最擅长的场景。问题是它要接管滚动容器。
- **「react-virtual 呢?它是 headless,不接管容器。」** → 认。「那个当时是 2.x,还没进 TanStack、API 也在动,我没敢上生产。」
  ⚠️ 这是最硬的反问 —— react-virtual `2.10.0` 的类型里既有 `windowRef`(支持窗口滚动),又有 `measureRef`(自动测高),上面两条理由它**都有解**。所以只能答「当时不敢押一个 API 还在变的库」,别硬撑。
- **「那你现在会怎么选?」** → 现在直接上 `@tanstack/react-virtual`,headless、维护活跃、窗口滚动和动态高度都支持;当年自己写是因为可选项要么接管容器、要么太重、要么不稳。

### 你当时大概是怎么做的

1. 数据从后端拿(分页 `page=1&size=20`)
2. 首屏渲染第 1 页
3. `useVirtualList(list, itemHeight, ...)` 拿到 `visibleItems`
4. 底部放一个 sentinel `<div ref={loaderRef} />`,IntersectionObserver 观察它
5. Sentinel 进入视口 → `fetchNextPage()` → 数据 append 到 list → 重新计算 visibleItems
6. 每个 item 用 `translateY` 定位
7. scroll 加 `passive: true`

### 面试预期追问(⭐ 高频)

**基础层:**
- **为什么不用 react-window?**(上面「选型」一节 —— 开场第一问,先把这条答顺)
- **为什么用 transform 不用 top?**(上面第 ④ 点)
- **IntersectionObserver 和 scroll 监听有什么区别?**(上面第 ⑤ 点)
- **60 FPS 意味着什么?**(每帧 16.67ms,超了就掉帧)
- **passive: true 是干什么的?**(上面)

**深入层:**
- **虚拟列表里 item 高度不一致怎么办?**(上面 —— 预估 + 测量,或 offset table)
- **虚拟列表怎么处理 keyboard 导航 / focus?**
  → 难点:被"回收"的 item DOM 消失,焦点丢失。做法:① 记住 focused index,重新挂载时恢复。② 或者用 `contain: layout` 隐藏 offscreen 但不真移除。
- **虚拟列表怎么处理图片懒加载?**
  → 用 `loading="lazy"`(原生),或 IntersectionObserver 观察每张图。虚拟列表里 item 本身就是"可见时才挂载",天然懒加载。
- **动态内容(item 高度会随时间变化,如展开评论)怎么办?**
  → ResizeObserver 观察每个 item,高度变化时更新 sizeMap 并重算 offsets。
- **虚拟列表和 SEO 冲突吗?**
  → 冲突。虚拟列表下 DOM 里只有可视 item,爬虫爬不到全部内容。SEO 场景要么不用虚拟列表,要么做 SSR 兜底(HTML 里输出完整内容,客户端接管后再虚拟化)。
- **为什么不用 `content-visibility: auto`?**
  → 这是 CSS 新特性,浏览器自己"跳过不可见 item 的 layout/paint"。是虚拟列表的**更轻量替代**。适合小到中等列表,大列表(万级)还是要虚拟化。

**极端追问:**
- **DOM 节点从五百多降到一百上下是怎么测的?**
  → Chrome DevTools Performance → 录制滚动过程 → 看 Rendering 面板 → DOM Nodes 计数。或者 `document.querySelectorAll('*').length`。
- **30 → 60 FPS 是怎么测的?**
  → Chrome DevTools Performance → 录制 → 看 FPS 折线图。或者用 `PerformanceObserver` 监听长任务(long task > 50ms)。
- **快速滚动时白闪(白屏一瞬)怎么办?**
  → 加大 overscan;或者滚动速度快时降级到静态占位;或者 skeleton 提前预渲染。
- **无限滚动 vs 分页有什么权衡?**
  → 无限滚动:体验流畅,不易返回特定位置;分页:清晰,可分享/回访 URL;混合:滚动到某个位置带 hash 更新 URL 支持后退。

**必须能画图的**:
- 虚拟列表结构:外层 spacer(容器 height=totalHeight)、内层 absolute item + translateY
- 浏览器渲染流水线:JS → Style → Layout → Paint → Composite

---


## Bullet 2 ⭐ Webpack 3 → 5 迁移 —— 包体积 -15%,构建 -70%


> 旧版原文：Led a Webpack 3-to-5 migration across 10+ incompatible packages, extracting shared runtime through SplitChunksPlugin and turning on persistent caching — bundle size down ~15%, local build times down 70%.

### 核心技术点

#### ① Webpack 的核心概念
- **Entry**:入口(`src/index.js`)
- **Output**:产物(`dist/bundle.[contenthash].js`)
- **Loader**:预处理器,把非 JS 文件(css、image、ts)转成 JS 能识别的模块
  - `babel-loader` 转 JS/JSX/TS
  - `css-loader` 解析 CSS 依赖,`style-loader` 注入到 style 标签
  - `file-loader` / `url-loader` 处理图片(Webpack 5 内置 Asset Modules 替代了这俩)
- **Plugin**:扩展 build 过程的钩子,做各种事
  - `HtmlWebpackPlugin` 生成 HTML
  - `DefinePlugin` 注入环境变量
  - `MiniCssExtractPlugin` 把 CSS 单独抽成 .css 文件
- **Module**:一切都是模块,包括 JS/CSS/图片
- **Chunk**:一组模块打包在一起的文件(通常一个 chunk = 一个 .js 文件)

#### ② Webpack 5 的主要新特性(和 3→5 差异)
1. **Persistent Cache**(`cache: { type: 'filesystem' }`):把 build 中间结果缓存到磁盘,冷启动慢、热启动秒过
2. **Asset Modules**:内置 4 种资源类型(`asset/resource` / `asset/inline` / `asset/source` / `asset` 自动),替代 `file-loader` / `url-loader` / `raw-loader`
3. **Module Federation**:微前端方案,允许运行时动态加载其他项目的 chunk
4. **Tree Shaking 强化**:更精确的死代码消除,支持 `sideEffects: false` 精细化
5. **Node.js polyfill 移除**:5 不再自动打包 `crypto` / `stream` / `buffer` 等 Node 内置模块的 polyfill(3/4 会自动加,导致 bundle 变大)。用到的话要手动装 `browserify-*` 或用 `resolve.fallback`
6. **Long-term Caching 改进**:内置更好的 hashing 策略(`chunkIds: 'deterministic'`),小改动不会导致所有 hash 变化
7. **Output 更小**:内置代码优化改进
8. **配置删繁**:很多之前要手写的现在有更好的默认值

#### ③ SplitChunksPlugin(⭐ 你简历直接提到了)
- **它解决什么问题**:第三方库(react、lodash、antd)和业务代码打在一个 bundle 里,业务代码稍微改动就整个 bundle hash 变,用户要重下所有 vendor code
- **拆分策略**:把 vendor 和 runtime 单独拆出来,业务代码变化时 vendor chunk 不变,浏览器缓存命中
- **配置示例**:
```js
optimization: {
  splitChunks: {
    chunks: 'all', // 对所有 chunk(async + sync)都拆
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10,
      },
      common: {
        minChunks: 2, // 至少被 2 个 chunk 引用
        name: 'common',
        priority: 5,
      },
    },
  },
  runtimeChunk: 'single', // runtime 单独一个 chunk
}
```

- **关键概念**:
  - **cacheGroups**:定义拆分规则,`priority` 决定同时匹配时用哪个
  - **runtimeChunk**:webpack 的运行时代码(module 注册、chunk 加载逻辑)单独拆,避免每个 bundle 都带一份
  - **minChunks**:模块被多少个 chunk 引用才拆
  - **minSize / maxSize**:控制 chunk 大小

#### ④ Persistent Cache(简历"启用持久化缓存")
```js
cache: {
  type: 'filesystem', // 缓存到磁盘(.webpack/cache/)
  buildDependencies: {
    config: [__filename], // config 变了 invalidate
  },
}
```
- 首次 build:5min(编译所有 module 存磁盘)
- 二次 build:30sec(只编译变动 module,其他读磁盘)
- **60–80% 的构建速度提升就来自这个**

#### ⑤ Tree Shaking
- **原理**:ESM(import/export)是**静态可分析**的,Webpack 在 build 时能知道"哪些 export 从没被 import 过",打包时排除掉
- **前提**:必须是 ESM,CommonJS(require)动态导入不能 tree-shake
- **副作用标记**:`package.json` 里 `"sideEffects": false` 或 `"sideEffects": ["*.css"]` 告诉 Webpack "这个包/文件即使没被 import 也可以安全删掉/不能删"
- **效果**:import 一个包里的一个函数,只打这一个,不打整个包

#### ⑥ 迁移中"10+ 个不兼容 loader/plugin"具体指什么
Webpack 3 → 4/5 有几个大的破坏性变化,受影响的:
- **ExtractTextPlugin**(webpack 3)→ **MiniCssExtractPlugin**(4+)
- **CommonsChunkPlugin**(3)→ **SplitChunksPlugin**(4+)
- **UglifyJSPlugin**(3)→ **TerserPlugin**(4+),Webpack 5 内置
- **file-loader** / **url-loader** → 内置 **Asset Modules**(Webpack 5)
- **awesome-typescript-loader** → **ts-loader** / **babel-loader + @babel/preset-typescript**
- 各种插件的 API 从 `apply(compiler)` + 直接 hook 改成 tapable v2 的 `.tap` / `.tapPromise`

### 实现原理

#### Webpack 到底怎么打包(高层流程)
1. **Entry** 开始,读入口文件
2. 交给 **Loader 链**处理(倒序应用,如 `use: ['style-loader', 'css-loader']` 从 css-loader 开始)
3. **AST 分析** import/require,找出依赖
4. 递归对每个依赖重复 1–3,构建**依赖图(dependency graph)**
5. 应用 **Plugin**(在各种 hook 点执行)
6. 根据 splitChunks 规则**分组打包**成 chunk
7. Output 到 `dist/`

#### Persistent Cache 的失效逻辑
Webpack 5 用**内容哈希 + 依赖哈希**判定 cache 是否有效:
- 每个 module 的 cache key = 内容 hash + loader 版本 hash + config hash + 依赖模块 hash
- 任何一个变了就 miss,重新编译
- `buildDependencies` 让你显式声明"这些文件变了要 invalidate 全部 cache"(如 `webpack.config.js`)

#### 为什么打包体积能减少 15%
- **Tree Shaking 增强**:Webpack 5 对 CommonJS interop 处理更好,能 shake 掉更多死代码
- **不再自动加 Node polyfill**:如果你的代码只在浏览器跑,不用 crypto/stream,减少几十 KB
- **更好的 Long-term Caching**:hash 策略更精确,同样的代码 hash 不变,能命中 CDN 缓存
- **代码 minify 改进**:内置 Terser 版本更新
- **Asset Modules 更精细**:小图片 base64 内联,大图片单独文件,不用 loader 中间转一遍

### 你当时大概是怎么做的

1. **准备**:锁定 Node 版本,备份现有 config
2. **升级 Webpack**:`yarn add webpack@5 webpack-cli@5 -D`
3. **一个一个替换 loader/plugin**:
   - `extract-text-webpack-plugin` → `mini-css-extract-plugin`
   - `uglifyjs-webpack-plugin` 删掉(用内置 Terser)
   - `file-loader` / `url-loader` 删掉,配 Asset Modules
4. **重构 splitChunks**:从 CommonsChunkPlugin 改到 splitChunks + cacheGroups
5. **启用 persistent cache**:加 `cache: { type: 'filesystem' }`
6. **修复 Node polyfill 缺失**:如果业务代码用了 `Buffer` / `process` 等,加 `resolve.fallback` 或换用浏览器版本
7. **测试**:build 产物对比、bundle size 对比、启动测试、E2E 跑一遍
8. **量化**:webpack-bundle-analyzer 看包体积变化,`time yarn build` 测时长

### 面试预期追问

**基础:**
- **Loader 和 Plugin 区别?**
  → Loader 处理**单个文件**的转换(css → js);Plugin 是**整个 build 过程**的扩展(自定义任何 hook)。
- **Loader 执行顺序?**
  → 从右到左(数组末尾先执行)。`['style-loader', 'css-loader']` 先 css-loader 处理成 JS,再 style-loader 注入 DOM。
- **Chunk 和 Bundle 区别?**
  → Chunk 是 Webpack 内部概念(打包过程中的一个模块组);Bundle 是最终产物(一个或多个 chunk 生成的 .js 文件)。

**深入:**
- **SplitChunksPlugin 里 `chunks: 'all'` / `'async'` / `'initial'` 有什么区别?**
  → `initial` 只对入口 chunk 生效;`async` 只对动态 import 生效;`all` 对所有都生效(推荐)。
- **runtimeChunk 为什么单独拆?**
  → runtime 代码包含 chunk id → 文件名的映射,任何 chunk 新增/移除都会改这个映射。不拆的话每次改动都改 runtime,连带 entry chunk hash 变。拆出来后 vendor / entry hash 更稳定,cache 命中率更高。
- **Tree Shaking 什么情况下失败?**
  → ① CommonJS 模块(动态 require)。② 有副作用的 import(`import 'polyfill'` 不能 shake)。③ `package.json` 没标 `"sideEffects": false`,Webpack 保守不 shake。④ 用了 `import * as ns` 后动态 `ns[key]` 访问。
- **`import()` 动态引入怎么实现的?**
  → Webpack 把 `import('./foo')` 编译成运行时通过 `__webpack_require__.e(chunkId)` 加载 chunk,返回 Promise。chunk 加载完成后 resolve module。
- **HMR 是怎么工作的?**
  → dev server 起 WebSocket 连接,监听文件变化 → 编译改动 module → 通过 WS 通知客户端 → 客户端下载新 module → 用 `module.hot.accept` 注册的回调替换旧 module。React 用 react-refresh 保留组件 state。

**极端:**
- **Webpack 5 和 Vite 你怎么选?**
  → Vite 开发时用 ESM + esbuild(冷启动秒开),生产用 Rollup。适合现代浏览器项目。Webpack 5 更成熟、生态大、兼容老浏览器好。新项目用 Vite,大老项目留 Webpack。
- **持久化缓存有什么坑?**
  → 缓存污染(某些情况下命中错误 cache 导致 build 错)。解决:cache key 加版本号,遇到问题 bump。CI 里如果不清 cache 会累积失效。
- **Module Federation 是什么?**
  → 微前端方案。一个应用可以在运行时**动态加载**另一个应用暴露的模块(共享 React 实例、共享 UI 组件)。适合大组织多团队协作。

---


## Bullet 3:P2 白屏事故复盘 —— 依赖锁定与预发布验证


> 旧版原文：First to diagnose a P2 white screen on Haokan Video’s search page (100M+ DAU): mismatched Node versions regenerated package-lock.json, pulling a breaking minor bump — version locks and release checks followed.

### 核心技术点

#### ① 依赖版本管理的层次
```
package.json         语义化范围声明("^1.2.3")
    ↓
package-lock.json    实际锁定版本("1.2.3")+ 完整依赖树 + 完整性 hash
    ↓
node_modules         实际安装的物理文件
```

#### ② Semver(语义化版本)
- **`MAJOR.MINOR.PATCH`** = `1.2.3`
- **PATCH**(1.2.**3**):bug 修复,兼容
- **MINOR**(1.**2**.3):新功能,兼容
- **MAJOR**(**1**.2.3):破坏性变化,不兼容
- **范围声明符**:
  - `1.2.3`:精确
  - `~1.2.3`:允许 patch 更新(1.2.x)
  - `^1.2.3`:允许 minor + patch 更新(1.x.x,MAJOR 不变)
  - `*`:任意版本(不要用)

#### ③ package-lock.json 是干嘛的
- **锁定版本**:即使 package.json 是 `^1.2.3`,lock 记录了实际装的是 `1.2.5`(以及所有依赖的依赖)
- **保证团队一致性**:所有人 `npm install` 装出来的 node_modules 完全一样
- **提供完整性校验**:每个包的 tar 包 sha512 hash,防止 registry 被篡改

#### ④ 事故根因链条(⭐ 逐层拆解)
你的描述:"Node.js 版本不一致导致 package-lock.json 重新生成,引发依赖小版本升级引入的 breaking change"

拆开看:
1. **不同开发者/CI 机器 Node 版本不一致**(如 dev: v14, CI: v16, 某同事: v18)
2. **npm 版本随 Node 变**(npm 6 vs npm 7 vs npm 8/9,lock 文件格式不同)
3. **某开发者本地 `npm install` 加了新包**
4. **他的 npm 版本(比 lock 生成时新)看到旧 lock 格式,或者算法不同,重新生成 lock**
5. **重新生成时,`^1.2.3` 被解析为最新 1.x.x**(比如 1.5.0)
6. **1.5.0 里有个 minor 更新引入了行为变化**(理论上 minor 应该兼容,但实际"意外破坏"经常发生)
7. **改动 commit 到主分支**
8. **CI build → 部署 → 生产白屏**

#### ⑤ 预防方案(简历"依赖版本锁定 + 强制预发布验证")

**A. 依赖版本锁定**:
1. **Node 版本锁定**:
   - `package.json` 加 `"engines": { "node": "16.x" }`(和 npm/yarn 一起)
   - `.nvmrc` 文件写死版本,`nvm use` 自动切
   - **Volta** 更强:`package.json` 里 `"volta": { "node": "16.20.0", "npm": "8.19.4" }`,自动切且强制
2. **Lock 文件强制**:
   - CI 用 `npm ci` 不用 `npm install`(严格按 lock 装,lock 和 package.json 不一致直接失败)
   - Yarn 用 `--frozen-lockfile`
3. **pnpm** 一定程度上更严格(严格 hoisting)
4. **CI 检查 lock 文件是否被随意改**:PR check 里 diff `package-lock.json`

**B. 强制预发布验证**:
1. **Staging/Canary 环境**:先部署到内部环境,QA 验证
2. **烟雾测试(Smoke Test)**:自动化脚本跑核心路径,通过才允许上线
3. **灰度发布(Canary Release)**:先 1% 流量,监控错误率,渐进放大
4. **回滚机制**:一键回滚到上一个 release
5. **Feature Flag**:代码上线不代表功能启用,可以用 flag 控制,出问题秒关

#### ⑥ 白屏事故的定位思路
用户报告"打不开某个页面"时的排查:
1. **能不能复现?**(哪个浏览器、哪个用户、哪个地区)
2. **看监控**:Sentry 看错误详情、堆栈、release 版本
3. **看 CDN 日志**:资源是不是 404?
4. **看 Console**:错误信息是什么?SyntaxError / TypeError / ChunkLoadError?
5. **定位到具体 JS 文件行数**(sourcemap)
6. **定位到具体依赖/代码变化**(git blame + release diff)
7. **验证根因**:本地复现、二分定位
8. **修复**:回滚 or 前向修复
9. **复盘**:根因、影响、时间线、改进项

#### ⑦ ChunkLoadError —— 白屏的另一常见根因
和你的场景不完全一样,但值得知道:发布时旧用户还在用旧 HTML,里面引用了旧的 chunk 文件名(hash),而新版本发布把旧 chunk 从 CDN 删了 → chunk 加载失败 → 白屏。

**解决**:
- CDN 上保留旧版本一段时间(不立刻删)
- 前端捕获 `ChunkLoadError` → 提示用户刷新 → 刷新后拿到最新 HTML

### 实现原理

#### `npm install` vs `npm ci` 的差异
| | `npm install` | `npm ci` |
|---|---|---|
| 更新 lock | 会(允许 semver 范围内漂移) | 不会 |
| package.json vs lock 不一致 | 修改 lock 让它一致 | 直接失败退出 |
| node_modules 存在 | 增量装 | 先删再装 |
| 速度 | 慢(要解析、比较) | 快(严格按 lock) |
| 场景 | 本地开发 | CI/CD |

**面试问"CI 用哪个",一定要答 `npm ci`**。

#### 为什么 minor 版本升级也可能 breaking
理论上 semver 说 minor 是兼容的,但实际:
- 修 bug 时可能改变了默认行为
- TypeScript 类型定义更严格,编译报错
- 内部实现变化影响性能特征
- 依赖的依赖被更新(transitive)

**教训**:任何依赖升级都要跑一遍测试,即使 patch。

### 你当时大概是怎么做的

1. **发现**:白屏 → 大概率 error 上报激增 → 你是第一个 dig 深的
2. **定位**:
   - 打开 Sentry,看 error 详情 → 某个 `TypeError: xxx is not a function`
   - 对照 sourcemap 定位到源码行数
   - 想:"我本地能跑,线上不行,差异在哪?"
   - `git log` 看最近改动 → 发现 `package-lock.json` 无关代码 PR 里被改了
   - 对比 lock 差异 → 某个依赖从 1.2.3 → 1.5.0
   - 查这个依赖的 changelog → 1.4.0 有个 breaking(可能是接口签名变了)
3. **修复**:
   - 短期:pin lock 里那个依赖到旧版本
   - 长期:推动流程改进
4. **复盘 & 改进**:
   - 全公司/团队加 `"engines"` + Volta 强制 Node 版本
   - CI 用 `npm ci`
   - PR 检查:package-lock diff 要独立 review
   - 预发布环境必过烟雾测试才准上线

### 面试预期追问

- **为什么不所有依赖都 pin 死?**
  → 完全 pin 意味着安全 patch 不会自动进来。折中:`^` 允许 minor + patch,但 lock 文件严格锁定当前实际版本。定期(如每月)run `npm outdated` 计划性升级。
- **`npm install` 和 `yarn install` 生成的 lock 兼容吗?**
  → **不兼容**。团队要么全 npm 要么全 yarn。混用会导致 lock 冲突。
- **P2 事故是什么级别?**
  → 通常公司分 P0(全线故障)/ P1(核心功能不可用)/ P2(部分功能受影响,DAU 亿级也算 P2 因为影响大)/ P3+(次要)。
- **为什么第一个发现的是你?**
  → 主动追根因(不是"重装解决"),对整个 build/deploy pipeline 熟悉。这一点值得在面试时强调 —— **ownership + system thinking**。
- **复盘会怎么开?**
  → **Blameless Postmortem**(无罪化复盘)原则:
    1. 时间线(什么时候发生、什么时候发现、什么时候修复)
    2. 根因(为什么发生)
    3. 影响(多少用户、多少收入)
    4. 改进项(具体行动、负责人、deadline)
    5. **不追责个人**,追问"为什么系统允许这事发生"

---


## Bullet 4:提现功能 QPS 2000+ —— 高并发场景下的前端防御


> 旧版原文：Built the withdrawal client on a path peaking above 2,000 QPS: request locking drops in-flight duplicates, client-generated idempotency keys survive reloads, and uncertain outcomes surface as failures, never successes.

### 核心技术点

#### ① 防抖(Debounce)vs 节流(Throttle)—— 常混
- **Debounce**:多次触发,**最后一次触发后 n 毫秒才执行**。用户不停按按钮,只有停手 300ms 才真正调用。
  - 场景:搜索框输入、resize、按钮防连点(第一版)
- **Throttle**:多次触发,**每 n 毫秒最多执行一次**。用户不停触发,匀速执行。
  - 场景:滚动 scroll、鼠标 mousemove
- **提现按钮用哪个?**
  - Debounce 有个问题:"最后一次才生效"意味着用户点了 100 次,只有第 100 次触发 300ms 后发请求。用户可能觉得"没反应"再点更多次。
  - **更好的做法**:**首次立即执行 + 后续 lock**(下面 ② 讲)。这是"leading edge"防抖 + 请求锁的组合。

#### ② 请求锁(Request Locking / In-flight Tracking)
问题:用户点提现 → 发请求 → **请求返回之前**用户又点 → 发第二个请求 → 后端可能扣两次款。

解决方案:在**请求发出到响应回来的整个窗口内**,拦截后续的相同请求。

```js
let inFlight = false;

async function withdraw() {
  if (inFlight) return; // 锁住,直接忽略
  inFlight = true;
  try {
    const res = await api.withdraw();
    handleSuccess(res);
  } catch (err) {
    handleError(err);
  } finally {
    inFlight = false; // 解锁
  }
}
```
更完整的做法:**按参数 key 去重**(同一笔提现锁,不同笔可以并发):
```js
const inFlightMap = new Map();

async function withdraw(orderId) {
  if (inFlightMap.has(orderId)) return inFlightMap.get(orderId);
  const promise = api.withdraw(orderId);
  inFlightMap.set(orderId, promise);
  try {
    return await promise;
  } finally {
    inFlightMap.delete(orderId);
  }
}
```
这个模式叫"**Promise 去重**",React Query / SWR 内部就是这么做的。

#### ③ 幂等性(Idempotency)—— 真正的零资金损失靠这个
前端锁只能防"同一个 tab 快速点击",防不了:
- 网络超时前端重试
- 用户在不同设备/tab 同时操作
- 页面刷新后再点

**真正的零损失必须靠后端幂等**:
- 每个提现请求带一个**幂等 key**(前端生成的 UUID,或者用 orderId)
- 后端在数据库里存"已处理的幂等 key",同 key 重复请求返回上次结果,不再执行

前端能做的是:
- 提前生成幂等 key,存 sessionStorage(刷新也保持)
- 每次调用都带这个 key
- **配合后端才是完整方案**

#### ④ 错误兜底(Error Fallbacks)
金融场景的错误处理原则:**默认失败,只有明确成功才展示成功**。
- **明确失败**(HTTP 4xx/5xx、业务错误码):UI 显示错误 + 可重试按钮
- **不确定**(超时、网络中断、请求发出但没响应):**当作失败处理**,但提示用户"网络异常,请稍后查看提现记录",不要直接说"失败"(可能后端处理了)
- **明确成功**(2xx + 业务成功码):UI 展示成功

**为什么"不确定"要按失败处理?**
- 显示"失败"用户会去重试,重试有幂等 key 兜底,不会真扣两次
- 显示"成功"如果实际没到账,用户以为提了但没钱到账,炸锅

#### ⑤ QPS 2000+ 的前端角度理解
- **QPS = Queries Per Second**,每秒请求数
- 2000 QPS 通常是**后端指标**,不是前端。前端不"扛" QPS,前端"贡献" QPS(每个用户点一下就贡献 1 QPS)
- 前端能做的:
  - 减少不必要的请求(防抖 + 锁)
  - 排队/限流(不让活动开始那一瞬间 10 万人同时点)
  - CDN 缓存静态资源,减少动态请求

### 实现原理

#### 前端限流的高级做法 —— 令牌桶 / 漏桶
真正的高并发场景,前端会自己做"限流":
- **令牌桶**:每 100ms 生成一个 token,用户点击消耗 token,没 token 时按钮 disabled
- **漏桶**:请求进队列,以固定速率发送
- **代码示例**(令牌桶):
```js
let tokens = 5;
setInterval(() => tokens = Math.min(tokens + 1, 5), 200);

async function tryClick() {
  if (tokens === 0) return alert('操作太频繁');
  tokens--;
  await api.doSomething();
}
```

### 你当时大概是怎么做的

1. 按钮 onClick 加 `disabled` 状态(点击后立刻 disable,响应回来 enable)—— 视觉锁
2. 逻辑锁:内存里 `inFlightMap` 或 `Set`,同一 orderId 拦截
3. 前端生成 idempotency key(uuid),存 sessionStorage
4. API 层统一注入 idempotency key 到 header 或 body
5. 错误兜底:统一 error handler,超时/网络错误显示"稍后查看",4xx 显示业务错误
6. 全局 loading 状态防止用户误以为"没反应"

### 面试预期追问

- **防抖和节流具体怎么实现?**
  → 手写(高频面试题):
  ```js
  const debounce = (fn, ms) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };
  
  const throttle = (fn, ms) => {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn(...args);
      }
    };
  };
  ```
  高级版本:防抖有 `leading` / `trailing` 选项,节流有 `requestAnimationFrame` 版本。
- **你怎么保证零资金损失的?**
  → 前端 3 层(视觉 disable + 内存锁 + idempotency key)+ 后端幂等 = 端到端保证。**前端只是"减少无效请求",真正的零损失是后端 + 前端配合**。
- **QPS 2000 对前端有什么挑战?**
  → 主要不是 QPS 本身,而是"活动开抢时的峰值",可能瞬间 10 万人涌入首屏。前端做:CDN、SSR/SSG 减少动态请求、按钮进入排队机制、失败降级到静态提示页。
- **如果用户在两个 tab 同时点提现怎么办?**
  → 前端内存锁跨 tab 无效,必须靠后端幂等或分布式锁(Redis SETNX + 过期时间)。

---


## Bullet 5:小度 App H5 智能家居模块 —— jsBridge + 混合应用


> 旧版原文：Delivered the Xiaodu App’s H5 smart-home module in Vue 2, adding native iOS/Android sharing via jsBridge, device detail pages and analytics tracking.

### 核心技术点

#### ① Hybrid App(混合应用)架构
- **是什么**:原生 App(Native)里嵌入 WebView 加载 H5 页面。原生做外壳(启动、账号、支付、大功能),H5 做业务(灵活迭代、跨端一致)。
- **为什么选混合**:
  - 快速迭代(改 H5 不用发版 App)
  - 跨端(iOS/Android 一套 H5)
  - 动态运营(活动页、专题、AB 测试)
- **WebView**:
  - **iOS**:早期 UIWebView(已废弃),现在都是 **WKWebView**(WebKit,基于 Safari 内核)
  - **Android**:早期是系统 WebView(4.4 前是 WebKit,4.4+ 是 Chromium),后来出 **X5 WebView**(腾讯魔改 Blink,统一多机型行为)

#### ② jsBridge —— H5 和原生怎么通信
问题:H5 跑在 WebView 沙箱里,和原生是**两个世界**。要"分享到微信"、"读取蓝牙设备"、"调起相机",H5 只能"求"原生做。

**H5 调原生的 4 种方案**:
1. **URL Scheme**(最古老):H5 里 `location.href = 'xiaodu://share?title=xxx'`,原生监听 URL 变化,匹配 scheme 后拦截 + 解析 + 执行。缺点:异步无返回值,一次只能一个调用。
2. **iframe.src 触发**(URL Scheme 变体):`iframe.src = 'xiaodu://...'`,用 iframe 是为了不让主页面跳转。
3. **`window.prompt` 拦截**(Android 常用):H5 调 `window.prompt('xiaodu://...')`,原生重写 WebView 的 `onJsPrompt` 拦截。
4. **注入原生对象**(现代主流):
   - **Android**:`webView.addJavascriptInterface(new NativeBridge(), 'AndroidBridge')`,H5 里 `window.AndroidBridge.share(...)` 直接调
   - **iOS(WKWebView)**:`WKUserContentController.add(handler, name: 'iosBridge')`,H5 里 `window.webkit.messageHandlers.iosBridge.postMessage({...})` 调,回调通过 `evaluateJavaScript` 反向注入

**原生调 H5**(反向):
- `webView.evaluateJavascript('window.somefn(data)', null)`(Android)
- `webView.evaluateJavaScript("window.somefn(...)")`(iOS)
- 需要 H5 提前挂 `window.somefn`

#### ③ 统一 jsBridge 封装
业界通用做法:封装一层,前端不管 iOS/Android 差异,统一调 `bridge.call('share', {...})`。

伪代码:
```js
class JSBridge {
  callbacks = new Map();
  callId = 0;
  
  call(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.callId;
      this.callbacks.set(id, { resolve, reject });
      
      const payload = { id, method, params };
      
      if (isIOS) {
        window.webkit.messageHandlers.iosBridge.postMessage(payload);
      } else if (isAndroid) {
        window.AndroidBridge.call(JSON.stringify(payload));
      }
    });
  }
  
  // 原生调用来触发回调
  _onNativeCallback(id, data, error) {
    const cb = this.callbacks.get(id);
    if (!cb) return;
    error ? cb.reject(error) : cb.resolve(data);
    this.callbacks.delete(id);
  }
}
```
关键点:**用 callId 关联请求和响应**,因为通信是异步的。

#### ④ 分享的原生实现
- **微信分享**:原生集成微信 SDK,jsBridge 收到"分享"指令 → 调 `WXApi.sendReq(...)`
- **微博/QQ**:同理,各自 SDK
- **系统分享**:iOS `UIActivityViewController`,Android `Intent.ACTION_SEND`

前端只管调 `bridge.call('share', { title, desc, imageUrl, link })`,不管落地渠道。

#### ⑤ 百度统计 API
- **是什么**:百度自家的 Web 分析,类似 Google Analytics 的国内版
- **接入方式**:
  1. HTML 里嵌一段 SDK 脚本(异步加载)
  2. 页面浏览自动上报
  3. 自定义事件:`_hmt.push(['_trackEvent', 'category', 'action', 'label', value])`
- **面试冷问**:"百度统计怎么保证请求不丢?" → 用 1x1 图片 `<img src="https://hm.baidu.com/hm.gif?..." />` 而不是 XHR,因为图片请求不受 CORS 限制,且 unload 时也能发出去(有些浏览器优化,更好是用 `navigator.sendBeacon`)

### 实现原理

#### WKWebView vs UIWebView 的关键区别
- **进程模型**:WKWebView 独立进程(隔离,崩了不影响 App),UIWebView 在 App 主进程
- **JS 引擎**:WKWebView 用 Nitro(Safari 同款,快),UIWebView 用受限 JavaScriptCore(慢)
- **iOS 8+ 后大厂都迁到 WKWebView**

#### URL Scheme 的坑
- **iOS**:`window.location.href = 'xiaodu://...'` 会触发页面跳转,如果 scheme 没注册会白屏。所以用 iframe 隔离
- **连续调用会丢**:两次快速调用 URL Scheme,原生可能只收到一次。要用队列 + 延迟

### 你当时大概是怎么做的

1. Vue 2 项目结构,路由 vue-router,状态 vuex
2. 封装 `utils/bridge.js`,统一 iOS/Android 差异
3. UA 检测:`navigator.userAgent` 里判 iOS/Android
4. 页面里 `import bridge from '@/utils/bridge'`,调 `bridge.call('share', {...})`
5. 设备详情页:调 `bridge.call('getDeviceList')` 拿设备列表 → 渲染
6. 百度统计:main.js 里加载 SDK,mixin 里在 `mounted` 时上报 pageview,业务点用 `_hmt.push` 打事件

### 面试预期追问

- **iOS 和 Android 的 bridge 实现差在哪?**
  → 见上面 ②,iOS 用 `messageHandlers`,Android 用 `addJavascriptInterface`。都是双向异步。
- **jsBridge 调用为什么要用 Promise?**
  → 原生 → H5 的回调是异步的,如果不用 Promise 就得回调地狱。用 callId + Promise 让 H5 侧看起来是"同步调用"。
- **H5 页面在原生 App 里性能不好怎么优化?**
  → ① 离线包(原生预置 H5 资源,不走网络)。② 预加载 WebView(App 启动就 warm up)。③ 首屏 SSR / SSG。④ 关键资源内联(减少请求数)。⑤ 精简依赖。
- **AndroidBridge 有什么安全风险?**
  → `addJavascriptInterface` 在 API < 17 时有 RCE 漏洞(反射调用任意 Java 方法)。17+ 加了 `@JavascriptInterface` 注解要求。建议只暴露必要的方法,输入严格校验。
- **怎么处理 iOS 和 Android 上不一致的行为?**
  → bridge 层统一 API,内部按平台分发。业务层不感知平台差异。特别情况(如 iOS 键盘弹起页面被挤压)加平台特定的 fix。

---


## 面试前 Checklist(百度部分)

### 必须能画出来
- [ ] 浏览器渲染流水线:JS → Style → Layout → Paint → Composite
- [ ] 虚拟列表结构:外层 spacer + absolute item + translateY
- [ ] jsBridge 双向通信:H5 ↔ WebView ↔ 原生
- [ ] Webpack build 流程:Entry → Loader → AST → 依赖图 → Plugin → Chunk → Output

### 必须能背下来
- [ ] `transform`/`opacity` 只触发 composite,`top`/`width` 触发 layout + paint + composite
- [ ] 16.67ms 一帧,超了掉帧
- [ ] IntersectionObserver 异步、不阻塞、不触发 layout;scroll 事件 + getBoundingClientRect 会强制 layout
- [ ] `passive: true` 让浏览器不等 JS 处理完就滚动
- [ ] `npm ci` 用于 CI,`npm install` 用于本地
- [ ] `^` 允许 minor + patch,`~` 只 patch
- [ ] Semver 里 MINOR 理论兼容但实际经常被破坏
- [ ] SplitChunks 里 vendor / common / runtime 各拆的目的
- [ ] Persistent Cache 首次慢、二次快的原因

### 必须能开口就讲(每个 30 秒简述)
- [ ] 虚拟列表为什么快?(3 层原因:DOM 少了、transform 便宜、IntersectionObserver 非阻塞)
- [ ] Webpack 5 相比 3 有什么大改动?(cache、asset modules、tree shaking、no Node polyfill、hash 稳定)
- [ ] 那次白屏事故你怎么定位的?(Sentry → sourcemap → git diff → lock file → 依赖 changelog)

## 需要单独刷一遍的知识点

按优先级:

1. **浏览器渲染原理 + 60 FPS 预算**(虚拟列表回答的基础)
2. **Composite-only CSS properties**(必背清单)
3. **IntersectionObserver 用法 + 和 scroll 事件对比**(高频面试点)
4. **Webpack 打包全流程 + 关键 Plugin 原理**
5. **SplitChunksPlugin 详细配置**(简历直接提到)
6. **Semver 和 lock file 机制**(事故复盘基础)
7. **Chrome DevTools Performance 面板使用**(每个前端应该会)
8. **jsBridge 常见实现方式**(hybrid app 岗必问,你有百度 App 经验是加分)

## 深入学习资源(选看)

- **虚拟列表**:直接读 `react-window` 或 `@tanstack/virtual` 源码,一两百行,读完什么都懂
- **Webpack**:官方文档 "Concepts" 和 "Optimization" 章节;Tobias Koppers(Webpack 作者)的博客
- **渲染原理**:Google Web Fundamentals 的 "Rendering Performance" 系列
- **Chrome DevTools**:官方 Performance 面板教程

