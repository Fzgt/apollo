---
title: "①④ 渲染管线与那次冻结"
tier: must
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# WinterFell 四条怎么讲

> 🔴 **必看**。⚠️ **第 ② ③ 条（instancing 与关卡扫描）的测量方法已经写透了**：[#17 布局扫描](/docs?section=winterfell&item=n17-layouts) · [#18 draw calls](/docs?section=winterfell&item=n18-draw-calls) · [#19 三角形](/docs?section=winterfell&item=n19-triangles) · [#20 gap](/docs?section=winterfell&item=n20-gap)。
>
> **这一篇补没覆盖的第 ① ④ 条**（TSL/WebGPU fallback、fog 冻结），外加四条各自的口播稿。

## 四条各 30 秒（改一改就能用）

**① bloom 与双后端**

> 这是个霓虹风格的跑酷游戏，**发光材质本身是平的，真正让它「亮」起来的是光晕**。问题在于常用的 `postprocessing` 那个包**只支持 WebGL**，而我们整个游戏是走 WebGPURenderer 渲染的。
>
> 所以 bloom 是用 three 的 **TSL 节点管线**写的——**同一套节点在 WebGPU 后端和 WebGPURenderer 自带的 WebGL2 回退上都能跑**。这样没有 WebGPU 的机器拿到的是同一个画面，**而不是悄悄丢掉这个效果**。

**② instancing**（细节见 [#18](/docs?section=winterfell&item=n18-draw-calls) / [#19](/docs?section=winterfell&item=n19-triangles)）

> 每个障碍区原本是几十个独立 Mesh，合并成两个 InstancedMesh 共用一套矩阵，**每帧 draw call 从 129 降到 76**。代价我也量了：**提交的三角形涨了 2.6 倍**——因为视锥剔除是按场景对象做的，合并之后剔除粒度从「每个方块」退化成「整个区段」。**这笔交易划算是因为省的是 CPU、花的是 GPU 的富余产能。**

**③ 关卡可通过性**（细节见 [#17](/docs?section=winterfell&item=n17-layouts) / [#20](/docs?section=winterfell&item=n20-gap)）

> 障碍是程序化生成的，每局都不一样，**所以「这关能不能过」没法靠试玩验证**。关键是意识到可通过性是**布局的几何性质**，不是运行结果——所以我直接算几何：从整条赛道宽度出发，每前进十个单位按飞行器在**那一关速度下**的横向能力扩张一次可达区间，再减掉障碍碰撞半径，**区间集合变空就说明这个布局必死**。扫了一千多个布局，全部有连续通路。

**④ 那次冻结**（下面详讲）

> 有个卡顿**每次都精确地落在关卡换色那一刻**。追下去发现是雾：它当时是作为 JSX 声明的，**换色时整个 fog 对象被重建**，而**雾属于材质的 program key**——换掉它等于让场景里每一个材质同时失效，渲染器在一帧之内把它们全部重新编译了一遍。**我写了个探针数每帧编译了多少条渲染管线，确认了慢帧就是编译帧。**

## ⭐ 第 ④ 条讲透：一次真正的排查

**这条 bullet 的价值在于它是完整的 observe → hypothesize → verify → fix 链条**，而且每一环都有东西可指。

### 现象（`Game.tsx:99-111` 的注释原话）

> *"That was the freeze that landed **exactly on a sector change**, with **the last drawn frame stuck on the previous palette while the HUD had already moved on**."*

> **最后这半句是最好的线索**：画面卡在旧配色，**而 HUD 已经更新了**——说明**逻辑在跑，是渲染这一侧被堵住了**。能讲出这个观察，说明你是从症状推的，不是猜的。

### 根因链条（三层，缺一层都讲不通）

```
① 雾是作为 JSX 声明的：<fog args={[palette.fog, ...]} />
     → 关卡换色时 args 变了，React 重建了一个新的 Fog 对象
         ↓
② 雾属于材质的 program key
     → 换了 fog 对象 = 场景里每一个材质的 program key 都变了
         ↓
③ 渲染器必须为每个材质重新编译着色器
     → 全场景的编译挤在同一帧里 → 冻结
```

> ⭐ **第 ② 层是这条 bullet 的技术核心**。program key（有的引擎叫 shader variant key）是「这个材质需要哪一份编译好的着色器程序」的标识——**雾、光源数量、贴图槽位这些都会进 key**，因为它们改变的是着色器代码本身而不只是 uniform 值。**换 uniform 便宜，换 key 要重编译。**

### 验证：`bench/pipelines.mjs`

探针的文件头说明了方法：

> *"WebGPU compiles a render pipeline **the first time a material/geometry combination is drawn**, and that compile happens on the frame that needs it... **If the slow frames are the frames that compiled, the hitch is shader compilation.**"*

**做法是包住设备的 pipeline 创建接口，按帧记录「这一帧编译了几条管线」和「这一帧耗时多少」。** 两条曲线对上，猜想就变成了结论。

> **这一步是这条 bullet 最值钱的地方**：**不是「我觉得是着色器编译」，是「我数了」。** 面试时强调这个转变——从猜测到证据。

### 修法（`Game.tsx:112-129`）

```tsx
const LevelFog = ({ color }) => {
  const fog = useRef<Fog | null>(null);
  useEffect(() => {
    if (!fog.current) fog.current = new Fog(color, 300, 1000);  // ⭐ 只创建一次
    scene.fog = fog.current;
    return () => { if (scene.fog === fog.current) scene.fog = null; };
  }, [scene, color]);
  useEffect(() => { fog.current?.color.set(color); }, [color]);  // ⭐ 只改颜色
};
```

**对象身份保持不变，只改它的 `color`。** program key 不变 → 不重编译 → 冻结消失。

> **一句话答法**：「症状是卡顿精确落在换色那一刻，而且卡住的那帧画面是旧配色但 HUD 已经更新了——说明是渲染侧被堵。根因是雾当时写成了 JSX，换色时 React 重建了 fog 对象；**而雾属于材质的 program key，换掉它等于让全场景材质同时失效**，渲染器在一帧里重编译了所有材质。我写了个探针包住 pipeline 创建、按帧统计编译数量，**确认慢帧就是编译帧**。修法是把 fog 提到 ref 里只创建一次、之后只改颜色——**对象身份不变，program key 就不变**。」

## ⭐ 第 ① 条讲透：为什么不用 `postprocessing`

**这一问是「为什么不用现成方案」的最好例子，因为理由是硬的。**

| | |
|---|---|
| **常用的 `postprocessing` 包** | **只支持 WebGL**。而这个游戏是 `WebGPURenderer` 渲染的 |
| **three 的 TSL 节点管线** | 同一套节点**在 WebGPU 后端和 WebGPURenderer 自带的 WebGL2 回退上都能跑** |

**一个渲染器，两个后端**（`Game.tsx:216-219`）：

```ts
const renderer = new WebGPURenderer({ ..., forceWebGL: !isWebGPUSupported });
```

**不是「WebGPU 一套代码、WebGL 另一套代码」，是同一个 `WebGPURenderer` 内部切后端。**

> ⭐ **简历那句 `the look survives the fallback instead of quietly degrading` 是这条的题眼**：常见的做法是「检测不到 WebGPU 就退回一个简化版」，**结果是一部分用户看到的是另一个游戏**。这套的做法是**让回退路径拿到同一个画面**。

**顺带一个 r3f 的细节**（`PostFX.tsx` 注释）：**render priority 大于 0 会把渲染权接管过来**——react-three-fiber 不再自己调 `gl.render`，最终上屏的是合成后的 pass。**这是「后处理为什么要设优先级」的答案。**

## Library 导航

[Library 的 WinterFell 笔记](/library?section=winterfell&item=project) 242 行讲项目、[图形概念](/library?section=winterfell&item=graphics-concepts) 129 行讲 WebGPU/TSL/instancing 的通用原理。**今天读后者补基础概念，前者对照四条 bullet。**
