---
title: Graphics / WebGPU concepts
section: WinterFell
---

# Graphics/WebGPU interview notes (the concepts)

> Resume anchor: `Frontend: ... React Three Fiber, Three.js` plus the four WinterFell bullets.
> Division of labour: `../project-related/LEARNING_NOTES_WINTERFELL.md` answers "how was it actually written in this project"; this one answers "what these concepts are, why they exist, and what each choice costs", including the parts the project doesn't use directly but that still get asked about.
> The goal isn't to become a graphics engineer, it's to **not freeze when asked how something works, and to know the price of every choice**.

---

## 1. The pipeline and draw calls: why "merge things" is the first optimisation

**Definition.** One draw call = the CPU telling the GPU, through a graphics API, to draw a batch of geometry. Each call has to set up pipeline state (shaders, material, bound resources), and that cost lands on the CPU.

**Why it's the bottleneck.** GPUs draw triangles very fast and **change state very slowly**. 1000 separate small objects give the GPU little to do, but the CPU has to submit 1000 state changes, and the main thread gives out first. So the first optimisation in browser 3D is usually not "fewer triangles", it's "fewer submissions".

**Three ways to merge, and what each costs:**

| Approach | What it does | The cost |
|---|---|---|
| **Instancing** | N copies of the same geometry and material, submitted once, distinguished by a per-instance matrix | **One bounding volume, so per-instance frustum culling disappears** |
| **Static merging** | Weld several static meshes into one at build or load time | You lose the ability to transform, cull or hide them individually |
| **Atlases / material merging** | Combine textures into an atlas so a material can be reused | Packing complexity, and mipmap bleeding at the edges |

**The examples in WinterFell.** Obstacles use instancing (two `InstancedMesh`es per section), scenery uses static merging (each kilometre tile collapses into a handful of draw calls), and only the things that move (fish, airships, turbines, lighthouse beams) stay as separately animated instances.

