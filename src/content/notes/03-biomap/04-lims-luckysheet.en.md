---
title: "④ LIMS and an imperative SDK"
section: BioMap
---

# ④ LIMS and an imperative SDK

> **Resume line**
>
> Developed the **LIMS platform in Vue 3 and TypeScript** for sample management and SOP workflows, integrating the **Luckysheet SDK** and a **CLI for one-command project scaffolding**.

## What this bullet is about

**LIMS is a Laboratory Information Management System** — the internal system a biology lab uses to track samples and processes. **SOP is a Standard Operating Procedure**, i.e. the template describing "how many steps this experiment has and what gets filled in at each one".

There is really only one technically interesting thing in this bullet: **fitting an imperative third-party spreadsheet SDK into a declarative framework without the two fighting.**

⭐ **And it should be answered at the general level** — swap in an ECharts chart, the Monaco editor, a Mapbox map or an AG Grid table and **the handling is identical**. The interviewer is never asking "can you use Luckysheet", they are asking "**how do you make something you do not control coexist with your framework**".

## The 30-second version

> LIMS has an SOP template editor, which is essentially an online spreadsheet — lab staff configure, cell by cell, what each step must record and how it is validated. The grid is a third-party SDK, Luckysheet.
>
> **The difficulty is that its mental model is the opposite of Vue's**: Vue is declarative, you describe state and the framework decides the DOM; **Luckysheet is imperative, you hand it a container and from then on it changes that DOM however it likes**. Both sides believe they own that DOM.
>
> **The fix is to carve out an enclave**: give it an empty div that Vue never touches, **and open only two bridges across the border — grid to app through events, app to grid through explicit calls** — never letting the reactivity system cross.

## 1. The conflict in one sentence: both sides want to own the same DOM

| | Mental model | Who owns the DOM |
|---|---|---|
| **Vue / React (declarative)** | You **describe state** and the framework decides what the DOM looks like | ⭐ **The framework** — it may re-render or replace nodes at any moment |
| **Luckysheet / ECharts (imperative)** | You hand it a container, call `create()`, and from then on **you drive it by calling methods** | ⭐ **Itself** — it changes that DOM however it likes |

**The classic symptoms of not drawing the line**: one Vue re-render wipes out the DOM the SDK built; the SDK changes the DOM and Vue never finds out; **each side keeps its own copy of the state and they go out of sync.**

## 2. The fix: one enclave, two bridges

### ① Give it a bare container the framework never touches

```html
<div class="lucky-content" id="luckysheet" ref="lucky"></div>
```

⭐ **Note that this div contains nothing** — no interpolation, no `v-for`, no child components. **Vue's only job is to put that empty box on the page; everything inside it belongs to Luckysheet.**

```ts
const luckysheet = window.luckysheet;
```

**`window.luckysheet` tells you it came in through a global `<script>` tag, not an npm package.** The costs: **no type hints, no participation in bundling (so no optimisation), and you have to guarantee the script has loaded before use yourself.**

### ② App → grid: explicit calls

```ts
const setSheetSopJson = (data) => {
  const { columnIndex, rowIndex, cellUi, cellJson } = data;
  luckysheet.setCellValue(rowIndex, columnIndex, { m: cellUi, v: cellJson });
};
```

Once the Vue-side dialog has changed the data, it pushes the value into the grid explicitly by calling `setCellValue`. ⭐ **Not through automatic reactive syncing — the reactivity system has no idea what the grid looks like inside.**

### ③ Grid → app: events

**Luckysheet's context menu is the only entry point** — three custom menu items are attached:

```ts
cellRightClickConfig: {
  customs: [
    { title: 'SOP 配置JSON字段', onClick: (e, k, params) => { ...打开 Vue 的弹窗 } },
    { title: 'SOP 配置数据验证',  onClick: ... },
    { title: 'SOP Mark Fields',   onClick: ... },
  ],
}
```

The user right-clicks in the grid → the callback receives the row and column index → a Vue dialog opens.

⭐ **Those two bridges are the whole design: grid to app through events, app to grid through explicit calls. Beyond that the two sides never touch.**

### ④ Data syncs through a hook, not through reactivity

```ts
hook: { updated: handleUpdate }
```

**`hook.updated` is a callback Luckysheet provides — it fires once whenever the grid's contents change.**

## 3. Three engineering details worth extra credit

### ① Null out the cell data before saving

```ts
const handleUpdate = () => {
  const allSheets = luckysheet.getAllSheets();
  allSheets.forEach((sheet) => (sheet.data = undefined));   // ⭐
  saveSopTemplate(allSheets);
};
```

**In the objects `getAllSheets()` returns, `data` is the full two-dimensional cell matrix** — a large sheet can be several MB.

⭐ **But saving only needs the sheet's structure and configuration, not that rendering data** (it is recomputed next time it opens), so it is nulled out first. **That is a real payload optimisation, and volunteering it shows you hit the problem.**

### ② Saving is debounced by 2 seconds

