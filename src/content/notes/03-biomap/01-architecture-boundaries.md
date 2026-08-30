---
title: "① 架构边界：把约定变成约束"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ① 架构边界：把约定变成约束

> **简历原句**
>
> 主导团队核心 C 端产品 Digital OS 的 **React 18 + TypeScript 架构**，通过 **5 条自定义 ESLint 导入区域**强制执行 feature 边界：任何 feature 都不能伸进另一个 feature。

> ⚠️ **证据边界**：本机没有 Digital OS 的生产仓库。下面能逐行指给面试官看的，是后来 `Prometheus` 里的同构实现；不要把这些文件路径冒充成 BioMap 源码。

## 这条真正要证明什么

我做的不是选 React 和 TypeScript，而是把依赖方向写成机器可执行的规则。代码量变大、多人并行之后，架构不会只靠每个人“自觉”。

## 第一层：必须答顺

### 1. Digital OS 是什么？“主导架构”具体做了什么？

Digital OS 是团队的核心 C 端产品。这里的“主导”不是说所有页面都由我写，而是我确定了目录边界、依赖方向和违反边界时的检查方式，让后续业务代码沿同一套结构增长。

### 2. 依赖方向是什么？

核心方向是：

`app → features → components / hooks / lib / types / utils`

- `app` 负责装配路由、Provider 和全局入口。
- `features` 按业务能力纵向组织。
- 底层共享目录提供稳定、无业务归属的能力。

上层可以依赖下层，下层不能反向知道具体业务；两个 feature 也不能直接钻进彼此内部。

### 3. “5 条 import zones”到底限制什么？

参考实现位于 `Prometheus/.eslintrc.cjs`：

- 前 3 条隔离 `blog`、`comments`、`theme`，阻止 feature 互相读取内部文件。
- 第 4 条禁止 `features` 反向导入 `app`。
- 第 5 条禁止共享层导入 `features` 或 `app`。

另外还有 `import/no-cycle: error`，拦住单个 zone 没覆盖到的循环依赖。

### 4. 为什么不用 README 约定？

README 只能提醒，ESLint 能在写代码和 CI 时立即失败。它把架构评审从“某个资深同事是否刚好看见”变成每次提交都执行的反馈环。

### 5. feature 之间真的完全不能协作吗？

可以协作，但不能偷读内部实现。跨 feature 的能力应通过公开入口、上移到 `app` 做编排，或抽成没有业务归属的共享模块。边界约束的是依赖方式，不是阻止业务组合。

## 第二层：继续追问时再讲

### 为什么 feature-first 比按文件类型分目录更适合大项目？

一个功能的 API、组件、hooks 和类型放在一起，改需求时影响范围更清楚，也更容易删除或迁移。按 `components/`、`hooks/`、`services/` 横向铺开，业务边界会随着规模增长而消失。

### 边界规则会不会太死？

会，所以规则必须跟真实依赖图一起演进。重复出现的合法跨域需求，通常说明公开 API 或共享抽象缺了一层；偶发的绕过应在 review 里解释，而不是默默关闭规则。

### TypeScript 已经能检查类型，为什么还需要 ESLint？

TypeScript 判断“这个导入能不能编译”，不会判断“这一层是否应该知道那一层”。类型正确和架构正确是两件事。

## 当前实现的缺口

- 本机能验证的是 `Prometheus` 参考实现，不是 Digital OS 生产代码。
- 规则只在真正进入编辑器检查和 CI 时才有强制力。
- barrel export 如果设计得太宽，仍可能把 feature 内部细节变成事实上的公共 API。

## 30 秒回答

> Digital OS 变大以后，我最担心的不是某个组件写得不好，而是依赖方向慢慢失控。我把代码分成 app、features 和稳定共享层，再用 5 条 ESLint import zones 固化规则：feature 不能互相伸进内部，features 不能反向依赖 app，共享层也不能知道上层业务；循环依赖另外直接报错。这样边界不是写在文档里等人记，而是在本地和 CI 里持续执行。

## 自检

1. 不看笔记，能否画出依赖方向？
2. 能否说清 5 条 zone 分别守哪一类边界？
3. 面试官问“两个 feature 如何协作”，能否给出公开入口、app 编排、共享抽象三种办法？
4. 能否主动说明 BioMap 源码与 `Prometheus` 参考实现的证据边界？
