---
title: "① Architectural boundaries: turning conventions into constraints"
section: BioMap
---

# ① Architectural boundaries: turning conventions into constraints

> **Resume line**
>
> Led the **React 18 and TypeScript architecture** for Digital OS, the team's core consumer-facing product, enforcing feature boundaries with **five custom ESLint import zones: no feature can reach into another**.

> ⚠️ **Evidence boundary**: the Digital OS production repository is not on this machine. The implementation I can walk through line by line is the equivalent pattern in my later `Prometheus` project; I should not present those paths as BioMap source code.

## What this bullet actually has to prove

My contribution was not choosing React and TypeScript. It was turning the dependency direction into executable rules, so architecture did not depend on everybody remembering a convention as the codebase and team grew.

## First layer: answer these cleanly

### 1. What was Digital OS, and what did “led the architecture” mean?

Digital OS was the team's core consumer-facing product. “Led” does not mean I wrote every page. It means I established the directory boundaries, dependency direction, and enforcement mechanism that later feature work followed.

### 2. What was the dependency direction?

The core direction was:

`app → features → components / hooks / lib / types / utils`

- `app` composes routing, providers, and global entry points.
- `features` organise code vertically by business capability.
- Lower shared directories provide stable capabilities with no feature ownership.

Higher layers may depend on lower ones. Lower layers must not know concrete business features, and one feature must not reach into another feature's internals.

### 3. What do the five import zones actually prevent?

The reference implementation is in `Prometheus/.eslintrc.cjs`:

- The first 3 isolate `blog`, `comments`, and `theme`, preventing features from reading one another's internals.
- The fourth prevents `features` from importing back up into `app`.
- The fifth prevents shared layers from importing `features` or `app`.

`import/no-cycle: error` separately catches circular dependencies that an individual zone may not express.

### 4. Why not leave this as a README convention?

A README can remind people; ESLint can fail immediately while they code and in CI. It turns architecture review from “did a senior engineer happen to notice?” into feedback executed on every change.

### 5. Does that mean features can never collaborate?

They can collaborate without reading private implementation. A cross-feature capability can go through a public entry point, be composed one layer up in `app`, or be extracted into a genuinely unowned shared module. The rule constrains dependency shape, not business composition.

## Second layer: only if they keep digging

### Why does feature-first structure scale better than grouping by file type?

A feature keeps its API, components, hooks, and types together, so the change surface is visible and the capability is easier to remove or migrate. A horizontal forest of `components/`, `hooks/`, and `services/` gradually erases business boundaries.

### Can boundary rules become too rigid?

Yes, so the rules must evolve with the real dependency graph. Repeated legitimate cross-domain needs usually reveal a missing public API or shared abstraction. A rare exception should be explained in review, not hidden by switching the rule off.

### If TypeScript checks imports, why is ESLint necessary?

TypeScript answers whether an import can compile. It does not answer whether this layer should know that layer. Type correctness and architectural correctness are different properties.

## Current gaps

- The locally verifiable code is the `Prometheus` reference implementation, not the Digital OS production repository.
- The rules only enforce anything if editor checks and CI actually run them.
- Overly broad barrel exports can still turn feature internals into accidental public APIs.

## 30-second answer

> As Digital OS grew, the main risk was not one badly written component; it was dependency direction decaying over time. I separated app composition, business features, and stable shared layers, then encoded the boundaries in five ESLint import zones: features cannot reach into one another, features cannot import back into app, and shared code cannot know upper business layers. Circular imports fail separately. That made the architecture executable in local development and CI instead of leaving it as a convention people had to remember.

## Self-check

1. Can I draw the dependency direction without looking?
2. Can I explain which class of boundary each of the five zones protects?
3. If asked how two features collaborate, can I give the three options: public entry point, app-level composition, or shared abstraction?
4. Can I state the evidence boundary between BioMap source and the `Prometheus` reference implementation before I am challenged on it?
