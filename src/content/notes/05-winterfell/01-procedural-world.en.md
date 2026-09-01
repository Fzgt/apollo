---
title: "① Twenty scenes and one seed per run"
section: WinterFell
---

# ① Twenty scenes and one seed per run

> **Resume line**
>
> Built a browser racing game: steer a craft through **fields of neon obstacles across twenty scenes**, with the **terrain, skyline and obstacles all generated on the fly from how far you have traveled**, on a **fresh seed each run**.

## Terms, in one line each

**Procedural generation** — the world is not hand-placed by an artist and saved as a level file; it is computed by a function. Input: how far you have driven. Output: what is here.

**Pseudo-random** — a computer has no real randomness. "Random" numbers come out of a fixed formula, and the same starting point always produces the same sequence.

**Seed** — that starting point: the first integer fed to the formula. **Same seed, identical run; different seed, a different world.** A seed is not "randomness", it is **this run's ID number**. The earlier version used unseeded `Math.random()`, so no run could ever be reproduced — and, as below, the shape of the route was fixed anyway.

**Hash function** — mixes a few integers into one that looks patternless but is fully determined. Same input, same output, always. World generation depends on this: **asking "what is at 3000 metres" has to give the same answer every time, or the world changes when you look back.**

**Noise** — a smooth undulating curve, like a terrain cross-section. Not per-point white noise: neighbouring points are close, which is what makes it usable for natural-looking terrain and density.

**Period** — how often that curve rises and falls. Short period, the route changes mood quickly; long period, one character persists.

## What this line has to show

Three things, one sentence each. **Twenty scenes** is how the world is arranged. **Generation from distance travelled** is where that content comes from. **A fresh seed each run** is why two runs differ. Hand-placing content cannot reach this scale, so everything is a function of distance.

## Scenes and levels are not the same axis

These are two independent progress axes. Both advance every eighteen hundred world units, and they mean entirely different things.

**A level controls only the palette and the speed.** There are six, they cycle, and the speed keeps rising, which is what makes a run endless. **A scene controls what stands beside the track** — Neon City, Beacon Coast, Abyss Tunnel, Iron Harbor, The Watchers, Aurora Canyon, through to the twentieth, The Terminus.

The crucial difference is that **scenes do not cycle**. The index is clamped to the last one:

```ts
const sceneIndex = Math.min(Math.floor(distance / SECTOR_DEPTH), SCENES.length - 1);
```

Past the final scene the world stays in its afterglow rather than looping back to the first. **Levels cycle so the run can be endless; scenes do not, so that arriving at the end means something.** That is the design intent behind both axes, and the answer to "why does one loop and the other not".

## What "generated from how far you have travelled" means

It means almost everything in the world is a function of distance, and there are **no authored level files**.

The scenery is rebuilt in **world tiles**: crossing a boundary discards the tile behind and builds the next one ahead according to whichever scene that stretch belongs to. The static parts collapse into a handful of **draw calls** (one CPU-to-GPU "draw this" command), and the living things — fish, whales, jellyfish, airships, pacing war machines, turbine rotors, lighthouse beams — are small **instanced meshes** animated per frame.

Obstacle generation goes further. It used to be four named **formations** — scatter, gates, slalom, pillars — swapping every two thousand units. The reason they were scrapped is in a code comment, in one line: **every formation is a surprise exactly once.**

Now there are no formations, only **three continuous functions** sampled at a fixed depth interval:

1. **The lane (corridor)** — the route guaranteed to be passable, whose sway never exceeds how far the craft can move sideways at that speed.
2. **The pressure** — how dense that stretch is.
3. **The mix** — whether the stretch is wide low **slabs** you can see over, or narrow tall **spires** you have to go around.

All three are smooth noise at **different periods**, so they drift in and out of **phase** and no stretch resembles the one before it. And none of the three knows where the section boundaries are, which is why the **seams** disappear. That is the part worth saying: **the seams were not patched out, they never formed, because no function knows a boundary exists.**

## What "a fresh seed each run" solves

Being a function of distance means every run is the same route. **That was a real defect in the earlier version**, and the comment states it plainly: the blocks did move between runs, because each one is placed with an unseeded roll, **but the shape did not** — the lane crossed the field at the same distance, the knots sat in the same slices, the density peaked in the same places. A player who dies twice in the same sector is meeting the same sector.

The fix is to hang the entire field on **a single integer**, drawn once when the module loads — once per run, since restarting reloads the page. That seed is folded into the hash function every noise stream shares, so **one place reseeds the lane, the pressure, the mix, the railings and the events at once**:

```ts
let routeSeed = (Math.random() * 0xffffffff) | 0;   // once per run, at module load

const hash2 = (a: number, b: number) => {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
    //                    ↓ the seed enters here — one line, every stream
    h = Math.imul(h ^ Math.imul((b ^ routeSeed) + 0x165667b1, 0x27d4eb2f), 0xc2b2ae35);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;   // fixed 0..1: same input, same output, forever
};
```

