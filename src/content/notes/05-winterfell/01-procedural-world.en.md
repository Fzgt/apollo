---
title: "① Twenty scenes and one seed per run"
section: WinterFell
---

# ① Twenty scenes and one seed per run

> **Resume line**
>
> Built a browser racing game: steer a craft through **fields of neon obstacles across twenty scenes**, with the **terrain, skyline and obstacles all generated on the fly from how far you have traveled**, on a **fresh seed each run**.

## What this line has to show

Three things, one sentence each: **twenty scenes** is how the world is arranged, **generated from distance** is where that content comes from, and **a fresh seed per run** is why two runs differ. You cannot hand-build a world at this size, so all of it is a function of z.

## Layer one: answer these without thinking

### 1. What are the "twenty scenes"? Are they the same as levels?

No. They are **two separate progress axes**, both stepping every 1800 world units:

```ts
// levels.ts — colour and speed only, six of them, cycling
export const LEVELS: Level[] = [
  { name: 'Signal',  neon: '#00e5ff', accent: '#ffe066', fog: '#04121a' },
  { name: 'Vapour',  neon: '#ff3ea5', accent: '#67ffe0', fog: '#170618' },
  // Circuit / Ember / Toxic / Nova
];
export const LEVEL_DISTANCE = 1800;
export const levelAt = (distance: number) =>
  Math.floor(Math.abs(distance) / LEVEL_DISTANCE);
```

```ts
// scenes.ts — what stands beside the track, twenty of them, no loop
export const SCENE_DISTANCE = 1800;

/** No loop: everything past the finale stays the finale's afterglow. */
export const sceneAt = (z: number): SceneSpec =>
  SCENES[Math.min(SCENES.length - 1, Math.floor(Math.abs(z) / SCENE_DISTANCE))];
```

- **Level = colour and speed.** Six of them, cycling, getting faster, which is what makes the run endless.
- **Scene = what stands beside the track**: Neon City, Beacon Coast, Abyss Tunnel, Iron Harbor, The Watchers, Aurora Canyon … up to the twentieth, The Terminus.

The difference is in that last line: **scenes do not loop.** `Math.min` pins the index at the last one, so past the finale the world stays in its afterglow instead of wrapping back to Neon City. **Levels cycle so the run can be endless; scenes do not, so arriving at the end means something.**

### 2. What does "generated on the fly from how far you have traveled" actually mean?

It means almost everything in the world is a **function of world z**. There are no level files laid out in advance.

**The scenery** (`Scenery.tsx`) is rebuilt per world tile: crossing a boundary drops the kilometre behind you and builds the next one ahead, in whatever scene owns that stretch. Static pieces merge down to a handful of draw calls. Anything alive — fish, whales, jellyfish, airships, pacing war machines, turbine rotors, lighthouse beams — is a small instanced mesh animated per frame.

**The obstacles** (`generateObstacles.ts`) go further. The old version had four named formations — scatter, gates, slalom, pillars — one per 2000-unit section. The comment says why they were removed:

> *"Every formation is a surprise exactly once."*

So there are no formations now, only **three continuous functions**, sampled every `SLICE_DEPTH` units:

- **the lane**: the guaranteed way through, sweeping no faster than the craft can move sideways at the speed that stretch is flown at
- **pressure**: how much of the field is occupied here
- **the low/tall balance**: whether this stretch is broad low blocks you look over, or narrow tall ones you look past

All three are **smooth noise with different periods**, so they drift in and out of phase and no stretch resembles the one before it. And **none of them knows where a section boundary is, so the seams disappear.**

### 3. What problem does "a fresh seed each run" solve?

**If everything is a function of z, every run is the same route.** That was a real flaw in the earlier version, and the comment is blunt about it:

> *"The blocks moved between runs, because each one is placed with an unseeded roll, but the shape did not: the lane crossed the field at the same z, the knots sat in the same slices, the density peaked in the same places. **A player who dies twice in the same sector is meeting the same sector.**"*

The fix: the whole field hangs off **one integer**, drawn once when the module loads — that is once per run, because restarting reloads the page.

```ts
let routeSeed = (Math.random() * 0xffffffff) | 0;

/** Deterministic 0..1 from two integers, and this run's seed. */
const hash2 = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ Math.imul((b ^ routeSeed) + 0x165667b1, 0x27d4eb2f), 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
```

