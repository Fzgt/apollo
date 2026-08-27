---
title: "③ The P2 white-screen incident"
section: Baidu
---

# ③ The P2 white-screen incident

> **Resume line**
>
> **First to diagnose a P2 white screen** on Haokan Video's search page (**30M+ DAU**): **mismatched Node versions regenerated package-lock.json**, pulling a **breaking minor bump** — **version locks and release checks followed**.

## What this bullet is about

⭐ **It is not about "I fixed a bug", it is about "I turned one bug into the end of a class of bugs".**

**All the value of this bullet sits in the last clause, `version locks and release checks followed`.** Telling only the debugging story wastes it — **on the surface it looks like "a library broke", but what actually happened is "our lockfile was not locking anything", and that will come back through any dependency at all.**

## The 30-second version

> The Haokan Video search page went white after a release. It was a P2 incident, on a product with hundreds of millions of daily active users.
>
> **The root-cause chain has four links**: someone's local Node version differed from the team's → so did their npm version → installing dependencies ⭐ **regenerated `package-lock.json`** → and in that regenerated file one dependency was allowed up to a new version carrying a breaking change, which blew up on release.
>
> ⭐ **On the surface it reads as "a library broke", but the real finding is "our lockfile was not locking anything".** So the follow-up work was not changing that one dependency; it was **pinning the Node version, switching CI to `npm ci`, and adding pre-release verification on staging** — **because the same mechanism will come back through any other dependency.**

## 1. ⭐ Four terms you must settle before telling this story

### ① semver, and those two symbols

A version `4.17.21` reads as **major.minor.patch**: ⭐ **major changed = breaking change, minor changed = features added but compatible, patch changed = bug fixes only.**

What `package.json` holds **is not a version, it is a permitted range**:

| Written as | Allows | Note |
|---|---|---|
| `4.17.21` | Only 4.17.21 | Pinned |
| `~4.17.21` | `>=4.17.21 <4.18.0` | Patch releases only |
| ⭐ `^4.17.21` | `>=4.17.21 <5.0.0` | **Minor releases allowed** — and this is what npm writes for you by default |

⭐ **The caret is where this incident starts: it bets that "a minor release is always compatible". People lose that bet every year** — a change the library author considered "adding a feature" is breaking for the way you use it.

### ② What `package-lock.json` is for

`package.json` holds a **range**; ⭐ **the lockfile holds the one exact version that was actually installed last time**, pinning its dependencies' dependencies too.

⭐ **Its entire reason for existing is to make every person and every CI machine produce an identical `node_modules`** — the property is called a **reproducible build**.

### ③ ⭐ Why a Node version mismatch corrupts the lockfile (the key link in the chain)

**The lockfile has a `lockfileVersion` field, and its format changes with npm's major version** (npm 6 is v1, npm 7+ is v2/v3). ⭐ **And npm's version follows Node's** — installing Node brings an npm with it.

**So:**

```
someone's Node version is a notch higher or lower
  → their npm sees a lockfile in "the wrong format"
    → ⭐ it regenerates the file under its own rules
      → regenerating means asking the registry for "the newest version satisfying the ^ range"
        → and that newest version carries a breaking change
```

⭐ **The key link is "regenerates": nobody edited the lockfile by hand, a tool rewrote it without them realising.**

⭐ **Which is also why the first fix is "pin the Node version" — without pinning Node you cannot pin npm, and without pinning npm you cannot pin the lockfile.**

### ④ `npm ci` vs `npm install`

| | Behaviour |
|---|---|
| `npm install` | ⚠️ **May modify the lockfile** — when `package.json` and the lockfile disagree, it updates the lockfile |
| ⭐ `npm ci` | **Reads the lockfile only**; on any disagreement it errors and exits, and it deletes the whole `node_modules` and installs from scratch |

⭐ **CI must use `npm ci`** (the ci in the name is continuous integration). **Using `npm install` means allowing CI to quietly change dependency versions.**

## 2. How to structure the investigation

⭐ **Tell it as observe → hypothesise → verify → fix → prevent, with the emphasis on separating the last two.**

| Step | What happened here |
|---|---|
| **Observe** | The search page is white; the console error points at a missing method on a third-party library |
| **Hypothesise** | Surface hypothesis: the library has a bug / we used the API wrong. ⭐ **But nobody touched it in the release** — the key move at this step is **noticing that the symptom does not match the change** |
| **Verify** | Compare the versions actually installed in `node_modules` before and after the release, **find that one had quietly gone up a minor version**; trace further back and `package-lock.json` was rewritten wholesale in that commit |
| **Fix** | Roll back the lockfile and pin that dependency's version — ⭐ **make this one go away** |
| ⭐ **Prevent** | Pin the Node version (`.nvmrc` + the `engines` field), switch CI to `npm ci`, add pre-release verification on staging — ⭐ **make the class go away** |

