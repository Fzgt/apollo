---
title: Project walkthrough
section: WinterFell
---

# WinterFell project notes (aligned to the five resume bullets)

> Repository: `~/Desktop/projects/github/CG-WinterFell`, remote `git@github.com:Fzgt/CG-WinterFell.git`, live at https://cg-winter-fell.vercel.app
> Stack: React 19 + @react-three/fiber v9 + three r0.174 (the `three/webgpu` entry) + WebGPU + cannon-es + Zustand + TypeScript + Vite
> **WinterFell is five bullets on the resume.** The first is the opener ("what kind of game is this" — twenty scenes, generated in real time from distance travelled, a fresh seed each run), which is section 0 below.
> **Not on the resume, still answerable**: triangles up 2.6×, "no gap narrower than 15 units", the randomly scattered control group, and the terms TSL / WebGPURenderer / program key. The sections below keep them as they were.
> On the numbers: draw calls are 129→76 and the threshold is 15 units, both measured; the 175→32 and 14 units that circulated earlier were both wrong — see sections 2 and 3.
> This note is the "project walkthrough": file paths, the actual mechanism, and the follow-ups to expect. The general graphics concepts live in `../concepts/LEARNING_NOTES_WINTERFELL_GRAPHICS_CONCEPTS.md`.

---

## 0. What this project is, in thirty seconds

**Resume text (the opening bullet):** *Built a browser racing game: steer a craft through fields of neon obstacles across twenty scenes, with the terrain, skyline and obstacles all generated on the fly from how far you have traveled, on a fresh seed each run.*

A third-person racing/dodging game in the browser. **One linear route, not a loop**: 20 scenes, 1800 units each, about 3.5 kilometres in total, with speed stepping up once per level, ending in the UTS forecourt where the craft comes to a stop. The score is the distance survived, in metres.

One fact to keep in mind: **there is not a single model, texture or audio asset file in the repository.** The skyline, the whale, the turbines and the letters on the signage are all assembled from geometry at runtime, and every sound is synthesised from Web Audio oscillators (`src/utils/audio.ts`). Asked "where did the art come from", the answer is "there is no art, it's all generated in code" — which is itself worth points.

A team of three; you owned the rendering pipeline, performance and level generation.

---

## 1. Bullet 1 — one renderer, two backends

**Resume text:** *Made the neon glow work on machines without WebGPU: it is built on the newer three.js node pipeline, so one renderer drives WebGPU where the browser has it and falls back to WebGL2 where it does not.*

> The older text (the jargon version — go to this depth when pushed): *Built the bloom pass on three.js's TSL node pipeline, which a classic WebGLRenderer cannot execute…*

### Where the code is

- `src/components/PostFX.tsx` — the bloom itself. The three imports that matter:
  ```
  import { PostProcessing } from 'three/webgpu';
  import { pass } from 'three/tsl';
  import { bloom } from 'three/addons/tsl/display/BloomNode.js';
  ```
- `src/Game.tsx:198-220` — where the renderer is created; `src/hooks/useWebGPURenderer.ts` — the `useWebGPUSupport()` probe.

### The chain of reasoning (the order matters)

1. **The neon look comes from the glow, not from the emissive material itself.** An emissive material on its own is flat; what makes it "glow" is the bloom post-process. So bloom isn't a garnish here, it's the whole visual identity.
2. **The usual choice is the `postprocessing` package, but it's WebGL-only.** Down that road, the WebGPU backend has no bloom at all.
3. **So the bloom is built on three's own TSL node pipeline** (`pass()` takes the scene pass, `bloom()` layers on top, `PostProcessing.outputNode` outputs). TSL = Three.js Shading Language, a node-based shader description that three compiles at runtime into WGSL or GLSL.
4. **The cost: a classic `WebGLRenderer` cannot execute a node pipeline.** So instead of branching between two renderers, **everything goes through `WebGPURenderer`**, and its `forceWebGL` parameter picks the backend:
   ```
   const renderer = new WebGPURenderer({ forceWebGL: !isWebGPUSupported, ... });
   ```
   With WebGPU it uses WebGPU; without it, it uses WebGPURenderer's own **WebGL2 backend**. The same node graph compiles on both.
