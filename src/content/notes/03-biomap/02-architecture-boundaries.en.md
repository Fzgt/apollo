---
title: "② Architectural boundaries: turning conventions into constraints"
section: BioMap
---

# ② Architectural boundaries: turning conventions into constraints

> **Resume line**
>
> Led the **React 18 and TypeScript architecture** for Digital OS, the team's core consumer-facing product, **enforcing feature boundaries with custom ESLint rules**.

## ⭐ The one sentence this bullet hangs on

> **"Documentation is a convention; a lint rule is a constraint."**
>
> **A convention holds only as long as people remember it; a constraint holds because the tool blocks you. As a team grows and people rotate, conventions drift — the one thing that never drifts is "you cannot do it".**

**Lead with that sentence in an interview, then land it with examples.** It sits a level above walking through ESLint rules one by one — ⭐ **it shows judgement, not tool familiarity.**

> **Note in passing**: the same sentence also explains [③ The design system and MSW](/docs?section=biomap&item=design-system-msw)) — **the two bullets look unrelated but are the same idea applied twice, and telling them together makes each one twice as strong.**

## The 30-second version

> Digital OS is the team's core consumer-facing product, and I owned its React 18 + TypeScript architecture. **The valuable part of architecture work is not which layer diagram you drew, it is whether that diagram can be enforced.**
>
> Our layering is **`app` → `features` → shared**, and dependencies may only flow one way. **But a rule like that written in a README does nothing** — nobody checks the docs under deadline pressure, one cross-feature import slips in, and by the time you notice, two features are welded together.
>
> So I wrote it as **ESLint rules**: five path restrictions plus one ban on import cycles. **A violation is not "someone might catch it in code review", it is a build error and a red CI run.** It went from a matter of discipline to something you cannot do.

## 1. The problem being solved: the big ball of mud

**The most common way a large project rots is the "big ball of mud"**: modules importing each other freely until **nothing can be deleted and nothing can be understood**.

**The fix is to require that dependencies flow in one direction only:**

```
app/ ──→ features/ ──→ components/ hooks/ lib/ types/ utils/

The arrows are the permitted dependency direction; the reverse is always forbidden.
```

| Layer | What lives there |
|---|---|
| **`app/`** | The **composition layer**: pages and routes |
| **`features/`** | Individual **business features** (blog, comments, theme, …) |
| **The row underneath** | **Shared things**: components, hooks, utilities, types |

⭐ **The direction is not arbitrary: the lower you go, the more general and the more stable; the higher you go, the more specific and the more volatile. Keeping stable things free of dependencies on volatile things is what keeps the blast radius of a change contained.**

## 2. Which rules enforce it

**The ESLint rule `import/no-restricted-paths`** does one thing: **"inside this directory, you may not import from that directory"**. The code defines five of them:

| Rule | What it blocks |
|---|---|
| **1–3** | `features/blog` may not import other features under `features/` (only itself) — ⭐ **features reaching into each other** |
| **4** | `features/` may not import `app/` — **a lower layer depending back up** |
| **5** | The shared layer may not import `features/` or `app/` — **business logic contaminating the shared layer** |

**Plus one `import/no-cycle` (no circular imports).**

## 3. What each of the three actually prevents (this section is the meat of the answer)

### ① Feature isolation prevents welding

```
blog imports a utility from comments
  → comments imports a type from blog
    → the two features are welded together
      → want to delete comments? you cannot
      → want a new hire to touch only blog? they have to read comments first
```

**If features need to talk, it goes through the composition layer above, or the shared part sinks into the shared layer below.** ⭐ **Only then is each feature a unit that can be deleted on its own and understood on its own** — and "can it be deleted on its own" is the best test of whether a module boundary is real.

### ② The shared layer may not depend upwards

The moment `components/Button` imports something from `features/blog`, ⭐ **it stops being shared** — no other project and no other feature can use it. **The entire value of the shared layer rests on it not knowing the business exists.**

### ③ Banning import cycles prevents a real runtime bug

A **circular import** is A importing B while B imports A (or comes back round through a chain). It has three consequences, and **the second one genuinely blows up**:

1. Module initialisation order becomes unpredictable
2. ⭐ **You can get `undefined`** — because at the moment you reference it, that module has not finished initialising
3. It is hard to maintain; refactoring anything pulls on everything

