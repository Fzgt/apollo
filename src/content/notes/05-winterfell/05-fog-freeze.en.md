---
title: "⑤ A freeze traced down to the frame"
section: WinterFell
---

# ⑤ A freeze traced down to the frame

> **Resume line**
>
> **Traced a freeze on every color change to the fog**: **rebuilding it as a new object made every material in the scene recompile its shader in one frame**. **Reusing one fog object and setting its color removed it**.

Neither "fog is part of a material's program key" nor the probe that counts pipelines built per frame is on the resume. The probe is this line's only source of evidence, so when someone asks how you confirmed it was recompilation, that is what you produce.

## What this line has to show

Of the WinterFell lines this is the only complete observe, hypothesise, verify, fix chain, and every link has something concrete to point at. If you get three minutes, lead with this one.

Its most valuable part is not how exotic the root cause was. It is the verification step: not "I think it was shader compilation" but "I wrote a probe and counted".

## The symptom

The freeze landed exactly on a sector change, with the last drawn frame stuck on the previous palette while the HUD had already moved on.

That last clause is the best clue: the picture is frozen on the old palette while the score in the interface has already updated — so the game logic is running fine and what is blocked is the render side.

Being able to state that observation shows you reasoned backwards from the symptom rather than guessing. Start here when you tell it.

## The root cause chain

Three layers, and skipping any one of them makes the story incoherent.

First, the fog was written as a JSX tag with the palette colour in its arguments. On a palette change the arguments changed, React decided a new object was needed, and it rebuilt the fog.

Second, fog is part of a material's program key. Replacing the fog object means every material in the scene has a different program key.

Third, the renderer has to recompile the shader for every material, and the whole scene's compilation lands in one frame. That is the freeze.

## The second layer is the technical core

First, what a shader is: a small program that actually runs on the GPU and decides the final colour of each pixel. It has to be compiled into instructions the GPU can execute, and that compilation costs something.

Then the program key: the renderer does not compile a separate shader for every object. It groups materials that need the same shader, and the basis for that grouping is the program key.

The important question is what goes into that key. Whether there is fog goes in. The number and types of lights go in. How many textures are used goes in. A material's colour, opacity, position and rotation do not — changing those only changes a value handed to the shader.

The test is: does it change the shader code itself, or only a parameter passed to the shader?

Fog changes the shader code. With fog present, the shader gains a block at the end that blends the colour toward the fog colour by distance, so "fog" and "no fog" need two different compiled outputs. And replacing the fog object makes the renderer treat it as a different fog configuration, so every material's key changes and every one of them must recompile.

One sentence: changing a uniform is cheap, changing the program key means a recompile.

## Verification: count what compiled per frame

The probe's reasoning is in its file header: WebGPU compiles a render pipeline the first time a material and geometry combination is drawn, and that compile happens on the frame that needs it — so if the slow frames are the frames that compiled, the hitch is shader compilation.

The method is to wrap the device's pipeline creation call and record, per frame, how many pipelines were compiled and how long that frame took. When the two curves line up, a hypothesis becomes a conclusion.

This step is where the line earns its value: not "I think it was shader compilation" but "I counted". Emphasise that shift in the interview — from guess to evidence. That sentence is the line's whole value proposition.

## The fix

The fog moved from a JSX tag to an object held in a ref: constructed once, and thereafter every palette change only calls its colour setter. On unmount, the scene's fog is cleared if it is still that object.

The object's identity stays stable, so the program key stays stable, so nothing recompiles, so the freeze is gone.

## The 30-second answer

> There was a hitch that landed exactly on the level's colour change every time. Tracking it down, it was the fog: at the time it was written as a JSX tag, so a colour change rebuilt the whole fog object — and fog is part of a material's program key, so replacing it invalidated every material in the scene at once and the renderer recompiled all of them within a single frame. I wrote a probe counting how many render pipelines were compiled per frame and confirmed the slow frames were the compile frames. The fix was lifting the fog into a ref, constructing it once, and only setting its colour after that.

## The full answer

> The symptom was a hitch landing exactly on the colour change, with the frozen frame still on the old palette while the HUD had already updated — so the logic was running and the render side was blocked. The root cause was that the fog was written as a JSX tag, so a colour change made React rebuild the fog object. Fog changes the shader code itself and is part of a material's program key, so replacing it invalidated every material in the scene and the renderer recompiled all of them in one frame. I wrote a probe wrapping pipeline creation and counting compilations per frame, and confirmed the slow frames were the compile frames. The fix was lifting the fog into a ref, constructing it once and only setting its colour afterwards — the object identity stays stable, so the program key stays stable.

## Self-check

1. Can you open with the clue that the HUD had updated while the frame was stuck on the old palette?
2. Can you walk all three layers of the root cause chain?
3. Can you say what goes into the program key, what does not, and what the test is?
4. Can you explain why fog changes the shader code itself?
5. Can you describe what the probe did, and what it turned the guess into?
6. Can you explain why the fix works, in terms of object identity?