5. **The conclusion (what that half-sentence on the resume means):** what degrades is the backend, not the picture. The conventional approach degrades by **silently dropping bloom**, and the user sees a lifeless scene with no error anywhere.

### One more detail worth knowing

`PostFX` uses a **render priority > 0**. In r3f that means taking over rendering: r3f stops calling `gl.render` itself and what reaches the screen is the composed pass. Asked "how is post-processing wired into r3f", this is the answer.

### Follow-ups to expect

- **"Where exactly is WebGPU faster than WebGL2?"** → Command buffers and explicit pipeline state objects mean far less driver-side validation and state-change overhead, and compute shaders are native. But **in this project both backends are capped by the compositor on a desktop GPU (~120fps), so FPS can't tell them apart** — say so honestly; it's worth far more than inventing "30% faster".
- **"Why not simply use renderer A when WebGPU is supported and renderer B when it isn't?"** → That means maintaining two post-processing implementations, and the WebGL one necessarily has no TSL bloom. One renderer with two backends is an order of magnitude cheaper to maintain.
- **"What is TSL?"** → See section 2 of the concepts note.
- **"How did you test the fallback path?"** → The URL flag `?renderer=webgl` forces it, and `bench/run.mjs` runs WebGPU/WebGL × instancing on/off as four comparison groups.

---

## 2. Bullet 2 — instanced obstacles, and what they cost

**Resume text:** *Cut draw calls from 129 to 76 by collapsing each obstacle field into two instanced meshes, measured frame by frame in a headless Chromium harness: the cost is that off-screen obstacles can no longer be skipped one by one.*

> ⚠️ **"Triangles submitted up 2.6×" is not on the resume**, and the cost clause was rewritten in plain language. **2.6× still has to be answerable** — the moment you say draw calls fell, "and what did that cost?" follows.

### Where the code is

- `src/components/ObstacleSection.tsx` — two `instancedMesh`es (the body and the glowing frame), with `setMatrixAt(i, ...)` sharing one set of dummy matrices.
- `src/components/ObstacleField.tsx` — scheduling the three live sections.
- `bench/run.mjs` — headless Chromium sampling `renderer.info` frame by frame (draw calls / triangle count) across the four comparison groups.

### ⚠️ The numbers were corrected (measured 2026-08-17)

**The "175 to 32" that circulated earlier was wrong; it has been replaced with measured values.** That day, with `npm run dev` plus `node bench/run.mjs` actually running, the four groups came out as:

| Group | Backend | Draw calls | Triangles |
|---|---|---|---|
| WebGPU + instancing | WebGPU | **76** | 69,112 |
| WebGPU, no instancing | WebGPU | **129** | 26,230 |
| WebGL + instancing | WebGPU (WebGL2 backend) | 76 | 67,838 |
| WebGL, no instancing | same | 126 | 26,198 |

**The real numbers: 129 → 76, about 1.7×.** Over a 20-second continuous play window, draw calls float between **67 and 81** (geometries steady at 49, textures at 27), which shows the per-section recycling works — the cost doesn't grow with distance.

**And the bench quantified the trade-off itself, which is worth far more than the draw-call number:** triangles submitted went from **26,230 to 69,112, a 2.6× increase**. Separate meshes are frustum-culled one by one; an `InstancedMesh` is a single object, so if any part of it is on screen the whole set is submitted. **Quote both numbers in an interview: draw calls down 1.7×, triangles up 2.6×, and this scene simply isn't draw-call bound on a desktop GPU.** Saying that moves you from "I can use instancing" to "I know it didn't actually pay off here".

### The trade-off you must volunteer

