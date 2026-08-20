---
title: "#19 · 2.6× triangles"
section: WinterFell · Day 12
icon: gamepad-2
tier: ref
day: 12
level: 前置
status: done
---

# #19 · `triangles submitted up 2.6×`

> **材料说明**：WinterFell 在本机，和 [#18](/docs?section=winterfell&item=n18-draw-calls) 是同一次测量、同一份 harness。
>
> **这条是整份简历里唯一一个「变差了的数字」**——而它恰恰是最能加分的一条，因为它证明你在报**代价**，不只是报**收益**。

## 对应简历原句

WinterFell 第 2 条 bullet（v40）：

> Collapsed each obstacle section into two InstancedMeshes sharing one matrix set: a headless Chromium harness sampling renderer stats every frame put draw calls down from 129 to 76 and **triangles submitted up 2.6×**, **one bounding volume per mesh being the price of losing per-instance frustum culling**.

**注意 bullet 自己就把原因写出来了**：`one bounding volume per mesh being the price of losing per-instance frustum culling`。**这半句就是这条的全部技术内容，要能完整展开。**

---

## 一、frustum culling 是什么

**frustum（视锥体）= 相机能看到的那个截头金字塔形空间。**

```
        相机
         /\
        /  \        ← 视锥体：near plane 到 far plane 之间
       /____\          这个范围里的东西才会出现在画面上
```

**frustum culling（视锥剔除）= 渲染前先判断「这个物体在不在视锥里」，不在就直接跳过，连提交都不提交。**

three.js 默认对**每个 Mesh** 做这件事：每帧遍历场景，拿每个 Mesh 的**包围体（bounding volume，通常是包围球）**和视锥求交，不相交就跳过。

**这是个非常划算的优化**：一次廉价的球体-视锥相交测试，就省掉了整个物体的顶点处理。

**在这个游戏里尤其划算**——赛道很长，视野受雾限制大约六百个单位，**任何时刻绝大多数障碍物都在视野外**。

---

## 二、Instancing 为什么会杀掉 frustum culling

**这就是那个 trade-off 的核心。**

| | 场景里的对象 | 剔除粒度 |
|---|---|---|
| **优化前**：N 个独立 Mesh | N 个 | **每个方块单独判断**——视野外的一个都不提交 |
| **优化后**：2 个 InstancedMesh | 2 个 | **整个 section 一个包围体**——只要有一个实例在视野里，**整批全部提交** |

**关键：剔除是按「场景对象」做的，而 instancing 把 N 个对象合成了 1 个。**

于是：

```
一个 section 里 80 个方块，玩家只看得到最前面 10 个
  优化前：剔掉 70 个，只提交 10 个的三角形
  优化后：包围体和视锥相交 → 80 个全部提交
```

**GPU 会为那 70 个不可见的实例跑完顶点着色器，然后在裁剪阶段把它们丢掉。** 工作做了，画面上什么都没多。

**这就是 `triangles submitted` 涨 2.6 倍的原因。**

> **注意 `submitted` 这个词用得很准**——涨的是**提交给 GPU 的三角形数**，不是画面上多了三角形。**画面完全一样。** 面试时要强调这一点，否则听起来像是画质变了。

---

## 三、那为什么这笔交易还是划算的

**这是必答题：draw call 降了 41%，三角形涨了 160%，凭什么说这是优化？**

**答案在于两种成本的性质完全不同：**

| | draw call | 顶点处理 |
|---|---|---|
| **成本在哪** | **CPU**（驱动状态校验、命令打包、提交） | **GPU**（顶点着色器，高度并行） |
| **能不能并行** | 基本串行，受驱动开销限制 | **极度并行**，几千个核同时算 |
| **瓶颈时的表现** | CPU 满、GPU 闲 | GPU 满、CPU 闲 |

**如果瓶颈在 CPU（draw-call bound），那么：**

- 少发 53 次 draw call = **直接省下 CPU 时间**
- 多提交 1.6 倍三角形 = **花的是 GPU 的富余产能**

**用一个瓶颈资源，换一个非瓶颈资源——这就是这笔交易划算的全部理由。**

而 [#18](/docs?section=winterfell&item=n18-draw-calls) 里那条 `fps.p50 > 115` 的提示正好佐证了「GPU 有富余」：四个场景的帧率都顶在合成器 120 的上限上，**harness 自己就说了 `the GPU still has headroom at this resolution`。**

> **⚠️ 但这个结论是有前提的，必须主动说**：
>
> **如果换个场景——更高分辨率、更复杂的着色器、更重的后处理——GPU 变成瓶颈，这笔交易就反过来亏了。** 那时候正确的做法是**分块 instancing**：不是整个 section 一个 InstancedMesh，而是按空间切成若干块，每块一个，**换回一部分剔除粒度**。
>
> **能说出「什么情况下我这个优化是错的」，比说出它为什么对更有说服力。**

---

## 四、2.6× 是怎么测的

**和 [#18](/docs?section=winterfell&item=n18-draw-calls) 是同一次测量**——同一个 harness、同一份采样、同一个 2×2 受控实验（WebGPU/WebGL × instancing 开关）。

数据来源：`src/utils/PerfProbe.tsx:64`

```js
triangles: render.triangles ?? 0,
```

统计量：`bench/run.mjs:142` 输出的是 `triangles.mean`——**采样窗口内每帧三角形数的平均值**。

**2.6× 是两个场景的比值**：`WebGPU + instancing` 的 triangles.mean ÷ `WebGPU, no instancing` 的 triangles.mean。

**绝对数字**：**26,230 → 69,112**（69112 ÷ 26230 = 2.635，即 2.6×）。**报比值时要能一并报出绝对值**——被问「涨到多少」答不上来会显得只背了个倍数。

**⚠️ 还有个口径要注意**：`129 → 76` 是**绝对值**，`2.6×` 是**比值**。同一句话里混用了两种表达。倒不是错，但被问「涨到多少」时，**你得能报出绝对数字**——跑一次 `node bench/run.mjs` 就能拿到。

**关于可信度**（这一条很重要）：`run.mjs:146-153` 那条软件光栅化警告明确说了——

> Draw-call and triangle counts are **CPU-side and still valid**, but any frame timing from a WebGL row is meaningless.

**三角形计数是 CPU 侧的统计（renderer 记录自己提交了多少），跟 headless 里有没有真 GPU 无关。** 所以这个 2.6× 在 headless 环境下**是可信的**，而同一份报告里的帧率不可信。**这个区分能主动说出来，说明你知道自己测量环境的边界。**

---

## 五、按「审什么」逐条过

### ① 为什么涨

见第二节：instancing 把 N 个场景对象合成 2 个，**frustum culling 的粒度从「每个方块」退化成「每个 section」**，视野外的实例也被整批提交。

### ② 与 draw call 的 trade-off

见第三节：**用 CPU 侧的瓶颈资源，换 GPU 侧的富余产能。** 并主动说明前提——GPU 一旦变成瓶颈，这笔交易就该改成分块 instancing。

### ③ 实际帧率影响

**诚实答案：在这次测量里看不出来，因为帧率饱和了。**

四个场景的 `fps.p50` 都超过 115、顶在合成器 ~120 的上限，**FPS 区分不了它们**（`run.mjs:123-131` 那条提示就是为此打的）。

**所以正确的说法是：**

> 「这次测量没能显示帧率提升，因为那个分辨率下四个场景都顶在合成器帧率上限。要看到 draw call 下降转化成帧率，得把分辨率调高、把 GPU 压到成为瓶颈之前——harness 里那条提示也建议了 re-run with a larger `--width/--height`。」

**别硬说帧率提升了。** 数据不支持，而且 harness 自己把这件事写在报告里了——**面试官只要打开代码就能看到那行提示。**

---

## 六、这条 bullet 最大的价值：它报了代价

**整份简历二十个数字，十九个是「变好了」。这一个是「变差了」。**

而且它不是被动承认，是**主动量化并解释**的：

```
draw calls down from 129 to 76     ← 收益
triangles submitted up 2.6×         ← 代价
one bounding volume per mesh being  ← 代价的机制
the price of losing per-instance
frustum culling
```

> **面试官读到这一句会认真起来**，因为绝大多数简历只报收益。**一个把 trade-off 的两边都量出来、还说清了机制的候选人，可信度和其他所有数字一起上升。**
>
> 讲的时候可以直接点出来：「这条我特意把代价也写上了，因为只报 draw call 下降是不完整的——它是用三角形数换来的。」

---

## 七、一句话答法

> 三角形涨 2.6 倍是 instancing 的代价，不是副作用。three.js 的视锥剔除是按场景对象做的，每个 Mesh 一个包围体；把一个 section 的 N 个方块合成两个 InstancedMesh 之后，剔除粒度就从每个方块退化成整个 section——玩家只看得到最前面十来个，但只要包围体和视锥相交，整批八十个的顶点全部提交，GPU 跑完顶点着色器再在裁剪阶段丢掉。画面完全一样，**涨的是提交量不是画面上的三角形**。这笔交易划算是因为两种成本性质不同：draw call 花的是 CPU，顶点处理花的是高度并行的 GPU，而这个场景里 GPU 有富余——harness 报告里那句四个场景都顶在合成器帧率上限就是证据。**但前提就在这儿：换成高分辨率或者重后处理、GPU 变成瓶颈，这笔交易就该反过来，改成按空间分块 instancing 换回一部分剔除粒度。**
