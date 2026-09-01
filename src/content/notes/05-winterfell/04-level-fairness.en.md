---
title: "④ Sweeping the generator for solvability"
section: WinterFell
---

# ④ Sweeping the generator for solvability

> **Resume line**
>
> **Checked the level generator by machine rather than by playing it**: across **1,020 generated layouts**, every step tested against **how far the craft can move sideways at that stage's speed**, **every layout had a way through**.

"The tightest gap never fell below 15 units" and the random-scatter control are not on the resume, but you need both: 15 is the verdict, and the control is the answer to "does this sweep discriminate at all".

## Terms, in one line each

**Solvability / winnable** — whether a layout contains any route that does not kill you.

**Playtesting** — actually running the game and playing it. **The entire point of this line is not doing that.**

**Forward sweep** — stepping along the track, each step depending only on the previous one.

**Reachable set (`reach` in the code)** — every lateral position the player **could be in right now without having hit anything on the way**. It is a **set of intervals**, because obstacles cut it apart.

**Collision radius** — an object's hit extent, usually larger than it looks.

**Lateral reach** — how far sideways the craft can move per unit travelled forward.

**Control / random baseline** — scatter blocks of the same count and size **completely at random** and see what score that gets. **Without it, your metric measures the difficulty of the problem, not the quality of the solution.**

**Minkowski sum** — the standard way to reduce "can this object with volume fit through" to "can this point fit through": add the object's radius to the obstacles.

## What this line has to show

The core is a **shift in framing**: **whether a run is winnable is a geometric property of the layout, not an outcome of running the game.** So do not run the game — compute the geometry.

And it does not sample a few paths. It computes **every position that survives** — which upgrades it from a test toward a proof.

## The problem

Obstacles are procedurally generated, so each run places blocks from noise and a seed. That creates a fatal problem: **you cannot guarantee the generated level is passable.** One draw might place a wall clean across the track, and the player dies with no recourse. **That is not difficulty, that is a bug.**

Manual playtesting cannot cover it: every run is a new random layout, a hundred attempts cover a hundred samples, and you do not know whether you hit a bad one.

**Automated playtesting in a headless browser was ruled out explicitly.** The reason is in the script's header: a headless environment has no real GPU, WebGL degrades to **software rasterisation**, and a frame takes seconds; the game advances the player by **delta time**, so **a multi-second frame teleports the player through the entire obstacle field in one step.** Playtested results there mean nothing.

That leaves one path: analyse the geometry directly. The header sentence is worth memorising: **whether a run is winnable is a property of the layout, not of the renderer — so measure the layout, don't playtest it.**

## The core algorithm: an interval-set forward sweep

**This is the most valuable part of the line.**

Picture it first: the track is 120 wide (±60), a section is 2000 long. Seen from above, the player flies upward.

The sweep takes **one step every 10 units** and maintains the reachable set through three operations:

```js
let reach = [[-FIELD_WIDTH / 2, FIELD_WIDTH / 2]];      // start: the whole track is reachable

for (let z = startZ; z > endZ && !deadAt; z -= STEP) {
    // ① grow: widen every interval by how far the craft can move sideways in 10 units
    const grow = STEP * reachAt(section);
    reach = reach.map(([a, b]) => [a - grow, b + grow]);

    // ② subtract: remove each obstacle's collision radius; one interval may split in two
    for (const p of near) {
        const lo = p.x - p.r, hi = p.x + p.r;
        // ... intervals clear of [lo, hi] survive intact; ones spanning it are cut open
    }

    // ③ merge: growing makes neighbours overlap; without merging the list grows exponentially
    reach = reach.filter(([a, b]) => b - a > 0).sort(...).reduce(mergeOverlaps, []);

    const widest = reach.reduce((m, [a, b]) => Math.max(m, b - a), 0);
    if (widest < tightest) tightest = widest;

    if (!reach.length) deadAt = z;                       // empty reach set = unsolvable layout
}
```

**Step three is not an optimisation, it is required** — the comment says so: every step grows every interval, so neighbours necessarily overlap, and splitting them around obstacles without re-merging lets the list **grow exponentially**.

Walk one example. Start with a single interval from −60 to +60, width 120. Advance 10 units, widen each interval by the lateral reach at this speed, then subtract the collision radii in that slice — an obstacle of radius 11.5 dead centre cuts the reach set into two intervals of 48.5 each. Advance again, another obstacle on the left, and the left interval splits again.

