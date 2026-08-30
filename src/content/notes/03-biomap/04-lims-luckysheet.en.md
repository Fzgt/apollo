---
title: "④ LIMS: keeping an imperative grid inside a Vue boundary"
section: BioMap
---

# ④ LIMS: keeping an imperative grid inside a Vue boundary

> **Resume line**
>
> Developed the **LIMS platform in Vue 3 and TypeScript** for sample management and SOP workflows, extending the **Luckysheet SDK with custom cell actions and a per-cell JSON contract**, plus a scaffolding CLI.

## What this line has to show

Two things: **how a global, imperative grid SDK gets wired into a reactive Vue page**, and **what the CLI automated**. That is your 30 seconds. Saving, resize and teardown come out only if they ask.

## Layer one: answer these without thinking

### 1. What are LIMS and SOP?

LIMS is a laboratory information management system. It tracks samples, workflows and results. SOP means standard operating procedure. On the SOP editing page the grid does not just show data — each cell also carries experiment steps, analysis methods and data write-back settings. A normal table component cannot do that, which is why we used Luckysheet.

### 2. How does Luckysheet get into Vue?

Give the SDK an empty container, then create it imperatively:

```ts
const lucky = ref(null);

const initSop = async () => {
  const metaData = await loadExcelMetadata();
  luckysheet.create(initOptions(metaData));
};

initSop();
```

**The boundary is the point.** Vue owns page state, modals and business data. Luckysheet owns the grid DOM inside the container. The two only talk through SDK methods and hooks. Vue never renders the SDK's internal DOM — two rendering systems writing to the same DOM always ends badly.

### 3. What are the custom cell actions?

Three right-click actions registered on `cellRightClickConfig.customs`:

```ts
cellRightClickConfig: {
  customs: [
    {
      title: 'SOP config JSON field',
      onClick: (e, k, params) => {
        const { rowIndex, columnIndex } = params;
        const v = luckysheet.getCellValue(rowIndex, columnIndex, { type: 'v' });
        const m = luckysheet.getCellValue(rowIndex, columnIndex, { type: 'm' });
        openModal(true, { ...params, m, v });
      },
    },
    { title: 'SOP data validation', onClick: (e, k, params) => openVerify(true, { ...params }) },
    { title: 'SOP Mark Fields',     onClick: (e, k, params) => openMark(true,   { ...params }) },
  ],
},
```

The chain is: **right-click → SDK hands over the coordinates → open a Vue modal → user fills the form → write back into the cell**.

```ts
const setSheetSopJson = ({ columnIndex, rowIndex, cellUi, cellJson }) => {
  luckysheet.setCellValue(rowIndex, columnIndex, { m: cellUi, v: cellJson });
};
```

`m` is the displayed value the user sees. `v` is the real stored value. The SDK only provides the trigger point and the write method; the complex form stays a Vue component.

### 4. What is the per-cell JSON contract?

Business metadata hangs off the cell as `sopExpandProperty`, holding fields like `analyseMethod` and `dataBackFill`. `MarkModal.vue` turns it into JSON for editing, then parses it back on save:

```ts
// open: object → formatted JSON text
sopExpandProperty.value = JSON.stringify(data, null, 2);

// save: text → object → write back into that cell
setMark({
  ...params,
  sopExpandProperty: JSON.parse(sopExpandProperty.value),
});
```

```ts
const setMark = ({ columnIndex, rowIndex, sopExpandProperty }) => {
  luckysheet.setCellValue(rowIndex, columnIndex, { sopExpandProperty });
};
```

The gain: **the visible cell value and the business config behind it stay separate**, and the config is saved, exported and restored along with the SOP template.

Say the cost yourself: this is a project convention, and there is no schema validation around that `JSON.parse`. Broken JSON needs a clearer error path. That is a real gap.

### 5. How does saving work?

It hangs off Luckysheet's `updated` hook, and strips the rebuildable matrix before sending:

```ts
const handleUpdate = () => {
  const allSheets = luckysheet.getAllSheets();
  allSheets.forEach((sheet) => (sheet.data = undefined));   // data rebuilds from celldata, no need to upload
  saveSopTemplate(allSheets);
};

const saveSopTemplate = debounce(
  (data) => putSopTemplate({ sopTemplateConfigId: Number(sopId), config: data })
    .then(() => message.success('Saved')),
  2000,
  { leading: false },
);
```

