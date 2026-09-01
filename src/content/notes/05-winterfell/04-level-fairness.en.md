---
title: "④ Sweeping the level generator for solvability"
section: WinterFell
---

# ④ Sweeping the level generator for solvability

> **Resume line**
>
> **Checked the level generator by machine rather than by playing it**: across **1,020 generated layouts**, every step tested against **how far the craft can move sideways at that stage's speed**, **every layout had a way through**.

"No gap narrower than 15 units" and the random-scatter control are not on the resume, but you need both: 15 is the measured result, and the control is the answer to whether this sweep has any discriminating power at all.

## What this line has to show

At its core is one mental shift: whether a run is winnable is a geometric property of the layout, not an outcome of running the game. So do not run the game — compute the geometry.

And it does not sample a few paths. It computes exactly every position that survives, which is the step from testing to proof.

## The problem

Obstacles are procedurally generated: each run, the code places blocks from noise and a random seed. Which creates a serious problem — you cannot guarantee the generated level is passable. One roll might produce a wall spanning the whole track, and the player dies with nothing they could have done. That is not difficulty, that is a bug.

Playing it manually does not work, because every run is a fresh random layout: a hundred attempts covers a hundred samples, and you do not know whether any of them was a bad one.

Automated playtesting in a headless browser was explicitly rejected too, and the reason is in the script's file header: there is no real GPU there, WebGL falls back to software rasterisation, frames take seconds — and since the game advances the player by the time elapsed since the last frame, a multi-second frame teleports the player straight through the entire obstacle field. Playtested results there are meaningless.

Which leaves one route: analyse the layout's geometry directly. The file header states it plainly — whether a run is winnable is a property of the layout, not of the renderer, so this measures the layout instead of playtesting.

Be able to say that mental shift in one sentence. It is the skeleton of this line.

## The core algorithm: an interval-set forward sweep

This is the most valuable part of the line.

Set the picture first: the track is a hundred and twenty wide, sixty either side of centre, and a section is two thousand long. Looking down from above, the player flies upward.

The sweep takes a step every ten units along the track, and each step maintains one thing — the reachable set, every lateral position the player could currently occupy having hit nothing on the way. It is a set of intervals, because obstacles cut it apart.

Each step does three things. Grow: over those ten units of forward travel the craft can move some distance sideways, so every reachable interval expands by that much on both sides. Subtract: every obstacle in that stretch has its collision radius removed from the reachable set, which can split one interval into two. Merge: growth makes adjacent intervals overlap, and without merging the interval list grows exponentially — a code comment says exactly this.

If the reachable set ever becomes empty, the layout is unsolvable and the player must die.

Walking it through makes it clear. The start is one interval from minus sixty to plus sixty, a hundred and twenty wide. Advance ten units, each interval expands by the small lateral distance available at that speed, then obstacle radii are subtracted — an obstacle of radius eleven and a half at the centre cuts the set into two intervals about forty-eight and a half wide each. Advance again, another obstacle on the left cuts the left interval in two. And so on.

What is elegant about this algorithm is that one sweep answers whether a path exists, and it answers for all paths rather than a few samples. That is the step from testing to proof.

The interval count carries extra meaning: two intervals mean there is an obstacle in between that must be gone around, and the player may choose left or right. So the number of intervals measures how many routes there are. A comment puts it well — a route that is always exactly one path wide is fair, but that is a queue, not a race track.

## Lateral reach: a bug fixed twice

The sweep's key input is how far the craft can move sideways per unit of forward travel, which is lateral speed divided by forward speed: the faster you go, the less sideways room each metre forward buys.

The generator's comments give the numbers: at the opening speed the craft can move about 0.049 sideways per unit forward, and by the sixth level only about 0.024 — half. So the same layout that is fair at the start may be genuinely impassable later.

The comments record two real fixes, and both are good interview material.

The first: originally this hard-coded the opening speed. The comment's words — it quietly validated the late game against reach it does not have.

The second: the lateral speed constant was a copied value of forty-four, while the game itself had already been tuned to sixty-four. The comment is quotable directly — a copy of a constant is a constant that goes stale. Which means the validation tool was validating levels against a craft that does not exist, and staying green the whole time.