⭐ **Separating fix from prevent is the skeleton of this bullet.** In an interview, always continue into prevent after the fix, **otherwise this is just a story about being able to read an error message.**

## 3. How to say "first to diagnose" without inflating it

⚠️ **`First to diagnose` is a strong claim and will be probed.**

> ⭐ **How to answer**: "Others were investigating too; **I was the first to trace the root cause down to the lockfile being regenerated.**"

⭐ **Make clear that "first" means first to the root cause, not first to notice the outage** — that distinction fends off most follow-ups, and it is honest: whoever notices a white screen is usually monitoring or support, not a developer.

## 4. Expected follow-ups

**Q: Why did local and test environments not catch it?**

⭐ **Because the person who caused it had that new version in their own `node_modules`, and in their environment it happened not to hit the crashing path** (or they never opened that page). **It spread only once other people pulled the code and reinstalled.**

⭐ **The deeper answer: if the test environment and production are not installed from the same lockfile with the same Node version, testing guarantees nothing.** That is exactly what those three prevention measures address.

**Q: How do you stop it happening again? (this question is the resume's second half)**

| Measure | What it blocks |
|---|---|
| ⭐ **Pin the Node version** | `.nvmrc` + the `engines` field in `package.json` + a CI check — **no pinned Node means no pinned npm** |
| ⭐ **`npm ci` in CI** | If the lockfile and `package.json` disagree it errors out **instead of silently rewriting** |
| **Lockfiles go through code review** | ⭐ **Large changes to `package-lock.json` must be visible to a human** — it should not normally be rewritten wholesale |
| **Pre-release verification** | Run a smoke test on staging **using exactly the same build output as production** |
| **Tighten dependency ranges** | Move critical dependencies from `^` to exact versions or `~`, **with upgrades going through their own PR** |

**Q: Why not just pin everything exactly?**

⭐ **The cost is that security patches cannot get in either.** The usual compromise: **pin the critical dependencies, use `~` for the rest so only patches flow, and add an automated upgrade bot (Renovate/Dependabot) that turns upgrades into individually reviewable PRs** — **so upgrades happen where you can see them, not while someone is installing dependencies.**

## 5. How to talk about `30M+ DAU`

⭐ **Like [the 5M PV in the virtual-list bullet](/docs?section=baidu&item=virtual-list), it is environment rather than achievement** — but its role here is more specific: **it explains why this was a P2 rather than a P3.**

**How to answer**: "Haokan Video is a product with daily active users in the hundreds of millions, and a white screen on the search page has a wide blast radius, which is why it was graded P2. **I know the figure from the product side's public numbers; I did not measure it.**"

⚠️ **Note that DAU is a product-level metric and not the same thing as the module you own** — do not let it sound like "my page has 30 million DAU".

## Glossary

| 中文 | English |
|---|---|
| 白屏 | **white screen** (incident grading: **P2 incident**) |
| 语义化版本 | **semantic versioning (semver)** |
| 主/次/修订版本 | **major · minor · patch** |
| 版本范围 | **version range** (`^` = caret, `~` = tilde) |
| 放行 | **allow / accept** (*the caret allows any minor bump*) |
| 破坏性的小版本升级 | **a breaking minor bump** (the resume's own phrase) |
| 锁文件 | **lockfile** (`package-lock.json`) |
| 被重新生成 | **regenerated** (the resume's own phrase, *regenerated package-lock.json*) |
| 可复现构建 | **reproducible build** |
| 版本锁定 | **version pinning / version locks** |
| 发布前检查 | **release checks** |
| 预发布环境 | **staging** |
| 冒烟测试 | **smoke test** |
| 根因 | **root cause** (to locate it = *diagnose / trace it to*) |
| 复现 | **reproduce** |
| 回滚 | **roll back** |
| 事后复盘 | **postmortem** |
| 依赖升级机器人 | Renovate / Dependabot (**automated dependency PRs**) |

> ⭐ **The three easiest to get wrong**:
>
> 1. "First to find the root cause" is **I was the first to trace it to the lockfile being regenerated** — use **trace it to**, and make clear it is the root cause, not first to notice the outage
> 2. "A tool rewrote the lockfile without him realising" is **the tool rewrote it without him realising**
> 3. Keep "fixed this one" and "eliminated the class" separate: **the fix made this one go away; the version locks and release checks made the class of bug go away**