**Follow-ups:**
- "Is instancing always faster?" → No. It's faster for dense close-up content; in a sparse, wide scene, losing culling can mean more geometry submitted overall. **Measure it.**
- "What kinds of culling are there?" → Frustum culling (outside the camera's view volume), occlusion culling (hidden behind something else), backface culling (free on the GPU). In the browser, three only does frustum culling by default.

---

## 2. WebGPU vs WebGL2, and what TSL is

**WebGL2** is the browser binding of OpenGL ES 3.0, a state machine: set global state all the way down, then draw. **WebGPU** follows the modern native APIs (Vulkan/Metal/D3D12): explicit **pipeline state objects**, **bind groups** and **command encoders**, with state frozen up front so the driver has almost nothing to validate at submission time. The other big thing it brings is **native compute shaders**.

**Where the difference actually shows:** in submission-heavy scenes (many draw calls, many state changes), WebGPU's CPU-side cost is markedly lower; in fill-rate-bound scenes there's little between them. **Don't memorise a "WebGPU is N% faster" number.**

**The shader languages differ:** WebGL uses GLSL, WebGPU uses **WGSL**. That's why TSL exists.

**TSL (Three.js Shading Language)** is three's **node-based shader description**: you compose nodes in JS to build material and post-processing logic, and three compiles the node graph into WGSL or GLSL at runtime. The value is **one description, two backends**. The cost is that it's tied to the newer `three/webgpu` entry, and a classic `WebGLRenderer` can't execute a node pipeline — which is exactly why WinterFell uses `WebGPURenderer` + `forceWebGL` throughout.

**Follow-ups:**
- "Is WebGPU usable today?" → It's on by default in desktop Chrome/Edge, and patchy in Safari, Firefox and on mobile, **so a fallback isn't optional**.
- "Did you use compute shaders?" → No. Say so honestly, and explain that this project's bottleneck is submission count and shader compilation, not parallel computation.

---

## 3. Shader compilation and the program key: where a stutter really comes from

**The shape of the problem.** Shaders aren't interpreted at runtime, they're **compiled** into GPU programs. Compilation happens on the main/render thread, and one complex material can take a few to a few dozen milliseconds. A frame is 16.7ms — **compile a batch of materials inside one frame and you will drop it**.

**How three manages it:** it caches against a **combination of material features** (the program key, or program cache key), reusing the compiled result for identical combinations. Typical members of that key:
- Whether the scene has **fog**, and what type
- The number and type of lights
- Whether skinning / morph targets are on
- Which texture slots are enabled (map / normalMap / emissiveMap ...)
- Whether instancing, vertex colours or shadows are on

**The distinction you must get right:**
> **Changing a uniform needs no recompile; changing the program key does.**
> Colour, intensity and position are uniforms, uploaded at runtime; **"is there fog", "how many lights", "is instancing on" are compile-time branches**, and changing one swaps in a different program.

**Two practices that follow:**
1. **Don't create or replace an object that's part of the key at runtime** — for instance rebuilding `Fog` on every colour change. Mutate the uniform; don't swap the identity.
2. **Solve the first-entry stutter with warm-up**: `renderer.compileAsync(scene, camera)`, or render each material variant once on the loading screen. But warm-up can't cure "it recompiles every time" — that's a design problem.

**How to confirm a stutter is compilation:** count **the number of pipelines created per frame** and line it up against frame time. The frame where the count explodes is the compiling frame. WinterFell's `bench/pipelines.mjs` does exactly this.

---

## 4. React Three Fiber: a declarative shell around imperative WebGL

**What it is.** r3f is a React renderer for three: you write `<mesh>` and `<instancedMesh>` in JSX and r3f maintains a tree matching the three scene graph. `useFrame` gives you a per-frame callback, `useThree` gets you the renderer/scene/camera.

**Two mechanisms to remember:**

1. **`args` are constructor arguments, and changing one rebuilds the instance.** This is r3f's central rule, and the source of the fog bug. Anything that changes should go through a prop or a mutation, never through `args`.
2. **Never `setState` inside `useFrame`.** setState every frame = React re-rendering every frame. Animation should mutate the three object directly (`ref.current.position.x = ...`), leaving React responsible for structure and not for per-frame numbers.

**A trap in r3f v9 (this project hit it):** v9 no longer disposes geometry and materials automatically on unmount. A project with a lot of hand-built geometry accumulates GPU resources. Either dispose in your own cleanup, or reuse rather than create.

**Follow-ups:**
- "Why r3f rather than bare three?" → Componentised lifecycle and reusable state (hooks that reuse control and renderer logic), and it connects naturally to the React ecosystem (state management, the UI layer). The cost is one more layer of abstraction, and when something breaks you have to see through it to three itself — the fog bug could only be found by doing that.
- "How do you layer state?" → UI and game state (score, level, paused) go in Zustand; per-frame positions and matrices go in no store at all and are mutated directly. **Draw that line in the wrong place and you have a performance disaster.**

---

## 5. Measuring performance in a browser: which signals to trust

**Start with a counter-intuitive conclusion:** **FPS often measures nothing.** Frame presentation is throttled by the **compositor** to the display's refresh rate (commonly 60/120Hz). On a desktop GPU, before and after an optimisation you may sit at 120 both times — an identical FPS curve, while the CPU submission cost differs by several times.

**What to look at instead:**
- **Draw call and triangle counts** (`renderer.info.render` in three) — a direct measure of submission cost.
- **New pipelines per frame** — a measure of shader compilation.
- **The tail of the frame-time distribution (p95/p99, the worst frame)**, not the average. Stutter is a tail phenomenon and an average erases it.
- **Live GPU resource counts** (buffers/textures) — a measure of leaks.

**The headless browser trap:** in headless Chromium, WebGL often degrades to **software rasterisation**, and a frame takes seconds. So **a headless environment is right for logical properties (is a layout passable, statistical counts) and wrong for rendering speed**. WinterFell's fairness check was designed on exactly that basis: don't play it, step through the generator's output directly.

**Follow-ups:**
- "How do you know the probe itself doesn't change the result?" → Measure the probe's own cost separately (`bench/probecost.mjs` is that question). Asking this back makes an interviewer notice you understand measurement contamination.

---

## 6. Procedural generation: turning playability into a verifiable property

**The core idea.** For a randomly generated level, "can it be completed" can't be guaranteed by play-testing — coverage is tiny and one parameter change invalidates all of it. The right move is to **state playability as a decidable property** and check it automatically over a large sample.

**Designing the criterion:** the criterion has to measure against **what the player can actually do**, not against a geometric "is there a gap". WinterFell uses **how far the craft can move sideways at that level's speed** — can it reach the gap.

**You must have a control group.** Everything passing may just mean the criterion is too loose. Run the same criterion over randomly scattered layouts and it should **fail**; only when it fails do you know the criterion discriminates. This is the same idea as "a test must be able to fail".

**General principles for parameterising this (transferable to any random content):**
- Constrain density against a **time budget** rather than distance — speed changes, and distance tells you nothing about how much reaction time the player has.
- Difficulty dimensions must **pay for each other** (buy height with width), or several dimensions hitting their extremes at once will generate impossible combinations.
- Solve constraints against **what the player perceives** (visible distance), not against your implementation's sections.

---

## 7. How this note works with the project note

The concepts note builds the frame: why draw calls matter, what WebGPU and TSL solve, what a program key is, r3f's two mechanisms, which measurements can be trusted, and how random generation becomes verifiable. The project note lands each of those on a specific file and a specific number in WinterFell.

**Preparation order: read this one first to build the concepts, then read the project note to map them onto the code.** Answer "what is X / why A rather than B" from this one; answer "what did you actually do in your project" from that one.
