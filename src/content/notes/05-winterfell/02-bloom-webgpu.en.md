---
title: "② The TSL node pipeline and two backends"
section: WinterFell
---

# ② The TSL node pipeline and two backends

> **Resume line**
>
> **Made the neon glow work on machines without WebGPU**: it is built on the **newer three.js node pipeline**, so **one renderer drives WebGPU where the browser has it** and **falls back to WebGL2 where it does not**.

The resume sentence is written in plain language; the terminology lives here. TSL, `WebGPURenderer` and "the classic renderer cannot execute this" never appear on paper, but if you are asked, this is where the answers come from.

## What this line has to show

It is the best example of "why not use the off-the-shelf solution", because the reason is hard: not that I wanted to write it myself, but that the existing library does not run on this renderer at all.

The half worth telling, though, is the intent. The usual approach is to detect the absence of WebGPU and fall back to a simplified version — which means some users are looking at a different game. This approach gives the fallback path the same picture.

## First, what bloom is

Bloom is a post-processing effect: it bleeds the brightest pixels outward, imitating the halo the eye sees around strong light.

Why this game cannot do without it: in a neon world, an emissive material renders as a flat patch of bright colour and does not read as glowing. The halo around it is the visual signal for "this is emitting light". So this is not a nice-to-have effect, it is the precondition for the art direction working at all. Say that first, or it sounds like engineering effort spent on something optional.

## The hard reason

The commonly used post-processing package only supports WebGL, and this game renders through the WebGPU renderer. Those do not meet. It is not a configuration problem — it simply does not run.

The three.js TSL node pipeline does run: the same nodes work on the WebGPU backend and on the WebGL2 fallback built into that same renderer.

The node pipeline is three.js's newer way of writing shaders: you describe the effect as a graph of nodes in JavaScript, and three.js compiles it into the shading language of whichever backend is active — one for WebGPU, another for WebGL. One description running on two backends is exactly where its value is.

## One renderer, two backends

In practice, the WebGPU renderer is constructed with a flag forcing WebGL, and that flag is the negation of the feature check: WebGPU where the browser has it, and the renderer's own WebGL2 implementation where it does not.

Get the phrasing right: this is not one codebase for WebGPU and another for WebGL, it is one renderer switching backends internally. Saying "two renderers" is wrong, and conspicuously so.

The clause on the resume — the look survives the fallback instead of quietly degrading — is the crux. The usual approach falls back to a simplified version, so some users are shown a different game. This one hands the fallback path the same picture.

## One extra detail

The post-processing component sets its render priority above zero, which takes the render loop away from the framework. The framework no longer calls render itself, and what reaches the screen is the composited output.

That is the answer to "why does post-processing need a render priority": post-processing has to be last, because it operates on an already-rendered frame. It is not a frequent follow-up, but it neatly demonstrates you know where post-processing sits in the pipeline.

## The 30-second answer

> It is a neon-styled endless racer, and an emissive material renders as a flat patch of bright colour — what actually makes it look lit is the halo around it. The problem is that the common post-processing package only supports WebGL, and the whole game renders through WebGPU. So the glow is written on three.js's node pipeline: one set of node descriptions, which three.js compiles into shader code for whichever backend is active, one language for WebGPU and another for WebGL2. That way a machine without WebGPU gets the same picture instead of quietly losing the effect.

## Self-check

1. Can you explain why bloom is a precondition for this art direction rather than an optional effect?
2. Can you state the hard reason for not using the off-the-shelf post-processing library?
3. Can you explain why the node pipeline can support both backends?
4. Can you say "one renderer, two backends" accurately rather than "two renderers"?
5. Can you explain why post-processing needs a render priority?