The seed is folded into **the one hash every noise stream is built from**, so a single place reseeds the lane, the pressure, the low/tall balance, the railing and the events together.

**Why XOR:** XOR is one-to-one, so **seeds that differ still differ** after folding. It cannot accidentally pull the streams into phase with each other.

### 4. Is changing the seed enough?

No, and this is the part worth saying out loud. From the comment:

> *"Two draws from the same distribution look alike from inside the cockpit, because the thing the eye reports is the distribution."*

A new seed only changes **which blocks this run got**. It does not change **what kind of route this is**. A shuffled deck is still the same deck.

So a handful of constants that used to be the route's personality become **this run's personality**, each one roll off the run seed, held for the whole route:

- **the periods**: how long one character lasts, ±40% — one run changes its mind every few hundred units, another commits to a mood for most of a sector
- **the mix**: whether this route is slabs you look over or spires you look past
- **the corridor**: where between the two lane widths this run generally sits
- **the railing**: how much of the route is walled along the lane rather than scattered around it

That split — arrangement versus personality — is the real engineering point of this bullet.

### 5. Does the fairness guarantee still hold once the seed varies?

Yes, and that is exactly why a reseed entry point exists:

```ts
/**
 * The game never calls this — a restart reloads the page and the module picks
 * its own seed on the way up. It exists so the fairness sweep can walk many
 * routes rather than many rolls of the dice on one route.
 */
export const reseedRoute = (seed?: number) => {
  routeSeed = (seed ?? Math.random() * 0xffffffff) | 0;
  laneSamples.length = 1;
  laneDir = 1;
  laneHold = 0;
  spreads.clear();
};
```

The game never calls it. It exists so the fairness sweep can walk **many routes** instead of rolling the dice many times on one route — see [④ Checking the level generator](/docs?section=winterfell&item=level-fairness) for what the sweep concluded.

Note the last four lines: **everything memoised off z has to be cleared with it.** The lane's samples are a walk from the start line and the cached spreads are read off those samples. Skip the reset and you explain the new route with the old route's data.

## Layer two: extra background

### Why not hand-build levels?

Twenty scenes over endless distance means hand-placement cost grows linearly, while a player sees only one slice of it per run. Generating from functions is constant cost, and it guarantees the **seams are continuous** — a hand-built boundary is always a hard cut. The cost is less control, which is exactly why the fairness sweep exists as a regression test.

### Why do the noise streams need different periods?

Streams on the same period peak together, and the world turns into a beat: crowded, empty, crowded, empty. Offset periods drift in and out of phase, so the combined shape does not repeat. It is the standard way to get something that looks unpatterned out of very few parameters.

### What does that `Math.min` cap cost?

Past the twentieth scene the world stops changing. That is deliberate — it "stays in its afterglow" — but it means the back half of a very long run is visually static, with only the level palette still cycling. Adding more change means either more scenes, or letting scenes loop, which throws away the idea of an ending.

## The 30-second answer

> It is a racing game in the browser: you fly a craft through fields of neon obstacles. The world is not hand-built levels, it is a function of distance. Every 1800 units you enter a new scene, twenty in total, and past the twentieth it does not loop — the world stays in the finale's afterglow. Colour and speed are a separate axis, six palettes cycling and getting faster. The obstacle field has no preset formations; three smooth noise streams on different periods decide it: the guaranteed lane through, how dense this stretch is, and whether it is broad low blocks or narrow tall ones. Because all of that is a function of z, the first version gave every run the same route — so I hung the whole field on one seed drawn once per run, XORed into the hash all the noise streams share. A new seed alone only changes which blocks you get, so a few constants became the run's personality too: how long a mood lasts, slabs versus spires, corridor width, how much is walled. Two runs are now different routes, not the same deck shuffled.

## Self-check

1. Can you explain that levels and scenes are two axes, and why one cycles and the other does not?
2. Can you name the three continuous functions that decide the obstacle field?
3. Can you explain why the four named formations were removed (*a surprise exactly once*)?
4. Can you say why the seed is XORed into the hash rather than added?
5. Can you explain arrangement versus personality, and why a new seed alone is not enough?
6. Can you say why `reseedRoute` must clear the lane samples and the cached spreads?