> **An `InstancedMesh` has exactly one bounding volume.** Per-instance frustum culling therefore disappears, and more geometry ends up submitted to the GPU. What you buy is a lower draw-call count, not "faster across the board".

Line 75 of the README says the same thing. **Don't wait for the interviewer to dig this out** — volunteer it; it lifts "I can use the API" into "I know what the API costs".

### Two implementation details in the code that draw follow-ups

1. **Why `useLayoutEffect` rather than `useEffect` to write the matrices?** (the comment at `ObstacleSection.tsx:56`) → An `InstancedMesh` starts with empty matrices, and if the first render happens before the matrices are written you get one frame in the wrong position.
2. **Why `frustumCulled={false}`?** (the comment on line 125 of the same file) → An `InstancedMesh` only computes its bounding sphere from the instance matrices the first time it's culled — **and then caches it**. If that test happens before the effect that writes the matrices, the bounding sphere is a single point at the origin and the entire obstacle section is culled the moment the camera flies past — **the obstacles flash once and vanish permanently**. The three live sections are always near the camera anyway, so turning culling off is the right call.
   > This is the best "tell me about a trap you hit" answer in the project — symptom (the obstacles disappeared), root cause (when the bounding sphere gets cached), fix (turn culling off), and why turning it off is safe. All four parts are there.

### Follow-ups to expect

- **"Are 129 and 76 the whole frame or just the obstacles?"** → Whole-frame renderer statistics, including the ground, the skyline and the craft.
- **"Why two InstancedMeshes rather than one?"** → The body and the glowing frame use different materials (the frame is emissive and feeds the bloom). Different materials must be separate, but the matrices can be shared.
- **"How are the three live sections recycled?"** → publish/get/release in `src/utils/obstacleRegistry.ts`, generating by section index rather than storing everything.

---

## 3. Bullet 3 — fairness is measured, not played

**Resume text:** *Checked the level generator by machine rather than by playing it: across 1,020 generated layouts, every step tested against how far the craft can move sideways at that stage's speed, every layout had a way through.*

> ⚠️ **"No gap narrower than 15 units" and the randomly scattered control group are not on the resume.** Both still have to be answerable: the threshold is what "has a way through" is judged against, and the control group is the answer to "does this sweep actually discriminate?".

### Where the code is

- `bench/fairness.mjs` — **imports the real generator through the Vite dev server** (rather than duplicating the logic), stepping section by section. Defaults are `--sections 12 --trials 40`; the 1,020 layouts on the resume are `--sections 20 --trials 51`.
- `src/utils/generateObstacles.ts` — the generator itself (`generateSectionObstacles`, `laneAt`, `reseedRoute`).
- `src/config/levels.ts`, `src/config/obstacles.ts` — the speed and density parameters.

### ⚠️ The numbers were corrected (measured 2026-08-17 over two runs)

- **"Zero dead ends" — holds.** Every sample of every section reports "Layouts with no way through" at **0%**, and the report ends with: *"Every layout sampled had a continuous path through it."* Say this with confidence.
- **"Tightest gap 14 units" is wrong, and it was read off the wrong column.** Measured, the **tightest gap per section sits between 15 and 20 units** (the global minimum over the two runs was 15 and 16). The 14 came from **another column**, "Things in view / how wide" — that's how wide the obstacles in view are, not the gap.
  → **The correct phrasing: no section's tightest gap fell below 15 world units.** Generation is random and the number moves slightly between runs, so **don't quote a single precise figure**; say "no lower than 15".
- **The 1,020 needs one qualification.** 20×51 = 1020 is right, but **the last three sections (17/18/19) are the finish area and contain no obstacles**, so the layouts with actual content are 17×51 = **867**. If pushed, say so — better than someone doing the arithmetic themselves.
- **The random control group holds and does discriminate:** the average distance you can fly straight through without touching the controls is **1336 units, against 1226 for the control group**; the control group also throws up straight corridors 121 units wide (which is a whole section flying itself).

