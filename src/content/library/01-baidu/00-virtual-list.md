---
title: 虚拟列表
section: 百度
icon: landmark
---

# 百度 Bullet 1 —— 虚拟列表

> 百度这段技术密度最高(虚拟列表、Webpack 迁移、P2 事故复盘都是硬货),但当时做完就忘。这几篇按简历 bullet 拆开,**把每条背后的底层机制彻底讲清楚**,让你面试时能一层一层往下答。
>
> 每条 bullet 分五段:**原文** / **核心技术点** / **实现原理** / **你当时大概是怎么做的** / **面试预期追问**。编号和顺序照现简历 Baidu section —— 虚拟列表 / Webpack / 白屏 / 提现 / jsBridge;开头引的是**该条更早的措辞**,和现简历有出入处以站内笔记为准。
>
> 百度的代码不在本机,这几篇全靠笔记 + 回忆,所以分量比另外两份重。

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
- **Layerize(分层)**:决定切成几个合成层。⚠️ **层不是 Paint 生成的,这是单独一步,而且排在 Paint 之后** —— [Chrome 官方 RenderingNG 架构文档](https://developer.chrome.com/docs/chromium/renderingng-architecture)的阶段清单原文就是 `… Layout → Pre-paint → Paint → Commit → Layerize → Raster …`,分层吃的正是 paint 产出的那份 display list(由 PaintArtifactCompositor 处理)
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

#### 曝光上报的骨架(⭐ 选型那一节的底子)

「为什么不用 react-window」的答案压在这段上,得能当场写出来。

```ts
// 曝光判定用几何,不用索引 —— 这正是 onItemsRendered 给不了的东西
function useExposure(report: (id: string) => void) {
  const exposed = useRef(new Set<string>());   // 每张卡只报一次
  const enterAt = useRef(new Map<string, number>());
  const ioRef = useRef<IntersectionObserver>();

  useEffect(() => {
    ioRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.expId!;
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            if (!enterAt.current.has(id)) enterAt.current.set(id, e.time);
          } else {
            const t0 = enterAt.current.get(id);
            enterAt.current.delete(id);
            // 露出 ≥50% 且停留 ≥1s 才算一次有效曝光
            if (t0 != null && e.time - t0 >= 1000 && !exposed.current.has(id)) {
              exposed.current.add(id);
              report(id);
            }
          }
        }
      },
      { threshold: [0, 0.5] }  // 必须显式给 0.5,否则只在完全进出时回调
    );
    return () => ioRef.current?.disconnect();
  }, []);

  // 挂在每张卡上;虚拟列表回收 DOM 时 cleanup 自动 unobserve
  return (id: string) => (el: HTMLElement | null) => {
    if (!el) return;
    el.dataset.expId = id;
    ioRef.current?.observe(el);
  };
}
```

**三个坑,面试官爱问:**

1. **别用「挂载即曝光」。** overscan 预渲染的卡在 DOM 里但在视口外,overscan 开 3 就每屏多报 3 张。曝光必须独立于渲染判定。
2. **回收会重复触发。** 卡片滚出去被卸载、滚回来又挂载,不做 `exposed` 去重就重复上报。key 用**业务 id 不能用 index** —— index 会随数据 append 变。
3. **退出时漏报。** 用户在卡片还露着的时候切后台或退页面,IO 的「离开」回调永远不来,那次曝光丢了。要在 `visibilitychange` 和 `pagehide` 里把 `enterAt` 里还没结算的补报一遍。

#### 无限滚动的三个终态(⭐ 哨兵那套的真实难点)

先把关系说清:**哨兵 + IntersectionObserver 就是无限滚动**,不是两件事。无限滚动是交互模式(滚到底自动续,不给分页器),哨兵是它的实现手段。

**最大的坑:IO 只在交叉状态「变化」时回调。**

请求失败了,哨兵还留在视口里 —— 交叉状态没变,回调永远不会来第二次,列表就死在那里。用户上下滚也没用,除非哨兵真的离开过视口再回来。

同一个原因还有第二种死法:**一页返回的条数撑不满一屏**(`size=5` 但屏幕放得下 9 条),追加完哨兵仍在视口内,状态没变 → 下一页永远不触发。

所以三个终态必须显式画出来:

| 终态 | UI | 必须做的事 |
|---|---|---|
| **加载中** | 哨兵位置放骨架屏 | 上一把锁(`loadingRef`),防 IO 连续回调打出重复请求 |
| **失败** | 「加载失败,点击重试」 | **这不是体验兜底,是功能必需** —— 自动重试永远不会来 |
| **没有更多** | 「已经到底了」 | `unobserve` 哨兵,别让它空转 |

撑不满一屏那个,在 append 完之后主动补一次:

```ts
// 追加完数据,强制 IO 重新算一遍当前交叉状态
io.unobserve(sentinelRef.current!);
io.observe(sentinelRef.current!);   // observe() 会异步回一次当前状态
```

**下拉刷新是另一个方向,别和触底加载混着说。** 顶部下拉 = 拉最新、整列表替换;底部触底 = 拉更旧、往后追加。列表被替换时有两件事要跟着复位:`scrollTop` 归零,以及**曝光去重的 `exposedIds` 要清空** —— 刷新之后再看到同一张卡,算新的一次曝光。

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

**先划掉一条你不能用的理由。** react-window 的核心约束是它要接管滚动容器 —— `<FixedSizeList height={600} itemCount={...} itemSize={80}>`,滚动条落在那个 div 上,不在页面上。**这条对这个场景不成立**:你的 feed 本来就是容器滚(外层还有吸顶 tabbar,滚动收在列表容器里),卡片也是定高。拿「它要接管容器」当理由,面试官对一眼你自己的实现就穿了。

**真正的理由在埋点这一侧。** 这个 feed 每张卡都要上报曝光 —— 推荐模型的负样本(曝光未点击)、坑位 CTR 都靠它,判定标准是「露出面积 ≥50% 且停留 ≥1s」。

- react-window 的 `onItemsRendered` 确实会回给你 `visibleStartIndex` / `visibleStopIndex`,能告诉你「第 10–18 条在视口里」。**别说它拿不到可见范围,那是错的。**
- 但它给的是**索引边界,不是几何**。第 10 条只露出 20% 算不算有效曝光、它停留了 800ms 还是 3s —— 这两个数它一个都给不了。
- 所以曝光那层,用不用 react-window 都得自己上 IntersectionObserver(`intersectionRatio` + 进出时间戳)。
- 而卡片定高,窗口化只剩三行算术:`floor(scrollTop / h)`、`ceil(containerH / h)`、`total * h`。引一个库,省的就是这三行。

**再加一笔小账:它的 `height` 必须是一个数字。** 不是建议,是硬校验 —— 传 `'100%'` 直接抛:

```
An invalid "height" prop has been specified. Vertical lists must specify a number for height.
```

而 feed 容器的高度是 CSS 撑出来的(外层吸顶 tabbar、不同机型、横竖屏),手里根本没有那个数字。要么再引 `react-virtualized-auto-sizer`(2021 年可用版 `1.0.6`,2021-08-13),它首帧拿不到尺寸、测完才渲第二次;要么自己写一层 `ResizeObserver` 测量 —— 那就又回到「库外面还得再写一层」。

⚠️ **这条别当主理由**,它扛不住一句「那也就多装一个包」。放在曝光那条后面当成本账,被追问时才拿出来。

⚠️ **也别说「它不支持无限滚动」** —— 说了就露怯。翻页不需要额外的包:`onItemsRendered` 回的 `visibleStopIndex` 判一句「快到底了」就能 fetch,数据 append 进 list、`itemCount` 变大,它自己就接上了。`react-window-infinite-loader` 只是把这段封装了一层,外带一个「哪些区间已加载」的位图防重复请求。

**一句话:曝光那层跑不掉,窗口化那层又太便宜,库夹在中间没位置。**

**开场就答这段,别多说:**

> 这个 feed 每张卡要上报有效曝光,得按露出面积比例和停留时长判,所以 IntersectionObserver 那层无论如何得自己写 —— react-window 的 `onItemsRendered` 只给可见索引范围,给不了面积比例和停留时长。而卡片是定高的,窗口化本身就是三行算术。引库只省掉那三行,却要把所有卡片组件绑上它的 style 契约,不划算。

**四个追击点,预置好答案:**

- **「定高不正是 react-window 最擅长的场景吗?」** → 认,而且主动把它说成理由:**定高恰恰是我不引它的原因**。不定高我大概率会用现成的,测量和 offset table 自己写容易出错;定高把窗口化压到三行,库剩下的价值就只有「别人替我维护」。
- **「react-window 里也能挂 IO 啊,item 组件里再包一层就行。」** → 能,别否认。区别是那样有**两套可见判定**:库按索引算渲染范围(含 overscan),我按几何算曝光范围,两套对同一件事各算各的,overscan 一改就得重新对一遍。自己写只有一个 `scrollTop` 作为唯一真相。
- **「react-virtual 呢?它是 headless,不接管容器。」** → 认。「那个当时是 2.x,还没进 TanStack、API 也在动,我没敢上生产。」
  ⚠️ 这仍是最硬的反问 —— react-virtual `2.10.0` 的类型里既有 `windowRef`,又有 `measureRef`,形态和你写的一模一样。只能答「当时不敢押一个 API 还在变的库」,认完立刻转回曝光那条,别硬撑。
- **「那你现在会怎么选?」** → 还是定高 + 自己做曝光的话,仍然自己写。卡片要是改成不定高,直接上 `@tanstack/react-virtual`,把测量交出去 —— 但曝光那层照样得自己挂 IO。

### 你当时大概是怎么做的

1. 数据从后端拿(分页 `page=1&size=20`)
2. 首屏渲染第 1 页
3. `useVirtualList(list, itemHeight, ...)` 拿到 `visibleItems`
4. 底部放一个 sentinel `<div ref={loaderRef} />`,IntersectionObserver 观察它
5. Sentinel 进入视口 → `fetchNextPage()` → 数据 append 到 list → 重新计算 visibleItems
6. **另一个 IntersectionObserver 观察每张卡做曝光上报**(`threshold: 0.5` + 进出时间戳算停留时长,`exposedIds` 去重)
7. 每个 item 用 `translateY` 定位
8. scroll 加 `passive: true`

⚠️ 第 6 步和第 4 步是**两个不同的 observer**,别在面试里说成一件事:哨兵那个管翻页(一个观察对象、`rootMargin` 提前触发),逐卡那个管埋点(N 个观察对象、看 `intersectionRatio`)。

### 两个难点(被问「最大的难点是什么」就答这两条)

两条都不是「虚拟列表本身难写」—— 窗口化只有三行算术。**难的是虚拟列表把别的东西弄坏了。**

#### 难点一:列表会回收 DOM,埋点就不准了

普通列表里「卡片在 DOM 里」约等于「用户看见了」。虚拟列表把这个等号打断,三种错法:

- **多报**:overscan 预渲染的卡已经在 DOM 里,但在视口外。按「挂载即曝光」算,overscan 开 3 就每屏多报 3 张。
- **重报**:卡片滚出去被卸载、滚回来又挂载,一张卡报两次。
- **漏报**:用户正看着某张卡就切后台/退页面,IO 的「离开」回调永远不来,那次曝光丢了。

**怎么解**:曝光判定和渲染判定彻底分开,只信几何不信挂载 —— 单独一个 IO 看 `intersectionRatio ≥ 0.5`,进出时间戳算停留 ≥1s 才算数;`exposedIds` 用**业务 id** 去重(用 index 会随数据 append 变);`visibilitychange` / `pagehide` 里把还没结算的补报一遍。

> 这条也是「为什么不用 react-window」的主理由:曝光要的是几何,库只给索引。

#### 难点二:IntersectionObserver 只在状态「变化」时回调,无限滚动会卡死

哨兵进视口 → 拉下一页,听着简单。但 IO 是**边沿触发**,不是电平触发 —— 哨兵一直在视口里、状态没变,它就不再回调。两种死法:

- **请求失败**:哨兵还在视口,回调不来第二次,列表死在那儿,用户上下滚都救不回来。
- **一页撑不满一屏**(`size=5` 但屏幕放得下 9 条):追加完哨兵仍在视口内,下一页永远不触发。

**怎么解**:失败态必须给「点击重试」按钮 —— 这不是体验兜底,是功能必需,自动重试永远不会来;append 完主动 `unobserve` + `observe` 重挂一次,强制 IO 重算当前状态。加载中上锁防重复请求,到底了 `unobserve` 别空转。


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
