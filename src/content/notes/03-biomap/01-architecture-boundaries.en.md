---
title: "① Architecture boundaries: putting the rules into ESLint"
section: BioMap
---

# ① Architecture boundaries: putting the rules into ESLint

> **Resume line**
>
> Led the **React 18 and TypeScript architecture** for Digital OS, the team's core consumer-facing product, enforcing feature boundaries with **five custom ESLint import zones: no feature can reach into another**.

## What this line has to show

Code is organised by business feature, dependencies only flow one way, and that direction is not a note in the README that people have to remember — it is an ESLint rule that stops you in the editor and in CI. The point is not "I configured a few lint rules". The point is that a spoken agreement became a check that runs on every commit. That gap is the whole content of this line.

## What Digital OS is, and what "led the architecture" means

Digital OS is the team's core consumer product. "Led" does not mean I wrote every page. It means three things were mine to decide: how the code is layered, how features are organised, and which imports are not allowed plus how that gets checked automatically. Anyone can have an opinion on the first two. The third one is the step that makes an opinion permanent — and the only one I can show evidence for.

## The dependency direction

Three layers, top to bottom: app, features, and the shared layer. `app` holds routes, providers and the global entry point; its job is wiring. `features` are cut vertically by business capability, and each one carries its own API layer, components, hooks and types. The shared layer is `components`, `hooks`, `lib`, `types` and `utils` — stable, general code with no business meaning.

One rule: an upper layer may depend on a lower one, a lower layer must never know about an upper one, and two features must never reach into each other's internal files.

## What the five import zones protect

This uses `import/no-restricted-paths` from `eslint-plugin-import`. It has three fields: `target` is "who", `from` is "where that who may not reach", and `except` is "apart from its own square". Be ready to explain those three on the spot, because an interviewer will usually ask you to read the config back.

The first three zones isolate features from each other, one zone per feature. Take blog: `target` points at blog's own folder, `from` points at the whole features folder, and `except` carves out blog itself — so code inside blog may not import anything under features except blog. Comments and theme get the same shape.

The fourth zone blocks the reverse dependency: `target` is the whole features folder, `from` is app. Nothing inside features may import anything from app. The entry layer is allowed to know about business; business is not allowed to know about the entry layer.

The fifth zone stops the shared layer knowing about business: `target` is the five shared folders, `from` is features and app. A generic button may not import a feature's types, because then it is no longer generic.

A separate `import/no-cycle` rule catches the circular dependencies the zones do not cover.

"Why five and not one" always comes. The answer is in `except`: feature isolation needs one zone per feature because `except` has to name that feature, and it cannot be written as a wildcard. Add a feature, add a zone. That is both its cost and the reason it is precise.

## Why ESLint and not the README

A README can only remind. It relies on people remembering, on a reviewer happening to notice, on someone telling the new hire. All three fail, and when they fail there is no signal.

ESLint is different. A bad import is red in the editor while you type it, and it blocks the merge in CI. The architecture went from a spoken agreement to a check that runs on every commit — that sentence is what this line is for.

## What if two features need to work together

Three legal routes, pick one. Call the other feature through its public entry point, its barrel export, without touching internal files. Or compose the two one layer up, in app or in the page. Or push the genuinely generic part — the part with no business owner — down into the shared layer.

Say out loud that the boundary restricts *how* things depend on each other, not whether business logic can be combined. Without that sentence it sounds like the rules stop people working.

## Background

**Why feature-first beats folders by file type.** When code is spread horizontally across `components`, `hooks` and `services`, one requirement lives in three or four folders, you cannot see the blast radius of a change, and deleting a feature means grepping the whole repo. Cut vertically, one feature's API, components, hooks and types sit together — it can be moved as a block, and deleted as a block.

**TypeScript already checks types, so why ESLint.** TypeScript answers "does this import compile". It does not answer "should this layer know about that layer". An import can be perfectly typed and still break the architecture. Type-correct and architecture-correct are two different things, and fumbling this one makes it look like you never thought about the split.

**What a barrel export costs.** A feature's entry file decides what the outside can use. Open it too wide and the internals quietly become a public API you can no longer refactor. Keep it narrow and the feature stays free to change inside.

**Are the boundaries too rigid.** Yes, sometimes. So the rules follow the real dependency graph. When the same cross-feature need keeps coming back, that usually means a public API or a shared abstraction is missing — not that the rule should be turned off.

## The 30-second answer

> Once Digital OS grew, I did not want module boundaries to live in the team's memory. I organised the code vertically by feature, fixed the dependency direction as app to features to the shared layer, and locked it down with five ESLint import zones: the first three let each feature import only itself, the fourth stops features depending back on app, the fifth stops the shared layer knowing about business, and a separate rule catches cycles. A bad import is red in the editor and blocked in CI. Cross-feature work goes through a public entry point, gets composed one layer up, or gets lifted into the shared layer — it never reaches through into internal folders.

## Self-check

1. Without notes, can you draw app → features → shared layer?
2. Can you say what `target`, `from` and `except` each mean?
3. Can you name what each of the five zones protects, and why feature isolation needs one zone per feature?
4. Can you give the three legal routes for cross-feature work?
5. Can you explain the division of labour between the ESLint boundary and TypeScript's type checking?
