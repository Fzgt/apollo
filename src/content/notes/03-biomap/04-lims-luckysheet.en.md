---
title: "④ LIMS: fencing an imperative grid inside Vue"
section: BioMap
---

# ④ LIMS: fencing an imperative grid inside Vue

> **Resume line**
>
> Developed the **LIMS platform in Vue 3 and TypeScript** for sample management and SOP workflows, extending the **Luckysheet SDK with custom cell actions and a per-cell JSON contract**, plus a scaffolding CLI.

## Terms, in one line each

**LIMS (Laboratory Information Management System)** — the system that tracks samples, workflows and result records.

**SOP (Standard Operating Procedure)** — the standard steps of an experiment. **In this product an SOP template is a spreadsheet carrying business configuration.**

**Luckysheet** — an open-source in-browser spreadsheet SDK. **It is imperative** — you call methods and it mutates the DOM. **It is not a Vue component.**

**Imperative vs declarative** — imperative says "perform this step"; declarative says "the result should look like this, work out the difference yourself". **Vue and React are both declarative, and mixing the two models over the same DOM always ends badly.**

**Debounce** — on repeated triggers, run once **after things stop**. **Trailing is the default.**

**Throttle** — on repeated triggers, run at a fixed interval, **starting immediately**.

**ResizeObserver** — a browser API firing on element size changes. **It fires very densely.**

## What this line has to show

Two things: **how a global, imperative grid SDK is fitted into a reactive Vue page**, and **what the CLI actually automates.**

Those two fill thirty seconds. Save, resize and teardown come out on follow-up — **dumping them all up front only dilutes the point.**

## What LIMS and SOP mean here concretely

On the SOP editing page **the grid is not just displaying data**: each cell also carries experiment steps, analysis methods and data-writeback configuration. **An ordinary table component cannot hold that**, which is why Luckysheet is there.

## How Luckysheet is fitted into Vue

Give the SDK **an empty container div**, then initialise imperatively: fetch the Excel metadata, then call the SDK's create method to build the grid inside that container.

**State the boundary precisely:**

- **Vue owns** page state, modals and business data.
- **Luckysheet owns** the grid DOM inside the container.
- The two **exchange data only through SDK methods and the hooks it provides.**

**Vue is never allowed to declaratively render the SDK's internal DOM** — two rendering systems mutating the same DOM will break, **and they break as nodes vanishing, state desynchronising, and almost nothing reproducing.**

The sentence worth keeping: **I treated Luckysheet as an imperative island.**

## What the custom cell actions are

Three custom actions are registered into the SDK's context-menu config: SOP JSON field configuration, SOP data validation, SOP Mark Fields.

The chain is a straight line:

```
right-click → the SDK hands the cell's (row, col) to a callback
           → the callback opens a Vue modal → the user fills the form
           → on confirm, an SDK write method puts the result back into that cell
```

Writing back **distinguishes two fields**: **the display value (`m`, what the user sees in the grid)** and **the stored value (`v`, what is actually persisted)**. **That distinction is a common follow-up; have it ready.**

The SDK here **only supplies the trigger point and the write method — the complex form is still a Vue component**, which is the boundary above made concrete.

## What the per-cell JSON contract is

Business metadata hangs on **an extension property of the cell itself**, holding analysis method, data writeback and similar fields. Opening the modal **formats that object as JSON text** for editing; saving **parses it back** and writes it into the cell.

The benefit: **the visible cell value and the business configuration behind it are cleanly separated**, and that configuration **saves, exports and restores with the SOP template** — no side table keyed by row and column coordinates.

**Volunteer the cost**: this is an internal convention, and **there is no schema validation around the parse**. Malformed JSON needs a clearer error than it currently gets. **That is a real gap** — conceding it beats glossing over it.

## How edits are saved

Hooked onto Luckysheet's update hook. **Before saving, the two-dimensional render data on each sheet is stripped**, because **it can be rebuilt from the cell data and is far larger** — there is no reason to upload it.

The submit itself runs on **a two-second trailing debounce**: consecutive edits collapse into one, and the request goes out two seconds after the user stops.

**A frequent follow-up: lodash `debounce` is trailing by default, not immediate.** The default behaviour is "do not run on the leading edge, run on the trailing edge". Immediate execution is `throttle`, or `debounce` with `leading: true` set explicitly.

**Do not get this backwards; getting it backwards makes debounce and throttle sound memorised.**

## Why resize needs its own handling

Luckysheet computes grid dimensions **at initialisation**, so a changed container means **a rebuild**. But **`ResizeObserver` fires very densely**, and wiring it up directly rebuilds the whole grid on every twitch.

So there are **two gates**:

1. **A 600 ms debounce**, collapsing a burst into one.
2. **A 20-pixel width threshold**, treating anything smaller as a twitch and skipping it.

Modals opening and closing, or a scrollbar appearing, no longer trigger a full rebuild.

**State this cost too**: **a rebuild is heavy and loses the current selection and edit state.** The better answer would be an SDK resize API that adjusts dimensions without rebuilding — **this exists because that API does not.**

## What the CLI does

**Commander** plus interactive prompts to pick a template, copy a whole Vue or React project skeleton, restore dotfiles, then rewrite the package name, the mount point id in the HTML and the entry selector.

**It is a project scaffold, solving the repeated cost of configuring a new project from zero.**

**It is not a module generator** — it does not generate a page, route, API layer or type into an existing project. **Get this distinction right; overstating it will be probed.**

## Background

**Why Vue is not allowed to own the grid's internal DOM.** Luckysheet creates and updates its own DOM. If Vue's **virtual DOM** also diffs that content, **the two update mechanisms overwrite each other.** The cleanest boundary hands the whole container to the SDK and lets Vue speak only through public methods and events.

**The standard integration surface for an imperative SDK.** **Initialisation, event bridging, data sync, resize, error handling, teardown** — those six belong inside an **adapter or composable**, so the page component consumes business meaning rather than touching a global object everywhere. **This page has no explicit teardown, so repeated navigation risks leaking instances and listeners** — another gap worth conceding first.

**Does debouncing make saving reliable?** **No.** It only reduces request count; **it does not guarantee eventual consistency.** Production also needs **a version or ETag so a stale response cannot overwrite a newer edit**, retry on failure, **a flush before the page unloads**, and explicit saving / saved / failed states.

## The 30-second answer

> The SOP editing page in LIMS has to carry experiment configuration on individual cells, so I treated Luckysheet as an imperative island: it gets an empty container, Vue owns the page and the modals, the SDK owns the grid DOM, and they talk only through methods and hooks. I added three custom actions to its context menu; each opens a Vue form, and on confirm the result is written back into that cell's extension property — a per-cell JSON contract that saves with the SOP template. Saving hangs off the update hook on a two-second trailing debounce, and the render data that can be rebuilt is stripped before submitting. Resize is gated by a 600 ms debounce plus a 20-pixel threshold so twitches do not rebuild the whole grid. The CLI is a project scaffold: it copies and rewrites a whole Vue or React template to solve new-project setup.

## Self-check

1. Can you say which state and which DOM Vue and Luckysheet each own, and why they cannot be mixed?
2. Can you narrate the full right-click → modal → JSON → write-back chain?
3. Can you state the difference between the display value and the stored value?
4. Can you say accurately that lodash `debounce` is trailing by default, not immediate?
5. Can you explain what the two-second save debounce and the 600 ms + 20 px resize gates each block?
6. Can you explain that the CLI is a project scaffold and not a module generator?
7. Can you volunteer all three gaps: teardown, schema validation, and resize-by-rebuild?
