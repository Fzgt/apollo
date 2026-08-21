---
title: "① 命令式 SDK 与框架共处"
tier: ref
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# Luckysheet 和 Vue 怎么共处

> ⚪ **速查**。⭐ **这一问要往通用高度答** —— 换成 ECharts、Monaco 编辑器、Mapbox 地图、AG Grid 表格，**处理方式完全一样**。
>
> 代码：`biomap-web-lims/src/views/sop/sop-edit/index.vue`，整条链路都在这一个文件里。

## 一、冲突就一句话：两边都想拥有同一块 DOM

**先说清「声明式」和「命令式」的区别：**

| | 心智模型 | 谁拥有 DOM |
|---|---|---|
| **Vue / React（声明式）** | 你**描述状态**，框架决定 DOM 长什么样 | **框架** —— 它随时可能重新渲染、替换节点 |
| **Luckysheet / ECharts（命令式）** | 你给它一个容器，调 `create()`，之后**调方法指挥它** | **它自己** —— 它在那块 DOM 里想怎么改就怎么改 |

**冲突就在这：两边都认为那块 DOM 归自己管。**

**不划清界限的典型症状**：Vue 一次重新渲染把 SDK 建好的 DOM 冲掉了；SDK 改了 DOM 但 Vue 不知道；两边各存一份状态然后不同步。

## 二、解法：划一块飞地，交界处只开两座桥

### ① 给它一个框架完全不碰的裸容器

```html
<!-- index.vue:9 -->
<div class="lucky-content" id="luckysheet" ref="lucky"></div>
```

> ⭐ **注意这个 div 里什么都没有** —— 没有插值、没有 `v-for`、没有子组件。**Vue 只负责把这个空盒子放在页面上，里面的一切归 Luckysheet。**

```ts
const luckysheet = window.luckysheet;   // :35
```

**`window.luckysheet` 说明它是通过全局 `<script>` 标签引进来的，不是 npm 包。** 代价是：**没有类型提示、不参与打包（也就不会被优化）、要自己保证脚本加载完了才能用。**

### ② 应用 → 表格：显式调用

```ts
// :53-56
const setSheetSopJson = (data) => {
  const { columnIndex, rowIndex, cellUi, cellJson } = data;
  luckysheet.setCellValue(rowIndex, columnIndex, { m: cellUi, v: cellJson });
};
```

**Vue 这边的弹窗改完数据，通过调 `setCellValue` 明确地把值推给表格。** ⭐ **不是靠响应式自动同步** —— 响应式系统根本不知道表格内部长什么样。

### ③ 表格 → 应用：事件

**Luckysheet 的右键菜单是唯一的入口**（`:139-178`）—— 挂了三个自定义菜单项：

```ts
cellRightClickConfig: {
  customs: [
    { title: 'SOP 配置JSON字段', onClick: (e, k, params) => { ...打开 Vue 的弹窗 } },
    { title: 'SOP 配置数据验证',  onClick: ... },
    { title: 'SOP Mark Fields',   onClick: ... },
  ],
}
```

**用户在表格里右键 → 回调里拿到行号列号 → 打开 Vue 的弹窗。**

> ⭐ **这两座桥就是这个设计的全部：表格 → 应用走事件，应用 → 表格走显式调用。除此之外两边互不触碰。**

### ④ 数据同步靠钩子，不靠响应式

```ts
// :180-182
hook: { updated: handleUpdate }
```

**`hook.updated` 是 Luckysheet 提供的回调 —— 表格内容变了它就调一次。**

## 三、三个能当加分点的工程细节

### ① 存之前把单元格数据置空

```ts
// :95-100
const handleUpdate = () => {
  const allSheets = luckysheet.getAllSheets();
  allSheets.forEach((sheet) => (sheet.data = undefined));   // ⭐
  saveSopTemplate(allSheets);
};
```

**`getAllSheets()` 返回的对象里，`data` 是完整的二维单元格矩阵** —— 一张大表可能是几 MB。

**而保存时只需要表格的结构和配置，不需要这份渲染数据**（下次打开会重新算），所以存之前把它置空。

> **这是个真实的体积优化，能主动说出来说明你踩过。**

### ② 保存做了 2 秒防抖

```ts
// :74-93
const saveSopTemplate = debounce((data) => { ...发请求... }, 2000, { leading: false });
```

**「防抖」的意思是：连续触发时只在停下来之后执行一次。**

**为什么需要**：用户连续编辑会疯狂触发 `updated` 钩子，不防抖就是**每敲一个字发一个请求**。

**`leading: false` 是什么**：默认的防抖会**先执行一次**再等；设成 false 表示**不在第一次就发，等停手 2 秒再发**。**对保存这种操作是对的** —— 第一次就发没有意义，因为用户还在改。

### ③ 「宽度变化小于 20px 算抖动，不重建」

```ts
// :186-206
const onResize = debounce((entries) => {
  const targetInfo = entries[0].contentRect;
  isMicroChange = Math.abs(targetInfo.width - lastViewport.value.width) < 20;
  isInit || isMicroChange ? (isInit = false) : initSop();   // ← 只有真的变了才重建
  lastViewport.value = targetInfo;
}, 600, { leading: false });
```

**背景**：Luckysheet 的尺寸自适应做得不好，视口变了要调 `luckysheet.create()` **整个重建**。**而重建代价很大** —— 整张表重新渲染，还会丢掉用户的选区。

**所以加了两道闸**：**600 毫秒防抖** + **20 像素的死区**。滚动条出现/消失、浏览器界面微调这类几像素的抖动被挡在外面。

> ⭐ **这是个很好的「我知道代价所以加了阈值」的例子** —— 不是无脑响应每一次 resize。

## 四、生产级 / 现在会怎么做

| 现状 | 问题 | 更好的做法 |
|---|---|---|
| `window.luckysheet` 全局脚本 | 没类型、不参与打包、要自己管加载时序 | 用有 npm 包和类型定义的库；或者自己写一层类型声明包装 |
| **整条链路挤在一个 `.vue` 文件里** | 视图和 SDK 的生命周期管理混在一起 | ⭐ **抽成一个 `useLuckysheet()` 组合式函数** —— 内部管创建/销毁/尺寸变化，**对外只暴露事件和方法** |
| 靠重建来适应尺寸 | 重建代价大，会丢选区 | 优先找 SDK 自己的 `resize()` 接口；没有才退回重建 |
| **没有显式销毁** | 路由切走可能泄漏 | 在组件卸载的钩子里销毁实例、解绑观察器 |

> ⭐ **一句话答法**
>
> 「命令式 SDK 和声明式框架的冲突就一句话 —— **两边都想拥有同一块 DOM**。解法是划一块飞地：给它一个 Vue 完全不碰的空 div，然后**只在交界处开两座桥 —— 表格到应用走事件（右键菜单回调），应用到表格走显式调用**，绝不让响应式系统穿过边界。数据同步靠它自己的更新钩子，存之前把几 MB 的单元格矩阵置空只留结构。**换成 ECharts、Monaco、Mapbox 是完全一样的处理方式。** 现在做的话我会把这套抽成一个组合式函数，把创建、销毁、尺寸变化的生命周期封在里面，而不是摊在视图文件里。」
