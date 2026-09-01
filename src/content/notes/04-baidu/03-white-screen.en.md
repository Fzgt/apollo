---
title: "③ The P2 white screen"
section: Baidu
---

# ③ The P2 white screen

> **Resume line**
>
> **First to diagnose a P2 white screen** on Haokan Video's search page (**30M+ DAU**): **mismatched Node versions regenerated package-lock.json**, pulling a **breaking minor bump** — **version locks and release checks followed**.

## Terms, in one line each

**Semver (semantic versioning)** — a version reads **major.minor.patch**. **A major bump means breaking changes; a minor bump means compatible additions; a patch bump means bug fixes only.**

**`package.json` does not name a version, it names a permitted range:**

```jsonc
{
  "lodash": "4.17.21",    // pinned: exactly this one
  "lodash": "~4.17.21",   // tilde: patches only → 4.17.x
  "lodash": "^4.17.21"    // caret: minors too  → 4.x.x   ← npm writes this for you
}
```

**The caret is where this incident starts**: it bets that a minor is always compatible, **and somebody loses that bet every year.** What the library author considered "adding a feature" **is breaking under your usage.**

**Lockfile (`package-lock.json`)** — `package.json` states a range; **the lockfile states the exact version last installed**, pinning transitive dependencies too. **Its entire reason to exist is the reproducible build.**

**P2** — an incident severity; **lower number, more severe.** Severity follows blast radius.

**DAU (daily active users)** — a **product-level** metric, not your module's.

## What this line has to show

It is not "I fixed a bug", it is "**I turned one bug into the end of a class of bugs**".

**The value of this line is entirely in the last clause: version locks and release checks.** Telling only the investigation wastes it — **on the surface a library broke; in reality our lockfile was not locking anything**, and that would return **in the shape of any dependency at all.**

## Why mismatched Node versions corrupt the lockfile

**This is the pivotal link.**

The lockfile carries a **`lockfileVersion` field whose format changes across npm majors**; and **npm's version rides along with Node's** — installing Node installs an npm.

So the chain is:

```
someone's Node version ≠ the team's
  → their npm version differs
  → npm sees a lockfile whose lockfileVersion it does not match
  → it regenerates one by its own rules
  → regeneration resolves the newest version inside each ^ range
  → that newest version carries a breaking change
  → white screen in production
```

**The pivot is "regenerates": the lockfile was not hand-edited, it was rewritten by a tool without the developer realising.**

**Which is why the first fix is pinning Node — without pinning Node you cannot pin npm, and without pinning npm you cannot pin the lockfile.**

## `npm ci` versus `npm install`

- **`npm install`** may **modify** the lockfile: when `package.json` and the lockfile disagree, **it updates the lockfile.**
- **`npm ci`** **reads only**: on disagreement it **fails immediately**, and it deletes `node_modules` and installs from scratch.

**CI must use `npm ci` — those two letters mean continuous integration. Using `install` lets CI silently change your dependency versions.**

## How to structure the investigation

Tell it as **observe → hypothesise → verify → fix → prevent**, with **the emphasis on separating the last two.**

**Observe**: the search page renders white, and the console error points at a method missing from a third-party library.

**Hypothesise**: the surface hypothesis is a library bug or misuse of its API. **But nobody had touched it in that release** — **noticing that the symptom does not match the change is the most valuable move in the whole investigation. Highlight it when you tell this.**

**Verify**: compare the versions actually installed in `node_modules` before and after the release; it had quietly gained a minor. Trace upward: **the lockfile had been rewritten wholesale in that commit.**

**Fix**: revert the lockfile and pin that dependency. **This makes this one go away.**

**Prevent**: pin Node, switch CI to `npm ci`, add a staging verification before release. **This makes the class go away.**

**That separation is the spine of the line.** Always continue into prevention, or the story is only "I can read a stack trace".

## How to make "first to diagnose" hold up

**"First to diagnose" is a strong claim and will be probed.**

**The answer**: others were investigating too, and **I was the first to trace it to the lockfile being regenerated.**

Make clear that "first" means **first to the root cause**, not first to notice the outage — **that distinction stops most follow-ups, and it is honest**: white screens are usually found by monitoring or support, not by developers.

## Expected follow-ups

**Why did local and test not catch it?** Because the developer who introduced it had that new version installed locally, and in their environment they never hit the crashing path — or never opened that page. The new version only spread once others pulled and reinstalled.

**The deeper answer: if the test environment and production are not installed from the same lockfile on the same Node version, testing guarantees nothing.** Which is exactly what the prevention items address.

**How do you stop it recurring (this is the resume's second clause):**

1. **Pin Node** — `.nvmrc` plus `engines` in `package.json`, verified again in CI. **Without pinning Node you cannot pin npm.**
2. **Switch CI to `npm ci`** — disagreement between lockfile and `package.json` **fails the build** instead of being silently resolved.
3. **Put the lockfile in code review** — it should not be rewritten wholesale, so **large diffs must be seen by a human.**
4. **Run a smoke test on staging using exactly the production build artefact before release.**
5. **Move key dependencies from `^` to pinned or `~`**, and make upgrades their own PR.

**Why not pin everything exactly?** **Because security patches stop arriving too.** The usual compromise pins key dependencies, uses `~` for the rest so only patches flow, and adds an update bot (Renovate / Dependabot) to **turn upgrades into reviewable PRs — making them happen where you can see them, rather than when someone installs dependencies.**

## How to present the 30M DAU

Like the 5M PV in the virtualized feed note, **this is the environment, not the achievement** — but here its role is sharper: **it explains why this was a P2 rather than a P3.**

**The phrasing**: Haokan Video is a product at that scale, a white screen on its search page has a wide blast radius, hence P2 — **and that number comes from the product side's public figure; I did not measure it.**

**DAU is a product-level metric, not your module's. Do not let it sound like "my page had 30M DAU".**

## The 30-second answer

> Haokan Video's search page went white after a release; it was a P2. The root cause is four layers deep: someone's local Node version did not match the team's, so their npm version differed, so installing regenerated package-lock.json, so a dependency's caret range resolved to a new minor carrying a breaking change, and it broke in production. On the surface a library broke; in reality our lockfile was not locking anything. So the follow-up was not fixing that one dependency — it was pinning Node, switching CI to npm ci, and adding staging verification before release, because the same mechanism would come back in the shape of any dependency at all.

## Self-check

1. Can you say what `^` and `~` each permit?
2. Can you narrate every link from "Node version" to "lockfile rewritten"?
3. Can you state the difference between `npm ci` and `npm install`, and why CI must use the former?
4. Can you separate fix from prevention, and name the five prevention items?
5. Can you qualify "first" as first to the root cause rather than first to notice?
6. Can you explain that 30M DAU is a product-level metric whose role is to justify the severity?
