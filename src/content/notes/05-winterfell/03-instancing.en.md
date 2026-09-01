---
title: "③ Batched rendering and what it costs"
section: WinterFell
---

# ③ Batched rendering and what it costs

> **Resume line**
>
> **Cut draw calls from 129 to 76** by collapsing each obstacle field into **two instanced meshes**, **measured frame by frame in a headless Chromium harness**: **the cost is that off-screen obstacles can no longer be skipped one by one**.

The 2.6× rise in submitted triangles is not on the resume — the cost clause is written in plain language. You still need the number: it is the key to "why report a cost when the draw calls went down".

## Terms, in one line each

**Draw call** — one CPU-to-GPU "draw this" command. **Its cost is mostly on the CPU side**, not the GPU.

**CPU-bound / GPU-bound** — which side the bottleneck is on. **Draw-call bound** is a specific form of CPU-bound.

**Instancing** — for N objects sharing one geometry and one material, upload the geometry once, upload N transform matrices as an array, and issue **one** draw call that draws it N times. The three.js class is `THREE.InstancedMesh`.

**Frustum** — the truncated pyramid of space the camera can see, between the near and far planes.

**Frustum culling** — before rendering, test whether an object is inside the frustum, and skip it entirely if not.

**Bounding volume** — a sphere or box that encloses an object, used for that cheap test. **The whole cost of this line comes out of this word.**

**Vertex shader** — a program the GPU runs once per vertex. **Massively parallel.**

**Headroom** — the part of a resource that is not yet used up.

**Headless** — a browser with no visible window, driven by a script, used for automated measurement.

## What this line has to show

Of twenty numbers on the resume, nineteen got better. **This line contains one that got worse** — and it is the one that helps most, because it proves you report costs, not just gains.

The bullet writes the trade-off into the sentence itself. An interviewer reading it sits up, because almost every resume reports only the gain.

## Why draw calls are the bottleneck

Each draw call makes the graphics driver validate state, possibly switch shader, texture and vertex buffer, and pack the command into a queue. **All of that is CPU work.**

The classic bottleneck: five hundred blocks, one draw call each, five hundred CPU-to-GPU submissions per frame. **The CPU cannot keep up and the GPU sits waiting** — frame rate pinned by the CPU while GPU utilisation is low.

That state is called **draw-call bound**, and it is easy to recognise: **halve the polygon count and the frame rate does not move**, because the bottleneck was never GPU arithmetic.

## Instancing: one command, ten thousand objects

If those five hundred blocks share a geometry and a material and differ only in position, rotation and scale, there is no reason to issue five hundred commands. Upload the geometry once, pack five hundred **transform matrices** into an array, and issue one command telling the GPU to draw the geometry five hundred times, taking the nth matrix on the nth pass.

In three.js that object is **`InstancedMesh`**.

"Collapsing each obstacle field into two instanced meshes" means each section went from dozens of independent objects to two. **Why two and not one — because instancing requires one geometry and one material**, and the two roughly correspond to two appearances; be ready to say which two. The two meshes share one set of transform data, so a batch of obstacle positions is computed once and uploaded once.

## The measurement trap: the same field means different things per backend

**This is the most valuable part of the line.**

On the WebGL renderer, `info.render.calls` is the draw-call count **for one frame**. On the WebGPU renderer, the identically named `info.render.calls` is a **cumulative** count of `render()` invocations since startup; its per-frame draw calls live in `info.render.drawCalls`. And WebGPU renders asynchronously, so its automatic per-frame reset does not reliably land before you read it.

**Three traps stacked.** The fix is three steps:

```tsx
info.autoReset = false;                                   // ① turn off the automatic reset

bench.push({
    drawCalls: render.drawCalls ?? render.calls ?? 0,     // ② prefer the WebGPU field, fall back
    triangles: render.triangles ?? 0,
    // ...
});

info.reset?.();                                           // ③ reset by hand, right after sampling
```

Every read then covers exactly one frame, **which is what makes the two backends comparable**.

Without knowing this, the draw-call number you measure under WebGPU climbs from zero into the tens of thousands — **and you might believe it.**

Being able to say "I found that the same field means different things on the two backends" is **the line between having measured it and having copied a snippet.** That sentence is worth saying out loud in an interview.

The same probe holds one more thing worth telling: **frames longer than 250 ms are recorded separately as stalls rather than dropped.** Silently filtering long frames once made a software-rendered run that was spending seconds per frame report a steady 120fps, because only the handful of fast frames survived the filter.

## How the experiment is built

Four scenarios, a **2×2 controlled experiment**: rendering backend × instancing on/off. WebGPU instanced, WebGPU not, WebGL instanced, WebGL not.

Three URL flags, each with a purpose: `?perf=1` mounts the probe, **only under that flag, so a normal visit costs nothing**; an invincibility flag stops the craft from crashing; `?renderer=webgl` forces the fallback for the control arm.

**The invincibility flag is the key design decision**: it fixes the **sampling window**. Without it a run ends on a crash, the two arms sample different stretches of track, and the difference you measure has scene differences mixed into it.

Sampling runs **Playwright** against a headless browser, a fixed number of seconds per scenario, one probe record per frame, statistics at the end. **129 → 76 is the mean per-frame draw call count over the sampling window.**

## Why report draw calls rather than FPS

