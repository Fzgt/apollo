---
title: "① 架构边界：把规则放进 ESLint"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ① 架构边界：把规则放进 ESLint

> **简历原句**
>
> 主导团队核心 C 端产品 Digital OS 的 **React 18 + TypeScript 架构**，通过 **5 条自定义 ESLint 导入区域**强制执行 feature 边界：任何 feature 都不能伸进另一个 feature。

> ⚠️ **证据边界**：本机没有 Digital OS 源码。`Prometheus` 是 2026 年写的后续示例，只能用来复习做法。里面的 `blog`、`comments`、`theme` 不是 BioMap 的 feature 名，面试时不能拿它们冒充 Digital OS 的 5 条规则。

## 这条要讲清什么

项目变大后，目录约定很容易被破坏。我做的是按业务 feature 划分代码，再用 ESLint 检查不允许出现的依赖，让错误在开发和 CI 阶段直接出现。

## 第一层：必须答顺

### 1. Digital OS 是什么？“主导架构”是什么意思？

Digital OS 是团队的核心 C 端产品。“主导”不是所有页面都由我写，而是我确定了代码如何分层、feature 如何组织、哪些 import 不允许出现，以及这些规则如何自动检查。

### 2. 什么是 feature-first 结构？

代码按业务功能组织，而不是把所有组件、hooks 和 API 分散到不同的大目录里。一个 feature 可以包含自己的页面、组件、hooks、API 和类型。修改一个业务功能时，相关代码大多在同一个位置。

### 3. 5 条 import zones 解决什么问题？

本机没有原始配置，所以不要背 `Prometheus` 里的 5 个名字。安全的讲法是说明它们保护了三类边界：

- 一个 feature 不能直接读取另一个 feature 的内部文件。
- feature 不能反向依赖应用入口层。
- 公共组件和工具不能反向依赖具体业务。

如果面试官要求逐条说出 Digital OS 的 5 个 zone，只说你真实记得的内容，不要用后来的示例补空白。

### 4. 为什么要用 ESLint，而不是写进 README？

README 需要人记住，ESLint 可以在写代码和 CI 时直接报错。这样模块边界不只靠 code review，也不会等项目已经耦合以后才发现。

### 5. 两个 feature 需要合作怎么办？

常见做法有三种：通过公开入口调用；在上层页面或 `app` 层组合；把真正通用的能力放到共享层。不要直接导入另一个 feature 的内部文件。

## 第二层：概念补充

### TypeScript 为什么不能代替 ESLint 边界？

TypeScript 检查类型是否正确，但一个类型正确的 import 仍然可能破坏架构。ESLint 负责检查“能不能依赖这一层”。

### feature-first 有什么代价？

边界太严格会让共享代码放置困难。重复出现的跨 feature 需求通常说明需要公开 API、上层组合或新的共享模块。规则需要跟项目一起调整，不能为了守规则制造更复杂的代码。

### 公共入口为什么重要？

feature 的公开入口决定外部可以使用什么。入口过宽，内部代码会慢慢变成公共 API；入口清楚，feature 内部就可以安全重构。

## 当前不能证明的内容

- 本机无法核对 Digital OS 的真实目录和 5 条 zone。
- `Prometheus` 的规则能解释方法，但不能证明 BioMap 当时的 feature 名和配置细节。
- 没有原始 CI 配置时，不要主动说这些规则一定在每次 BioMap 提交中执行。

## 30 秒回答

> Digital OS 变大以后，我不希望模块边界只靠团队记忆。我按业务 feature 组织代码，再用 5 条 ESLint import zones 阻止 feature 互相读取内部文件、阻止下层反向依赖上层。这样违规 import 会在开发和 CI 阶段直接失败。跨 feature 的功能则通过公开入口、上层组合或共享模块完成，而不是直接穿透内部目录。

## 自检

1. 能否用一句话解释 feature-first？
2. 能否说清 ESLint 边界与 TypeScript 类型检查的区别？
3. 能否说出跨 feature 合作的三种方式？
4. 被问到 5 条真实 zone 时，能否避免拿 `Prometheus` 的 feature 名冒充 BioMap？
