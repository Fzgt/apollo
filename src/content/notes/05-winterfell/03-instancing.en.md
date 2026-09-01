---
title: "③ Batched rendering and what it costs"
section: WinterFell
---

# ③ Batched rendering and what it costs

> **Resume line**
>
> **Cut draw calls from 129 to 76** by collapsing each obstacle field into **two instanced meshes**, **measured frame by frame in a headless Chromium harness**: **the cost is that off-screen obstacles can no longer be skipped one by one**.

The figure "triangles submitted up 2.6×" is not on the resume; the cost is written there in plain language instead. You still need the 2.6× ready, because it is the key link in why a drop in draw calls has to be reported with a cost attached.

## What this line has to show

Of the twenty numbers on the resume, nineteen say something got better. This line contains one that says something got worse — and that is exactly what earns credit, because it proves you report costs and not only wins.

The line carries its own trade-off inside the sentence. An interviewer reading it sits up, because almost every resume reports only the upside.

## What a draw call is, and why it is the bottleneck

A draw call is the CPU telling the GPU, once, to draw something.

The important part is that its cost mostly falls on the CPU, not the GPU. Every command means the graphics driver validates state, possibly switches shaders, textures and vertex buffers, packages the command and queues it.

A typical bottleneck looks like this: five hundred blocks in the scene, one command each, five hundred CPU-to-GPU submissions per frame, the CPU unable to keep up, the GPU idling, the frame rate limited by the CPU while GPU utilisation stays low.

This condition has a name: draw-call bound. It is easy to recognise — halve the polygon count and the frame rate does not move, because the bottleneck was never the GPU's arithmetic.

## Instancing: one command, ten thousand objects

If those five hundred blocks share a geometry and a material and differ only in position, rotation and scale, there is no reason to issue five hundred commands. Upload the geometry once, pack the five hundred transform matrices into an array, and issue one command telling the GPU to draw that geometry five hundred times, using the i-th matrix on the i-th pass.

In three.js this is an instanced mesh.

So "collapsing each obstacle field into two instanced meshes" means each section went from dozens of independent objects down to two. Why two and not one — because instancing requires a shared geometry and material, and the two roughly correspond to two appearances. Be ready to say what those two are. Both meshes share one set of transform data, so the positions for a batch are computed once and uploaded once.

## The measurement trap: the two backends count different things

This is the most substantial part of the line.

On the WebGL renderer, the counter field means "draw calls this frame". On the WebGPU renderer, the field of the same name means "how many times the render function has been called since startup" — a monotonically increasing total — and its per-frame draw call count lives in a different field. On top of that, WebGPU renders asynchronously, so its automatic per-frame reset may not have happened before you read.

Three traps stacked. The fix has three steps: turn off the automatic reset, read the WebGPU field first and fall back to the WebGL field, and reset manually after sampling. Then every read is exactly one frame's worth, and the two backends become comparable.

Without knowing this, the "draw call count" you measure under WebGPU is a number climbing from zero into the tens of thousands — and you might well believe it.

Being able to say "I found that the identically named field means different things on the two backends" is the dividing line between having actually measured and having copied a snippet. It is worth saying out loud in the interview.

## How the experiment was designed

Four scenarios, a two-by-two controlled experiment: rendering backend crossed with the instancing switch. WebGPU with instancing, WebGPU without, WebGL with, WebGL without.

Three flags, each worth explaining. The first mounts the performance probe, and it only mounts with that flag, so normal visits carry no overhead. The second makes the craft immortal — otherwise the sampling window is cut short by a crash, and every sample covers a different duration and a different stretch of track. The third disables instancing for the control group.

The immortality flag is the key design decision: it pins the sampling window as a variable. Without it, the two groups sample different stretches of track and the difference between them is contaminated by the difference in scenery.

Sampling runs a headless browser through Playwright, samples each scenario for a fixed number of seconds, records one entry per frame from the probe, and reports statistics at the end. The 129 to 76 is the mean per-frame draw call count across the sampling window.

## Why report draw calls rather than frame rate

The measurement script has a check: if a scenario's median frame rate exceeds a hundred and fifteen, it appends a warning to the report saying those scenarios are sitting at the compositor's roughly hundred-and-twenty frame cap, that FPS cannot separate them, and that draw calls and triangles should be compared instead.

That is not filtering data, it is annotating the report. The logic: the frame rate metric has saturated, it reads a hundred and twenty before and after, and it shows no difference at all — which does not mean there is no difference, only that the GPU still has headroom and the bottleneck has not been reached.

That is precisely why this line reports draw calls rather than frame rate. When someone asks why you did not report an FPS improvement, this is the answer — reporting a saturated metric is fooling yourself.

There is a related warning: in a headless browser WebGL often falls back to software rasterisation, the CPU imitating a GPU. So in that environment draw call and triangle counts are trustworthy, because they are CPU-side counters of what the renderer submitted and do not depend on a real GPU existing, while frame times and frame rates are not trustworthy.

Volunteering that earns real credit: it shows you know where your measurement environment's boundary is and only draw conclusions inside it.

## Point by point, for an audit

