---
title: "④ LIMS: fencing an imperative grid inside Vue"
section: BioMap
---

# ④ LIMS: fencing an imperative grid inside Vue

> **Resume line**
>
> Developed the **LIMS platform in Vue 3 and TypeScript** for sample management and SOP workflows, extending the **Luckysheet SDK with custom cell actions and a per-cell JSON contract**, plus a scaffolding CLI.

## What this line has to show

Two things: how a global, imperative grid SDK gets wired into a reactive Vue page, and what the CLI actually automated. Those two fill thirty seconds. Saving, resize and teardown are follow-up material — dumping all of it up front only dilutes the point.

## What LIMS and SOP are

LIMS is a laboratory information management system: it tracks samples, workflows and results. SOP means standard operating procedure.

On the SOP editing page the grid is not just displaying data. Each cell also carries an experiment step, an analysis method, a data-backfill configuration. An ordinary table component cannot hold that, which is why Luckysheet is there.

## How Luckysheet is wired into Vue

The SDK gets an empty container div and is initialised imperatively: fetch the spreadsheet metadata, then call the SDK's create method to build the grid inside that container.

State the boundary clearly. Vue owns page state, modals and business data. Luckysheet owns the grid DOM inside its container. The two only exchange data through SDK methods and the hooks it exposes. Vue never declaratively renders the SDK's internal DOM — two rendering systems mutating the same nodes always ends badly, and it ends in the kind of bug where nodes vanish, state scrambles, and nothing reproduces.

## What the custom cell actions are

Three custom actions are registered in the SDK's right-click menu configuration: configure the cell's SOP JSON fields, configure data validation, and mark fields.

The path is a straight line: the user right-clicks, the SDK hands the callback the row and column of that cell, the callback opens a Vue modal, the user fills in the form, and on confirm an SDK write method puts the result back into that cell.

Writing back distinguishes two fields: the display value, which is what the user sees in the grid, and the stored value, which is what is actually persisted. That distinction is a common follow-up, so have it ready.

The SDK only provides the trigger point and the write method here. The complicated form is still a Vue component — which is the boundary above, made concrete.

## What the per-cell JSON contract is

The business metadata hangs off an extension property on the cell itself, holding fields like the analysis method and the backfill config. Opening the modal formats that object into JSON text for editing; saving parses it back into an object and writes it to that cell.

The benefit is that the visible cell value and the business configuration behind it are fully separated, and that configuration is saved, exported and restored along with the SOP template — no second table keyed by row and column coordinates.

Volunteer the cost: this is an internal convention, and there is no schema validation around the parse. Broken JSON needs a clearer error than it currently gets. That is a real gap, and admitting it reads better than talking around it.

## How edits are saved

Saving hangs off Luckysheet's update hook. Before submitting, the render-only two-dimensional matrix on each sheet is dropped, because it can be rebuilt from the cell data and is far larger — there is no reason to upload it.

The submit itself is on a two-second trailing debounce: continuous editing collapses into one call, sent two seconds after the user stops.

One frequent follow-up lives here: lodash's `debounce` is trailing by default, not leading. The default is equivalent to "do not run at the start, run at the end". Immediate execution is `throttle`, or `debounce` with `leading` explicitly turned on. Getting this backwards makes it sound memorised.

## Why resize needs its own handling

Luckysheet computes the grid's dimensions at init, so a changed container means a rebuild. But `ResizeObserver` fires very densely, and wiring it up directly rebuilds the whole grid on every twitch.

So there are two gates: a six-hundred-millisecond debounce collapses continuous jitter, and a width threshold skips anything under twenty pixels as noise. Opening a modal or a scrollbar appearing no longer triggers a full rebuild.

State the cost here too: rebuilding is expensive and it loses the current selection and edit state. The better answer would be a reliable resize API on the SDK that adjusts dimensions without rebuilding — this approach exists because that API does not.

## What the CLI does

It uses Commander plus interactive prompts to pick a template, copies a whole Vue or React project skeleton, restores the dotfiles, then rewrites the package name, the mount point id in the HTML and the entry selector.

It is a project scaffold. It solves the repeated cost of configuring a new project from zero. It is not a module generator — it does not generate a page, route, endpoint or type inside an existing project. Get that distinction right; overstating it will not survive one follow-up.

## Background

**Why Vue must not touch the grid's internal DOM.** Luckysheet creates and updates its own DOM. If Vue's virtual DOM also diffs that content, the two update mechanisms overwrite each other. The clean boundary is to give the whole container to the SDK and let Vue speak to it only through public methods and events.

**The standard integration surface for an imperative SDK.** Init, event bridging, data sync, resize, error handling and teardown — those six belong in one adapter or composable, so page components consume business semantics instead of reaching for a global object everywhere. This page has no explicit teardown, so repeatedly entering and leaving it risks leaking instances and listeners. That is another gap worth naming yourself.

**Does the debounce make saving reliable.** No. It only reduces request count; it guarantees nothing about eventual consistency. Production also needs a version number or ETag so a late response cannot overwrite a newer edit, retries on failure, a flush of the last edit before leaving the page, and explicit saving / saved / failed states in the UI.

## The 30-second answer

> The SOP editing page in LIMS needs experiment configuration attached to individual cells, so I treated Luckysheet as an imperative island: it gets an empty container, Vue owns the page and the modals, the SDK owns the grid DOM, and they only talk through methods and hooks. I added three custom actions to its right-click menu; each opens a Vue form, and the result is written back into that cell's extension property as a per-cell JSON contract that is saved with the SOP template. Saving hangs off the update hook on a two-second trailing debounce, and the render-only matrix is dropped before submitting. Resize is gated by a six-hundred-millisecond debounce plus a twenty-pixel threshold so small jitters do not rebuild the grid. The CLI I also built is a project scaffold: it copies and rewrites a whole Vue or React template to solve new-project setup.

## Self-check

1. Can you say which state and which DOM belong to Vue and which to Luckysheet, and why they must not mix?
2. Can you walk the full path from right-click to modal to JSON to write-back?
3. Can you state the difference between the display value and the stored value?
4. Can you state accurately that lodash `debounce` is trailing by default, not leading?
5. Can you explain what the two-second save debounce and the six-hundred-millisecond plus twenty-pixel resize gates each block?
6. Can you explain that the CLI is a project scaffold and not a module generator?
7. Can you volunteer the three gaps: teardown, schema validation, and rebuilding on resize?