**What makes this elegant: one sweep answers whether a route exists, and it answers for every route, not a handful of samples.**

**The interval count carries extra meaning**: two intervals mean an obstacle between them that has to be gone round on a side the player picks. So the count measures **how many ways through** there are. The comment puts it well: **a field that is fair, dense and has one interval everywhere is a queue, not a route.**

## Lateral reach: a trap that was fixed twice

The sweep's key input is **how far sideways the craft moves per unit forward**, which is **lateral speed ÷ forward speed**: the faster you go, the less you can move per metre travelled.

The numbers: at starting speed the craft moves about **0.049** sideways per unit forward; by level six only about **0.024**, half as much. So **the same layout can be fair at the start and impossible later.**

The comments record two real fixes. **Both are good interview material.**

**First**, the reach was originally hard-coded to the starting speed. The comment's own words: it **quietly validated the late game against reach the craft does not have.**

**Second**, the lateral speed constant was a **copy**, still at 44, while the game itself had been tuned to 64. Quote that comment directly: **a copy of a constant is a constant that goes stale.** The validator was validating levels against a craft that does not exist — **and it was green the whole time.**

The second one is especially worth telling: **that is far more dangerous than a failing test, because failure alarms and silent staleness does not.** The fix was importing from the constants file instead.

## Why the random-scatter control is needed

The control scatters blocks of the same count and size **completely at random** over the same stretch.

Why it is needed: some column of the track always gets lucky and happens to be clear. With 80 blocks over a 120-wide track, a given column is covered about seven times in 2000 units — and the largest gap among 120 such columns **covers most of a section by probability alone.**

So "there is a way through" is not, by itself, an achievement. The comment sums it up: **the control is what this density can do; the gap between the two is what the layout adds.**

This is **general experimental thinking**: any claim of "my algorithm achieves X" has to be answered with what a random baseline achieves. **A metric without a control measures the difficulty of the problem, not the quality of the solution.**

## Where 1,020 comes from

Simple: **sections × trials per section**. The script's defaults are 12 × 40 = 480. So 1,020 was a parameterised run — **12 × 85** is the likely combination, since the section count is the default.

Record the parameters you ran with. **This is the one input you fully control**, and not being able to state it looks bad.

Each trial is an **independent reseed**, the seed being `section × prime + trial index`. The comment explains why the whole route must be reseeded rather than re-rolled: **sampling many times on one seed only tests one route many times, and says nothing about the route the player actually gets.**

That also answers "how do you reproduce a failing random layout": **the seed is deterministic**, so with the same parameters the sweep is fully reproducible — section 3, trial 17 is always the same layout.

## How the conclusion is phrased

The script reports that **every sampled layout** had a continuous route through.

Note "**sampled**", not "every possible". The resume drops that word — strictly, that is a generalisation from 1,020 samples to all of them.

Pressed on "can you guarantee every random layout is passable", the right answer is: **no — this is sampled validation, not a formal guarantee.** 1,020 layouts all had a continuous route, covering 12 sections at 85 independent reseeds each. A real guarantee would require formal constraints on the generator — **what we built is a regression check that can run repeatedly in CI.**

**Conceding that it is sampling is far stronger than glossing over it.**

## "Gap" is not the spacing between obstacles

**This is easy to misread, so kill it first.** It is not the distance between two obstacles; it is a quantity the interval sweep computes.

After each step, **take the widest of the surviving reachable intervals**; over the whole section, **take the minimum of those widest values.**

So its precise meaning: **across the whole track, how wide is the widest safe band the player can stand in, at its narrowest moment.**

## Why max first, then min

**This is the step that confuses people.** An example settles it.

Say a step leaves three intervals, of width 8.5, 17 and 48.5. That step scores **the widest, 48.5**, not the narrowest 8.5.

Why? **Because the player only needs one route to work.** Whether the 8.5 sliver exists is irrelevant — they can be inside the 48.5 one.

Then take the **minimum** over the section: across 2000 units the widest corridor is usually forty or fifty units, comfortable, but somewhere it pinches to 15 — **that pinch is the difficulty ceiling of the section**, because the player has to be precise exactly there.

In one line: **it measures how hard the hardest moment of the route is.**

## What the unit is

**Game world coordinate units** — not pixels, not metres. Some same-scale references: track width **120**, section length **2000**, a 2.5-wide block's collision radius about **11.5**, the generator's guaranteed corridor half-width between **11 and 18** with a floor of 7, lateral speed **64**, forward sample step **10**, fog visibility about **600**.

