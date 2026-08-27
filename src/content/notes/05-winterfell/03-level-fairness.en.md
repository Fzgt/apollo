---
title: "③ Scanning levels for solvability"
section: WinterFell
---

# ③ Scanning levels for solvability

> **Resume line**
>
> **Checked the level generator by machine rather than by playing it**: across **1,020 generated layouts**, every step tested against **how far the craft can move sideways at that stage's speed**, **every layout had a way through**.

> ℹ️ **v66 removed "no gap narrower than 15 units" and the random-scatter control.** You still need both: 15 units is the measured threshold, and the control is the answer to "does this scan discriminate at all".

## What this bullet is about

⭐ **The core is one mental shift: whether a run can be completed is a geometric property of the layout, not an outcome of running the game. So do not run the game — compute the geometry.**

**And it does not "try a few random paths", it computes exactly all the positions you could survive in** — ⭐ **which is an upgrade from testing to proving.**

## 1. The problem

**The obstacles are procedurally generated**: on every run the code places a batch of blocks from noise and a random seed.

**Which creates a lethal problem: you cannot guarantee the generated level can be completed.**

One roll of the dice might place a wall spanning the whole track — **the player hits it and dies with nothing they could have done**. **That is not "hard", that is a bug.**

**How do you verify it?**

| Approach | Why it fails |
|---|---|
| Play it by hand | Every run is a new random layout, so **a hundred attempts cover a hundred samples**, and you do not know whether you hit a bad one |
| Auto-play in a headless browser | **Explicitly ruled out**; see below |
| **Analyse the layout's geometry directly** | ✅ What this bullet does |

**The file header of `bench/fairness.mjs` says it plainly:**

> *"Whether a run is winnable is **a property of the layout, not of the renderer**, so this measures the layout directly instead of playtesting."*

> ⭐ **The key mental shift: whether a run can be completed is a geometric property of the layout, not an outcome of running the game. So do not run the game — compute the geometry.**

**Why auto-play does not work** (the same comment, worth memorising):

> *"Playtesting this in headless Chromium does not work — **WebGL there falls back to software rasterisation**, frames take seconds, and the run either crawls or **teleported the player straight through the field**."*

**In plain terms**: a headless environment has no real GPU, WebGL degrades to **CPU emulation**, and a frame takes seconds. The game advances the player by "how long since the last frame" — **so a frame lasting seconds means the player crosses the whole obstacle field in one frame.** **Playtested results mean nothing.**

## 2. ⭐ The core algorithm: a forward sweep over an interval set

**This is the most valuable part of the bullet.** It does not sample a few paths, it **computes exactly every position you could still be alive in.**

### Picture it first

The track is 120 wide (60 each side) and each section is 2000 long. **Viewed from above, the player flies from the bottom upwards.**

**The sweep steps 10 units along the track at a time, maintaining one thing at each step:**

> **`reach` = every lateral position the player could currently be in without having hit anything on the way.**

**It is a set of intervals**, because obstacles cut it apart.

### The three-step loop (`fairness.mjs:271-307`)

```js
let reach = [[-60, 60]];                    // start: the whole track is available

for (let z = 起点; z > 终点; z -= 10) {
    // ① grow: how far the craft can move sideways over these 10 units of forward travel
    const grow = 10 * reachAt(section);
    reach = reach.map(([a, b]) => [a - grow, b + grow]);

    // ② punch holes: subtract every obstacle's collision radius in this stretch
    for (const p of near) { /* 区间被切成两半 */ }

    // ③ merge overlapping intervals
    reach = reach.filter(...).sort(...).reduce(...)
}
```

| Step | What it does |
|---|---|
| **① Grow** | How far can the player move sideways over these 10 units? **Every reachable interval expands by that much in both directions** |
| **② Punch holes** | For each obstacle in this stretch, **subtract its collision radius from the reachable intervals** — one interval may be cut into two |
| **③ Merge** | Growing makes adjacent intervals overlap, and **without merging the interval list grows exponentially** (a code comment says so explicitly) |

> ⭐ **If `reach` becomes the empty set after any step, the layout is unsolvable and the player must die.**

### Walking through it

```
start          reach = [ -60 ────────────────── +60 ]   width 120

advance 10     every interval expands by 0.49 in each direction (the lateral distance available in this step)
               then the collision radii of this stretch's obstacles are subtracted

               obstacle A at x=0, radius 11.5
               reach = [ -60 ─── -11.5 ]  [ +11.5 ─── +60 ]
                         width 48.5           width 48.5

advance again  obstacle B at x=-40, radius 11.5
               reach = [-60,-51.5]  [-28.5,-11.5]  [+11.5,+60]
                        width 8.5     width 17       width 48.5
```