> **This one is worth calling out separately**, because it is not a tidiness issue — **it is a class of production bug that is extremely hard to trace**: the error surfaces at the point of use while the cause lives in the shape of the module graph.

## 4. ⭐ Why this belongs on a resume

**"I set up a React architecture" is an empty sentence; anyone can say it.** This bullet stands up because it answers a harder question: **what decides whether the architecture rots?**

| | Convention (drifts) | Constraint (blocks) |
|---|---|---|
| **Architectural boundaries** | A dependency diagram in the README | ⭐ **An ESLint rule — a violation is a build error** |
| **Code style** | "Everyone please watch the naming" | A formatter plus lint rules |
| **Front-end / back-end decoupling** | "Agree the contract first, the back end will get to it" | **MSW intercepting at the network layer** (see [③](/docs?section=biomap&item=design-system-msw))) |

> ⭐ **The same idea as [the four-state machine at Beyz](/docs?section=beyz&item=credential-quota), [the lifetime-purchase protection in Stripe](/docs?section=beyz&item=stripe-billing) and [the `Omit` in TanStack Query](/docs?section=biomap&item=tanstack-query): turn "must not happen" from a matter of discipline into something that cannot be expressed.**
>
> **Four examples across three projects; strung together they are a ready-made answer to [the cross-project follow-ups](/docs?section=cheatsheet&item=crosscut).**

## 5. Production grade, and three things you will be pushed on

| Practice | Note |
|---|---|
| ⭐ **The rules have to run in CI** | **A rule that is not in continuous integration does not exist** — locally it can be skipped or silenced with an ignore comment. Same reasoning as [the CI gate at Beyz](/docs?section=beyz&item=service-cicd) |
| **At scale, move to a dedicated tool** | `dependency-cruiser` can generate the dependency graph, express more complex architectural rules and produce visualisations — **there is a ceiling on what ESLint rules can express** |
| ⚠️ **The rules must evolve with the directory structure** | A new feature needs a new rule, **or the whole thing slowly becomes decoration** — that is the real maintenance cost of this approach, so raise it yourself |

### Expected follow-up: should you use barrel exports?

**A "barrel export" is an `index.ts` in a directory that re-exports everything in it**, so callers write `import { A, B } from '@/features/blog'` instead of individual paths.

| Benefit | Cost |
|---|---|
| The outside world knows one entry point, so **files can move around inside without affecting any caller** — which fits the boundary rules above exactly: **one feature, one door** | ⚠️ **It readily creates import cycles** (A imports the barrel, the barrel imports B, B imports A); **it is unfriendly to bundler tree shaking** and can drag the whole directory into the output |

> **How to answer**: "Yes, but only at a feature directory's outward boundary — **files inside it import concrete paths directly**. Overusing barrels is the most common source of import cycles, and import cycles are exactly what we ban with a rule, **so the two decisions have to be made together.**"

## Glossary

| 中文 | English |
|---|---|
| 架构边界 | **architectural boundary** (*enforcing feature boundaries*) |
| 约定 ↔ 约束 | **convention ↔ constraint** (⭐ *documentation is a convention, ESLint is a constraint*) |
| 强制 / 落到实处 | **enforce** (*enforced by a lint rule*) |
| 依赖方向 | **dependency direction** |
| 分层 | **layering** |
| 大泥球 | **big ball of mud** |
| 功能隔离 | **feature isolation** |
| 循环引用 | **circular dependency / import cycle** |
| 模块初始化顺序 | **module initialisation order** |
| 通用层 | **shared layer** |
| 组装层 | composition layer |
| 桶式导出 | **barrel export** |
| 摇树优化 | **tree shaking** |
| 腐化 / 劣化 | **rot / erode** (*architecture erodes*) |
| 编译期报错 ↔ 运行时报错 | **compile-time error ↔ runtime error** |
| 可独立删除 | **independently deletable** |

> ⭐ **The two easiest to get wrong**:
>
> 1. The sentence this bullet hangs on: **"Documentation is a convention; a lint rule is a constraint."** Memorise it — it is worth more than any detail
> 2. "Turn what must not happen into what cannot happen" is **make the wrong thing impossible, not just discouraged**