The measurement script carries a check: if a scenario's **median FPS is above 115**, the report gains a warning saying these scenarios are pinned at the display **compositor**'s roughly 120fps cap, FPS cannot separate them, and you should read draw calls and triangles instead.

That is not filtering data, it is annotating the report. The logic: **the metric is saturated** — 120 before, 120 after, no visible difference. That does not mean there is no difference, only that the GPU still has headroom and the bottleneck has not arrived.

Asked "why not report an FPS gain", that is the answer: **reporting a saturated metric is self-deception.**

A related warning: **in a headless browser, WebGL often degrades to software rasterisation**, the CPU imitating a GPU. So in that environment **draw calls and triangles are trustworthy** — they are CPU-side counters of what the renderer submitted, regardless of whether a real GPU exists — while **frame times and FPS are not.**

Volunteering that scores well: it shows you know the limits of your measurement environment and only conclude inside them.

## Point by point, for "what gets audited"

The probe is a component I wrote, sampling once per frame, mounted only under `?perf=1`. Same machine, same headless browser, same resolution; the invincibility flag fixes the sampling window; the four scenarios differ only by flags. The figure is a per-frame mean over the window. To reproduce: start the dev server, then run the script under `bench/`; it needs Playwright. Attribution: my probe, my experiment, my runs.

Before running, write down the exact command, the resolution and the sampling seconds — **all three affect the result**, resolution most of all, because it decides whether the GPU is actually saturated.

## Why instancing kills frustum culling

**This is the core of the trade-off.**

Before, the scene held N independent objects and culling was per-object: nothing off-screen was submitted. After, the scene holds two `InstancedMesh` objects, **the whole section shares one bounding volume**, and if a single instance is visible the entire batch is submitted.

**One sentence: culling is per scene object, and instancing turned N objects into one.**

So with eighty blocks in a section and only the nearest ten visible, the old path culled seventy and submitted ten blocks' worth of triangles; the new path finds the bounding volume intersecting the frustum and **submits all eighty**. The GPU runs the vertex shader for those seventy invisible instances and discards them at the **clipping** stage — work done, nothing added to the image.

That is why submitted triangles rose **2.6×**, in absolute terms from **about 26,000 to about 69,000**. Quote the ratio with the absolute numbers; being unable to answer "to what" makes it look like a memorised multiple.

Note how precisely "**submitted**" is used: what rose is triangles **submitted to the GPU**, not triangles in the picture. **The image is identical.** Stress that, or it sounds like the visuals changed.

## So why is the trade still worth it

**This is a must-answer.** Draw calls fell forty per cent, triangles rose by half again — on what grounds is that an optimisation?

Because **the two costs are of entirely different kinds**:

**Draw calls cost CPU time** — state validation, command packing, submission; largely serial, limited by driver overhead. When it bottlenecks, the CPU is saturated and the GPU idles.

**Vertex processing costs GPU time** — vertex shaders, massively parallel, thousands of cores at once. When it bottlenecks, the GPU is saturated and the CPU idles.

If the bottleneck is the CPU, then issuing 53 fewer draw calls **buys back CPU time directly**, and submitting 1.6× more triangles is spent out of **GPU headroom**.

**We spent GPU headroom to buy back CPU time — that is the entire reason the trade is good.** And the saturation warning above is evidence the headroom exists: all four scenarios pinned at the compositor cap, which the script itself reports as "the GPU still has room at this resolution".

## But the conclusion has a precondition, and you must say it

Change the scene — higher resolution, heavier shaders, heavier post-processing — so that **the GPU becomes the bottleneck, and the trade inverts.**

The right move then is **chunked instancing**: not one `InstancedMesh` per section, but the section cut into spatial chunks with one mesh each, buying back some **culling granularity**.

**Being able to say "here is when my optimisation is wrong" is more convincing than saying why it is right.** That holds for any performance bullet.

## Actual frame-rate impact: the honest answer

**This measurement cannot show it, because FPS is saturated.** All four scenarios sit above a 115 median, pinned at the compositor's ~120 cap.

The correct phrasing: this run did not demonstrate an FPS gain, because at that resolution all four scenarios were at the compositor cap. To see the draw-call reduction turn into frame rate you would raise the resolution until the GPU approaches its own bottleneck; the script's own note recommends re-running in a larger window.

**Do not claim an FPS gain.** The data does not support it, and the script writes that caveat into the report — an interviewer who opens the code sees the line.

## What this bullet is really worth

The gain is 129 → 76 draw calls. The cost is 2.6× submitted triangles. **The mechanism is that each mesh has exactly one bounding volume**, and the cost is the loss of per-instance frustum culling.

You can name it directly: **I put the cost on the resume deliberately, because reporting only the draw-call drop is incomplete — it was bought with triangles.**

## Self-check

1. Can you explain that a draw call costs mostly CPU, and name the signature of being draw-call bound?
2. Can you explain why instancing requires one geometry and one material, and why there are two meshes?
3. Can you tell the `info.render.calls` trap across the two backends, and the three-step fix?
4. Can you say which variable the invincibility flag fixes?
5. Can you explain why you report draw calls rather than FPS?
6. Can you explain why instancing kills per-instance culling, quoting both 2.6× and 26k → 69k?
7. Can you say when this trade inverts, and name chunked instancing as the remedy?
