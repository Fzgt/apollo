---
title: "Day 5 · 命令式 SDK 与框架共处"
tier: ref
section: BioMap · Day 5
icon: microscope
day: 5
level: B
status: done
---

# Day 5 · 命令式 SDK 与框架共处（速查）

> ⚪ **这一问要往通用高度答**：换成 ECharts、Monaco、Mapbox、AG Grid 是完全一样的处理方式。
>
> 代码：`biomap-web-lims/src/views/sop/sop-edit/index.vue`，整条链路都在这一个文件里。

## 冲突就一句话

**两边都想拥有同一块 DOM。**

| | 心智模型 |
|---|---|
| **Vue / React** | 声明式：你描述状态，**DOM 归框架管** |
| **Luckysheet / ECharts / Monaco** | 命令式：`create(container)` 之后，**这块 DOM 归它管** |

不划界的症状：Vue 重渲染把 SDK 的 DOM 冲掉、SDK 改了 DOM 框架不知道、两边各存一份状态然后不同步。

## 解法：划飞地，交界处只开两座桥

| 做法 | 代码 |
|---|---|
| **给它一个框架完全不碰的裸容器** | `:9` `<div id="luckysheet" ref="lucky"></div>`——**里面没有插值、没有 v-for、没有子组件** |
| **应用 → 表格：显式调用** | `:53-56` `luckysheet.setCellValue(...)`，**不靠响应式自动同步** |
| **表格 → 应用：事件** | `:139-178` 右键菜单挂三个自定义项，回调里拿 `rowIndex/columnIndex` 打开 Vue 弹窗 |
| **数据同步靠 hook** | `:180-182` `hook: { updated: handleUpdate }` |

> **`window.luckysheet`（`:35`）是全局脚本不是 npm 包**——代价是没类型、不参与打包、要自己保证加载时序。

## 三个能当加分点的细节

| 细节 | 代码 | 为什么 |
|---|---|---|
| **存之前把 `sheet.data` 置空** | `:95-100` | `getAllSheets()` 里 `data` 是**完整的二维单元格矩阵**，一张大表几 MB。保存只要结构和配置，**不需要渲染数据** |
| **保存 2 秒防抖，`leading: false`** | `:74-93` | 连续编辑会疯狂触发 `updated`。不在第一次就发——**对保存这种操作，第一次发没有意义** |
| **「宽度变化 < 20px 算抖动，不重建」** | `:186-206` | Luckysheet 尺寸自适应差，视口变了要 `create()` 重建，**而重建代价大还会丢选区**。所以 600ms 防抖 + 20px 死区，挡掉滚动条出现/消失这类几像素的抖动 |

> 最后一条是很好的**「我知道代价所以加了阈值」**的例子——不是无脑响应每次 resize。

## 生产级会怎么做

| 现状 | 更好的做法 |
|---|---|
| `window.luckysheet` 全局脚本 | 用有 npm 包和类型的库；或自己写一层 `.d.ts` |
| 整条链路挤在一个 `.vue` 里 | **抽成 `useLuckysheet()` composable**，把 create/destroy/resize 封进去，对外只暴露事件和方法 |
| 靠重建适应尺寸 | 优先找 SDK 自己的 `resize()` API |
| 没有显式 destroy | `onBeforeUnmount` 里销毁实例、解绑 observer |
