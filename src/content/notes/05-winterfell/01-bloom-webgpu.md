---
title: "① TSL 节点管线与双后端"
tier: must
section: WinterFell
icon: gamepad-2
day: 12
level: B
status: done
---

# ① TSL 节点管线与双后端

> **简历原句**
>
> **Made the neon glow work on machines without WebGPU**: it is built on the **newer three.js node pipeline**, so **one renderer drives WebGPU where the browser has it** and **falls back to WebGL2 where it does not**.
>
> ---
>
> 让霓虹辉光在没有 WebGPU 的机器上照样成立：它建在 three.js 较新的节点管线上，所以同一个渲染器在浏览器支持时走 WebGPU，不支持时回退到 WebGL2。

> ℹ️ **v66 把这条改成了大白话**：TSL、WebGPURenderer、「classic WebGLRenderer cannot execute」这些词都从简历上撤了。技术事实没变，正文仍按原来的深度讲。

## 这条 bullet 在讲什么

⭐ **它是「为什么不用现成方案」的最好例子，因为理由是硬的** —— 不是「我想自己写」，是**现成的库在这个渲染器上根本跑不起来**。

**而后半句 `instead of quietly degrading` 才是这条真正的立意**：常见做法是「检测不到 WebGPU 就退回一个简化版」，**结果是一部分用户看到的其实是另一个游戏。**

## 30 秒口播稿

> 这是个霓虹风格的跑酷游戏，**发光材质本身渲染出来是平的一块亮色，真正让它「亮」起来的是周围那圈光晕**。
>
> 问题在于常用的后处理库**只支持 WebGL**，而我们整个游戏是走 WebGPU 渲染的。
>
> 所以光晕是用 three.js 的**节点管线**写的 —— **同一套节点描述，three.js 会把它编译成对应后端的着色器代码**，WebGPU 用一种、WebGL2 用另一种。**这样没有 WebGPU 的机器拿到的是同一个画面，而不是悄悄丢掉这个效果。**



**这是「为什么不用现成方案」的最好例子，因为理由是硬的。**

### 先说什么是 bloom

**bloom（辉光 / 光晕）是一种后处理效果（post-processing effect）**：把画面里特别亮的像素「晕开」，模拟人眼看强光时的光晕。

**为什么这个游戏离不开它**：霓虹风格的世界里，**发光材质本身渲染出来是平的一块亮色**，看不出「在发光」。**周围那圈光晕才是「发光」的视觉信号。**

### 硬理由

| | |
|---|---|
| **常用的 `postprocessing` 包** | **只支持 WebGL**。而这个游戏是用 WebGPU 渲染器渲染的 |
| **three.js 的 TSL 节点管线** | 同一套节点**在 WebGPU 后端和这个渲染器自带的 WebGL2 回退上都能跑** |

**「TSL 节点管线」（node pipeline）是什么**：three.js 新的着色器写法 —— **你用 JavaScript 把效果描述成一张节点图，three.js 再把它编译成对应后端的着色器代码**（WebGPU 用 WGSL，WebGL 用 GLSL）。**所以同一份描述能跑在两个后端上。**

### 一个渲染器，两个后端

```ts
// Game.tsx:216-219
const renderer = new WebGPURenderer({ ..., forceWebGL: !isWebGPUSupported });
```

> ⭐ **不是「WebGPU 一套代码、WebGL 另一套代码」，是同一个渲染器内部切后端。** 检测到浏览器不支持 WebGPU，就让它走自带的 WebGL2 实现。

> ⭐ **简历那句 `the look survives the fallback instead of quietly degrading` 是这条的题眼**：
>
> **常见的做法是「检测不到 WebGPU 就退回一个简化版」，结果是一部分用户看到的其实是另一个游戏。** 这套的做法是 —— **让回退路径拿到同一个画面。**

### 顺带一个细节

**后处理组件把渲染优先级设成大于 0，就把渲染权接管过来了**（`PostFX.tsx` 的注释）—— react-three-fiber 不再自己调渲染，**最终上屏的是合成后的画面**。

**这是「后处理为什么要设优先级」的答案**：因为后处理必须是最后一步，它要拿到已经渲染好的画面再加工。

## 四、本篇术语英文对照

| 中文 | 英文 |
|---|---|
| 辉光 / 光晕 | **bloom** |
| 后处理 | **post-processing**（*a post-processing pass*） |
| 渲染通道 | **pass**（*the bloom pass*） |
| 节点管线 | **node pipeline**（three.js TSL） |
| 着色器 | **shader**（WGSL / GLSL） |
| 后端 | **backend**（*WebGPU backend · WebGL2 fallback*） |
| 回退 | **fallback**（⭐ *the look survives the fallback*） |
| 悄悄降级 | **quietly degrade**（简历原句） |
| 能力检测 | **feature detection**（`isWebGPUSupported`） |
| 渲染优先级 | **render priority** |
| 接管渲染 | **take over the render loop** |
| 合成后的画面 | **the composited output** |
| 发光材质 | **emissive material** |

> ⭐ **两个最容易说错的**：
>
> 1. 「同一个渲染器内部切后端」说 **one renderer with two backends**，不要说 "two renderers"
> 2. 「效果在回退路径上照样成立」是简历原句 **the look survives the fallback instead of quietly degrading**