Two things to point at. First, **`hash2` is a pure function** — the same `(a, b)` always returns the same number, which is why the world does not deform when you look back at it. Second, **the seed participates in exactly one line** (`b ^ routeSeed`), and every noise stream draws from `hash2`, so changing one place changes the whole run.

Why fold it in with **XOR** rather than addition: **XOR is a bijection**, so different seeds stay different after folding and several streams cannot accidentally be pulled into the same phase. With addition, "seed A's third stream" can land on exactly "seed B's fifth stream" and the two collide. That question comes up occasionally, and answering it shows you knew what you were doing.

## Is a new seed enough

**No, and this is the layer worth telling.** The comment puts it precisely: two draws from the same distribution look alike from inside the cockpit, because the thing the eye reports is the distribution.

**A new seed only changes which blocks you get** — the **arrangement**. It does not change **what kind of route this is** — the **personality**. **A shuffled deck is still the same deck.**

So a handful of constants become the run's personality, each rolled once from the run seed and held for the whole route:

```ts
const runRoll = (k: number) => hash2(k, 0x5eed);       // seed only — no distance argument

const periodScale = () => 0.6 + 0.85 * runRoll(1);     // how fast this run changes its mind
const mixBias    = () => runBias(2, 0.22);             // slabs or spires
```

Note that `runRoll` takes no distance — **it has one value for the entire run**, which is why it reads as a property of the place rather than as more noise. The four: **the periods** decide how long one style persists (±40 per cent — some runs change their mind every few hundred units, others hold a mood for most of a sector); **the mix** decides slabs or spires; **the corridor** decides whether this run's lane runs generally wide or narrow; **the railing fraction** decides how much of the field walls along the lane rather than scattering around it.

**The distinction between personality and arrangement is the actual technical point of this line.** When someone asks "why is a new random seed not enough", that is the answer.

## Does the fairness guarantee still hold with a seed

Yes, and that is precisely why a `reseedRoute(seed?)` entry point exists.

**The game never calls it** — restarting reloads the page and the module draws its own seed on the way up. It exists so the fairness sweep can walk **many routes** rather than many rolls of the dice on one route. The conclusion from that sweep is in the level solvability note.

Note what it has to clear: everything **memoised** by distance (cached so it is not recomputed) has to be reset with it. The lane samples were walked out from the start line, and the cached spreads are read from those samples, so **leaving them in place explains a new route with the old route's data**. Being able to state that detail shows you actually wrote the function.

## Background

**Why not author levels by hand.** Twenty scenes plus endless distance means hand-placement costs grow linearly, while a player only ever sees one stretch per run. Generation costs a constant, and it guarantees continuity at the seams — hand-authored boundaries are always hard cuts. The cost is less control, which is exactly why the fairness sweep exists as a **regression check**.

**Why the noise streams use different periods.** Streams sharing a period peak together, and the world turns into a rhythm of very dense and very empty. Offset periods drift in and out of phase, so the combined shape does not repeat — this is the standard way to get "no discernible pattern" out of very few parameters.

**What clamping the scene index costs.** Past the twentieth scene the world stops changing. That is deliberate, but it means the back half of a long run is visually static, with only the level palette still cycling. To keep introducing variety you would either add scenes or let scenes cycle — and cycling gives up the idea of an ending.

## The 30-second answer

> It is a racing game in the browser: you fly a craft through fields of neon obstacles. The world is not hand-authored levels, it is a function of distance — a new scene every eighteen hundred units, twenty of them, and past the twentieth it does not loop; the world stays in the finale's afterglow. The palette and speed are a separate axis: six of them, cycling, getting faster. The obstacle field has no preset formations; it is decided by three smooth-noise functions at different periods — the lane that is guaranteed passable, how dense the stretch is, and whether it is wide low slabs or narrow tall towers. Because everything was a function of distance, the first version handed every player the same route, so I hung the whole field on a seed drawn once per run and folded it with XOR into the hash all the noise streams share. A new seed alone only changes the arrangement of blocks, so a few more constants become the run's personality — period length, the slab-versus-tower mix, corridor width, how much of it walls along the lane — so two runs are different routes rather than one deck shuffled twice.

## Self-check

1. Asked "what is a seed", can you answer in two sentences, including "same seed, identical run"?
2. Can you explain that levels and scenes are two axes, and why one cycles and the other does not?
3. Can you name the three continuous functions that decide the obstacle field?
4. Can you explain why the four named formations were scrapped?
5. Can you say why the seed is folded in with XOR rather than addition?
6. Can you explain the difference between arrangement and personality, and why a new seed alone is not enough?
7. Can you say why reseeding must clear the lane samples and the cached spreads?
