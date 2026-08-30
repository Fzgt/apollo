---
title: "① Architecture boundaries: putting rules into ESLint"
section: BioMap
---

# ① Architecture boundaries: putting rules into ESLint

> **Resume line**
>
> Led the **React 18 and TypeScript architecture** for Digital OS, the team's core consumer-facing product, enforcing feature boundaries with **five custom ESLint import zones: no feature can reach into another**.

> ⚠️ **Evidence limit**: the Digital OS source code is not on this machine. `Prometheus` is a later example built in 2026 and can only help explain the pattern. Its `blog`, `comments`, and `theme` names are not BioMap feature names. Do not present them as the five Digital OS rules.

## What this bullet needs to show

As the project grew, folder rules were easy to break. I grouped code by business feature and used ESLint to block imports that broke the layer rules. Problems could be found during development and in CI.

## First layer: answer these clearly

### 1. What was Digital OS, and what did “led the architecture” mean?

Digital OS was the team's main consumer product. “Led” does not mean I wrote every page. It means I decided how the code was split into layers, how features were organised, which imports were not allowed, and how those rules were checked.

### 2. What is a feature-first structure?

Code is grouped by business feature instead of putting every component, hook, and API file into large shared folders. A feature can contain its own pages, components, hooks, API code, and types. Most files for one business change stay in one place.

### 3. What problem did the five import zones solve?

The original config is not available, so do not learn the five names from `Prometheus`. The safe answer is that the rules protected three kinds of boundary:

- One feature could not read another feature's private files.
- A feature could not import back up into the app entry layer.
- Shared components and tools could not import business features.

If an interviewer asks for all five Digital OS zones, only give details you truly remember. Do not fill the gap with the later example.

### 4. Why use ESLint instead of a README?

People have to remember a README. ESLint can fail while they code and in CI. The team does not have to wait until modules are already tied together before finding the problem.

### 5. How can two features work together?

There are three common choices: use a public entry point, join the features in a page or the `app` layer, or move truly shared code into a shared module. One feature should not import another feature's private files.

## Second layer: useful concepts

### Why can TypeScript not replace ESLint boundaries?

TypeScript checks whether types are correct. An import can have correct types and still break the architecture. ESLint checks whether that layer is allowed to depend on another layer.

### What is the cost of feature-first structure?

Rules that are too strict can make shared code hard to place. A repeated need across features may show that the project needs a public API, app-level work, or a new shared module. The rules should grow with the project instead of making the code harder.

### Why are public entry points important?

A feature's public entry point controls what other code may use. If it exports too much, private code slowly becomes public. A small, clear entry point lets the feature change safely inside.

## What we cannot prove from local code

- The real Digital OS folders and five zones are not available here.
- The `Prometheus` rules explain the method, but they do not prove the BioMap feature names or exact config.
- Without the original CI config, do not claim that every BioMap commit ran these checks.

## 30-second answer

> As Digital OS grew, I did not want module boundaries to depend on team memory. I grouped code by business feature and added five ESLint import zones to stop features reading each other's private files and stop lower layers importing higher layers. A bad import then failed during development and in CI. When features needed to work together, we used public entry points, joined them at a higher layer, or moved shared code into a shared module.

## Self-check

1. Can I explain feature-first in one sentence?
2. Can I explain the difference between ESLint boundaries and TypeScript checks?
3. Can I give the three ways for features to work together?
4. If asked for the five real zones, can I avoid using `Prometheus` feature names as BioMap facts?