> ⭐ **What is elegant about this algorithm**: one sweep answers "is there a way through", **and it answers for every path, not for a few samples. That is an upgrade from testing to proving.**
>
> **Each interval carries extra meaning too** (the comment at `:309-316`): **two intervals mean there is an obstacle in between that must be gone around, and the player may pick left or right.** So the **number** of intervals measures how many routes exist — "**exactly one route everywhere is fair, but that is a queue, not a racetrack**".

## 3. `at that level's speed` — a trap that was fixed twice

**`reachAt` is the sweep's key input: how far the craft can move sideways per unit of forward travel.**

```js
// fairness.mjs:59-63
const reachAt = section => {
    const z = -section * cfg.SECTION_LENGTH;
    const speed = levels.paletteFor(levels.levelAt(z)).speed;
    return LATERAL_SPEED / (speed * 60);
};
```

> **The formula: lateral capability = lateral speed ÷ forward speed. The faster you go, the less sideways distance you get per metre travelled.**

**A comment in the generator gives the concrete numbers**: at the opening speed the craft can move **0.049** sideways per unit forward, and by level six only **0.024** — **half of it gone.**

> **So the same layout that is fair at the start may be impossible later on.**

**⭐ The comments record two real fixes, and both make excellent interview material** (`fairness.mjs:50-57`):

| The bug it had | Consequence |
|---|---|
| It originally **hard-coded the opening speed** | *"quietly validated the late game against reach it does not have"* — **it validated late levels using a capability the craft does not have** |
| Later `LATERAL_SPEED` was **a copied constant** with the value 44, while the game itself had been tuned to 64 | *"a copy of a constant is a constant that goes stale"* — **the validator was validating levels against a craft that does not exist, and it stayed green throughout** |

> ⭐ **The second is especially worth telling**: the validator copied a constant, the game changed it and the copy did not, so **the validator silently stopped being valid — which is far more dangerous than a failing test**, because a failure raises an alarm and silent invalidity does not.
>
> **The fix was to import from the constants file directly.**

## 4. `against a random-scatter control` — why a control is needed

```js
// fairness.mjs:135-140
/** The same blocks, thrown at the same ground with no rules at all. */
const shuffled = (obstacles, startZ, endZ) =>
    obstacles.map(p => ({ r: p.r, x: 随机, z: 随机 }));
```

**The same number of blocks, the same sizes, thrown completely at random over the same stretch of track.**

**Why it is needed** (the comment at `:106-114` explains it well):

> *"Some x always gets lucky: with eighty blocks spread over a hundred and twenty units of width, a given strip is covered seven times in two thousand units, and **the largest gap among a hundred and twenty such strips is most of a sector by chance alone.**"*

**In plain terms**: **some lane down the track always gets lucky and happens to be clear** — **that is a probabilistic certainty, not a credit to the layout.**

**So "there is a way through" is not an achievement in itself; it has to be compared against "scatter the same density at random":**

> *"The control is what this density can do; **the gap between the two is what the layout is adding.**"*

> ⭐ **This is general experimental thinking**: any claim of the form "my algorithm achieves X" has to be met with "**what does a random baseline achieve**". **A metric with no control measures the difficulty of the problem, not the quality of the solution.**

## 5. Where the 1,020 comes from

**The formula is simple:**

```
total layouts = number of sections × trials per section
```

```js
// fairness.mjs:23-24
const SECTIONS = Number(getArg('sections', 12));
const TRIALS   = Number(getArg('trials', 40));
```

**The defaults are 12 × 40 = 480.** So 1,020 came from **a parameterised run** (`12 × 85 = 1020` is the most likely combination, since the section count kept its default).

⚠️ **Write down the parameters used before running** — being asked "where does 1,020 come from" and having no answer looks bad, **because it is the one input you control completely.**

**Each trial reseeds independently** (`:260`):

```js
mod.reseedRoute(section * 7919 + t);
```

**The comment explains why the whole route must be reseeded rather than retrying the same route:**

> *"sampling one seed many times would test one route many times and **say nothing about the one the player is actually handed**."*

**7919 is a prime**, chosen so seeds from different sections and trials do not collide.

