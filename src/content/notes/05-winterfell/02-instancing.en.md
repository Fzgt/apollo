---
title: "② Batched rendering and what it costs"
section: WinterFell
---

# ② Batched rendering and what it costs

> **Resume line**
>
> **Cut draw calls from 129 to 76** by collapsing each obstacle field into **two instanced meshes**, **measured frame by frame in a headless Chromium harness**: **the cost is that off-screen obstacles can no longer be skipped one by one**.

> ℹ️ **v66 removed "triangles submitted up 2.6×"** and rewrote the cost clause in plain language. You still need the 2.6× figure ready — it is the key link in "why a reduction in draw calls comes with a cost to declare".

## What this bullet is about

⭐ **Of the twenty numbers on the resume, nineteen say "this got better". This bullet contains one that says "this got worse" — and that is exactly what earns credit, because it proves you report costs and not only wins.**

**The bullet writes the mechanism of the trade-off into the sentence itself** (`one bounding volume per mesh being the price of...`). **An interviewer reading that line starts paying attention, because almost every resume reports only the upside.**

## 1. What a draw call is, and why it is the bottleneck

**A draw call is the CPU telling the GPU once: "draw this thing".**

**The key point: its cost sits mostly on the CPU side, not the GPU.** Each command means the graphics driver validating state, possibly switching shaders/textures/vertex buffers, and packing the command into a queue.

**The classic bottleneck looks like this:**

```
500 blocks in the scene, one draw command each
  → 500 CPU → GPU submissions per frame
    → the CPU cannot keep up and the GPU sits waiting
      → the frame rate is pinned by the CPU while GPU utilisation is low
```

> **This situation has a name: draw-call bound. Its signature is that halving your model's triangle count changes the frame rate not at all** — because the bottleneck was never the GPU's arithmetic.

## 2. Instancing: one command draws ten thousand

**If 500 blocks share one geometry and one material and differ only in position, rotation and scale, there is no reason to issue 500 commands.** Instead:

1. Upload the geometry once
2. Pack the 500 **transform matrices** into an array and upload that
3. **Issue one** draw command telling the GPU "draw this geometry 500 times, using array element i on pass i"

**In three.js this is an `InstancedMesh`.**

**So "collapsing each obstacle field into two instanced meshes sharing one matrix set" means:**

- Each section held dozens of independent objects → collapsed into **2**
- **Why two and not one**: instancing requires the same geometry and the same material. The two roughly correspond to two visual kinds — **in an interview you should be able to say which two**
- **Sharing one matrix set**: both meshes read the same transform data, so a batch of obstacles' positions are **computed once and uploaded once**

## 3. ⚠️ The measurement trap: the same counter means different things on the two backends

**This is the most valuable part of the bullet.**

From the comment in `PerfProbe.tsx:11-21`:

> - **On the WebGL renderer, `info.render.calls` is "draw commands this frame"**
> - **On the WebGPU renderer the identically named field is "how many times the render function has been called since startup"** — a monotonically increasing total; its per-frame draw commands live in **a different field**, `drawCalls`
> - **And WebGPU renders asynchronously**, so its automatic per-frame reset **may not have happened before you read the value**

**Three traps stacked. The fix (`:37-44` and `:74`):**

```js
info.autoReset = false;                              // ① turn off the automatic reset
// ...read...
drawCalls: render.drawCalls ?? render.calls ?? 0,    // ② prefer the WebGPU field
// ...
info.reset?.();                                      // ③ reset by hand after sampling
```

> ⭐ **Turn off the automatic reset and reset it yourself after sampling** — that way every read is exactly one frame's worth, **and the two backends become comparable.**
>
> **Without knowing this trap, the "draw call count" you measure under WebGPU is a number climbing from 0 into the tens of thousands, and you might well believe it.**
>
> **Being able to say "I found that the identically named field means different things on the two backends" is the dividing line between having really measured something and having copied a snippet.**

## 4. How the experiment was designed

`bench/run.mjs:32-40` defines **four scenarios**:

```js
{ name: 'WebGPU + instancing',    flags: 'perf=1&immortal=1' },
{ name: 'WebGPU, no instancing',  flags: 'perf=1&immortal=1&instancing=off' },
{ name: 'WebGL + instancing',     flags: 'perf=1&immortal=1&renderer=webgl' },
{ name: 'WebGL, no instancing',   flags: 'perf=1&immortal=1&renderer=webgl&instancing=off' },
```

**A 2×2 controlled experiment**: rendering backend × instancing on or off.

**Each of the three flags has a purpose, and all three are worth explaining:**

| Flag | What it does |
|---|---|
| `perf=1` | Mounts the performance probe. **It mounts only with this parameter, so normal visits pay nothing** |
| ⭐ `immortal=1` | **The craft cannot die** — otherwise a crash cuts the sampling window short and **every run samples a different duration and a different stretch of track** |
| `instancing=off` | Turns instancing off for the control group |

