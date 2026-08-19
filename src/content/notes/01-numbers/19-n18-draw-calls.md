---
title: "#18 · 129 → 76 draw calls"
section: Day 1 · 数字口径
icon: calculator
day: 1
level: 前置
status: done
---

# #18 · `draw calls down from 129 to 76`

> **材料说明**：WinterFell 在本机，能指行号、能重跑。
>
> 这条 bullet 的技术点是 **GPU instancing（实例化渲染）**，而测量方法本身有个**很容易搞错的坑**——两个渲染后端的计数语义不一样。**这个坑是这条最能体现「我真的量过」的细节。**

## 对应简历原句

WinterFell 第 2 条 bullet（v40）：

> Collapsed each obstacle section into two InstancedMeshes sharing one matrix set: a headless Chromium harness sampling renderer stats every frame put **draw calls down from 129 to 76** and triangles submitted up 2.6×, one bounding volume per mesh being the price of losing per-instance frustum culling.

（`2.6×` 那半句见 [#19](/docs?section=numbers&item=n19-triangles)。）

---

## 一、draw call 是什么，为什么它是瓶颈

**一次 draw call = CPU 对 GPU 说「画这个东西」的一次命令。**

关键在于**它的成本主要在 CPU 侧，不在 GPU 侧**：每次 draw call，驱动要做状态校验、可能要切换 shader / 纹理 / 顶点缓冲、把命令打包送进队列。

**所以典型的瓶颈长这样：**

```
场景里 500 个方块，每个一次 draw call
  → 每帧 500 次 CPU→GPU 命令
    → CPU 忙不过来，GPU 反而在等
      → 帧率被 CPU 卡住，而 GPU 占用率很低
```

**这就是所谓的 CPU-bound / draw-call bound。** 特征是：**你把模型面数砍一半，帧率纹丝不动**——因为瓶颈根本不在 GPU 算不算得过来。

---

## 二、Instancing：一次 draw call 画一万个

**GPU instancing 解决的正是这个问题。**

如果 500 个方块**用的是同一个几何体和同一个材质**，只是位置/旋转/缩放不同，那完全没必要发 500 次命令。可以：

1. 把几何体传一次
2. 把 500 个**变换矩阵**打包成一个 buffer 传过去
3. 发**一次** draw call，告诉 GPU「用这个几何体画 500 遍，每遍从 buffer 里取第 i 个矩阵」

three.js 里就是 `InstancedMesh`。

**简历里 `Collapsed each obstacle section into two InstancedMeshes sharing one matrix set` 说的是：**

- 每个 section 原本 N 个独立 Mesh → 合并成 **2 个** `InstancedMesh`
- **为什么是 2 个而不是 1 个**：instancing 要求同几何体同材质。两个大概对应两类外观（比如实体块和另一种形态），**面试时要能说出这两个分别是什么**
- **`sharing one matrix set`**：两个 InstancedMesh 共用同一套变换矩阵——同一批障碍物的位置只算一次、只上传一次

---

## 三、⚠️ 测量的坑：两个后端的计数语义不一样

**这一节是这条最有含金量的部分。**

`src/utils/PerfProbe.tsx:11-21` 的注释：

> - **WebGLRenderer's `info.render.calls` is the draw-call count for one frame.**
> - **WebGPURenderer's `info.render.calls` is instead a *cumulative* count of render() invocations since startup**; its per-frame draw calls live in `info.render.drawCalls`. It also renders asynchronously, so its automatic per-frame reset does not reliably land before this callback reads it.

**翻译成人话，三个坑叠在一起：**

| 坑 | 后果 |
|---|---|
| 同名字段 `info.render.calls` 在两个后端含义不同 | WebGL 是「这一帧的 draw call 数」，**WebGPU 是「启动至今 render() 被调了多少次」——一个单调递增的累计值** |
| WebGPU 的 per-frame draw call 在**另一个字段** `drawCalls` 里 | 读错字段就得到一个一直在涨的数 |
| WebGPU **异步渲染**，自动重置不一定在回调读取前完成 | 即使读对字段，也可能读到跨帧的脏数据 |

**解法（`:37-44` 和 `:74`）：**

```js
info.autoReset = false;                                    // 关掉自动重置
// ... 采样 ...
drawCalls: render.drawCalls ?? render.calls ?? 0,          // 优先读 WebGPU 的字段
// ...
info.reset?.();                                            // 采样完立刻手动重置
```

**关掉自动重置，采样后自己重置。** 这样每次读到的都恰好是一帧的量，**两个后端才可比**。

> **这个细节的价值**：如果不知道这个坑，你在 WebGPU 下量出来的「draw calls」会是一个从 0 一路涨到几万的数字，而且你可能还会信它。**能讲出「我发现两个后端的同名字段语义不同」，是「真的量过」和「抄了段代码」的分水岭。**

---

## 四、实验是怎么设计的（受控对比）

`bench/run.mjs:32-40` 定义了**四个场景**：

```js
const SCENARIOS = [
    { name: 'WebGPU + instancing',    flags: 'perf=1&immortal=1' },
    { name: 'WebGPU, no instancing',  flags: 'perf=1&immortal=1&instancing=off' },
    { name: 'WebGL + instancing',     flags: 'perf=1&immortal=1&renderer=webgl' },
    { name: 'WebGL, no instancing',   flags: 'perf=1&immortal=1&renderer=webgl&instancing=off' },
];
```

**这是个 2×2 的受控实验**：渲染后端 × instancing 开关。

**三个 flag 各有用途，都值得讲：**

| flag | 作用 |
|---|---|
| `perf=1` | 挂载 `PerfProbe`（`PerfProbe.tsx:8-9`：**只在 `?perf=1` 下挂载，正常访问零开销**） |
| `immortal=1` | **飞行器不死**——否则采样窗口会因为撞毁而中断，每次采样的时长和场景都不一样 |
| `instancing=off` | 关掉 instancing 走对照组 |

> **`immortal=1` 这个设计很关键**：它把「采样窗口」这个变量固定住了。**没有它，两组数据采集的赛道段落都不一样，比出来的 draw call 差异就混进了场景差异。**

采样方式：`bench/run.mjs` 用 **playwright 起 headless Chromium**，每个场景采样固定秒数（`SECONDS`），`PerfProbe` **每帧**往 `window.__bench` 里推一条记录，最后取统计量。

**129 → 76 报的是 `drawCalls.mean`**（`run.mjs:141`：`Math.round(s.drawCalls.mean)`）——**每帧 draw call 数在采样窗口内的平均值。**

---

## 五、`fps.p50 > 115` 那个过滤条件是干什么的

`bench/run.mjs:123-131`：

```js
const capped = ok.filter(r => r.report.fps.p50 > 115);
if (capped.length) {
    console.log(
        `> Note: ${capped.length}/${ok.length} scenarios sit at the compositor's` +
        ` frame cap (~120 fps), so FPS does not separate them — the GPU still has` +
        ` headroom at this resolution. Compare draw calls and triangles instead,` +
        ` or re-run with a larger --width/--height.`,
    );
}
```

**这不是在过滤数据，是在给报告加一条警告。**

**逻辑是**：如果一个场景的**帧率中位数超过 115**，说明它**顶在了合成器的 120fps 上限**上。这时候 FPS 这个指标已经**饱和**了——优化前后都是 120，**看不出任何差别**，但这不代表没有差别，只代表 GPU 还有富余、瓶颈还没到。

> **所以这行代码是在说：「在这个分辨率下 FPS 已经区分不了这四个场景了，请改看 draw calls 和 triangles。」**
>
> **这正是为什么这条 bullet 报的是 draw calls 而不是 FPS。** 被问「为什么不报帧率提升」，答案就在这里——**报一个已经饱和的指标是自欺欺人**，draw call 才是这次改动真正影响的量。

**还有一条相关的警告**（`run.mjs:146-153`）：

> WARNING: WebGL here is [swiftshader] — software rasterisation, not a GPU. **Draw-call and triangle counts are CPU-side and still valid, but any frame timing from a WebGL row is meaningless for real hardware.**

**headless 环境里 WebGL 常常退化成软件光栅化**（和 [#17](/docs?section=numbers&item=n17-layouts) 遇到的是同一个问题）。这条警告划清了界限：

| 指标 | headless 里可不可信 |
|---|---|
| **draw calls / triangles** | ✅ 可信，**它们是 CPU 侧计数**，跟有没有真 GPU 无关 |
| **帧时间 / FPS** | ❌ 不可信 |

> **这一条能主动说出来非常加分**：它说明你清楚**自己的测量环境的边界在哪**，只在有效范围内下结论。

---

## 六、按「审什么」逐条过

| 审什么 | 答案 |
|---|---|
| **哪个 probe** | `src/utils/PerfProbe.tsx`，`useFrame` 每帧采样 `info.render.drawCalls`，只在 `?perf=1` 挂载 |
| **同场景同设备吗** | ✅ 同一台机器、同一个 headless Chromium、同一分辨率、`immortal=1` 固定采样窗口，四个场景只差 flag |
| **报的是什么统计量** | `drawCalls.mean`，采样窗口内的每帧平均 |
| **p50 过滤条件** | 见第五节——**不是过滤数据，是提示 FPS 已饱和、该看 draw call** |
| **能否复现** | ✅ `npm run dev` + `node bench/run.mjs`，需要 playwright |
| **归因** | 你自己写的 probe、自己搭的 harness、自己跑的 |

**⚠️ 一个建议**：跑之前把**具体命令、分辨率、采样秒数**记下来。`run.mjs` 支持 `--width/--height/--seconds`，**这三个参数会影响结果**（尤其分辨率——它决定 GPU 是不是真的被压满）。

---

## 七、一句话答法

> 每个障碍 section 原本是 N 个独立 Mesh，合并成两个 InstancedMesh 共用一套变换矩阵，draw call 从每帧 129 降到 76。测法是 playwright 起 headless Chromium，跑四个场景——WebGPU 和 WebGL 各配 instancing 开关，一个 2×2 的受控对比，飞行器设成不死好让采样窗口固定——探针每帧读一次渲染器统计。**这里有个坑：WebGL 的 `info.render.calls` 是当帧 draw call 数，WebGPU 的同名字段却是启动至今 render 的累计次数，它的每帧数在 `drawCalls` 里，而且异步渲染让自动重置不一定在回调前落地**，所以我关掉了 autoReset、采样完手动重置，两个后端才可比。**报 draw call 而不是帧率，是因为那个分辨率下四个场景的帧率都顶在合成器 120 的上限、区分不出来——harness 里那句 `fps.p50 > 115` 就是专门打这条提示的。**
