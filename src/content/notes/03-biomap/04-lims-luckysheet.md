---
title: "④ LIMS：把命令式表格关进 Vue 边界"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ④ LIMS：把命令式表格关进 Vue 边界

> **简历原句**
>
> 使用 **Vue 3 + TypeScript** 开发 LIMS 平台，支持样本管理和 SOP 流程；扩展 Luckysheet SDK，加入**自定义单元格操作和逐单元格 JSON 契约**，并开发脚手架 CLI。

> ✅ **证据边界**：这一篇有真实 BioMap 仓库可以核对：`biomap-web-lims` 和 `biomap-cli`。但别把代码没有测量过的效果编成数字。

## 先立住：这条只需要两件事

1. 我怎样把一个全局、命令式的表格 SDK 接进 Vue 的响应式页面。
2. CLI 到底自动化了什么。

主回答到这里展开 30 秒就够了；只有面试官继续问，才进入保存、resize 和 SDK 生命周期。

## 第一层：必须答顺

### 1. LIMS 和 SOP 是什么？

LIMS 是实验室信息管理系统，负责样本、流程和结果记录。SOP 是标准操作流程。在这个页面里，表格不只是展示数据，还承载实验步骤、分析方法和数据回填配置，所以普通表格单元格不够用。

### 2. Luckysheet 是怎样接进 Vue 的？

`sop-edit/index.vue` 给 SDK 一个空容器，再通过 `window.luckysheet.create(...)` 命令式初始化。Vue 管页面状态、弹窗和业务数据；Luckysheet 管容器内部表格。双方通过明确方法和事件交换数据，不让 Vue 同时声明式渲染 SDK 内部 DOM。

### 3. “自定义单元格操作”具体是什么？

页面向 `cellRightClickConfig.customs` 注册了 3 个右键动作。用户从单元格打开 Vue 弹窗，编辑业务信息后，再用 `setCellValue` 把结果写回表格。SDK 提供触发点，复杂表单仍由 Vue 组件负责。

### 4. “逐单元格 JSON 契约”是什么？

业务元数据存放在单元格的 `sopExpandProperty` 中，包括 `analyseMethod`、`dataBackFill` 等字段。`MarkModal.vue` 用 JSON 编辑器读写它。这样可见单元格值和业务配置有明确边界，也能随 SOP 模板一起保存和恢复。

它是项目内部约定，不代表已有完整 schema 校验；损坏 JSON 仍需要错误提示和校验策略。

### 5. 保存为什么不直接上传整个 Luckysheet 对象？

`updated` hook 触发保存前，代码取得所有 sheets，并移除可重建的 `data` 二维矩阵，避免把重复且体积大的运行时数据一起传输。保存使用尾沿 2 秒 debounce：连续编辑会合并，用户停下后再提交。

旧笔记说 lodash debounce 默认“立即执行”，这是错的；默认就是尾沿执行，`leading: false` 只是把意图写明。

### 6. CLI 到底生成什么？

`@biomap/cli` 通过 Commander 和交互提示选择模板，复制一套完整 Vue 或 React 项目，恢复 dotfiles，并改写 package name、HTML app id 和入口 selector。它是**项目脚手架**，不是为现有项目生成一个页面、路由、API 和类型文件的模块生成器。

## 第二层：继续追问时再讲

### resize 为什么需要特殊处理？

页面对 ResizeObserver 做 600ms debounce，并忽略宽度变化小于 20px 的抖动，避免频繁重建表格。这个策略能止住噪声，但重建仍然偏重；更理想的是 SDK 提供可靠的 resize API，并保留当前选区和编辑状态。

### 命令式 SDK 的标准集成边界是什么？

初始化、事件桥接、数据同步、尺寸变化、错误处理和销毁都应被封进 adapter 或 composable。页面组件只消费业务语义，不应到处直接访问全局 SDK。

### 保存怎样做得更可靠？

debounce 只能减少请求，不保证最终一致。生产上还要考虑版本号或 ETag、防止旧响应覆盖新编辑、失败重试、离开页面前 flush，以及明确的“保存中 / 已保存 / 保存失败”状态。

## 当前实现的缺口

- Luckysheet 通过 `window` 全局加载，类型声明、脚本加载顺序和版本都由应用自己承担。
- 当前页面没有看到显式的 unmount dispose；重进页面时存在监听器或实例残留风险。
- resize 走重建而不是轻量调整，可能丢失临时交互状态。
- `sopExpandProperty` 是 JSON 约定，但没有看到完整 runtime schema validation。
- 删除 `data` 确实减少 payload；“减少了多少 MB”没有测量，不能编数字。

## 30 秒回答

> LIMS 的 SOP 编辑页需要在单元格上承载实验配置。我把 Luckysheet 当成命令式孤岛：Vue 管页面和弹窗，SDK 只管表格容器；右键动作打开 Vue 表单，再把结果写回单元格的 `sopExpandProperty` JSON。编辑通过尾沿 2 秒 debounce 保存，提交前去掉可重建的二维 data。除此之外，我做的 CLI 是复制并改写完整 Vue 或 React 模板的一键项目脚手架，不是生成单个业务模块。

## 自检

1. 能否说清 Vue 和 Luckysheet 各自拥有哪一块状态与 DOM？
2. 能否把右键动作 → 弹窗 → JSON → 写回单元格的链路讲完整？
3. 能否准确解释 2 秒 debounce，而不是再说成默认立即执行？
4. 能否明确 CLI 生成整套项目模板，不夸成业务模块生成器？
5. 能否主动承认 dispose、runtime validation 和未测量 payload 的缺口？