### Why it has to be measured rather than play-tested

The comment at the top of `bench/fairness.mjs` is the answer, and it's worth memorising: **in headless Chromium, WebGL degrades to software rasterisation and a frame takes seconds**, so it either crawls or (before delta clamping was added) teleports the player straight through the obstacle field. So **whether a level can be completed is a property of the layout, not of the renderer** — test the layout directly.

### What the criterion is

At every step, ask one question: at **that level's speed**, given how far the craft can move **sideways**, can it still reach a safe position? Not "is there a gap", but "is the gap reachable". The control group is a randomly scattered layout, there to prove that "zero dead ends" isn't just a loose criterion.

### The four hard rules of route generation (worth memorising separately — this is the evidence of design ability)

1. Guarantee a corridor through the whole route, where the corridor's lateral rate never exceeds what the craft can follow at that speed.
2. Solve the corridor width against **the visible distance**, not against the section — otherwise you get "by the time you can see it, it's already too late".
3. Compute density against a **flight-time budget** (38–76 blocks per second), not against distance — computed against distance, it suddenly thickens once speed rises.
4. Buy height with width (`width × height ≤ 1.05` base blocks), so the generator can never throw a wall across the horizon.

### Follow-ups to expect

- **"What is a unit?"** → A world unit, in the same coordinate system as the 1800 per section and the 3.5km total.
- **"What did the random control group show?"** → Same number of blocks, same ground, scattered at random: the straight-flight distance drops from 1336 to 1226, and it throws up straight corridors 121 units wide — **the point of the control group is to prove the criterion discriminates**, not to make up the numbers.
- **"Why import the generator from the dev server rather than copying the logic into the bench?"** → A copy drifts, and then you're testing the copy instead of the product code.

---

## 4. Bullet 4 — fog and the program key: one frozen frame

**Resume text:** *Traced a freeze on every color change to the fog: rebuilding it as a new object made every material in the scene recompile its shader in one frame. Reusing one fog object and setting its color removed it.*

> ⚠️ **"Fog is part of a material's program key" and the probe counting new pipelines per frame are not on the resume.** The probe is the only evidence behind this bullet; when asked "how do you know it was recompilation", it's what you produce.

**This is the best debugging story in the whole note, and it rests on something most frontend engineers don't know. Get it fluent before the interview.**

### Where the code is

`LevelFog` at `src/Game.tsx:112-129`, and where it's used at `Game.tsx:233`. The fixed shape:

```tsx
const LevelFog = ({ color }: { color: string }) => {
    const scene = useThree(state => state.scene);
    const fog = useRef<Fog | null>(null);
    useEffect(() => {
        if (!fog.current) fog.current = new Fog(color, 300, 1000);
        scene.fog = fog.current;
        return () => { if (scene.fog === fog.current) scene.fog = null; };
    }, [scene, color]);
    useEffect(() => { fog.current?.color.set(color); }, [color]);
    return null;
};
```

**One Fog object for the whole run; a colour change is just `color.set()`.**

### Tell it in four parts (symptom → root cause → verification → fix)

1. **Symptom:** the stutter landed exactly on a scene transition (the frame where the palette changes). The picture froze on the old palette while the HUD counter kept advancing — so it wasn't "the logic stalled", it was the render thread being saturated.
2. **Root cause:** it was originally written as `<fog args={[color, 300, 1000]} />`. **When a JSX prop changes, r3f rebuilds the Fog object**; and **fog participates in a material's program key** — whether it exists and what type it is decides which shader variant has to be compiled. Replacing the Fog object invalidates the program key of **every material in the scene**, so all of them recompile **inside the same frame**.
3. **Verification:** `bench/pipelines.mjs` wraps the device's pipeline creation and **counts new pipelines per frame**, lining that up against frame time. On the frozen frame the count explodes — which nails it to shader compilation and nothing else.
4. **Fix:** one Fog object, mutate the colour only. The program key never changes and not one shader is recompiled.