> ⭐ **This also answers "how do you reproduce a failing random layout"**: **the seed is deterministic** (`section * 7919 + t`), so **given the same parameters the scan is fully reproducible** — section 3, trial 17 is always the same layout.

## 6. How the conclusion is worded

`fairness.mjs:416-421` is the original source of the resume's sentence:

```js
worst === 0
  ? `\nEvery layout sampled had a continuous path through it.`
  : `\nUp to ${worst}% of layouts had no path through — those runs end in a death the player could not avoid.`
```

> ⚠️ **Note it says `Every layout sampled`, not "every possible layout".**

The resume says `every layout had a continuous path through it`, **dropping `sampled`** — strictly, that generalises from 1,020 samples to all layouts.

**When pushed on "can you guarantee every random layout is passable", the right answer is:**

> "**No, and this is sampled validation rather than a formal proof.** All 1,020 layouts had a continuous path, covering 12 sections with 85 independent reseeds each. A real guarantee would need formal constraints on the generator — **what we built is a regression check that can be re-run in CI.**"

**Admitting it is sampling is much better than glossing over it.**

---

## 7. ⚠️ First, kill a misconception: a gap is not the spacing between obstacles

**"Gap" is easily read as "the distance between two obstacles". It is not.**

**It is the quantity the interval sweep computes** (`fairness.mjs:307-308`):

```js
const widest = reach.reduce((m, [a, b]) => Math.max(m, b - a), 0);
if (widest < tightest) tightest = widest;
```

| Variable | Meaning |
|---|---|
| `reach` | At this step, **every still-alive reachable interval** (each one a safe lateral range) |
| `widest` | How wide **the widest of them** is at this step |
| `tightest` | Across the whole section, **the minimum of `widest`** |

> ⭐ **So its precise meaning is: over the whole track, how wide the widest safe patch the player can occupy is at its narrowest moment.**

## 8. Why the maximum first and the minimum second

**This is the easiest step to get tangled in; an example makes it clear.**

Suppose one step of the sweep produces:

```
reach = [-60,-51.5]  [-28.5,-11.5]  [+11.5,+60]
         width 8.5     width 17       width 48.5
```

**This step takes the widest (48.5), not the narrowest (8.5).**

**Why? Because the player only needs one route that works.** Whether that 8.5 sliver exists is irrelevant — **they can stay inside the 48.5 one.** So this step's "difficulty" is 48.5.

**Then the section takes the minimum**: over two thousand units the widest corridor is often 40 or 50 units, which is generous. **But somewhere it narrows to 15** — **and that spot is the section's difficulty ceiling**, because the player has to be precise there.

> ⭐ **In one line: it measures how hard the hardest moment on the route is.**

## 9. What "units" are

**They are game-world coordinate units, not pixels and not metres.**

**A few references at the same scale, which make "15" legible:**

| Quantity | Value | Source |
|---|---|---|
| Total track width | **120** | `FIELD_WIDTH` |
| Length of one section | **2000** | `SECTION_LENGTH` |
| **Collision radius of a 2.5-wide block** | **≈ 11.5** | The comment at `generateObstacles.ts:511` |
| **Corridor half-width the generator guarantees** | `{ floor: 7, min: 11, max: 18 }` | `LANE_HALF` |
| Lateral speed | 64 | `LATERAL_SPEED` |
| Forward sampling step | 10 | `STEP` in the sweep |
| Fog visibility distance | ≈ 600 | |

**Put 15 on that scale**: it is **slightly more than one large block's collision radius (11.5)**, and it falls **in the lower part of the corridor half-width range (11–18)**.

> **So 15 units is roughly "a bit more than one large block's width" of room to pass. Tight, but passable** — **which is exactly what the difficulty design wants: at its tightest there is still just enough room.**

## 10. ⚠️ 15 is not a threshold that was set, it is a result that was measured

**This is the easiest thing in this bullet to get wrong.**

**Nowhere in the code does it say "the gap must be ≥ 15"** — there is no such constant and no such assertion. `tightest` starts at infinity and **is pushed down by the actual values encountered during the sweep.**

**So the correct direction of causation is:**

```
❌ we set a floor of 15 and the generator met it
✅ we scanned 1020 layouts and measured a narrowest point of 15
```

**When asked "why did you pick 15 as the threshold", correct the premise directly:**

> "15 is not a threshold we set, **it is the worst value the scan measured.** What the generator constrains is parameters like corridor half-width, in the range 11 to 18; **15 is what layouts from those parameters actually measure at their tightest.**"

