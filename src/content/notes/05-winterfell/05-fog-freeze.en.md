---
title: "⑤ A freeze traced down to the frame"
section: WinterFell
---

# ⑤ A freeze traced down to the frame

> **Resume line**
>
> **Traced a freeze on every color change to the fog**: **rebuilding it as a new object made every material in the scene recompile its shader in one frame**. **Reusing one fog object and setting its color removed it**.

"Fog is part of a material's program key" and the probe that counts pipelines built per frame are not on the resume. **The probe is the only source of evidence here** — when someone asks how you confirmed it was recompilation, that is what you produce.

## Terms, in one line each

**Shader** — a small program that runs on the GPU and decides the final colour of each pixel. **It must first be compiled into GPU instructions, and that compilation costs time.**

**Render pipeline** — the compiled artefact: a shader plus a whole set of render state. WebGPU compiles it **the first frame a given material × geometry pair is drawn**.

**Program key** — the classification key the renderer computes for a material. **Materials sharing a key share one compiled artefact**; change the key and it must be recompiled.

**Uniform** — something that does not change the shader code, only a value the shader reads: colour, opacity, and so on. **Changing one is nearly free.**

**Object identity** — whether two values are the same object reference in JS. **This is what React uses to decide whether to rebuild, and it is where this bug lives.**

**Hitch / freeze / jank** — a visible stall caused by one frame suddenly taking far longer.

## What this line has to show

It is the only complete **observe → hypothesise → verify → fix** chain in WinterFell, and every link has something to point at. In a three-minute version, lead with this one.

Its value is not how exotic the root cause is, it is **the verification step**: not "I think it was shader compilation", but "**I wrote a probe and counted**".

## The symptom

The freeze landed **exactly on the sector change**, and the last drawn frame was still on the old palette **while the HUD had already moved on**.

**That last clause is the best clue**: the picture stuck on the old colours while the score had updated means **the game logic was running fine and the render side was blocked.**

Being able to narrate that observation shows you reasoned back from symptoms rather than guessing. Always open with it.

## The causal chain

Three layers; drop any one and it does not add up.

**Layer one**: the fog was a JSX tag, `<fog args={[palette.fog, ...]} />`, carrying the palette colour in its args. On a recolour the args changed, **React took that as a new object**, and a new `Fog` was built.

**Layer two**: **fog is part of a material's program key.** Swapping the fog object means **every material in the scene has a new key.**

**Layer three**: the renderer must recompile the shader for each material, **and all of those compilations land inside one frame** — the freeze.

## Layer two is the technical core

The renderer does not compile a shader per object. It groups materials that need **the same** shader, and **the grouping is the program key**.

What matters is **what enters that key**: **whether there is fog** does, **how many lights and of what kind** does, **how many textures** does. **Colour, opacity, position and rotation do not** — changing those only changes a uniform.

**The test is: does it change the shader code itself, or only a value passed into the shader?**

**Fog changes the shader code.** With fog present, the shader needs an extra block at the end that blends colour toward the fog colour by distance, **so fog and no-fog are two different compiled artefacts**. Swap the fog object and the renderer treats it as a different fog configuration, so every material's key changes and every one recompiles.

**The crux, in one line: changing a uniform is cheap; changing the program key means every material recompiles.**

## Verification: count what compiles per frame

The probe's reasoning is in its header: **WebGPU compiles a render pipeline the first time a given material × geometry pair is drawn, and that compilation happens in the frame that needs it.** If the slow frames are the compile frames, the hitch *is* shader compilation.

The method is to **wrap `device.createRenderPipeline`** and record, per frame, how many pipelines were built and how long the frame took. **When the two line up, the hypothesis becomes a conclusion.**

**This step is what the bullet is really worth**: not "I thought it was shader compilation", but "**I counted**". Stress that shift in the interview — **from guess to evidence**.

## The fix

The fog moved from a JSX tag to **an object held in a ref**:

```tsx
const fog = useRef<Fog | null>(null);

useEffect(() => {
    if (!fog.current) fog.current = new Fog(color, 300, 1000);   // ← constructed once, ever
    scene.fog = fog.current;
    return () => {
        if (scene.fog === fog.current) scene.fog = null;          // detach only on unmount
    };
}, [scene, color]);

useEffect(() => {
    fog.current?.color.set(color);                                // ← recolour mutates, never swaps
}, [color]);
```

**Object identity holds, so the program key holds, so nothing recompiles, and the freeze is gone.**

Note the `if (scene.fog === fog.current)` guard on teardown: **detach only if the scene's fog is still this one**, or you would remove a fog someone else has just installed.

## The 30-second answer

> There was a hitch landing exactly on every level recolour. It traced to the fog: it was written as a JSX tag, so recolouring rebuilt the whole Fog object — and fog is part of a material's program key, so swapping it invalidates every material in the scene at once and the renderer recompiled all of them inside a single frame. I wrote a probe that wraps pipeline creation and counts pipelines built per frame, which confirmed the slow frames were the compile frames. The fix was to hold the fog in a ref, construct it once, and only call color.set afterwards.

## The full one-shot answer

> The symptom was a hitch landing exactly on a recolour, with the stuck frame showing the old palette while the HUD had already updated — so the logic was running and the render side was blocked. The root cause was that fog was a JSX tag, so React rebuilt the Fog object on recolour; and fog changes the shader code itself, it is part of a material's program key, so swapping it invalidated every material at once and the renderer recompiled all of them in one frame. I wrote a probe wrapping pipeline creation and counting compiles per frame, which confirmed the slow frames were the compile frames. The fix holds the fog in a ref, constructs it once and only mutates the colour — object identity holds, so the program key holds.

## Self-check

1. Can you open from the clue "the HUD had updated while the frame was still on the old palette"?
2. Can you narrate all three layers of the causal chain?
3. Can you say what enters the program key, what does not, and what the test is?
4. Can you explain why fog changes the shader code itself?
5. Can you describe the probe (what it wraps, what it counts) and what it turned the guess into?
6. Can you explain why the fix works, landing on the words "object identity"?
