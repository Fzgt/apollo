---
title: "④ One investigation, frame by frame"
section: WinterFell
---

# ④ One investigation, frame by frame

> **Resume line**
>
> **Traced a freeze on every color change to the fog**: **rebuilding it as a new object made every material in the scene recompile its shader in one frame**. **Reusing one fog object and setting its color removed it**.

> ℹ️ **v66 removed "fog is part of a material's program key" and the probe counting pipelines built per frame.** The probe is this bullet's only source of evidence; when pushed on "how do you know it was recompilation", you have to produce it.

## What this bullet is about

⭐ **It is the only one of the four with a complete observe → hypothesise → verify → fix chain, and every link has something to point at. Lead with this one in a 3-minute version.**

**Its most valuable part is not how exotic the root cause was, it is the verify step**: ⭐ **not "I think it was shader compilation" but "I wrote a probe and counted".**

## The 30-second version

> There was a hitch landing **precisely on the level's colour change**. Tracing it led to the fog: it was written as a JSX tag at the time, so **changing colours rebuilt the whole fog object** — and ⭐ **fog is part of a material's program key**, so replacing it invalidated every material in the scene at once and **the renderer recompiled all of them inside a single frame.**
>
> **I wrote a probe counting how many render pipelines were compiled per frame, and confirmed the slow frames were the compile frames.** The fix was to hoist the fog into a ref, create it once, and afterwards only set its colour.

**The value of this bullet is that it is a complete observe → hypothesise → verify → fix chain**, with something to point at in every link. **Lead with it in a 3-minute version.**

### The symptom (the comment at `Game.tsx:99-111`, verbatim)

> *"That was the freeze that landed **exactly on a sector change**, with **the last drawn frame stuck on the previous palette while the HUD had already moved on**."*

> ⭐ **That second half is the best clue**: the picture is stuck on the old palette **while the health bar and score in the HUD have already updated** — which means **the game logic is running fine and it is the render side that is blocked.**
>
> **Being able to state that observation shows you reasoned back from the symptom rather than guessing.**

### The root-cause chain (three layers; drop any one and it does not hold together)

```
① the fog was written as a JSX tag: <fog args={[palette.fog, ...]} />
     → the arguments change on a palette change, React treats it as a new object, and a new fog is built
         ↓
② fog is part of a material's program key
     → replacing the fog object = every material in the scene has a changed program key
         ↓
③ the renderer must recompile the shader for every material
     → the whole scene's compilation lands in one frame → freeze
```

### ⭐ Layer ② is the technical core; unpack it

**First, what a shader is**: a small program that actually runs on the GPU, deciding the final colour of each pixel. **It has to be compiled into GPU instructions first**, and that compilation is not free.

**What a "program key" is**: the renderer does not compile a separate shader per object — it **groups materials that need the same shader**, and the program key is the basis of that grouping.

**The crux: what goes into that key?**

| In the key (changing it forces a recompile) | Not in the key (changing it is just a value) |
|---|---|
| **Whether there is fog** | A material's colour |
| The number and type of lights | Opacity |
| How many textures are used | Position, rotation |

> ⭐ **The test is: does it change the shader's code, or only a parameter passed into the shader?**
>
> **Fog changes the shader's code** — with fog, the shader needs an extra block at the end blending the colour towards the fog colour by distance. So "with fog" and "without fog" **need two different compiled outputs.**
>
> **And when the fog object is replaced, the renderer considers it a different fog configuration, so every material's key changes — and all of them must recompile.**

**Changing a uniform is cheap; changing the program key means a recompile.** That sentence is the point of this section.

### Verification: count the compiles per frame

**The probe's file header states the method** (`bench/pipelines.mjs`):

> *"WebGPU compiles a render pipeline **the first time a material/geometry combination is drawn**, and that compile happens on the frame that needs it... **If the slow frames are the frames that compiled, the hitch is shader compilation.**"*

**The method**: **wrap the device's pipeline-creation call** and record, per frame, how many pipelines were compiled and how long the frame took. When the two curves line up, the hypothesis becomes a conclusion.

> ⭐ **This step is the most valuable part of the bullet: not "I think it was shader compilation" but "I counted".** Stress that shift in an interview — **from guess to evidence.**

### The fix (`Game.tsx:112-129`)

```tsx
const LevelFog = ({ color }) => {
  const fog = useRef<Fog | null>(null);
  useEffect(() => {
    if (!fog.current) fog.current = new Fog(color, 300, 1000);  // ⭐ created exactly once
    scene.fog = fog.current;
    return () => { if (scene.fog === fog.current) scene.fog = null; };
  }, [scene, color]);
  useEffect(() => { fog.current?.color.set(color); }, [color]);  // ⭐ afterwards only the colour changes
};
```

**A ref holds the fog object, `new` runs only the first time, and afterwards `color.set()` changes the colour.**

> ⭐ **The object's identity stays stable → the program key stays stable → no recompile → the freeze is gone.**

### The one-paragraph answer

> "The symptom was a hitch landing exactly on the colour change, and the frozen frame showed the old palette while the HUD had already updated — **so the logic was running and the render side was blocked**. The root cause was that the fog was written as a JSX tag, so React rebuilt the fog object on a palette change; **and fog changes the shader code itself, it is part of a material's program key**, so replacing it invalidated every material in the scene and the renderer recompiled all of them in one frame. I wrote a probe wrapping the pipeline-creation call and counting compiles per frame, **and confirmed the slow frames were the compile frames**. The fix was hoisting the fog into a ref, creating it once and only setting the colour afterwards — **identity stays stable, so the program key stays stable.**"

---

## Glossary

| 中文 | English |
|---|---|
| 卡顿 / 冻结 | **hitch · freeze · jank** |
| 换配色 | **palette change** |
| 距离雾 | **distance fog** |
| 重建对象 | **rebuild / recreate the object** |
| 对象身份 | **object identity** (⭐ *the identity stays stable, so the key stays stable*) |
| 就地修改 | **mutate** (*one mutated fog object removed it*) |
| 着色器 | **shader** |
| 着色器编译 | **shader compilation** |
| 渲染管线（GPU 的） | **render pipeline** |
| 程序标识 | **program key** |
| uniform（传给着色器的参数） | **uniform** (⭐ *changing a uniform is cheap; changing the program key means a recompile*) |
| 重新编译 | **recompile** |
| 探针 | **probe** |
| 包住某个接口 | **wrap** (*wrap pipeline creation and count per frame*) |
| 慢帧 | **slow frame** |
| 归因 | **attribute** (*the slow frames are the frames that compiled*) |

> ⭐ **The three easiest to get wrong**:
>
> 1. The key sentence: **"Changing a uniform is cheap. Changing the program key means every material recompiles."**
> 2. The best way to state the clue: **the last drawn frame was stuck on the old palette while the HUD had already moved on — so the logic was fine and the render side was blocked**
> 3. From guess to evidence: **I didn't assume it was shader compilation — I counted pipelines built per frame and the slow frames were the compile frames**
