---
title: "④ 一次精确到帧的排查"
tier: must
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# ④ 一次精确到帧的排查

> **简历原句**
>
> **Traced a freeze landing exactly on each palette change to distance fog**: declared as JSX it **rebuilt the fog object**, and **fog belongs to a material's program key**, so the renderer **recompiled every material in the scene inside one frame** — a **probe counting pipelines built per frame** confirmed it; one mutated fog object removed it.
>
> ---
>
> 把每次换配色时精准出现的卡顿定位到了距离雾：以 JSX 声明会重建 fog 对象，而 fog 属于材质的 program key，于是渲染器在同一帧里重新编译了场景中的每一个材质 —— 一个统计每帧新建管线数的探针证实了这一点；改成复用同一个 fog 对象后卡顿消失。

## 这条 bullet 在讲什么

⭐ **这是四条里唯一一个完整的「观察 → 假设 → 验证 → 修复」链条，而且每一环都有东西可指。3 分钟版建议主讲这条。**

**它最值钱的地方不是根因有多刁钻，是「验证」那一步**：⭐ **不是「我觉得是着色器编译」，是「我写了个探针数了一下」。**

## 30 秒口播稿

> 有个卡顿**每次都精确地落在关卡换色那一刻**。追下去发现是雾：它当时是写成 JSX 标签的，**换色时整个雾对象被重建**，而 ⭐ **雾属于材质的「程序标识」的一部分** —— 换掉它等于让场景里每一个材质同时失效，**渲染器在一帧之内把它们全部重新编译了一遍**。
>
> **我写了个探针数每帧编译了多少条渲染管线，确认了慢帧就是编译帧。** 修法是把雾提到 ref 里只创建一次、之后只改颜色。



**这条 bullet 的价值在于它是完整的 观察 → 假设 → 验证 → 修复 链条**，而且每一环都有东西可指。**3 分钟版建议主讲这条。**

### 现象（`Game.tsx:99-111` 的注释原话）

> *"That was the freeze that landed **exactly on a sector change**, with **the last drawn frame stuck on the previous palette while the HUD had already moved on**."*
>
> （那个冻结**精确地落在换关那一刻**，**最后画出来的那一帧还停在旧配色上，而 HUD 已经更新了**。）

> ⭐ **最后半句是最好的线索**：画面卡在旧配色，**而界面上的血条分数已经更新了** —— 说明**游戏逻辑在正常跑，堵住的是渲染这一侧**。
>
> **能讲出这个观察，说明你是从症状往回推的，不是猜的。**

### 根因链条（三层，缺一层都讲不通）

```
① 雾是写成 JSX 标签的：<fog args={[palette.fog, ...]} />
     → 关卡换色时参数变了，React 认为要换一个新对象，于是重建了一个雾
         ↓
② 雾属于材质的「程序标识」
     → 换了雾对象 = 场景里每一个材质的程序标识都变了
         ↓
③ 渲染器必须为每个材质重新编译着色器
     → 全场景的编译挤在同一帧里 → 冻结
```

### ⭐ 第 ② 层是技术核心，展开讲

**先说什么是「着色器」**：GPU 上实际跑的小程序，决定每个像素最终什么颜色。**它需要先编译成 GPU 能执行的指令**，这个编译是有成本的。

**「程序标识」（program key）是什么**：渲染器不会为每个物体单独编译一份着色器 —— 它会把**需要同一份着色器的材质归成一类**，这个分类的依据就是程序标识。

**关键在于：哪些东西会进这个标识？**

| 进标识的（改了要重编译） | 不进标识的（改了只是换个数值） |
|---|---|
| **有没有雾** | 材质的颜色 |
| 光源的数量和类型 | 透明度 |
| 用了几张贴图 | 位置、旋转 |

> ⭐ **判据是：它改变的是着色器的代码本身，还是只是传给着色器的一个参数？**
>
> **雾会改变着色器代码** —— 有雾的时候，着色器末尾要多一段「根据距离把颜色混向雾色」的计算。所以「有雾」和「没雾」**需要两份不同的编译产物**。
>
> **而换掉雾对象，渲染器认为「这是一个不同的雾配置」，于是场景里每个材质的标识全变了 —— 全部要重编译。**

**换 uniform 便宜，换程序标识要重编译。** 这句话是这一段的题眼。

### 验证：数一数每帧编译了多少

**探针的文件头说明了方法**（`bench/pipelines.mjs`）：

> *"WebGPU compiles a render pipeline **the first time a material/geometry combination is drawn**, and that compile happens on the frame that needs it... **If the slow frames are the frames that compiled, the hitch is shader compilation.**"*
>
> （WebGPU 在**某个材质/几何组合第一次被绘制时**编译渲染管线，而这个编译就发生在需要它的那一帧……**如果慢帧正好就是编译帧，那这个卡顿就是着色器编译。**）

**做法**：**包住设备创建渲染管线的那个接口**，按帧记录「这一帧编译了几条管线」和「这一帧耗时多少」。两条曲线对上，猜想就变成了结论。

> ⭐ **这一步是这条 bullet 最值钱的地方：不是「我觉得是着色器编译」，是「我数了」。** 面试时强调这个转变 —— **从猜测到证据。**

### 修法（`Game.tsx:112-129`）

```tsx
const LevelFog = ({ color }) => {
  const fog = useRef<Fog | null>(null);
  useEffect(() => {
    if (!fog.current) fog.current = new Fog(color, 300, 1000);  // ⭐ 只创建一次
    scene.fog = fog.current;
    return () => { if (scene.fog === fog.current) scene.fog = null; };
  }, [scene, color]);
  useEffect(() => { fog.current?.color.set(color); }, [color]);  // ⭐ 之后只改颜色
};
```

**用一个 ref 把雾对象存住，第一次才 `new`，之后只调 `color.set()` 改颜色。**

> ⭐ **对象的身份不变 → 程序标识不变 → 不重编译 → 冻结消失。**

### 一句话答法

> 「症状是卡顿精确落在换色那一刻，而且卡住的那帧画面是旧配色但 HUD 已经更新了 —— **说明逻辑在跑，堵的是渲染侧**。根因是雾当时写成了 JSX 标签，换色时 React 重建了雾对象；**而雾会改变着色器代码本身，它属于材质的程序标识**，换掉它等于让全场景材质同时失效，渲染器在一帧里重编译了所有材质。我写了个探针包住管线创建接口、按帧统计编译数量，**确认慢帧就是编译帧**。修法是把雾提到 ref 里只创建一次、之后只改颜色 —— **对象身份不变，程序标识就不变。**」

---

