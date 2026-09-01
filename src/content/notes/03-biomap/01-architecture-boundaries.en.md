---
title: "① Architecture boundaries: putting the rules into ESLint"
section: BioMap
---

# ① Architecture boundaries: putting the rules into ESLint

> **Resume line**
>
> Led the **React 18 and TypeScript architecture** for Digital OS, the team's core consumer-facing product, enforcing feature boundaries with **five custom ESLint import zones: no feature can reach into another**.

## Terms, in one line each

**Feature** — a vertical slice of code organised by business capability, carrying its own API layer, components, hooks and types. **Not a folder of one file type.**

**Feature-first** — directories split by business first, file type second; the opposite is **type-first** (`components/`, `hooks/`, `services/` at the top).

**Import zone** — one entry in `eslint-plugin-import`'s `no-restricted-paths` rule, stating **who may not import from where**.

**Barrel export** — a feature's `index.ts`, exporting exactly what it chooses to make public. **Outsiders enter only through it.**

**Circular dependency** — A imports B and B imports A back. Initialisation order becomes unpredictable and bundlers cannot tree-shake.

**CI (continuous integration)** — the pipeline that builds and checks every commit. **"Blocked in CI" means it cannot be merged.**

## What this line has to show

Code is organised vertically by feature, dependencies flow one way, and **that direction is not written in a document for people to remember — it is blocked by ESLint in the editor and in CI.**

The point is not "I configured a few lint rules", it is "**I turned a verbal agreement into a check that runs on every commit**". **The gap between an agreement and a check is the whole content of this line.**

## What Digital OS is, and what "led the architecture" means

Digital OS is the team's core consumer-facing product. **Leading it does not mean I wrote every page.** It means three things were mine: how the code is layered, how features are organised, and which imports are forbidden and how that is checked automatically.

Anyone can have an opinion on the first two. **The third is the step that makes an opinion permanent — and the only one that leaves evidence.**

## The direction of dependencies

Three layers, flowing **`app` → `features` → shared**:

- **`app`** — routing, providers, global entry. Its job is **assembly**.
- **`features`** — vertical business slices, each with its own `api/`, `components/`, `hooks/`, `types/`.
- **shared** — `components` / `hooks` / `lib` / `types` / `utils`: **stable, business-free** capability.

**One rule: upper layers may depend on lower ones, lower layers may not know about upper ones, and no two features may reach into each other's internals.**

## What the five zones each guard

```js
'import/no-restricted-paths': ['error', {
  zones: [
    // Zones 1-3: each feature may only import itself
    { target: './src/features/blog',     from: './src/features', except: ['./blog'] },
    { target: './src/features/comments', from: './src/features', except: ['./comments'] },
    { target: './src/features/theme',    from: './src/features', except: ['./theme'] },

    // Zone 4: features may not import back into app
    { target: './src/features', from: './src/app' },

    // Zone 5: the shared layer may not import features or app
    { target: './src/(components|hooks|lib|types|utils)', from: './src/(features|app)' },
  ],
}],

'import/no-cycle': 'error',   // cycles the zones cannot see, caught separately
```

**Be able to explain the three fields instantly**, because interviewers usually ask you to read the config itself: **`target` is "who", `from` is "where that who may not reach", `except` is "apart from its own square".**

**The first three** isolate features, **one zone per feature**. Take blog: `target` is blog's own directory, `from` is all of `features`, `except` carves out blog itself — meaning **code in blog may import nothing under `features` except itself.**

**The fourth** blocks the reverse edge: `target` is all of `features`, `from` is `app`. **The entry layer may know the business; the business may not know the entry layer.**

**The fifth** stops the shared layer knowing the business. **A generic button may not import a feature's types, or it stops being generic.**

**"Why five and not one" is a certainty as a follow-up.** The answer is `except`: feature isolation needs one zone per feature **because `except` must point at that feature, which cannot be expressed as a wildcard**. More features, more zones — **which is both its cost and the reason it is precise.**

## Why ESLint and not the README

**A README can only remind.** It relies on people remembering, on a reviewer happening to notice, on someone telling the new hire. **All three fail, and they fail without a signal.**

ESLint does not: **the offending import is red in the editor as you type it, and blocked at merge in CI.**

The sentence worth memorising: **enforced in the editor and in CI, not in a README.**

## What if two features need to work together

Three legal paths, take any one:

1. Call through the other feature's **public entry point (barrel export)**, never its internals.
2. **Compose one layer up**, in `app` or the page layer.
3. **Lift** the genuinely generic, business-free part **into the shared layer**.

**The boundary restricts how you depend, not whether features may combine** — say that unprompted, or the rules sound like they stop people working.

## Background

**Why feature-first beats type-first.** Spread across `components/`, `hooks/` and `services/`, one requirement's code sits in three or four directories, the blast radius of a change is invisible, and deleting a feature means grepping the repo. Sliced vertically, a feature's API, components, hooks and types live in one folder — **it can be moved as a block, and deleted as a block.**

**TypeScript already checks types, so why ESLint.** TypeScript decides "**does this import compile**", not "**should this layer know about that one**". **A perfectly typed import can still break the architecture.** Type-correct and architecture-correct are different things; missing this makes it look like you never thought about the division of labour.

**What barrel exports cost.** A feature's `index.ts` decides what outsiders can use. **Open it too wide and the internals quietly become a de facto public API**, and refactoring becomes impossible. Keep it narrow and the feature stays free to change inside.

**Are the boundaries too rigid?** Yes, sometimes. So the rules evolve with the real dependency graph. **The same cross-feature need appearing repeatedly usually means a missing public API or a missing shared abstraction — not that the rule should be switched off.**

## The 30-second answer

> As Digital OS grew I did not want module boundaries to depend on team memory. I organised code vertically by feature, fixed the dependency direction as app → features → shared, then froze it with five ESLint import zones: the first three let each feature import only itself, the fourth forbids features importing back into app, the fifth forbids the shared layer knowing the business, plus a separate no-cycle rule for circular dependencies. An offending import is red in the editor and blocked at merge in CI. Cross-feature needs go through a public entry point, get composed one layer up, or get lifted into the shared layer — never straight through someone's internals.

## Self-check

1. Without notes, can you draw `app → features → shared`?
2. Can you explain what `target`, `from` and `except` each mean?
3. Can you say what each of the five zones guards, and why feature isolation needs one zone per feature?
4. Can you give the three legal paths for cross-feature work?
5. Can you explain the division of labour between ESLint boundaries and TypeScript type checking?
6. Can you name the cost of an over-wide barrel export?
