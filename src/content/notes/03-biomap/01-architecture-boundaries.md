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
> Led the **React 18 and TypeScript architecture** for Digital OS, the team's core consumer-facing product, enforcing feature boundaries with **five custom ESLint import zones: no feature can reach into another**.
>
> ---
>
> 主导团队核心 C 端产品 Digital OS 的 **React 18 + TypeScript 架构**，通过 **5 条自定义 ESLint 导入区域**强制执行 feature 边界：任何 feature 都不能伸进另一个 feature。

## 这条要讲清什么

代码按业务 feature 纵向组织，依赖只能单向流动，而这个方向不是写在文档里靠人记，是用 ESLint 规则在编辑器和 CI 里直接拦住。

## 第一层：必须答顺

### 1. Digital OS 是什么？"主导架构"是什么意思？

Digital OS 是团队的核心 C 端产品。"主导"不是所有页面都由我写，而是我定了三件事：代码怎么分层、feature 怎么组织、哪些 import 不允许出现以及怎么自动检查。

### 2. 依赖方向是什么？

```
app  →  features  →  components / hooks / lib / types / utils
```

- `app`：路由、Provider、全局入口，负责装配。
- `features`：按业务能力纵向切，每个 feature 自带 `api/`、`components/`、`hooks/`、`types/`。
- 底层共享目录：稳定、不含业务的通用能力。

上层可以依赖下层，下层不能反过来知道上层；两个 feature 之间也不能互相伸进内部文件。

### 3. 5 条 import zones 分别守什么？

用的是 `eslint-plugin-import` 的 `import/no-restricted-paths`：

```js
'import/no-restricted-paths': [
  'error',
  {
    zones: [
      // Zone 1-3：每个 feature 只能引用自己
      { target: './src/features/blog',     from: './src/features', except: ['./blog'] },
      { target: './src/features/comments', from: './src/features', except: ['./comments'] },
      { target: './src/features/theme',    from: './src/features', except: ['./theme'] },

      // Zone 4：features 不能反向引用 app
      { target: './src/features', from: './src/app' },

      // Zone 5：共享层不能引用 features 或 app
      {
        target: './src/(components|hooks|lib|types|utils)',
        from: './src/(features|app)',
      },
    ],
  },
],
```

一句话读法：`target` 是"谁"，`from` 是"不能碰哪里"，`except` 是"除了自己这一格"。

前 3 条是 feature 互相隔离，一个 feature 一条；第 4 条挡住下层反向依赖入口层；第 5 条挡住共享组件反向依赖业务。另外配一条 `import/no-cycle: 'error'`，把 zone 没覆盖到的循环依赖也拦下来。

> 追问"为什么是 5 条不是 1 条"：feature 隔离必须一个 feature 写一条，因为 `except` 要指向自己。feature 增加，zone 数量跟着增加。

### 4. 为什么用 ESLint，不写进 README？

README 只能提醒，要靠人记住、靠 code review 恰好有人看见。ESLint 在写代码时红线就出现，在 CI 里直接挡住 merge。架构约定从"口头协议"变成每次提交都执行的检查。

### 5. 两个 feature 需要合作怎么办？

三条合法路径，任选：

1. 通过对方 feature 的**公开入口**（barrel export）调用，不碰内部文件。
2. 在上层 `app` 或页面层做**编排**，让两个 feature 在更高一层组合。
3. 把真正通用、没有业务归属的部分**下沉到共享层**。

边界限制的是依赖方式，不是禁止业务组合。

## 第二层：概念补充

### feature-first 比按文件类型分目录好在哪？

按 `components/`、`hooks/`、`services/` 横向铺开时，一个需求的代码散在三四个目录里，改动影响范围看不出来，删除功能更是要全局搜。按 feature 纵向切，一个功能的 API、组件、hook、类型在同一个文件夹，能整块迁移，也能整块删掉。

### TypeScript 已经检查类型了，为什么还要 ESLint？

TypeScript 判断"这个 import 能不能编译通过"，不判断"这一层该不该知道那一层"。一个类型完全正确的 import 照样可以破坏架构。类型正确和架构正确是两件事。

### barrel export 的代价是什么？

feature 的 `index.ts` 决定外部能用什么。入口开得太宽，内部实现会慢慢变成事实上的公共 API，以后想重构就动不了。入口收紧，feature 内部才敢改。

### 边界会不会太死？

会。所以规则要跟着真实依赖图演进。同一个跨 feature 需求反复出现，通常说明缺一层公开 API 或缺一个共享抽象，而不是说明规则该关掉。

## 30 秒回答

> Digital OS 变大以后，我不希望模块边界只靠团队记忆。我按业务 feature 纵向组织代码，依赖方向定成 app → features → 共享层，再用 5 条 ESLint import zones 固化：前三条让每个 feature 只能引用自己，第四条禁止 features 反向依赖 app，第五条禁止共享层知道业务，另外单开一条规则拦循环依赖。违规的 import 在编辑器里就红，在 CI 里直接挡住。跨 feature 的需求走公开入口、上层编排或下沉共享层，不允许直接穿透内部目录。

## 自检

1. 不看笔记，能否画出 app → features → 共享层这个方向？
2. 能否说清 `target` / `from` / `except` 三个字段各是什么意思？
3. 能否说出 5 条 zone 分别守哪一类边界，以及为什么 feature 隔离要一个 feature 一条？
4. 能否给出跨 feature 合作的三种合法路径？
5. 能否解释 ESLint 边界和 TypeScript 类型检查的分工？
