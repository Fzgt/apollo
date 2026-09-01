---
title: "② The TSL node pipeline and two backends"
section: WinterFell
---

# ② The TSL node pipeline and two backends

> **Resume line**
>
> **Made the neon glow work on machines without WebGPU**: it is built on the **newer three.js node pipeline**, so **one renderer drives WebGPU where the browser has it** and **falls back to WebGL2 where it does not**.

The resume sentence is written in plain language; the terminology lives here. TSL, `WebGPURenderer` and "the classic renderer cannot execute this" never appear on paper, but if you are asked, this is where the answers come from.

## Terms, in one line each

**WebGL / WebGL2** — the long-standing browser graphics API, based on OpenGL ES. Every browser has it.

**WebGPU** — the new browser graphics API, closer to how modern GPUs actually work, with lower overhead. Recent Chrome and Edge have it; Safari and older machines may not. **"May not" is the entire problem this line solves.**

**Shader** — a small program that runs on the GPU and decides the final colour of each pixel. WebGL shaders are written in GLSL, WebGPU shaders in WGSL — **two languages, which is why one effect usually cannot run on both.**

**TSL (Three.js Shading Language)** — three.js's node-based way of writing shaders. You describe the effect as a **node graph** in JavaScript, and three.js compiles it to GLSL or WGSL depending on the active backend. **One description, two backends** — that is where its value is.

**Post-processing** — render the whole scene to an off-screen image first, then work on that image as a whole (blur, colour grade, halo), and only then put it on screen.

**Bloom** — a post-processing effect that bleeds the brightest pixels outward, imitating the halo the eye sees around strong light.

**Fallback** — the path taken when the primary one is unavailable.

## What this line has to show

It is the best example of "why not use the off-the-shelf solution", because **the reason is hard**: not that I wanted to write it myself, but that the existing library does not run on this renderer at all.

The half worth telling, though, is the intent. The usual approach is to detect the absence of WebGPU and fall back to a simplified version — **which means some users are looking at a different game.** This approach gives the fallback path the same picture.

## Why bloom is a precondition, not an effect

In a neon world, an **emissive material** renders as a flat patch of bright colour and does not read as glowing. **The halo around it is the visual signal for "this is emitting light".**

So this is not a nice-to-have, it is the precondition for the art direction working at all. Say that first, or it sounds like engineering effort spent on something optional.

## The hard reason

The community's usual post-processing package — **pmndrs `postprocessing` — is WebGL-only**, and this game renders through `WebGPURenderer`. Those do not meet. **It is not a configuration problem; it simply does not run.**

The TSL node pipeline does run: the same nodes work on the WebGPU backend and on `WebGPURenderer`'s own WebGL2 fallback.

```tsx
import { PostProcessing } from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

const scenePass = pass(scene, camera);                       // whole scene to one image
const composed  = scenePass.add(bloom(scenePass, 0.52, 0.55, 0.72));
//                                          strength / radius / threshold

const postProcessing = new PostProcessing(gl);
postProcessing.outputNode = composed;                        // this composite is what ships
```

**`threshold` is worth calling out on its own**: only pixels brighter than it take part in the bloom, which keeps the darks clean. Too low and the whole frame goes milky; too high and the neon stops glowing. 0.72 was tuned.

## One renderer, two backends

In practice, `WebGPURenderer` is constructed with a `forceWebGL` flag, and that flag is the negation of the feature check:

```tsx
const isWebGPUSupported = webGPUAvailable && !benchFlags.forceWebGL;

const renderer = new WebGPURenderer({
    antialias: true,
    forceWebGL: !isWebGPUSupported,   // ← WebGPU if present, its own WebGL2 if not
});
await renderer.init();
```

Get the phrasing right: **this is not one codebase for WebGPU and another for WebGL, it is one renderer switching backends internally.** Saying "two renderers" is wrong, and conspicuously so.

Note also that `benchFlags.forceWebGL` comes from the URL parameter `?renderer=webgl` — **it exists so both backends can be measured against the same scene**, which is the bench harness in the next note.

The clause on the resume — **the look survives the fallback instead of quietly degrading** — is the crux.

## One extra detail: render priority

The post-processing component sets its **`renderPriority` above zero**, which takes the render loop away from react-three-fiber: the framework no longer calls `gl.render` itself, and what reaches the screen is the composited output.

That is the answer to "why does post-processing need a render priority": **post-processing has to be last, because it operates on an already-rendered frame.** It is not a frequent follow-up, but it neatly demonstrates you know where post-processing sits in the pipeline.

## The 30-second answer

> It is a neon-styled endless racer, and an emissive material renders as a flat patch of bright colour — what actually makes it look lit is the halo around it. The problem is that the common post-processing package only supports WebGL, and the whole game renders through WebGPURenderer. So the glow is written on three.js's TSL node pipeline: one set of node descriptions, which three.js compiles into the shading language of whichever backend is active, WGSL for WebGPU and GLSL for WebGL2. That way a machine without WebGPU gets the same picture instead of quietly losing the effect. The switch is a forceWebGL flag on the one renderer, not two renderers.

## Self-check

1. Can you explain the difference between WebGL and WebGPU, and why shader code usually cannot serve both?
2. Can you explain why bloom is a precondition for this art direction rather than an optional effect?
3. Can you state the hard reason for not using the `postprocessing` library?
4. Can you explain why the TSL node pipeline can support both backends?
5. Can you say "one renderer, two backends" accurately rather than "two renderers"?
6. Can you explain why post-processing needs a render priority?
7. What does bloom's `threshold` do, and what goes wrong at each extreme?