> ⭐ **`immortal=1` is the crucial design decision**: it holds the sampling window constant. **Without it the two groups sample different stretches of the track, and the difference you measure has scene differences mixed into it.**

**How sampling works**: playwright launches a headless browser, each scenario is sampled for a fixed number of seconds, the probe records one entry **per frame**, and statistics are taken at the end.

**129 → 76 reports the mean draw commands per frame across the sampling window.**

## 5. What that `fps.p50 > 115` condition is for

```js
// bench/run.mjs:123-131
const capped = ok.filter(r => r.report.fps.p50 > 115);
if (capped.length) {
  console.log(`> Note: ${capped.length}/${ok.length} scenarios sit at the compositor's
    frame cap (~120 fps), so FPS does not separate them — the GPU still has headroom
    at this resolution. Compare draw calls and triangles instead...`);
}
```

**This does not filter data; it adds a warning to the report.**

**The logic**: if a scenario's **median frame rate exceeds 115**, it is **pinned against the display compositor's 120 fps cap**. **At that point frame rate as a metric has saturated** — it reads 120 before and after the optimisation and shows no difference at all, **which does not mean there is no difference, only that the GPU still has headroom and the bottleneck has not been reached.**

> ⭐ **So that line of code is saying: "at this resolution frame rate can no longer separate these four scenarios; look at draw calls and triangles instead."**
>
> **Which is exactly why this bullet reports draw calls rather than frame rate.** Asked "why not report an FPS improvement", the answer is right here — **reporting a metric that has saturated is fooling yourself.**

**There is a related warning too** (`:146-153`): in a headless browser WebGL often degrades to **software rendering** (the CPU emulating a GPU). That warning draws the line:

| Metric | Trustworthy in a headless environment |
|---|---|
| **Draw calls / triangles** | ✅ **Yes** — **they are CPU-side counters** (the renderer recording what it submitted), independent of whether a real GPU exists |
| **Frame time / frame rate** | ❌ **No** |

> **Volunteering this earns a lot**: it shows you know **where your measurement environment's boundaries are** and only draw conclusions inside them.

## 6. Point by point, against "what will be audited"

| Question | Answer |
|---|---|
| **Which probe** | `src/utils/PerfProbe.tsx`, sampling once per frame, **mounted only under `?perf=1`** |
| **Same scene, same device?** | ✅ One machine, one headless browser, one resolution, **`immortal=1` fixing the sampling window**; the four scenarios differ only by flags |
| **Which statistic is reported** | The **per-frame mean** across the sampling window |
| **Reproducible?** | ✅ Start the dev server and run `node bench/run.mjs`; playwright required |
| **Attribution** | **Your own probe, your own experiment, your own runs** |

⚠️ **One suggestion**: before running, write down **the exact command, resolution and sampling duration** — those three affect the result, **the resolution most of all** (it decides whether the GPU is genuinely saturated).

---

## 7. First, what frustum culling is

**The frustum is the truncated pyramid of space the camera can see.**

```
        camera
         /\
        /  \        ← the frustum: between the near and far planes
       /____\          only things in here can appear on screen
```

**Frustum culling means deciding, before rendering, whether an object is inside the frustum, and skipping it entirely — not even submitting it — when it is not.**

**three.js does this per object by default**: each frame it walks the scene, intersects each object's **bounding volume** (a sphere or box large enough to contain it, used for a cheap rough test) against the frustum, and **skips it when they do not intersect.**

> **It is an extremely good trade**: one cheap sphere intersection test saves the whole object's vertex processing.
>
> **In this game especially** — the track is long, fog limits visibility to about six hundred units, and **at any instant the vast majority of obstacles are out of view.**

## 8. ⭐ Why instancing kills frustum culling

**This is the heart of the trade-off.**

| | Objects in the scene | Culling granularity |
|---|---|---|
| **Before**: N independent objects | N | ✅ **Each block tested individually** — nothing out of view is submitted |
| **After**: 2 instanced meshes | 2 | ⚠️ **The whole section shares one bounding volume** — if a single instance is in view, **the entire batch is submitted** |

> ⭐ **The key: culling happens per scene object, and instancing merged N objects into 1.**

**So:**

```
a section holds 80 blocks and the player can see only the nearest 10
  before: 70 are culled and only 10 blocks' triangles are submitted
  after:  the bounding volume intersects the frustum → all 80 are submitted
```

**The GPU runs the vertex shader for all 70 invisible instances and then throws them away at the clipping stage. The work happened; nothing was added to the picture.**

**That is why the triangles submitted go up 2.6×.**

> ⭐ **Note how precisely the word `submitted` is used** — what went up is **the triangles submitted to the GPU**, **not triangles on screen. The image is identical.** Stress this in an interview, or it sounds like the visuals changed.

