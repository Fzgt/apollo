---
title: "④ LIMS：把 Luckysheet 接进 Vue"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ④ LIMS：把 Luckysheet 接进 Vue

> **简历原句**
>
> 使用 **Vue 3 + TypeScript** 开发 LIMS 平台，支持样本管理和 SOP 流程；扩展 Luckysheet SDK，加入**自定义单元格操作和逐单元格 JSON 契约**，并开发脚手架 CLI。

> ✅ **证据边界**：Luckysheet 与 SOP 代码能在真实 BioMap 仓库中核对。你确认自己也参与了 CLI，但本机 CLI 的 Git 历史没有记录你的提交；面试时只讲你真实参与并且能解释的部分，不要说自己是 CLI 唯一作者。

## 这条要讲清什么

这一条有两个主题：怎样把全局 Luckysheet SDK 接进 Vue 页面；怎样用 CLI 减少新项目的重复配置。主回答控制在 30 秒，保存和 resize 细节等追问再讲。

## 第一层：必须答顺

### 1. LIMS 和 SOP 是什么？

LIMS 是实验室信息管理系统，用于管理样本、流程和结果。SOP 是标准操作流程。这个页面需要在表格单元格上保存实验配置，所以它不只是一个普通数据表格。

### 2. Luckysheet 怎样接进 Vue？

页面先提供一个空的 `<div>`，再通过 `window.luckysheet.create(...)` 创建表格。Vue 管页面状态、弹窗和接口数据；Luckysheet 管容器内部的表格 DOM。两边通过事件和 SDK 方法交换数据。

### 3. 自定义单元格操作是什么？

代码通过 `cellRightClickConfig.customs` 加入 3 个右键操作。用户点击操作后打开 Vue 弹窗，填写完成再用 `setCellValue` 把数据写回对应单元格。

### 4. 逐单元格 JSON 契约是什么？

每个单元格可以保存 `sopExpandProperty`，其中包括 `analyseMethod`、`dataBackFill` 等业务字段。`MarkModal.vue` 把对象转成 JSON 供用户编辑，保存时再解析并写回单元格。

当前代码使用 `JSON.parse`，但没有完整 schema 校验。JSON 格式错误时需要更清楚的错误处理。

### 5. 编辑内容怎样保存？

Luckysheet 的 `updated` hook 触发保存。代码读取所有 sheets，先移除可重新生成的 `data` 二维矩阵，再调用接口。保存使用尾沿 2 秒 debounce，用户连续编辑时不会每一步都发送请求。

### 6. resize 为什么需要处理？

页面使用 ResizeObserver，并加了 600ms debounce。宽度变化小于 20px 时不重建表格，用来过滤弹窗和布局造成的小抖动。其他尺寸变化会重新调用 `create()`。

### 7. CLI 做了什么？

CLI 通过交互选项复制完整的 Vue 或 React 项目模板，并修改项目名、HTML app id、入口 selector 和 dotfiles。它解决的是新项目初始化，不是给现有项目生成一个业务页面。

本机记录显示 CLI 仓库原作者是其他同事。你已经确认自己参与过，所以回答时要说清你具体修改或维护了哪部分，不要扩大成独立完成整个 CLI。

## 第二层：概念补充

### 为什么不让 Vue 直接管理表格内部 DOM？

Luckysheet 自己创建和更新内部 DOM。如果 Vue 同时管理同一块内容，两套更新方式会互相影响。最简单的边界是把整个容器交给 SDK，Vue 只通过公开方法与它通信。

### debounce 能保证保存安全吗？

不能。它只能减少请求。更完整的方案还要处理保存失败、旧请求覆盖新数据、离开页面前提交最后一次修改，以及明确显示保存状态。

### 这种 SDK 集成还缺什么？

初始化、事件、数据同步、resize、错误处理和销毁最好放进 adapter 或 composable。页面没有看到明确的 Luckysheet 销毁逻辑，重新进入页面时可能留下实例或监听器。

## 30 秒回答

> LIMS 的 SOP 页面需要在单元格上保存实验配置。我给 Luckysheet 一个独立容器，Vue 负责页面和弹窗，SDK 负责表格。三个右键操作打开 Vue 表单，再把结果写回单元格的 `sopExpandProperty` JSON。编辑通过尾沿 2 秒 debounce 保存，提交前移除可重新生成的二维 data。CLI 则用项目模板减少 Vue 或 React 新项目的初始化工作。

## 自检

1. 能否说清 Vue 与 Luckysheet 分别管理什么？
2. 能否讲完整右键操作、弹窗、JSON、写回单元格的流程？
3. 能否解释 2 秒保存防抖与 600ms resize 防抖？
4. 能否说明 CLI 生成整套项目，而不是业务模块？
5. 能否准确说出自己在 CLI 中参与的部分，而不说成唯一作者？
