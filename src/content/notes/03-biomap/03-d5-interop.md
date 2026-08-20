---
title: "Day 5 · 命令式 SDK 与框架共处"
tier: ref
section: BioMap · Day 5
icon: microscope
day: 5
level: B
status: done
---

# Day 5 · 参考 · Luckysheet 怎么和 Vue 共处

> ⚪ **速查**。回答 **Q5**。对应 bullet ①（LIMS / Vue 3 / Luckysheet / CLI）。
>
> **这一问的价值在于它是个通用问题**：**声明式框架怎么容纳一个命令式的第三方 SDK。** 换成 ECharts、Monaco、Mapbox、AG Grid 是完全一样的答法——**答的时候要往这个高度上抬。**

## 对应简历原句

> **Developed the LIMS platform in Vue 3 and TypeScript** for sample management and SOP workflows, **integrating the Luckysheet SDK** and a CLI for one-command project scaffolding.

代码：`~/Desktop/BioMap/biomap-web-lims/src/views/sop/sop-edit/index.vue`——**整条链路都在这一个文件里。**

---

## 冲突在哪

| | 心智模型 |
|---|---|
| **Vue / React** | **声明式**：你描述状态，框架决定 DOM 长什么样。**DOM 归框架管** |
| **Luckysheet / ECharts / Monaco** | **命令式**：`create(container)` 之后，**这块 DOM 归它管**，你只能调方法 |

**两边都想拥有同一块 DOM——这就是冲突的全部。**

**如果不划清界限，典型症状是**：Vue 重渲染把 SDK 的 DOM 冲掉、SDK 改了 DOM 而 Vue 不知道、双方各自维护一份状态然后不同步。

---

## 解法：划一块飞地，交界处只走事件和显式调用

### ① 给它一个 Vue 不管的裸容器

```html
<!-- index.vue:9 -->
<div class="!mt-15 lucky-content" id="luckysheet" ref="lucky"></div>
```

**注意这个 div 里什么都没有**——没有插值、没有 `v-for`、没有子组件。**Vue 只负责把它放在那儿，里面的一切归 Luckysheet。**

```ts
const luckysheet = window.luckysheet;   // :35  全局脚本，不是 npm 包
```

> **`window.luckysheet` 这个细节值得提**：它是通过全局 script 引入的，不参与打包。**代价是没有类型、没有 tree shaking、要自己保证加载时序。**

### ② 「应用 → 表格」的桥：显式调用

```ts
// :53-56
const setSheetSopJson = (data) => {
  const { columnIndex, rowIndex, cellUi, cellJson } = data;
  luckysheet.setCellValue(rowIndex, columnIndex, { m: cellUi, v: cellJson });
};
```

**Vue 侧的弹窗改完数据，通过 `setCellValue` 明确地推给表格。不是靠响应式自动同步。**

### ③ 「表格 → 应用」的桥：事件

Luckysheet 的右键菜单是唯一的入口（`:139-178`）——挂了三个自定义项：

```ts
cellRightClickConfig: {
  customs: [
    { title: 'SOP 配置JSON字段', onClick: (e, k, params) => { ...openModal(...) } },
    { title: 'SOP 配置数据验证',  onClick: ... },
    { title: 'SOP Mark Fields',   onClick: ... },
  ],
}
```

**用户在表格里右键 → 回调里拿到 `rowIndex/columnIndex` → 打开 Vue 的弹窗。**

> **这两座桥是这个设计的全部**：**表格 → 应用走事件，应用 → 表格走显式调用。除此之外两边互不触碰。**

### ④ 数据同步靠 hook，不靠响应式

```ts
// :180-182
hook: { updated: handleUpdate }
```

```ts
// :95-100
const handleUpdate = () => {
  const allSheets = luckysheet.getAllSheets();
  allSheets.forEach((sheet) => (sheet.data = undefined));   // ⭐
  saveSopTemplate(allSheets);
};
```

**`sheet.data = undefined` 这行值得讲**：`getAllSheets()` 返回的对象里，`data` 是**完整的二维单元格矩阵**——一张大表可能是几 MB。**保存时只需要结构和配置，不需要这份渲染数据，所以存之前置空。**

**这是个真实的体积优化，能主动说出来说明你踩过。**

---

## 两个工程细节（都能当加分点）

### 保存做了 2 秒防抖

```ts
// :74-93
const saveSopTemplate = debounce((data) => { ...putSopTemplate(...) }, 2000, { leading: false });
```

**用户连续编辑会疯狂触发 `updated` hook**，不防抖就是每敲一个字发一个请求。`leading: false` 意味着**不在第一次就发，等停手 2 秒再发**——对保存这种操作是对的（第一次就发没有意义）。

### 「宽度变化小于 20px 算抖动，不重建」

```ts
// :186-206
const onResize = debounce((entries) => {
  const targetInfo = entries[0].contentRect;
  lastViewport.value &&
    (isMicroChange = Math.abs(targetInfo.width - lastViewport.value.width) < 20);
  isInit || isMicroChange ? (isInit = false) : initSop();   // ← 只有真的变了才重建
  lastViewport.value = targetInfo;
}, 600, { leading: false });
```

**Luckysheet 的尺寸自适应不好，视口变了要 `luckysheet.create()` 重建。但重建代价很大（整张表重新渲染，还会丢选区）。**

**所以加了两道闸：600 ms 防抖 + 20px 的死区。** 滚动条出现/消失、浏览器 UI 微调这类几像素的抖动被挡在外面。

> **这是个很好的「我知道代价所以加了阈值」的例子**——不是无脑响应每一次 resize。

---

## ③ 生产级 / 现在会怎么做

| 现状 | 问题 | 更好的做法 |
|---|---|---|
| `window.luckysheet` 全局脚本 | 没类型、不参与打包、要自己管加载时序 | 用有 npm 包和类型定义的库；或者自己写一层 `.d.ts` 包装 |
| 整条链路挤在一个 `.vue` 文件里 | 视图和 SDK 生命周期管理混在一起 | **抽成一个 `useLuckysheet()` composable**：内部管 create/destroy/resize，对外只暴露事件和方法 |
| 靠 `initSop()` 重建来适应尺寸 | 重建代价大，会丢选区 | 优先找 SDK 自己的 `resize()` API；没有才退回重建 |
| 没有显式 destroy | 路由切走可能泄漏 | `onBeforeUnmount` 里销毁实例、解绑 observer |

> **一句话答法**：命令式 SDK 和声明式框架的冲突就一句话——**两边都想拥有同一块 DOM**。解法是划一块飞地：给它一个 Vue 完全不碰的裸 div，然后**只在交界处开两座桥——表格到应用走事件（右键菜单回调），应用到表格走显式调用（`setCellValue`）**，绝不让响应式系统穿过边界。数据同步靠它的 `updated` hook，存之前把几 MB 的单元格矩阵置空只留结构。**换成 ECharts、Monaco、Mapbox 是完全一样的处理方式。** 现在做的话我会把这套抽成一个 composable，把 create / destroy / resize 的生命周期封在里面，而不是摊在视图文件里。