The probe is a component I wrote, sampling once per frame, mounted only with the performance flag. Same machine, same headless browser, same resolution, sampling window pinned by the immortality flag, and the four scenarios differ only by switch. What is reported is the mean per-frame value across the sampling window. Reproduction is starting the dev server and running the bench script, which needs Playwright. Attribution: my probe, my experiment, my run.

Record the exact command, the resolution and the sampling duration before running — those three affect the result, especially the resolution, which decides whether the GPU is genuinely loaded.

## First, what frustum culling is

The frustum is the truncated pyramid of space the camera can see, between the near and far planes. Frustum culling is deciding, before rendering, whether an object is inside that frustum, and skipping it entirely — not even submitting it — when it is not.

three.js does this per object by default: each frame it walks the scene, intersects each object's bounding volume — a sphere or box large enough to contain it, used for a cheap approximate test — against the frustum, and skips anything that does not intersect.

It is an excellent trade: one cheap sphere test saves an entire object's vertex processing. In this game it is especially good, because the track is long, fog limits visibility to about six hundred units, and at any moment the vast majority of obstacles are outside the view.

## Why instancing kills frustum culling

This is the heart of the trade-off.

Before, the scene held N independent objects and culling was decided per object, so nothing outside the view was submitted at all. After, the scene holds two instanced meshes, the whole section shares one bounding volume, and as soon as a single instance is in view the entire batch is submitted.

One sentence: culling happens per scene object, and instancing merged N objects into one.

So with eighty blocks in a section and the player able to see the front ten, before the change seventy were culled and ten submitted; after the change the bounding volume intersects the frustum and all eighty are submitted. The GPU runs the vertex shader for all seventy invisible instances and discards them at clipping. Work done, nothing added to the picture.

That is why submitted triangles rose 2.6×, in absolute terms from roughly twenty-six thousand to roughly sixty-nine thousand. Always be able to give the absolute numbers alongside the ratio; being unable to answer "up to what?" makes it look like you memorised a multiple.

Note that *submitted* is precise: what rose is the triangles submitted to the GPU, not triangles visible on screen. The image is identical. Stress that, or it sounds like the visual quality changed.

## So why is the trade still worth it

This is a mandatory question: draw calls down forty per cent, triangles up a hundred and sixty per cent — on what grounds is that an optimisation?

The answer is that the two costs are fundamentally different resources. Draw call cost falls on the CPU — driver state validation, command packaging, submission — largely serial and bounded by driver overhead, and when it is the bottleneck the CPU is pinned while the GPU idles. Vertex processing cost falls on the GPU — the vertex shader, massively parallel across thousands of cores — and when it is the bottleneck the GPU is pinned while the CPU idles.

If the bottleneck is the CPU, then issuing fifty-three fewer commands is CPU time directly saved, while submitting 1.6× more triangles spends GPU headroom.

Spending a non-bottleneck resource to buy back a bottleneck one is the entire reason this trade is worth it. And the frame-rate saturation warning above is the evidence that the headroom exists: all four scenarios sit at the compositor cap, and the measurement script itself says the GPU still has room at that resolution.

## But the conclusion has a precondition — say it yourself

Change the scenario — higher resolution, heavier shaders, more post-processing — and once the GPU becomes the bottleneck, the trade inverts and loses.

The right response then is chunked instancing: not one instanced mesh per section, but the section split spatially into blocks with one mesh each, buying back part of the culling granularity.

Being able to say "here is when my optimisation is wrong" is more persuasive than explaining why it is right. That sentence applies to every performance line you will ever write.

## The honest answer on frame rate

This measurement cannot show it, because the frame rate saturated. All four scenarios had a median above a hundred and fifteen, sitting at the compositor's roughly hundred-and-twenty cap, and FPS cannot separate them.

The correct statement: this measurement did not show a frame rate improvement, because at that resolution all four scenarios sat at the compositor cap. To see the draw call reduction turn into frame rate, you would raise the resolution and load the GPU toward being the bottleneck — and the measurement script itself suggests rerunning with a larger window.

Do not insist the frame rate improved. The data does not support it, and the measurement script wrote that fact into its own report — an interviewer only has to open the code to see the note.

## What this line is really worth

The win is draw calls from 129 to 76. The cost is 2.6× more submitted triangles. The mechanism is one bounding volume per mesh, which is the price of losing per-instance frustum culling.

An interviewer reading that sits up, because almost every resume reports only the upside. A candidate who measured both sides of a trade-off and can explain the mechanism raises the credibility of every other number at the same time.

You can point at it directly: I deliberately put the cost on the line, because reporting only the draw call reduction would be incomplete — it was bought with triangles.

## Self-check

1. Can you explain that draw call cost falls mostly on the CPU, and name the symptom of being draw-call bound?
2. Can you explain why instancing requires a shared geometry and material, and why there are two meshes?
3. Can you explain the trap where the two backends count different things, and the three-step fix?
4. Can you say which variable the immortality flag pins?
5. Can you explain why draw calls are reported instead of frame rate?
6. Can you explain why instancing kills per-instance culling, and give both the ratio and the absolute numbers?
7. Can you say when this trade would invert, and name chunked instancing as the remedy?