Put 15 on that scale: it is slightly more than one big block's collision radius of 11.5. So **15 units is roughly a big-block-and-a-bit of room — tight, but passable.** Which is exactly what the difficulty design wants: at its tightest, there is still a way.

## 15 is not a threshold we set, it is a measured result

**This is the easiest thing to get wrong.**

**Nowhere in the code** does it say the tightest gap must be ≥ 15. There is no such constant and no such assertion. `tightest` starts at infinity and is pushed down by whatever the sweep actually finds.

The causality runs the other way: **we did not set a floor of 15 that the generator met; we swept 1,020 layouts and measured the tightest point at 15.**

Asked "why did you pick 15 as the threshold", **correct the premise directly**: 15 is not a threshold we set, it is the worst case the sweep measured; what the generator constrains is the corridor half-width and similar parameters (11–18), and 15 is the measured tightest point of the layouts those parameters produce.

That correction matters — it moves the line from the weak "we set a standard" to the strong "**we measured the actual water line**", and it heads off the unanswerable "so why not 20".

## What the generator actually constrains

Although 15 is not a threshold, the generator does guarantee passage. The rule: **a block's centre must be at least the corridor half-width plus that block's own collision radius from the corridor centre.**

A good technical point hides in the comment: a 2.5-wide block has a collision radius of 11.5, so placing it just outside a nominally 15-wide corridor still lets **its collision volume reach into the corridor and nearly cross it.** The minimum distance cannot be the half-width alone; it must add the block's own radius.

The comment's last line is the crux: **a corridor has to be as wide to fly as it looks.**

This is a classic **collision-geometry bug**: lay out by object centres, and collision volumes eat most of the passage — the player sees a route and only discovers on impact that it is not one.

## Volunteer the craft-radius simplification

The sweep subtracts the **obstacles'** radii and **treats the craft as a point.** That simplification is worth conceding before you are asked.

Phrase it: in the sweep the craft is a point and only obstacle radii are subtracted; strictly you should add the craft's radius too — geometrically that is a **Minkowski sum** — and doing so would measure a tightest gap slightly below 15, **so 15 is an optimistic number.** In practice the generator's spacing rule already reserves both radii between block and corridor, and no run has been unable to fit through.

**Naming your measurement's bias, and which way it leans, is the most convincing way to present a number like this.**

## The four questions this number must survive

**Unit**: game world coordinates, referenced against track width 120, big-block radius 11.5, corridor half-width 11–18, fog ~600. **How the threshold was chosen**: it is not a threshold, it is a measured worst case; no such constant or assertion exists. **Relation to craft collision radius**: the craft is a point in the sweep, only obstacle radii subtracted, so 15 is optimistic. **How it was measured**: interval-set forward sweep, widest reachable interval per step, minimum over the section. **Reproducible**: start the dev server and run `bench/fairness.mjs`; the column is in the report table.

## The 30-second answer

> Obstacles are procedurally generated, so every run has a different layout, and randomness can place a wall clean across the track — the player dies with no recourse, and that is not difficulty, that is a bug. Manual playtesting cannot cover it, and automated playtesting in a headless browser does not work either, because WebGL degrades to software rendering there and a frame takes seconds, so the player teleports through the whole obstacle field in one frame. The key realisation is that whether a run is winnable is a property of the layout, not of the renderer, so I compute the geometry directly. The sweep steps every ten units and maintains a set of reachable intervals: grow each interval by how far the craft can move sideways at that stage's speed, subtract the collision radii of the obstacles in that slice, merge the overlaps; if the reachable set goes empty, the layout is unsolvable. One sweep answers for every route, not a sampled few. Across 1,020 layouts every one had a continuous route, with the tightest point at 15 units — and 15 is a measured result, not a threshold we set. I also ran a random-scatter control, because "there is a way through" can be a probabilistic certainty; the gap between the two is what the layout contributes.

## Self-check

1. Can you state the shift in framing, and explain why headless playtesting is invalid?
2. Can you name the three sweep operations (grow / subtract / merge) and say why merging cannot be skipped?
3. Can you give the lateral-reach formula and both stale-constant lessons?
4. Can you explain why the control exists?
5. Can you derive 1,020, and say why each trial reseeds the whole route?
6. Can you explain that gap is max-then-min, and what it measures?
7. Can you correct the premise that 15 is a threshold, and volunteer the point-craft simplification?