The second one is especially worth telling: the tool copied a constant, the game changed it, the tool did not, and the tool failed silently. That is far more dangerous than a failing test, because failure raises an alarm and silent failure does not. The fix was importing from the constants file directly.

## Why a random-scatter control is needed

The control takes the same number of blocks at the same sizes and throws them at the same stretch of track with no rules at all.

The reason is well explained in a comment: some lateral strip always gets lucky and happens not to be blocked. With eighty blocks spread over a hundred and twenty units of width, a given strip is covered about seven times in two thousand units, and the largest gap among a hundred and twenty such strips is most of a sector by chance alone.

So "a path exists" is not an achievement on its own; it has to be compared against the same density scattered arbitrarily. The comment summarises it: the control is what this density can do, and the gap between the two is what the layout is adding.

This is a general experimental instinct. Any claim of the form "my algorithm achieved X" should be met with "what does the random baseline achieve?" A metric without a control measures the difficulty of the problem, not the quality of the solution.

## Where 1,020 comes from

The formula is simple: sections times trials per section. The script defaults to twelve sections and forty trials, which is four hundred and eighty. So 1,020 came from a parameterised run — twelve by eighty-five is the most likely combination, since the section count is the default.

Record the parameters before you run. Being asked where 1,020 comes from and not knowing the parameters looks bad, because this is the one input you fully control.

Each trial reseeds independently, with a seed of the section number times a prime plus the trial index. A comment explains why reseeding the whole route matters rather than retrying one route: sampling one seed many times would test one route many times and say nothing about the one the player is actually handed.

That also answers "how do you reproduce a failing random layout": the seed is deterministic, so with the same parameters the sweep is fully reproducible — section three, trial seventeen is always the same layout.

## How the conclusion is phrased

The script reports that every layout sampled had a continuous path through it; or, if any failed, that up to some percentage of layouts had no path, and those runs end in a death the player could not avoid.

Note that it says *every layout sampled*, not "every possible layout". The resume says every layout had a continuous path and drops "sampled" — strictly, that generalises from 1,020 samples to all.

When asked whether you can guarantee every random layout is passable, the correct answer is: no. This is sampled validation, not a formal proof. All 1,020 layouts had a continuous path, covering twelve sections at eighty-five independent reseeds each. A real guarantee would require formal constraints on the generator — what we built is a regression check that can be run repeatedly in CI.

Admitting it is sampling is far better than talking around it.

## "Gap" is not the spacing between obstacles

The word invites a misreading, so kill it first. It is not the distance between two obstacles; it is a quantity the interval sweep computes.

After each step, take the widest of the surviving reachable intervals. Across the whole section, take the minimum of those widest values.

So its exact meaning is: across the whole track, at the moment when the widest safe strip the player can occupy is at its narrowest, how wide is it?

## Why widest first, then narrowest

This is the step that confuses people, and an example fixes it.

Suppose after one step there are three intervals, of width eight and a half, seventeen, and forty-eight and a half. This step takes the widest, forty-eight and a half — not the narrowest.

Why? Because the player only needs one route to work. Whether that eight-and-a-half-wide sliver exists is irrelevant; they can sit in the forty-eight-and-a-half one. So this step's difficulty is forty-eight and a half.

Then take the minimum across the section: over two thousand units, the widest corridor is usually forty or fifty units, which is generous — but at one point it narrows to fifteen, and that point is the section's difficulty ceiling, because the player has to be precise there.

One sentence: it measures how hard this route is at its hardest moment.

## What the units are

They are game world coordinate units, not pixels and not metres. A few references at the same scale make fifteen legible: the track is a hundred and twenty wide, a section is two thousand long, a block of width 2.5 carries a collision radius of about eleven and a half, the generator's guaranteed lane half-width runs eleven to eighteen with a floor of seven, lateral speed is sixty-four, the forward sampling step is ten, and fog limits visibility to about six hundred.

Put fifteen into that scale: it is a little larger than a big block's collision radius of eleven and a half, and it sits in the lower part of the lane half-width range. So fifteen units is roughly one big block's width of passage, plus a bit. Tight, but passable — which is exactly what the difficulty design wants: at its tightest there is still just enough room.

## 15 is not a threshold that was set — it is a result that was measured

This is the easiest thing here to get wrong.

