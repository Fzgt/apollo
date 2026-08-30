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
> Developed the **LIMS platform in Vue 3 and TypeScript** for sample management and SOP workflows, extending the **Luckysheet SDK with custom cell actions and a per-cell JSON contract**, plus a scaffolding CLI.
>
> ---
>
> 使用 **Vue 3 + TypeScript** 开发 LIMS 平台，支持样本管理和 SOP 流程；扩展 Luckysheet SDK，加入**自定义单元格操作和逐单元格 JSON 契约**，并开发脚手架 CLI。

## 这条要讲清什么

两件事：**怎么把一个全局、命令式的表格 SDK 接进 Vue 的响应式页面**，以及 **CLI 自动化了什么**。主回答讲到这里就够 30 秒；保存、resize、销毁这些细节等追问再展开。

## 第一层：必须答顺

### 1. LIMS 和 SOP 是什么？

LIMS 是实验室信息管理系统，管样本、流程和结果记录。SOP 是标准操作流程。在 SOP 编辑页里，表格不只是展示数据——每个单元格还要挂实验步骤、分析方法、数据回填配置。普通表格组件不够用，所以接了 Luckysheet。

### 2. Luckysheet 怎样接进 Vue？

给 SDK 一个空容器，然后命令式初始化：

```ts
const lucky = ref(null);

const initSop = async () => {
  const metaData = await loadExcelMetadata();
  luckysheet.create(initOptions(metaData));
};

initSop();
```

**边界很清楚**：Vue 管页面状态、弹窗、业务数据；Luckysheet 管容器内部的表格 DOM。两边只通过 SDK 方法和 hook 交换数据，绝不让 Vue 去声明式渲染 SDK 内部的 DOM——两套渲染机制同时改一块 DOM 一定出事。

### 3. "自定义单元格操作"具体是什么？

往 `cellRightClickConfig.customs` 注册 3 个右键动作：

```ts
cellRightClickConfig: {
  customs: [
    {
      title: 'SOP 配置JSON字段',
      onClick: (e, k, params) => {
        const { rowIndex, columnIndex } = params;
        const v = luckysheet.getCellValue(rowIndex, columnIndex, { type: 'v' });
        const m = luckysheet.getCellValue(rowIndex, columnIndex, { type: 'm' });
        openModal(true, { ...params, m, v });
      },
    },
    { title: 'SOP 配置数据验证', onClick: (e, k, params) => openVerify(true, { ...params }) },
    { title: 'SOP Mark Fields',  onClick: (e, k, params) => openMark(true,   { ...params }) },
  ],
},
```

链路是：**右键 → SDK 给出坐标 → 打开 Vue 弹窗 → 用户填表 → 写回单元格**。

```ts
const setSheetSopJson = ({ columnIndex, rowIndex, cellUi, cellJson }) => {
  luckysheet.setCellValue(rowIndex, columnIndex, { m: cellUi, v: cellJson });
};
```

`m` 是显示值（用户看到的），`v` 是真实值（存的）。SDK 只提供触发点和写入方法，复杂表单仍然是 Vue 组件。

### 4. "逐单元格 JSON 契约"是什么？

业务元数据挂在单元格的 `sopExpandProperty` 上，包含 `analyseMethod`、`dataBackFill` 等字段。`MarkModal.vue` 把它转成 JSON 给用户编辑，保存时再解析写回：

```ts
// 打开：对象 → 格式化 JSON 文本
sopExpandProperty.value = JSON.stringify(data, null, 2);

// 保存：文本 → 对象 → 写回那一格
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

好处是：**可见的单元格值和背后的业务配置分开**，而且配置跟着 SOP 模板一起保存、导出、恢复。

代价要能主动说：这是项目内部约定，`JSON.parse` 外面没有 schema 校验。JSON 格式坏了需要更明确的错误提示，这是当前的缺口。

### 5. 编辑内容怎样保存？

挂 Luckysheet 的 `updated` hook，保存前先把可重建的二维数据摘掉：

```ts
const handleUpdate = () => {
  const allSheets = luckysheet.getAllSheets();
  allSheets.forEach((sheet) => (sheet.data = undefined));   // data 能从 celldata 重建，不必上传
  saveSopTemplate(allSheets);
};