`sheet.data` is the two-dimensional matrix used for rendering. It can be rebuilt from `celldata` and it is far bigger, so it is dropped before the request.

Saving runs on a **2-second trailing debounce**: continuous edits collapse into one call, sent 2 seconds after the user stops.

> `{ leading: false }` just makes the default explicit. lodash `debounce` is trailing by default (`leading: false, trailing: true`) — it does **not** fire immediately. **This gets asked, so do not get it backwards.** Firing immediately is `throttle`, or `debounce` with `leading: true` set on purpose.

### 6. Why does resize need its own handling?

Luckysheet works out grid sizes at creation time, so a changed container means a rebuild. But ResizeObserver fires constantly:

```ts
const onResize = debounce(
  (entries) => {
    const targetInfo = entries[0].contentRect;
    lastViewport.value &&
      (isMicroChange = Math.abs(targetInfo.width - lastViewport.value.width) < 20);
    isInit || isMicroChange ? (isInit = false) : initSop();
    lastViewport.value = targetInfo;
  },
  600,
  { leading: false },
);

useResizeObserver(lucky, onResize);
```

Two gates: a **600ms debounce** collapses the bursts, and **a width change under 20px counts as jitter** and is skipped. Opening a modal or a scrollbar appearing will not rebuild the whole grid.

State the cost too: a rebuild is heavy and throws away the current selection and edit state. Better would be an SDK resize API that adjusts size without recreating.

### 7. What did the CLI do?

`@biomap/cli` used Commander with interactive prompts to pick a template, copied a full Vue or React project skeleton, restored the dotfiles, then rewrote the package name, the HTML app id and the mount selector.

It is a **project scaffold** — it removes the repeated setup work when starting a new project. It is not a module generator that adds a page, route, API and types to an existing project. Get that distinction right; overstating it is easy to catch.

## Layer two: extra background

### Why not let Vue manage the grid's internal DOM?

Luckysheet creates and updates its own DOM. If Vue's virtual DOM also diffs the same subtree, the two update mechanisms overwrite each other and you get missing nodes and corrupted state — the kind of bug that takes days. The clean boundary is: the whole container belongs to the SDK, and Vue talks to it only through public methods and events.

### The standard boundary for an imperative SDK

Six things belong in one adapter or composable: creation, event bridging, data sync, resize, error handling and teardown. Page components should consume business meaning, not reach for `window.luckysheet` all over the place.

There is no explicit dispose on unmount in this page, so leaving and re-entering risks leftover instances and listeners. That is a fair gap to raise yourself.

### Does debounce make saving reliable?

No. It only cuts the number of requests; it does not guarantee the final state is correct. Production also needs a version number or ETag so a slow old response cannot overwrite a newer edit, retries on failure, a flush of the last change before leaving the page, and a visible "saving / saved / failed" state.

## The 30-second answer

> The SOP editing page in LIMS had to carry experiment config on individual cells, so I treated Luckysheet as an imperative island: it gets an empty container, Vue owns the page and the modals, the SDK owns the grid DOM, and they only talk through methods and hooks. I added three right-click actions on `cellRightClickConfig.customs`; each opens a Vue form and writes the result back into the cell's `sopExpandProperty` JSON with `setCellValue`. Saving hangs off the `updated` hook on a 2-second trailing debounce, and drops the rebuildable two-dimensional data before sending. Resize is gated by a 600ms debounce plus a 20px threshold so small jitter never rebuilds the grid. The CLI I built is a project scaffold — it copies and rewrites a whole Vue or React template so a new project starts configured.

## Self-check

1. Can you say what state and DOM Vue owns, what Luckysheet owns, and why they must not mix?
2. Can you walk the full chain: right-click → modal → JSON → `setCellValue` write-back?
3. Can you explain the difference between `m` and `v`?
4. Can you state correctly that lodash `debounce` is trailing by default, not immediate?
5. Can you explain what the 2-second save debounce and the 600ms + 20px resize gates each block?
6. Can you keep the CLI described as a project scaffold, not a module generator?
7. Can you raise the dispose, schema validation and resize-rebuild gaps yourself?
