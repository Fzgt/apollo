---
title: "③ The P2 white screen"
section: Baidu
---

# ③ The P2 white screen

> **Resume line**
>
> **First to diagnose a P2 white screen** on Haokan Video's search page (**30M+ DAU**): **mismatched Node versions regenerated package-lock.json**, pulling a **breaking minor bump** — **version locks and release checks followed**.

## What this line has to show

It is not "I fixed a bug". It is "I turned one bug into the end of a class of bugs".

All of the value sits in the last clause: version locks and release checks. Telling only the debugging story wastes it — on the surface a library broke, but underneath the lockfile was not locking anything, and that second problem comes back wearing any dependency you like.

## Four terms to settle first

**Semantic versioning and the two symbols.** A version reads major dot minor dot patch. A major change means something broke. A minor change means functionality was added, compatibly. A patch means bug fixes only.

What sits in `package.json` is not a version, it is a permitted range. A bare number pins exactly one. A tilde allows patch bumps only. A caret allows minor bumps — and the caret is what npm writes for you by default.

The caret is where this incident starts. It bets that a minor version is always compatible, and someone loses that bet every year. A change the library author considers "adding functionality" is a breaking change under your usage.

**What the lockfile is for.** `package.json` records a range; the lockfile records the exact version that was actually installed last time, pinning transitive dependencies too. Its entire purpose is that every person and every CI machine installs an identical dependency tree — the property called a reproducible build.

**Why mismatched Node versions corrupt the lockfile.** This is the crucial link. The lockfile carries a format version field whose format changes with npm's major version, and npm's version follows Node's version, because installing Node installs an npm with it.

So the chain runs: someone's Node version differs from the team's, their npm sees a lockfile in a format it does not use, and it regenerates one by its own rules. Regenerating means going to the registry for the newest version satisfying the caret range. That newest version carried a breaking change.

The crucial link is *regenerated*. Nobody edited the lockfile by hand; a tool rewrote it without them realising. That is also why the first fix is pinning Node — you cannot lock npm without locking Node, and you cannot lock the lockfile without locking npm.

**`npm ci` versus `npm install`.** `install` is allowed to modify the lockfile: when it finds `package.json` and the lockfile disagreeing, it updates the lockfile. `ci` only reads the lockfile, exits with an error when they disagree, and deletes the whole dependency directory before installing from scratch.

CI must use `ci` — the two letters mean continuous integration. Using `install` there is permission for CI to quietly change dependency versions.

## How to structure the investigation

Tell it as observe, hypothesise, verify, fix, prevent — with the weight on the separation between the last two.

Observe: the search page renders blank, and the console error points at a method missing from a third-party library.

Hypothesise: the surface hypothesis is that the library has a bug or we used the API wrong. But nobody touched it in that release — and noticing that the symptom does not match the change is the pivotal move in the whole investigation. Emphasise it when you tell the story.

Verify: compare the versions actually installed before and after the release, find that one had quietly moved up a minor version, then trace upward and find the lockfile had been rewritten wholesale in that commit.

Fix: roll back the lockfile and pin that dependency. This makes this one go away.

Prevent: pin the Node version, switch CI to `npm ci`, add a staging verification before release. This makes the class go away.

That separation is the skeleton of the line. In an interview, always continue from the fix into the prevention, or this is just a story about being able to read an error message.

## How to defend "first to diagnose"

"First to diagnose" is a strong claim and it will be tested.

The answer: others were investigating too; I was the first to trace it to the lockfile being regenerated.

Make clear that "first" means first to the root cause, not first to notice the outage. That distinction deflects most follow-ups, and it is honest — the outage is usually found by monitoring or by support, not by a developer.

## Expected follow-ups

**Why did local and staging not catch it?** Because the person who introduced it had that new version installed locally, and in their environment it happened not to reach the crashing path — or they never opened that page. It spread once other people pulled the code and reinstalled.

The deeper answer is that if staging and production are not installed from the same lockfile with the same Node version, staging is not a guarantee of anything. That is exactly what the prevention items address.

**How do you stop it happening again?** This question *is* the second half of the resume line. Pin the Node version with an `.nvmrc` plus the `engines` field, and verify it in CI — without pinning Node you cannot pin npm. Switch CI to `npm ci`, so a mismatch between the lockfile and `package.json` fails loudly instead of being silently rewritten. Put the lockfile into code review: it should not be rewritten wholesale in normal work, so a large diff must be seen by a human. Run a smoke test on staging using exactly the production build artifacts. And tighten critical dependencies from caret to exact or tilde, with upgrades landing as their own pull requests.

**Why not pin everything exactly?** Because security patches stop arriving too. The usual compromise is pinning the critical dependencies, using tilde for the rest so only patches flow, and running an automated upgrade bot so upgrades arrive as reviewable pull requests — upgrades happen where you can see them, not when someone happens to install dependencies.

## What to say about 30M DAU

Like the five million page views in the virtualized feed line, this is the environment, not the achievement — but here its job is more specific: it explains why this was a P2 and not a P3.

The answer: Haokan Video is a product at that scale, so a blank search page has a wide blast radius and the incident was graded P2. I know that figure from the product's public numbers; I did not measure it.

Note that DAU is a product-level metric and is not the same as the module you owned. Do not let it sound like "my page had thirty million daily users".

## The 30-second answer

> Haokan Video's search page went blank after a release. It was graded a P2, and the product is at hundreds of millions of daily users. The root cause was four layers deep: someone's local Node version differed from the team's, so their npm differed, so installing dependencies regenerated the lockfile, and the regenerated lockfile allowed one dependency up to a newer version that carried a breaking change. It shipped and it broke. On the surface a library failed; underneath, our lockfile was not locking anything. So the follow-up was not fixing that one dependency — it was pinning the Node version, moving CI to `npm ci`, and adding a staging verification before release, because the same mechanism will come back wearing any dependency at all.

## Self-check

1. Can you say what the caret and the tilde each allow?
2. Can you walk every link from the Node version mismatch to the rewritten lockfile?
3. Can you state the difference between `npm ci` and `npm install`, and why CI must use the former?
4. Can you separate the fix from the prevention and name the five prevention items?
5. Can you qualify "first" as first to the root cause rather than first to notice?
6. Can you explain that 30M DAU is a product metric whose job is to justify the incident grade?