**The absolute numbers**: **26,230 → 69,112** (69112 ÷ 26230 = 2.635, i.e. 2.6×). **When quoting a ratio, be ready to quote the absolutes too** — being asked "up to what?" and having no answer makes it look like you memorised a multiplier.

## 9. So why is the trade still worth it

**This is a must-answer: draw calls down 41%, triangles up 160% — on what basis is that an optimisation?**

**The answer is that the two costs are of entirely different natures:**

| | Draw calls | Vertex processing |
|---|---|---|
| **Where the cost lands** | **The CPU** — driver state validation, command packing, submission | **The GPU** — the vertex shader, massively parallel |
| **Parallelisable?** | Essentially serial, limited by driver overhead | **Extremely parallel**, thousands of cores at once |
| **What it looks like as a bottleneck** | CPU saturated, GPU idle | GPU saturated, CPU idle |

**If the bottleneck is the CPU:**

- 53 fewer draw calls = **CPU time saved directly**
- 1.6× more triangles submitted = **spending the GPU's spare capacity**

> ⭐ **Spend a non-bottleneck resource to buy back a bottleneck resource — that is the entire reason this trade pays.**

**And the `fps.p50 > 115` note in section 5 is precisely the evidence that "the GPU has headroom"**: all four scenarios are pinned at the compositor's 120 cap, and **the measurement script itself says "the GPU still has headroom at this resolution".**

## 10. ⚠️ But the conclusion has a precondition, and you must volunteer it

> **Change the scene — higher resolution, more complex shaders, heavier post-processing — so that the GPU becomes the bottleneck, and this trade goes the other way and loses.**
>
> **The right move then is chunked instancing**: not one instanced mesh per section, but **the section cut into spatial chunks with one mesh each** — **buying back some culling granularity.**

> ⭐ **Being able to say "here is when my optimisation is wrong" is more persuasive than explaining why it is right.**

## 11. The real frame-rate impact — the honest answer

**This measurement cannot show it, because frame rate saturated.**

All four scenarios have a median frame rate above 115, pinned at the compositor's roughly 120 cap, **so frame rate cannot separate them.**

**So the correct statement is:**

> "This measurement could not show a frame-rate improvement, **because at that resolution all four scenarios sit at the compositor's frame cap.** To see the draw-call reduction convert into frame rate you would raise the resolution and push the GPU towards being the bottleneck — the note in the measurement script suggests re-running with a larger window for exactly that reason."

> ⚠️ **Do not insist the frame rate improved.** The data does not support it, **and the measurement script writes that fact into its own report** — the interviewer only has to open the code to see the note.

## 12. What this bullet is really worth

```
draw calls down from 129 to 76        ← the win
triangles submitted up 2.6×            ← the cost
one bounding volume per mesh being     ← the mechanism of the cost
the price of losing per-instance
frustum culling
```

> ⭐ **An interviewer reading that starts paying attention**, because almost every resume reports only the upside. **A candidate who measured both sides of a trade-off and explained the mechanism raises the credibility of every other number at the same time.**
>
> **You can point it out directly when telling it**: "I deliberately put the cost on this line, because reporting only the draw-call reduction would be incomplete — **it was bought with triangles.**"

## Glossary

| 中文 | English |
|---|---|
| 绘制命令 | **draw call** |
| 受绘制命令限制 | **draw-call bound** (cf. *GPU-bound* / *CPU-bound*) |
| 实例化渲染 | **instancing · InstancedMesh** |
| 变换矩阵 | **transform matrix** (*sharing one matrix set*) |
| 合批 | **batching** (*collapsed into two meshes*) |
| 视锥 | **frustum** |
| 视锥剔除 | **frustum culling** (*per-instance frustum culling*) |
| 包围体 / 包围盒 | **bounding volume · bounding box** |
| 剔除粒度 | **culling granularity** |
| 提交的三角形 | **triangles submitted** (⚠️ not more triangles on screen) |
| 顶点着色器 | **vertex shader** |
| 裁剪阶段 | **clipping** |
| 富余产能 | **headroom** (*the GPU still has headroom*) |
| 帧率上限 / 饱和 | **frame cap · saturated** (*FPS does not separate them*) |
| 软件光栅化 | **software rasterisation** |
| 无头测量装置 | **headless harness** |
| 受控实验 | **controlled experiment** (2×2 = *a two-by-two*) |
| 采样窗口 | **sampling window** |
| 分块实例化 | **chunked instancing** |

> ⭐ **The three easiest to get wrong**:
>
> 1. "Trading a non-bottleneck resource for a bottleneck one" is **we spent GPU headroom to buy back CPU time** — the entire reason the trade pays
> 2. "Triangles went up" must be **submitted**, followed by **the image is identical**, or it sounds like the visuals changed
> 3. "Frame rate cannot separate the four scenarios" is **FPS is saturated at the compositor cap, so it can't separate them**