```ts
const saveSopTemplate = debounce((data) => { ...发请求... }, 2000, { leading: false });
```

**"Debounce" means: on repeated triggers, run once only after they stop.** Continuous editing fires the `updated` hook constantly, and **without debouncing that is one request per keystroke**.

**What `leading: false` does**: the default debounce **runs once immediately** and then waits; false means **do not fire on the first trigger, wait 2 seconds after the user stops**. ⭐ **Which is right for saving — firing on the first trigger is pointless, because the user is still editing.**

### ③ "A width change under 20px is jitter; do not rebuild"

```ts
const onResize = debounce((entries) => {
  const targetInfo = entries[0].contentRect;
  isMicroChange = Math.abs(targetInfo.width - lastViewport.value.width) < 20;
  isInit || isMicroChange ? (isInit = false) : initSop();   // ← rebuild only on a real change
  lastViewport.value = targetInfo;
}, 600, { leading: false });
```

**Background**: Luckysheet handles resizing badly, so a viewport change means calling `create()` and **rebuilding the whole thing**. ⭐ **And rebuilding is expensive — the entire sheet re-renders and the user's selection is lost.**

**So there are two gates**: a **600 ms debounce** plus a **20-pixel dead zone**. A scrollbar appearing or disappearing, or a few pixels of browser chrome adjustment, is filtered out.

⭐ **This is a good example of "I knew the cost so I added a threshold" — not blindly reacting to every resize.**

## 4. What that CLI actually is (the honest version)

The `a CLI for one-command project scaffolding` on the resume refers to a **project scaffolding command-line tool**: one command generates the directory skeleton for a new page or module — view files, route registration, the API layer and type definitions all laid out per the team's conventions.

**Its value is not technical, it is consistency**: ⭐ **a new hire does not have to ask "where do files go in this project, what is the naming convention" — the tool just produces the right answer.**

> **Do not oversell it when pushed**: it is a template renderer; technically it **reads templates, substitutes variables and writes files**. **What is worth discussing is that it is the same thing as [② Architectural boundaries](/docs?section=biomap&item=architecture-boundaries)** — **the scaffold makes "laid out right from the start" easy, and the ESLint rules make "laid out wrong later" impossible. One at the entrance, one at the exit.**

## 5. Production grade, and how it would be done now

| Today | Problem | Better |
|---|---|---|
| `window.luckysheet` global script | No types, not bundled, load order is your problem | Use a library with an npm package and type definitions; or write your own typed wrapper layer |
| **The whole chain crammed into one `.vue` file** | View code and SDK lifecycle management are tangled together | ⭐ **Extract a `useLuckysheet()` composable** — it manages creation, disposal and resizing internally and **exposes only events and methods** |
| Adapting to size changes by rebuilding | Rebuilding is expensive and loses the selection | Look for the SDK's own `resize()` API first; fall back to rebuilding only if there is none |
| ⚠️ **No explicit disposal** | Navigating away may leak | Dispose the instance and unbind observers in the unmount hook |

> ⭐ **The one-paragraph answer**
>
> "The conflict between an imperative SDK and a declarative framework is one sentence — **both want to own the same piece of the DOM**. The fix is to carve out an enclave: give it an empty div Vue never touches, then **cross the boundary only through two bridges — grid to app through events, app to grid through explicit calls** — and never let the reactivity system through. Data syncs through the SDK's own update hook, and before saving I null out the several-MB cell matrix and keep only the structure. **ECharts, Monaco and Mapbox get handled exactly the same way.** If I did it now I would pull all of this into a composable, with creation, disposal and resizing sealed inside it rather than spread across the view file."

## Glossary

| 中文 | English |
|---|---|
| 声明式 ↔ 命令式 | **declarative ↔ imperative** |
| 第三方 SDK | third-party SDK |
| 飞地 / 划一块 DOM 出去 | **enclave** (*carve out a DOM enclave*) |
| 裸容器 / 空 div | plain container · **unmanaged DOM node** |
| 交界处 / 边界 | **boundary** (*only cross the boundary through events and explicit calls*) |
| 桥 | **bridge** |
| 显式调用 | **explicit call** |
| 响应式系统 | **reactivity system** |
| 生命周期钩子 | **lifecycle hook** |
| 组合式函数 | **composable** (Vue) · custom hook (React) |
| 卸载时销毁 | **dispose / tear down on unmount** |
| 内存泄漏 | **memory leak** |
| 防抖 ↔ 节流 | **debounce ↔ throttle** |
| 死区 / 阈值 | **dead zone · threshold** |
| 重建 | **rebuild / re-initialise** |
| 选区 | **selection** (*rebuilding loses the user's selection*) |
| 脚手架 | **scaffolding** (*a CLI for one-command project scaffolding*) |

> ⭐ **The two easiest to get wrong**:
>
> 1. "An imperative SDK and a declarative framework fight over the same DOM" is **both want to own the same piece of the DOM** — `own` is the key word
> 2. "Scaffolding" is the word on the resume; do not say `framework` or `template tool`
