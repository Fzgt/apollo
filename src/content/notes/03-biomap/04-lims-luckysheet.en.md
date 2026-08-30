---
title: "④ LIMS: containing an imperative spreadsheet inside Vue"
section: BioMap
---

# ④ LIMS: containing an imperative spreadsheet inside Vue

> **Resume line**
>
> Developed the LIMS platform in **Vue 3 and TypeScript** for sample management and SOP workflows, extending the Luckysheet SDK with **custom cell actions and a per-cell JSON contract**, plus a scaffolding CLI.

> ✅ **Evidence boundary**: this article has real BioMap repositories to inspect: `biomap-web-lims` and `biomap-cli`. I still should not invent measured outcomes that the code does not establish.

## Establish this first: this bullet only needs two claims

1. How I integrated a global, imperative spreadsheet SDK into a reactive Vue page.
2. What the CLI actually automated.

The main answer only needs about 30 seconds. Saving, resize behaviour, and SDK lifecycle belong in follow-up answers.

## First layer: answer these cleanly

### 1. What are LIMS and SOP?

A LIMS is a laboratory information management system for samples, processes, and result records. An SOP is a standard operating procedure. On this page, the spreadsheet was not just a data display; cells also carried experimental steps, analysis methods, and data-backfill configuration.

### 2. How was Luckysheet integrated into Vue?

`sop-edit/index.vue` gives the SDK an empty container and initialises it imperatively through `window.luckysheet.create(...)`. Vue owns page state, modals, and business data; Luckysheet owns the spreadsheet inside the container. They exchange data through explicit methods and events instead of asking Vue to declaratively render SDK-owned DOM.

### 3. What were the custom cell actions?

The page registers 3 right-click actions through `cellRightClickConfig.customs`. A cell opens a Vue modal, the user edits business information, and `setCellValue` writes the result back. The SDK supplies the trigger point while Vue components own the complex forms.

### 4. What was the per-cell JSON contract?

Business metadata lives in the cell's `sopExpandProperty`, including fields such as `analyseMethod` and `dataBackFill`. `MarkModal.vue` reads and edits it through a JSON editor. This separates the visible cell value from its business configuration and allows both to travel with the SOP template.

It is an internal project contract, not proof of complete schema validation. Malformed JSON still needs validation and useful error handling.

### 5. Why not upload the entire Luckysheet object on every edit?

Before saving from the `updated` hook, the code gets all sheets and removes the reconstructable two-dimensional `data` matrix, avoiding a large duplicate runtime payload. Saving uses a trailing 2-second debounce: continuous edits coalesce and the request runs after the user pauses.

The old note claimed lodash debounce runs immediately by default. That was wrong: trailing execution is the default, while `leading: false` only makes the intention explicit.

### 6. What did the CLI actually generate?

`@biomap/cli` uses Commander and interactive prompts to choose a template, copy a complete Vue or React project, restore dotfiles, and rewrite the package name, HTML app id, and entry selector. It is a **project scaffolder**, not a module generator that adds one page, route, API file, and types to an existing application.

## Second layer: only if they keep digging

### Why did resize need special handling?

The page debounces ResizeObserver by 600ms and ignores width changes below 20px to avoid repeatedly rebuilding the spreadsheet for layout noise. That reduces churn, but rebuilding remains heavy. A reliable SDK resize API that preserves selection and editing state would be better.

### What is the standard boundary for an imperative SDK?

Initialisation, event bridging, data synchronisation, resize, errors, and disposal should sit behind an adapter or composable. Page components should consume business semantics rather than reaching for a global SDK throughout the codebase.

### How would saving become more reliable?

Debouncing reduces requests; it does not guarantee final consistency. A production design should also consider a version or ETag, protection against an older response overwriting newer edits, retries, flushing before navigation, and explicit saving, saved, and failed states.

## Current gaps

- Luckysheet is loaded through `window`, so the application owns typing, script order, and version compatibility.
- The page shows no explicit unmount disposal, creating a risk of retained listeners or instances on re-entry.
- Resize rebuilds rather than adjusting lightly and may lose transient interaction state.
- `sopExpandProperty` is a JSON convention without visible full runtime schema validation.
- Removing `data` clearly reduces the payload; there is no measurement supporting a claimed number of megabytes.

## 30-second answer

> The LIMS SOP editor needed cells to carry experimental configuration. I treated Luckysheet as an imperative island: Vue owned the page and modals, while the SDK owned only its spreadsheet container. Right-click actions opened Vue forms and wrote the result back into each cell's `sopExpandProperty` JSON. Edits used a trailing 2-second debounce, and saving removed the reconstructable two-dimensional data matrix. Separately, my CLI copied and rewrote complete Vue or React templates as one-command project scaffolding; it did not generate individual business modules.

## Self-check

1. Can I state which state and DOM Vue owns and which Luckysheet owns?
2. Can I explain the complete right-click action → modal → JSON → cell write-back path?
3. Can I describe the 2-second debounce correctly without calling the default immediate?
4. Can I state that the CLI generates complete project templates without exaggerating it into a business-module generator?
5. Can I volunteer the disposal, runtime validation, and unmeasured-payload gaps?
