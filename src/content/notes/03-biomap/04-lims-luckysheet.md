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

两件事：怎么把一个全局的、命令式的表格 SDK 接进 Vue 的响应式页面，以及 CLI 到底自动化了什么。主回答讲到这两点就够 30 秒；保存、resize、销毁那些细节等追问再展开，一上来全倒出来只会把重点冲淡。

## LIMS 和 SOP 是什么

LIMS 是实验室信息管理系统，管样本、流程和结果记录。SOP 是标准操作流程。

在 SOP 编辑页里，表格不只是展示数据：每个单元格还要挂实验步骤、分析方法、数据回填配置。普通的表格组件承载不了这些，所以接了 Luckysheet。

## Luckysheet 怎么接进 Vue

给 SDK 一个空的容器 div，然后命令式地初始化：先把 Excel 元数据取回来，再调 SDK 的创建方法把表格建在那个容器里。

边界要说得很清楚：Vue 管页面状态、弹窗和业务数据，Luckysheet 管容器内部的表格 DOM，两边只通过 SDK 方法和它提供的 hook 交换数据。绝不让 Vue 去声明式地渲染 SDK 内部的 DOM——两套渲染机制同时改同一块 DOM 一定出事，而且出的是那种节点凭空消失、状态错乱、几乎没法复现的问题。

## 自定义单元格操作是什么

往 SDK 的右键菜单配置里注册了三个自定义动作：SOP 配置 JSON 字段、SOP 配置数据验证、SOP Mark Fields。

链路是一条直线：用户右键，SDK 把这一格的行列坐标交给回调，回调打开一个 Vue 弹窗，用户在弹窗里填表，确认之后调 SDK 的写入方法把结果写回那一格。

写回的时候要区分两个字段：一个是显示值，也就是用户在表格里看到的东西；另一个是真实值，也就是实际存下来的东西。这两个字段的区别是这条容易被追问的点，要能张口说出来。

SDK 在这里只提供触发点和写入方法，复杂表单仍然是 Vue 组件——这也是前面那条边界的具体体现。

## 逐单元格 JSON 契约是什么

业务元数据挂在单元格自己的一个扩展属性上，里面是分析方法、数据回填这些字段。弹窗打开的时候把这个对象格式化成 JSON 文本给用户编辑，保存的时候再解析回对象写回那一格。

好处是可见的单元格值和背后的业务配置彻底分开，而且这份配置跟着 SOP 模板一起保存、导出、恢复，不需要另建一张表去关联行列坐标。

代价要主动说：这是项目内部的约定，解析那一步外面没有 schema 校验。JSON 写坏了需要更明确的错误提示，这是当前的缺口——被问到的时候承认它，比含糊过去好。

## 编辑内容怎么保存

挂在 Luckysheet 的更新 hook 上。保存之前先把每张表里那份渲染用的二维数据摘掉，因为它能从单元格数据重建，体积却大得多，没必要上传。

提交本身走两秒的尾沿防抖：连续编辑合并成一次，用户停手两秒之后才真正提交。

这里有一个高频追问：lodash 的 debounce 默认是尾沿执行，不是立即执行。默认配置等价于「不在开头执行、在结尾执行」。想要立即执行是 throttle，或者给 debounce 显式打开 leading。这一条别答反了，答反了会显得防抖节流是背的。

## resize 为什么要单独处理

Luckysheet 的表格尺寸是初始化时算出来的，容器变了就得重建。但 ResizeObserver 触发得非常密，直接接上去等于每次抖动都重建一次整表。

所以加了两道闸：六百毫秒的防抖，把连续抖动合并成一次；再加一个宽度阈值，变化小于二十像素的直接当微抖动跳过。弹窗开合、滚动条出现这类几像素的变化就不会触发整表重建了。

代价同样要说：重建是重操作，会丢掉当前的选区和编辑态。更理想的做法是 SDK 提供可靠的 resize 接口，只调整尺寸不重建——现在是没有这个接口才这么做的。

## CLI 做了什么

用 Commander 加交互式提问选模板，复制一整套 Vue 或 React 的项目骨架，恢复 dotfiles，然后改写包名、HTML 里的挂载点 id 和入口 selector。

它是项目脚手架，解决的是新项目从零配置的重复劳动。它不是模块生成器，不会给已有项目生成某个页面、路由、接口或类型。这个区分要说准，说大了会被追问穿。

## 概念补充

**为什么不让 Vue 直接管表格内部 DOM。** Luckysheet 自己创建和更新内部 DOM。如果 Vue 的虚拟 DOM 也去 diff 同一块内容，两套更新机制会互相覆盖。最干净的边界就是整个容器交给 SDK，Vue 只通过公开方法和事件跟它说话。

**命令式 SDK 的标准集成边界。** 初始化、事件桥接、数据同步、尺寸变化、错误处理、销毁——这六件事应该封进一个 adapter 或者 composable，页面组件只消费业务语义，不到处直接摸全局对象。当前页面没有看到显式的卸载清理，反复进出页面存在实例和监听器残留的风险，这也是一个可以主动承认的缺口。

**防抖能保证保存可靠吗。** 不能。它只减少请求数量，不保证最终一致。生产上还要考虑版本号或 ETag 防止旧响应覆盖新编辑、失败重试、离开页面前把最后一次刷出去，以及明确的保存中、已保存、保存失败三种状态提示。

## 30 秒回答

> LIMS 的 SOP 编辑页要在单元格上承载实验配置，所以我把 Luckysheet 当成一个命令式的孤岛：给它一个空容器，Vue 管页面和弹窗，SDK 管表格 DOM，两边只通过方法和 hook 通信。我往它的右键菜单里加了三个自定义动作，点开是 Vue 表单，填完把结果写回那一格的扩展属性，那是一份逐单元格的 JSON 契约，跟着 SOP 模板一起保存。保存挂在更新 hook 上，走两秒尾沿防抖，提交前把能重建的渲染数据摘掉。resize 用六百毫秒防抖加二十像素阈值挡掉微抖动，避免整表重建。另外做的 CLI 是项目脚手架，复制并改写整套 Vue 或 React 模板，解决新项目初始化。

## 英文怎么说

「命令式孤岛」说 I treated Luckysheet as an imperative island。边界那句是 Vue owns the page and the modals, the SDK owns the grid DOM, and they only talk through methods and hooks。显示值和真实值说 the display value and the stored value。防抖那句是 a two-second trailing debounce, and lodash debounce is trailing by default, not leading。CLI 的定位要说准：it is a project scaffold, not a module generator。承认缺口时说 there is no schema validation around the JSON parse, and I never added an explicit dispose。

## 自检

1. 能否说清 Vue 和 Luckysheet 各自拥有哪一块状态和 DOM，以及为什么不能混？
2. 能否把右键、弹窗、JSON、写回这条链路讲完整？
3. 能否说出显示值和真实值的区别？
4. 能否准确说明 lodash debounce 默认是尾沿执行，不是立即执行？
5. 能否解释两秒保存防抖和六百毫秒加二十像素的 resize 双闸各挡什么？
6. 能否说明 CLI 是项目脚手架而不是模块生成器？
7. 能否主动承认卸载清理、schema 校验、resize 重建这三个缺口？
