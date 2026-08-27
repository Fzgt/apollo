---
title: "① The TSL node pipeline and two backends"
section: WinterFell
---

# ① The TSL node pipeline and two backends

> **Resume line**
>
> **Made the neon glow work on machines without WebGPU**: it is built on the **newer three.js node pipeline**, so **one renderer drives WebGPU where the browser has it** and **falls back to WebGL2 where it does not**.

> ℹ️ **v66 rewrote this line in plain language**: TSL, WebGPURenderer and "classic WebGLRenderer cannot execute" all came off the resume. The technical facts are unchanged, and this page still covers them at the original depth.

## What this bullet is about

⭐ **It is the best example of "why not use an off-the-shelf solution", because the reason is hard** — not "I wanted to write my own", but **the existing library simply does not run on this renderer.**

**And the second half, `instead of quietly degrading`, is what the bullet is really arguing**: the common approach is "if WebGPU is not detected, fall back to a simplified version", **which means some of your users are looking at a different game.**

## The 30-second version

> This is a neon-styled racing game, and **an emissive material on its own renders as a flat patch of bright colour; what actually makes it "glow" is the halo around it.**
>
> The problem is that the usual post-processing library **only supports WebGL**, while the whole game renders through WebGPU.
>
> So the glow is written with three.js's **node pipeline** — **one node description that three.js compiles into shader code for whichever backend is in use**, one form for WebGPU and another for WebGL2. **That way a machine without WebGPU gets the same picture rather than quietly losing the effect.**

**This is the best example of "why not use an off-the-shelf solution", because the reason is hard.**

### First, what bloom is

**Bloom is a post-processing effect**: it bleeds the brightest pixels in the frame outwards, imitating the halo the human eye sees around a strong light.

**Why this game cannot do without it**: in a neon world, **an emissive material renders as a flat patch of bright colour** and does not read as glowing. **The halo around it is the visual signal of "this is emitting light".**

### The hard reason

| | |
|---|---|
| **The usual `postprocessing` package** | **WebGL only.** This game renders through the WebGPU renderer |
| **three.js's TSL node pipeline** | The same nodes **run on the WebGPU backend and on this renderer's own WebGL2 fallback** |

**What the "TSL node pipeline" is**: three.js's newer way of writing shaders — **you describe the effect as a graph of nodes in JavaScript, and three.js compiles it into shader code for the backend in use** (WGSL for WebGPU, GLSL for WebGL). **Which is how one description runs on two backends.**

### One renderer, two backends

```ts
// Game.tsx:216-219
const renderer = new WebGPURenderer({ ..., forceWebGL: !isWebGPUSupported });
```

> ⭐ **This is not "one codebase for WebGPU and another for WebGL", it is one renderer switching backends internally.** Detect that the browser lacks WebGPU and it uses its own WebGL2 implementation.

> ⭐ **The resume's `the look survives the fallback instead of quietly degrading` is the point of this bullet**:
>
> **The common approach is "if WebGPU is not detected, fall back to a simplified version", which means some of your users are looking at a different game.** This approach instead **gives the fallback path the same picture.**

### One detail worth carrying

**Setting the post-processing component's render priority above 0 takes over rendering** (the comment in `PostFX.tsx`) — react-three-fiber stops calling the render itself, and **what reaches the screen is the composited output.**

**That is the answer to "why does post-processing need a priority": because post-processing has to be last; it works on a frame that has already been rendered.**

## Glossary

| 中文 | English |
|---|---|
| 辉光 / 光晕 | **bloom** |
| 后处理 | **post-processing** (*a post-processing pass*) |
| 渲染通道 | **pass** (*the bloom pass*) |
| 节点管线 | **node pipeline** (three.js TSL) |
| 着色器 | **shader** (WGSL / GLSL) |
| 后端 | **backend** (*WebGPU backend · WebGL2 fallback*) |
| 回退 | **fallback** (⭐ *the look survives the fallback*) |
| 悄悄降级 | **quietly degrade** (the resume's own phrase) |
| 能力检测 | **feature detection** (`isWebGPUSupported`) |
| 渲染优先级 | **render priority** |
| 接管渲染 | **take over the render loop** |
| 合成后的画面 | **the composited output** |
| 发光材质 | **emissive material** |

> ⭐ **The two easiest to get wrong**:
>
> 1. "One renderer switching backends internally" is **one renderer with two backends** — never "two renderers"
> 2. "The effect survives on the fallback path" is the resume's own phrase, **the look survives the fallback instead of quietly degrading**
