---
title: "④ LIMS: adding Luckysheet to Vue"
section: BioMap
---

# ④ LIMS: adding Luckysheet to Vue

> **Resume line**
>
> Developed the LIMS platform in **Vue 3 and TypeScript** for sample management and SOP workflows, extending the Luckysheet SDK with **custom cell actions and a per-cell JSON contract**, plus a scaffolding CLI.

> ✅ **Evidence limit**: the Luckysheet and SOP code can be checked in the real BioMap repository. You confirmed that you also worked on the CLI, but the local CLI Git history does not show your commits. In an interview, explain only the parts you truly worked on and can describe. Do not say you were the only author of the CLI.

## What this bullet needs to show

This bullet has two topics: how Luckysheet was added to a Vue page, and how the CLI reduced repeated setup for new projects. Keep the main answer near 30 seconds. Explain saving and resize details only when asked.

## First layer: answer these clearly

### 1. What are LIMS and SOP?

A LIMS is a laboratory information management system for samples, work steps, and results. An SOP is a standard operating procedure. This page needed to store experiment settings on spreadsheet cells, so it was more than a normal data table.

### 2. How was Luckysheet added to Vue?

The page provides an empty `<div>` and creates the spreadsheet through `window.luckysheet.create(...)`. Vue owns page state, modals, and API data. Luckysheet owns the spreadsheet DOM inside the container. Events and SDK methods pass data between them.

### 3. What were the custom cell actions?

The code adds 3 right-click actions through `cellRightClickConfig.customs`. An action opens a Vue modal. After the user finishes the form, `setCellValue` writes the data back to the selected cell.

### 4. What was the per-cell JSON contract?

Each cell can store `sopExpandProperty`, including business fields such as `analyseMethod` and `dataBackFill`. `MarkModal.vue` turns the object into JSON for editing, then parses it and writes it back to the cell.

The current code uses `JSON.parse` but has no full schema check. Invalid JSON needs clearer error handling.

### 5. How were edits saved?

Luckysheet's `updated` hook starts the save flow. The code reads all sheets, removes the two-dimensional `data` field that can be rebuilt, and then calls the API. Saving uses a trailing 2-second debounce, so a request is not sent after every small edit.

### 6. Why did resize need extra work?

The page uses ResizeObserver with a 600ms debounce. A width change below 20px does not rebuild the spreadsheet, which filters small layout changes caused by modals and page movement. Other size changes call `create()` again.

### 7. What did the CLI do?

The CLI uses questions to choose and copy a full Vue or React project template. It changes the project name, HTML app id, entry selector, and dotfiles. It sets up a new project; it does not add one business page to an existing project.

The local history shows another teammate as the original CLI author. You confirmed that you worked on it, so be clear about the exact part you changed or maintained. Do not describe the whole CLI as solo work.

## Second layer: useful concepts

### Why does Vue not manage the spreadsheet's inner DOM?

Luckysheet creates and updates that DOM itself. If Vue also manages the same area, the two update systems can conflict. The simple boundary is to give the full container to the SDK and let Vue talk to it through public methods.

### Does debounce make saving safe?

No. It only reduces requests. A stronger design also handles save failures, old requests replacing newer data, the last save before leaving the page, and clear saving or failed states.

### What else should this SDK setup include?

Setup, events, data updates, resize, errors, and cleanup should sit in an adapter or composable. The page has no clear Luckysheet cleanup step, so an old instance or event listener may remain after the user leaves and returns.

## 30-second answer

> The LIMS SOP page needed to store experiment settings on spreadsheet cells. I gave Luckysheet its own container: Vue handled the page and modals, while the SDK handled the spreadsheet. Three right-click actions opened Vue forms and wrote the result back into each cell's `sopExpandProperty` JSON. Edits used a trailing 2-second debounce, and saving removed the two-dimensional data field that could be rebuilt. The CLI reduced setup work by copying Vue or React project templates.

## Self-check

1. Can I explain what Vue owns and what Luckysheet owns?
2. Can I explain the full right-click action, modal, JSON, and cell update flow?
3. Can I explain the 2-second save debounce and 600ms resize debounce?
4. Can I explain that the CLI creates a full project rather than one business module?
5. Can I state my exact CLI work without calling myself the only author?