### Follow-ups to expect

- **"What is a program key?"** → See section 3 of the concepts note. In one line: three caches compiled shader programs against a combination of material features, and fog/lights/skinning/morph/texture slots are all part of that key.
- **"But if the colour changed, doesn't the shader have to change?"** → No. The colour is a **uniform**, uploaded at runtime; it's the **presence and type** of fog that's a compile-time branch. That distinction is the technical core of this bullet.
- **"Why not `onBeforeCompile` or material warm-up?"** → Warm-up (`compileAsync`) can flatten the first compile, but the problem here is **recompiling on every colour change**, which warm-up doesn't touch; the root cause is the object identity changing.
- **"What other props in r3f rebuild on change like this?"** → Any change to an item in the `args` array rebuilds the instance. That's a general r3f rule, not something specific to fog.

---

## 5. The one that got dropped (still in the README — don't pretend it isn't)

`bench/leak.mjs` wraps the GPU device to count surviving buffers/textures, and caught **about 800 left over on a restart, 463 on a cold start**. The root cause is that **r3f v9 no longer disposes automatically on unmount**, and most of this project's geometry is hand-built. The handling was **to make "restart" reload the document rather than remount the scene — which is a workaround, not a fix**, and it ends too weakly, which is why it is not on the resume.

**But it's still in the README.** If an interviewer has read it and asks, say it straight: it was located, it was quantified, and the cheapest workaround was chosen at the time; the real fix is adding a dispose lifecycle to the hand-built geometry. Admitting that beats trying to round it off.

---

## 6. The seven bench scripts each answer one question (when asked "how did you verify it", produce this list)

| Script | The question it answers |
|---|---|
| `run.mjs` | What the rendering approach costs: WebGPU/WebGL × instancing on/off, four groups |
| `leak.mjs` | Whether GPU resources leak across a restart |
| `jank.mjs` | Where the worst frames fall by distance |
| `pipelines.mjs` | How many pipelines are created per frame (= is it compiling shaders) |
| `vberror.mjs` | Locating vertex-buffer errors |
| `attrowner.mjs` | Tracking attribute ownership |
| `probecost.mjs` | Whether the `?perf=1` probe itself changes what it measures |

All of them need playwright, and `npm run dev` has to be running first.

**Every URL flag is opt-in:** `?perf=1` `?renderer=webgl` `?instancing=off` `?immortal=1` `?craft=plane`; for development there's `?scenic=1` and `?z=` (the start of scene n is (n-1)×1800), fenced off in the code with `DEV ONLY` comments.

---

## 7. One judgement that runs through the whole project — memorise it separately

> **The frame rate is capped by the compositor (about 120fps on this machine) and every approach hits that cap on a desktop GPU, so FPS is not a useful signal — draw calls and triangle counts are.**

Line 75 of the README says exactly this. Its value: most candidates finish an optimisation and report "FPS went from X to Y", whereas you can explain **why FPS can't show a difference in this environment and what to look at instead**. That's the difference between "I can measure" and "I know whether the measurement means anything".

---

## 8. The shortest path through a week of revision

In order of return, not in file order:

1. **Section 4 (fog / program key)** — get the telling fluent; it's the strongest one you have.
2. **The two implementation details in section 2** — the bounding-sphere caching trap, and the culling trade-off you have to volunteer.
3. **The five-step chain in section 1** — getting the order right is enough; you don't need TSL's API memorised.
4. **The four route rules in section 3, plus "why it must be measured rather than played"**.
5. **The line in section 7** — it closes out any performance question.

There are only four files you actually need to open: `src/Game.tsx` (LevelFog plus renderer creation), `src/components/PostFX.tsx`, `src/components/ObstacleSection.tsx`, and the header comment of `bench/fairness.mjs`.

---

Related: `../concepts/LEARNING_NOTES_WINTERFELL_GRAPHICS_CONCEPTS.md`, `../../periplus/`