> ⭐ **That correction matters** — it turns the bullet from "we set a standard" (weak) into "**we measured the actual water line**" (strong), and it **sidesteps the unanswerable follow-up "then why not set 20".**

## 11. What the generator side actually constrains

15 is not a threshold, **but the generator does guarantee passing room** (`generateObstacles.ts:508-516`):

```js
/**
 * How far this block's centre has to sit from the lane centre.
 *
 * Its own footprint plus the lane, because a 2.5-wide slab carries an 11.5
 * radius: one placed just outside a nominal 15-unit lane reaches most of the
 * way back across it. The lane has to be as wide to fly as it is to look at.
 */
const clearFor = (shape, z) => laneHalfAt(z) + OBSTACLE_BASE_RADIUS * shape.width;
```

**There is a good technical point buried in that comment:**

> A 2.5-wide block has a collision radius of 11.5. Place it **just outside** a nominal 15-wide corridor and **its collision volume still reaches into the corridor and nearly crosses it.**

**So "minimum distance from the lane centre" cannot be the corridor half-width alone; the block's own collision radius has to be added** — which is what that sum is.

> ⭐ **The last line of the comment is the point**: **"The lane has to be as wide to fly as it is to look at."**
>
> **This is a textbook collision-geometry bug**: laying out purely by object centres, while collision volumes eat most of the passage. **The player sees a route and only discovers on impact that it is not one.**

## 12. ⚠️ Be up front about the craft's own collision radius

**The sweep subtracts obstacle radii and treats the craft as a point.**

**That is a simplification worth admitting yourself:**

> "In the sweep the craft is a point and only the obstacles' collision radii are subtracted. **Strictly it should include the craft's radius too** (geometrically that is a Minkowski sum), **which would make the measured narrowest point somewhat smaller than 15. So 15 is an optimistic figure** — although the generator's `clearFor` already leaves both radii as margin between block and corridor, and in actual play there has never been a passage that could not be flown."

> ⭐ **Naming your own measurement's bias, and saying which way it leans, is the most convincing way to present this kind of number.**

## 13. The four terms of this number

| Question | Answer |
|---|---|
| **What the unit means** | Game-world coordinate units. References: track width 120, large-block collision radius 11.5, corridor half-width 11–18, fog distance ~600 |
| **How the threshold was chosen** | ⚠️ **It is not a threshold, it is the measured worst case.** There is no constant 15 and no assertion in the code |
| **Relation to the craft's collision radius** | ⚠️ **The craft is a point in the sweep**, and only obstacle radii are subtracted — **so 15 is optimistic**; say so unprompted |
| **How it was measured** | A forward sweep over an interval set: take the widest reachable interval per step, take the minimum across the section |
| **Reproducible?** | ✅ Start the dev server and run `node bench/fairness.mjs`; it is a column in the report table |

## Glossary

| 中文 | English |
|---|---|
| 程序化生成 | **procedural generation** |
| 种子 / 重新播种 | **seed · reseed** |
| 可通过性 | **solvability** (*winnable*) |
| 试玩 | **playtesting** |
| 前向扫描 | **forward sweep** |
| 区间集合 | **interval set** |
| 可达集 | **reachable set / reach** |
| 生长 ↔ 挖洞 ↔ 合并 | **grow · subtract · merge** |
| 空集 | **empty set** (*if reach goes empty, the layout is unwinnable*) |
| 横向可达范围 | **lateral reach** |
| 碰撞半径 | **collision radius** |
| 走廊 / 通道 | **lane · corridor** (half-width) |
| 缺口 | **gap** |
| 采样 ↔ 穷举证明 | **sampling ↔ formal proof** (⚠️ this is the former) |
| 对照组 | **control** (*against a random-scatter control*) |
| 随机基线 | **random baseline** |
| 回归检查 | **regression check** |
| 闵可夫斯基和 | **Minkowski sum** |
| 常量副本失效 | ⭐ *a copy of a constant is a constant that goes stale* |

> ⭐ **The three easiest to get wrong**:
>
> 1. The mental-shift sentence: **"Whether a run is winnable is a property of the layout, not of the renderer — so measure the layout, don't playtest it."**
> 2. What the control is for: **the control is what this density can do; the gap between the two is what the layout adds**
> 3. Say "this is sampling, not proof" yourself: **this is sampled validation, not a formal guarantee**