Nowhere in the code does it say the gap must be at least fifteen. There is no such constant and no such assertion. That narrowest value starts at infinity and is pushed down by the actual values encountered during the sweep.

So the causal direction is: not "we set a floor of fifteen and the generator met it", but "we swept 1,020 layouts and the narrowest point measured fifteen".

If asked why fifteen was chosen as the threshold, correct the premise directly: fifteen is not a threshold we set, it is the worst case the sweep measured. What the generator constrains is parameters like the lane half-width, in the range eleven to eighteen; fifteen is what layouts from those parameters actually measure at their tightest.

That correction matters. It turns this from the weak claim "we set a standard" into the strong claim "we measured the real waterline", and it avoids the unanswerable follow-up "so why not set it to twenty?"

## What the generator actually constrains

Fifteen is not a threshold, but the generator does guarantee passage. The rule is that a block's centre must sit at least the lane half-width plus that block's own collision radius away from the lane centre.

There is a good technical point buried in that comment. A block of width 2.5 carries a collision radius of eleven and a half, so placing it just outside a nominally fifteen-wide lane still lets its collision volume reach into the lane and cross most of the way back over it. So the minimum distance cannot be the lane half-width alone; the block's own radius has to be added.

The last line of that comment is the crux: the lane has to be as wide to fly as it is to look at.

This is a very typical collision-geometry bug: place objects by their centre points, and the collision volumes eat most of the corridor. The player sees a route, flies into it, and discovers it is not one.

## Volunteer the point about the craft's collision radius

The sweep subtracts the obstacles' radii and treats the craft as a point. That is a simplification worth admitting yourself.

The answer: in the sweep the craft is a point, and only the obstacle radii are subtracted. Strictly it should include the craft's radius too — geometrically that is the Minkowski sum — and doing so would make the measured narrowest point somewhat smaller than fifteen, so fifteen is an optimistic number. That said, the generator's clearance rule already reserves each radius between blocks and the lane, and in actual play there was never a passage too tight to fly.

Pointing out the bias in your own measurement, and saying which way it leans, is the most convincing way to present a number like this.

## Four definitions behind the number

The unit is a game world coordinate, referenced against a track width of a hundred and twenty, a big block's collision radius of eleven and a half, a lane half-width of eleven to eighteen, and fog at about six hundred. On how the threshold was set — it is not a threshold, it is the measured worst case, and there is no such constant or assertion in the code. On the craft's collision radius — the sweep treats the craft as a point and subtracts only obstacle radii, so fifteen is optimistic. On how it was measured — an interval-set forward sweep, taking the widest reachable interval per step and the minimum across the section. On reproduction — start the dev server and run the fairness script; the report has this column.

## The 30-second answer

> The obstacles are procedurally generated, so every run has a different layout, and randomness can produce a wall spanning the whole track — the player hits it with nothing they could have done, and that is not difficulty, that is a bug. Manual playtesting cannot cover it, and automated playtesting in a headless browser does not work either, because WebGL falls back to software rasterisation there, frames take seconds, and the player teleports straight through the field. The key realisation is that whether a run is winnable is a geometric property of the layout, not of the renderer — so I computed the geometry. The sweep steps every ten units along the track maintaining a set of reachable intervals: each step grows them by how far the craft can move sideways at that stage's speed, subtracts the obstacle collision radii in that stretch, then merges the overlaps; if the set ever empties, the layout is unsolvable. One sweep answers for every path, not a few samples. It ran over 1,020 layouts, all of which had a continuous path, with the narrowest point measuring fifteen units — and fifteen is a measured result, not a threshold we set. There is also a random-scatter control, because "a path exists" can be pure probability; the gap between the two is what the layout adds.

## Self-check

1. Can you state the mental shift, and explain why playtesting in a headless browser is invalid?
2. Can you walk the three steps of the forward sweep, and explain why merging cannot be skipped?
3. Can you explain the lateral reach formula, and the lesson from both stale-constant bugs?
4. Can you explain why the control exists?
5. Can you say how 1,020 is computed, and why each trial reseeds the whole route?
6. Can you explain that the gap takes the widest per step then the minimum overall, and what it measures?
7. Can you correct the premise that fifteen is a threshold, and volunteer the point-craft simplification?
