---
title: "⑤ 一次精确到帧的排查"
tier: must
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# ⑤ 一次精确到帧的排查

> **简历原句**
>
> **Traced a freeze on every color change to the fog**: **rebuilding it as a new object made every material in the scene recompile its shader in one frame**. **Reusing one fog object and setting its color removed it**.
>
> ---
>
> 把每次换配色时出现的卡顿定位到了雾：把它当成新对象重建，会让场景里每一个材质在同一帧内重新编译着色器。改成复用同一个雾对象、只改它的颜色，卡顿就消失了。

「雾属于材质的 program key」和那个统计每帧新建管线数的探针都不在简历上。**探针是这条唯一的证据来源**，被追问「你怎么确认是重编译」时必须拿它出来。

## 先把词说清

**着色器（shader）**：GPU 上实际跑的小程序，决定每个像素最终什么颜色。**它需要先编译成 GPU 能执行的指令，这个编译是有成本的。**

**渲染管线（render pipeline）**：着色器加上一整套渲染状态编译出来的产物。WebGPU 里在某个「材质 × 几何体」组合**第一次被绘制的那一帧**才编译。

**program key（程序标识）**：渲染器给材质算的一个「归类键」。**同一个 key 的材质共用同一份编译产物**，key 变了就得重新编译。

**uniform（传给着色器的参数）**：不改变着色器代码、只改变它读到的数值的东西，比如颜色、透明度。**改它是白菜价。**

**对象身份（object identity）**：JS 里两个值是不是同一个对象引用。**React 判断「要不要重建」看的就是这个，而这条 bullet 的根因也在这里。**

**卡顿（hitch / freeze / jank）**：单帧耗时突然暴涨造成的可见停顿。

## 这条要讲清什么

这是 WinterFell 几条里**唯一一个完整的观察 → 假设 → 验证 → 修复链条**，而且每一环都有东西可指。三分钟版建议主讲这条。

它最值钱的地方不是根因有多刁钻，是**验证那一步**：不是「我觉得是着色器编译」，是「**我写了个探针数了一下**」。

## 现象

那个冻结**精确地落在换关那一刻**，最后画出来的那一帧还停在旧配色上，**而 HUD 已经更新了**。

**最后半句是最好的线索**：画面卡在旧配色，而界面上的分数已经更新了，说明**游戏逻辑在正常跑，堵住的是渲染这一侧**。

能讲出这个观察，说明你是从症状往回推的，不是猜的。面试里讲这条一定要从这句开始。

## 根因链条

三层，缺一层都讲不通。

**第一层**：雾当时写成 JSX 标签 `<fog args={[palette.fog, ...]} />`，参数里带着调色板的颜色。关卡换色时参数变了，**React 认为要换一个新对象**，于是重建了一个 `Fog`。

**第二层**：**雾属于材质的 program key。**换了雾对象，等于场景里**每一个材质的 program key 都变了**。

**第三层**：渲染器必须为每个材质重新编译着色器，**全场景的编译挤在同一帧里**，于是冻结。

## 第二层是技术核心

渲染器不会为每个物体单独编译一份着色器，它会把需要**同一份**着色器的材质归成一类，**分类的依据就是 program key**。

关键在于**哪些东西会进这个 key**：**有没有雾**会进，**光源的数量和类型**会进，**用了几张贴图**会进。而**颜色、透明度、位置、旋转都不进**——改这些只是换一个 uniform。

**判据是：它改变的是着色器的代码本身，还是只是传给着色器的一个数值。**

**雾会改变着色器代码。**有雾的时候，着色器末尾要多一段「根据距离把颜色混向雾色」的计算，**所以有雾和没雾需要两份不同的编译产物**。而换掉雾对象，渲染器认为这是一个不同的雾配置，于是场景里每个材质的 key 全变了，全部要重编译。

**一句话题眼：改 uniform 便宜，改 program key 要重编译。**

## 验证：数一数每帧编译了多少