const saveSopTemplate = debounce(
  (data) => putSopTemplate({ sopTemplateConfigId: Number(sopId), config: data })
    .then(() => message.success('已保存')),
  2000,
  { leading: false },
);
```

`sheet.data` 是渲染用的二维矩阵，能从 `celldata` 重建，体积却大得多，所以提交前置空。

保存走 **2 秒尾沿 debounce**：连续编辑合并成一次，用户停手 2 秒后才提交。

> `{ leading: false }` 是把默认行为写明白。lodash `debounce` 默认就是尾沿执行（`leading: false, trailing: true`），不是立即执行——**这一点面试很容易被追问，别答反了**。立即执行是 `throttle` 或 `debounce` 显式开 `leading: true`。

### 6. resize 为什么要单独处理？

Luckysheet 的表格尺寸是初始化时算的，容器变了要重建。但 ResizeObserver 触发得非常密：

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

两道闸：**600ms debounce** 合并连续抖动，**宽度变化小于 20px 视为微抖动**直接跳过。弹窗开合、滚动条出现这类几像素的变化不会触发整表重建。

代价也要说：重建是重操作，会丢掉当前选区和编辑态。更理想的是 SDK 提供可靠的 resize API，只调整尺寸不重建。

### 7. CLI 做了什么？

`@biomap/cli` 用 Commander 加交互式提问选模板，复制一整套 Vue 或 React 项目骨架，恢复 dotfiles，然后改写 package name、HTML 的 app id 和入口 selector。

它是**项目脚手架**——解决新项目从零配置的重复劳动，不是给已有项目生成某个页面/路由/API/类型的模块生成器。这个区分要说准，说大了会被追问穿。

## 第二层：概念补充

### 为什么不让 Vue 直接管表格内部 DOM？

Luckysheet 自己创建和更新内部 DOM。如果 Vue 的虚拟 DOM 也去 diff 同一块内容，两套更新机制会互相覆盖，出现节点丢失、状态错乱这类很难查的问题。最干净的边界就是：整个容器交给 SDK，Vue 只通过公开方法和事件跟它说话。

### 命令式 SDK 的标准集成边界

初始化、事件桥接、数据同步、尺寸变化、错误处理、销毁——这六件事应该封进一个 adapter 或 composable。页面组件只消费业务语义，不到处直接摸 `window.luckysheet`。

当前页面没有看到显式的 unmount dispose，反复进出页面存在实例和监听器残留的风险，这是可以主动承认的缺口。

### debounce 能保证保存可靠吗？

不能。它只减少请求数量，不保证最终一致。生产上还要考虑：版本号或 ETag 防止旧响应覆盖新编辑、失败重试、离开页面前 flush 最后一次、以及明确的"保存中 / 已保存 / 保存失败"状态提示。

## 30 秒回答

> LIMS 的 SOP 编辑页要在单元格上承载实验配置，所以我把 Luckysheet 当成一个命令式孤岛：给它一个空容器，Vue 管页面和弹窗，SDK 管表格 DOM，两边只通过方法和 hook 通信。我往 `cellRightClickConfig.customs` 加了三个右键动作，点开是 Vue 表单，填完用 `setCellValue` 把结果写回单元格的 `sopExpandProperty` JSON。保存挂在 `updated` hook 上，走 2 秒尾沿 debounce，提交前把能重建的二维 data 摘掉。resize 用 600ms debounce 加 20px 阈值挡掉微抖动，避免整表重建。另外做的 CLI 是项目脚手架，复制并改写整套 Vue 或 React 模板，解决新项目初始化。

## 自检

1. 能否说清 Vue 和 Luckysheet 各自拥有哪一块状态和 DOM，以及为什么不能混？
2. 能否把右键 → 弹窗 → JSON → `setCellValue` 写回这条链路讲完整？
3. 能否说出 `m` 和 `v` 的区别？
4. 能否准确说明 lodash `debounce` 默认是尾沿执行，不是立即执行？
5. 能否解释 2 秒保存防抖和 600ms + 20px resize 双闸各挡什么？
6. 能否说明 CLI 是项目脚手架而不是模块生成器？
7. 能否主动承认 dispose、schema 校验、resize 重建这三个缺口？
