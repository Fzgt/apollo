---
title: "② TSL 节点管线与双后端"
tier: must
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# ② TSL 节点管线与双后端

> **简历原句**
>
> **Made the neon glow work on machines without WebGPU**: it is built on the **newer three.js node pipeline**, so **one renderer drives WebGPU where the browser has it** and **falls back to WebGL2 where it does not**.
>
> ---
>
> 让霓虹辉光在没有 WebGPU 的机器上照样成立：它建在 three.js 较新的节点管线上，所以同一个渲染器在浏览器支持时走 WebGPU，不支持时回退到 WebGL2。

简历这句写的是大白话，术语全收在这篇正文里。TSL、`WebGPURenderer`、「传统渲染器根本跑不了」这些说法不出现在纸上，但被问到就从这里答。

## 先把词说清

**WebGL / WebGL2（Web Graphics Library）**：浏览器里的老牌图形接口，基于 OpenGL ES，所有浏览器都支持。

**WebGPU**：新一代浏览器图形接口，更贴近现代显卡的工作方式，开销更低。Chrome / Edge 较新版本支持，Safari 和老机器不一定有。**这条 bullet 的整个问题就是它「不一定有」。**

**着色器（shader）**：跑在 GPU 上的小程序，决定每个像素最终是什么颜色。WebGL 用 GLSL 语言写，WebGPU 用 WGSL 写——**两种语言，这就是为什么同一份效果代码通常不能两边跑。**

**TSL（Three.js Shading Language）**：three.js 的节点着色器写法。你用 JavaScript 把效果描述成一张**节点图（node graph）**，three.js 再按当前后端把它编译成 GLSL 或 WGSL。**一份描述，两个后端**——这就是它值钱的地方。

**后处理（post-processing）**：先把整个场景渲染到一张离屏图上，再对这张图整体加工（模糊、调色、加光晕），最后才上屏。

**辉光（bloom）**：一种后处理效果，把画面里特别亮的像素晕开，模拟人眼看强光时的光晕。

**回退（fallback）**：主路径不可用时走的备用路径。

## 这条要讲清什么

它是「为什么不用现成方案」的最好例子，因为**理由是硬的**：不是我想自己写，是现成的库在这个渲染器上根本跑不起来。

而更值得讲的是立意那一半。常见做法是检测不到 WebGPU 就退回一个简化版，**结果是一部分用户看到的其实是另一个游戏**。这套的做法是让回退路径拿到同一个画面。

## 为什么辉光是前提，不是特效

霓虹风格的世界里，**发光材质（emissive material）**本身渲染出来是平的一块亮色，看不出它在发光。**周围那圈光晕才是「发光」的视觉信号。**

所以这不是锦上添花的特效，是这个美术方向能不能成立的前提——讲的时候要先把这句说清楚，否则听起来像是在为一个可选特效做工程。

## 硬理由

社区最常用的后处理库 **`postprocessing`（pmndrs 那个）只支持 WebGL**，而这个游戏是用 `WebGPURenderer` 渲染的。两者对不上，**不是配置问题，是根本跑不了**。

TSL 节点管线能跑：同一套节点在 WebGPU 后端和 `WebGPURenderer` 自带的 WebGL2 回退上都成立。

```tsx
import { PostProcessing } from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

const scenePass = pass(scene, camera);                       // 整个场景渲到一张图
const composed  = scenePass.add(bloom(scenePass, 0.52, 0.55, 0.72));
//                              ↑ strength 强度 / radius 半径 / threshold 阈值

const postProcessing = new PostProcessing(gl);
postProcessing.outputNode = composed;                        // 这张合成图才是上屏的东西
```

**`threshold`（阈值）这个参数值得单独说**：只有亮度超过它的像素才参与辉光，暗部保持干净。设低了整个画面发灰，设高了霓虹不亮。取 0.72 是调出来的。

## 一个渲染器，两个后端

实现上是创建 `WebGPURenderer` 时传一个 `forceWebGL` 开关，取值就是能力检测的反面：

```tsx
const isWebGPUSupported = webGPUAvailable && !benchFlags.forceWebGL;

const renderer = new WebGPURenderer({
    antialias: true,
    forceWebGL: !isWebGPUSupported,   // ← 支持就 WebGPU，不支持就它自带的 WebGL2
});
await renderer.init();
```

这里有个说法必须准确：**不是 WebGPU 一套代码、WebGL 另一套代码，是同一个渲染器内部切后端。**说成两个渲染器就错了，而且错得很显眼。

另外注意 `benchFlags.forceWebGL` 来自 URL 参数 `?renderer=webgl`——**它的存在是为了让两个后端跑同一个场景做对比测量**，见下一篇的 bench 装置。

简历那句「效果在回退路径上照样成立，而不是悄悄降级」是这条的题眼。

## 顺带一个细节：渲染优先级

后处理组件把 **`renderPriority`（渲染优先级）设成大于零**，就把渲染权从 react-three-fiber 手里接管过来了：框架不再自己调 `gl.render`，最终上屏的是合成后的画面。

这是「后处理为什么要设优先级」的答案：**后处理必须是最后一步，它要拿到已经渲染好的画面再加工。**这个追问不算高频，但它能顺手证明你知道后处理在管线里的位置。

## 英文怎么说

**两句最容易说错的。**「同一个渲染器内部切后端」说 **one renderer with two backends**，不要说 two renderers。「效果在回退路径上照样成立」直接用简历原句 **the look survives the fallback instead of quietly degrading**。

**术语对照**：辉光 bloom ／ 后处理 post-processing ／ 渲染通道 pass ／ 节点管线 node pipeline ／ 节点图 node graph ／ 着色器 shader ／ 后端 backend ／ 回退 fallback ／ 悄悄降级 quietly degrade ／ 能力检测 feature detection ／ 渲染优先级 render priority ／ 接管渲染循环 take over the render loop ／ 合成后的画面 the composited output ／ 发光材质 emissive material ／ 阈值 threshold。

## 30 秒回答

> 这是个霓虹风格的跑酷游戏，发光材质本身渲染出来是平的一块亮色，真正让它亮起来的是周围那圈光晕。问题在于社区常用的那个后处理库只支持 WebGL，而我们整个游戏是走 WebGPURenderer 渲染的。所以光晕是用 three.js 的 TSL 节点管线写的——同一套节点描述，three.js 会按当前后端编译成对应的着色器语言，WebGPU 出 WGSL、WebGL2 出 GLSL。这样没有 WebGPU 的机器拿到的是同一个画面，而不是悄悄丢掉这个效果。切换靠的是同一个渲染器上的 forceWebGL 开关，不是两个渲染器。

## 自检

1. 能否说清 WebGL 和 WebGPU 的区别，以及为什么着色器代码通常不能两边通用？
2. 能否说清为什么辉光是这个美术方向的前提，而不是可选特效？
3. 能否说出不用 `postprocessing` 库的硬理由？
4. 能否解释 TSL 节点管线为什么能同时支持两个后端？
5. 能否准确说成「一个渲染器两个后端」，而不是两个渲染器？
6. 能否说明后处理为什么要设渲染优先级？
7. 辉光的 threshold 参数是干什么的，设高设低分别会怎样？