探针的思路写在它的文件头里：**WebGPU 在某个「材质 × 几何体」组合第一次被绘制时编译渲染管线，而这个编译就发生在需要它的那一帧**；如果慢帧正好就是编译帧，那这个卡顿就是着色器编译。

做法是**包住 `device.createRenderPipeline` 这个接口**，按帧记录这一帧编译了几条管线、这一帧耗时多少。**两条曲线对上，猜想就变成了结论。**

**这一步是这条 bullet 最值钱的地方**：不是我觉得是着色器编译，是**我数了**。面试时要强调这个转变——**从猜测到证据**。

## 修法

把雾从 JSX 标签改成**用一个 ref 存住的对象**：

```tsx
const fog = useRef<Fog | null>(null);

useEffect(() => {
    if (!fog.current) fog.current = new Fog(color, 300, 1000);   // ← 只在第一次创建
    scene.fog = fog.current;
    return () => {
        if (scene.fog === fog.current) scene.fog = null;          // 卸载时才摘掉
    };
}, [scene, color]);

useEffect(() => {
    fog.current?.color.set(color);                                // ← 换色只改颜色，不换对象
}, [color]);
```

**对象身份不变，program key 就不变，不重编译，冻结消失。**

注意卸载时那句 `if (scene.fog === fog.current)`：**只有当前场景的雾还是自己这一个时才摘掉**，否则会把别人刚挂上去的雾误删。

## 英文怎么说

**三句最容易说错的。**题眼：**changing a uniform is cheap; changing the program key means every material recompiles**。最好的那条线索：**the last drawn frame was stuck on the old palette while the HUD had already moved on — so the logic was fine and the render side was blocked**。从猜测到证据：**I didn't assume it was shader compilation — I counted pipelines built per frame, and the slow frames were the compile frames**。

**术语对照**：卡顿 hitch、freeze、jank ／ 换配色 palette change ／ 距离雾 distance fog ／ 重建对象 recreate the object ／ 对象身份 object identity ／ 就地修改 mutate ／ 着色器编译 shader compilation ／ 渲染管线 render pipeline ／ 程序标识 program key ／ 传给着色器的参数 uniform ／ 重新编译 recompile ／ 探针 probe ／ 包住某个接口 wrap ／ 慢帧 slow frame ／ 归因 attribute。

## 30 秒回答

> 有个卡顿每次都精确地落在关卡换色那一刻。追下去发现是雾：它当时是写成 JSX 标签的，换色时整个 Fog 对象被重建，而雾属于材质 program key 的一部分——换掉它等于让场景里每一个材质同时失效，渲染器在一帧之内把它们全部重新编译了一遍。我写了个探针包住管线创建接口、数每帧编译了多少条渲染管线，确认了慢帧就是编译帧。修法是把雾提到 ref 里只创建一次、之后只调 color.set。

## 一句话答法（完整版）

> 症状是卡顿精确落在换色那一刻，而且卡住的那帧画面是旧配色但 HUD 已经更新了，说明逻辑在跑、堵的是渲染侧。根因是雾当时写成了 JSX 标签，换色时 React 重建了 Fog 对象；而雾会改变着色器代码本身，它属于材质的 program key，换掉它等于让全场景材质同时失效，渲染器在一帧里重编译了所有材质。我写了个探针包住管线创建接口、按帧统计编译数量，确认慢帧就是编译帧。修法是把雾提到 ref 里只创建一次、之后只改颜色——对象身份不变，program key 就不变。

## 自检

1. 能否从「HUD 已经更新而画面停在旧配色」这条线索讲起？
2. 能否讲完三层根因链条？
3. 能否说清什么会进 program key、什么不会，以及判据是什么？
4. 能否说明雾为什么会改变着色器代码本身？
5. 能否讲出探针的做法（包住哪个接口、统计什么），并说明它把猜测变成了什么？
6. 能否解释修法为什么有效，落到「对象身份」这四个字上？
