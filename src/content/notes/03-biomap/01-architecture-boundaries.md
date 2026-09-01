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

## 先把词说清

**feature（业务功能模块）**：按业务能力纵向切的一块代码，自带接口层、组件、hook、类型。**不是按文件类型分的目录**。

**feature-first（按功能优先组织）**：目录结构先按业务切，再在里面分文件类型；对立面是 **type-first**（先分 `components/` `hooks/` `services/`）。

**import zone（导入区域）**：`eslint-plugin-import` 的 `no-restricted-paths` 规则里的一条配置，规定「**谁不能引用哪里**」。

**barrel export（桶导出）**：一个 feature 的 `index.ts`，把它愿意对外公开的东西集中导出。**外部只准从这里进。**

**circular dependency（循环依赖）**：A 引用 B、B 又引用回 A。会造成初始化顺序不可预测、打包工具无法摇树。

**CI（Continuous Integration，持续集成）**：每次提交自动跑构建和检查的流水线。**「在 CI 里挡住」的意思是不通过就合不进主干。**

## 这条要讲清什么

代码按业务 feature 纵向组织，依赖只能单向流动，而**这个方向不是写在文档里靠人记，是用 ESLint 在编辑器和 CI 里直接拦住**。

讲的时候重点不是「我配了几条 lint 规则」，是「**我把一个口头约定变成了每次提交都会执行的检查**」。**约定和检查之间的那道坎，才是这条 bullet 的全部内容。**

## Digital OS 是什么，「主导架构」是什么意思

Digital OS 是团队的核心 C 端产品。**主导不是说所有页面都由我写**，而是三件事由我定：代码怎么分层、feature 怎么组织、哪些 import 不允许出现并且怎么自动检查。

前两件事谁都可以提意见，**第三件事是把意见固化下来的那一步——也是唯一能拿出证据的那一步。**

## 依赖方向

一共三层，方向是 **`app` → `features` → 共享层**：

- **`app`**：路由、Provider、全局入口，职责是**装配**。
- **`features`**：按业务能力纵向切，每个 feature 自带 `api/`、`components/`、`hooks/`、`types/`。
- **共享层**：`components` / `hooks` / `lib` / `types` / `utils`，放**稳定的、不含业务的**通用能力。

**规则只有一句：上层可以依赖下层，下层不能反过来知道上层；两个 feature 之间也不能互相伸进对方的内部文件。**

## 五条 import zone 各守什么

```js
'import/no-restricted-paths': ['error', {
  zones: [
    // Zone 1-3：每个 feature 只能引用自己
    { target: './src/features/blog',     from: './src/features', except: ['./blog'] },
    { target: './src/features/comments', from: './src/features', except: ['./comments'] },
    { target: './src/features/theme',    from: './src/features', except: ['./theme'] },

    // Zone 4：features 不能反向引用 app
    { target: './src/features', from: './src/app' },

    // Zone 5：共享层不能引用 features 或 app
    { target: './src/(components|hooks|lib|types|utils)', from: './src/(features|app)' },
  ],
}],

'import/no-cycle': 'error',   // zone 覆盖不到的循环依赖，单独拦
```

**三个字段的含义要能张口就答**，因为面试官通常会顺手让你解释配置本身：**`target` 是「谁」，`from` 是「这个谁不能碰哪里」，`except` 是「除了自己这一格」。**

**前三条**守 feature 之间的隔离，**一个 feature 一条**。以 blog 为例：`target` 指向 blog 自己的目录，`from` 指向整个 `features`，`except` 留出 blog 自己——意思是 **blog 里的代码不能引用 `features` 下的任何东西，除了它自己**。

**第四条**挡住反向依赖：`target` 是整个 `features`，`from` 是 `app`。**入口层可以知道业务，业务不能知道入口层。**

**第五条**挡住共享层知道业务。**一个通用按钮不许 import 某个 feature 的类型，否则它就不再通用了。**

**「为什么是五条不是一条」是必然会来的追问**，答案在 `except` 上：feature 隔离必须一个 feature 写一条，**因为 `except` 要指向它自己，没法写成通配**。feature 增加，zone 数量跟着增加——**这既是它的代价，也是它精确的原因。**

## 为什么用 ESLint，不写进 README

**README 只能提醒。**它要靠人记住，靠 code review 恰好有人看见，靠新人入职时有人告诉他。**这三件事都会失效，而且失效的时候没有任何信号。**

ESLint 不一样：**违规的 import 在写代码时编辑器里就是红的，在 CI 里直接挡住 merge。**

这句英文是这条 bullet 最好的一句：**enforced in the editor and in CI, not in a README.**

## 两个 feature 需要合作怎么办

三条合法路径，任选一条：

1. 通过对方 feature 的**公开入口（barrel export）**调用，不碰内部文件。
2. 在上层的 `app` 或页面层做**编排（composition）**，让两个 feature 在更高一层组合起来。
3. 把真正通用、没有业务归属的那部分**下沉到共享层**。

**边界限制的是依赖方式，不是禁止业务组合**——这句话要主动说出来，否则听起来像是这套规则让人没法干活。

## 概念补充

**feature-first 比 type-first 好在哪。** 按 `components/`、`hooks/`、`services/` 横向铺开的时候，一个需求的代码散在三四个目录里，改动的影响范围看不出来，想删掉一个功能得全局搜索。按 feature 纵向切之后，一个功能的接口、组件、hook、类型在同一个文件夹里，**能整块迁移，也能整块删掉**。

**TypeScript 已经检查类型了，为什么还要 ESLint。** TypeScript 判断的是「**这个 import 能不能编译通过**」，不判断「**这一层该不该知道那一层**」。**一个类型完全正确的 import 照样可以破坏架构。**类型正确和架构正确是两件事，这一问答不上会显得没想过分工。

**barrel export 的代价。** feature 的 `index.ts` 决定外部能用什么。**入口开得太宽，内部实现会慢慢变成事实上的公共 API**，以后想重构就动不了。入口收紧，feature 内部才敢改。

**边界会不会太死。** 会。所以规则要跟着真实的依赖图演进。**同一个跨 feature 的需求反复出现，通常说明缺一层公开 API 或者缺一个共享抽象，而不是说明规则该关掉。**

## 30 秒回答

> Digital OS 变大以后，我不希望模块边界只靠团队记忆。我按业务 feature 纵向组织代码，依赖方向定成 app → features → 共享层，然后用五条 ESLint import zone 固化下来：前三条让每个 feature 只能引用自己，第四条禁止 features 反向依赖 app，第五条禁止共享层知道业务，另外单开一条 no-cycle 拦循环依赖。违规的 import 在编辑器里就是红的，在 CI 里直接挡住 merge。跨 feature 的需求走公开入口、上层编排或者下沉共享层，不允许直接穿透内部目录。

## 英文怎么说

**最好的一句**：**enforced in the editor and in CI, not in a README**。

「主导架构」用 **led the architecture**，不要说 designed all of it。「依赖只能单向流动」说 **dependencies only flow one way**。跨 feature 合作的三条路径分别是 **through the feature's public entry point**、**composed one layer up**、**lifted into the shared layer**。承认代价时说 **one zone per feature, so the count grows with the features**。

**术语对照**：feature 边界 feature boundaries ／ 导入区域 import zone ／ 桶导出 barrel export ／ 公开入口 public entry point ／ 循环依赖 circular dependency ／ 摇树 tree shaking ／ 编排 composition ／ 下沉 lift into ／ 事实上的公共 API de facto public API ／ 依赖图 dependency graph。

## 自检

1. 不看笔记，能否画出 `app → features → 共享层` 这个方向？
2. 能否说清 `target` / `from` / `except` 三个字段各是什么意思？
3. 能否说出五条 zone 分别守哪一类边界，以及为什么 feature 隔离要一个 feature 写一条？
4. 能否给出跨 feature 合作的三种合法路径？
5. 能否解释 ESLint 边界和 TypeScript 类型检查的分工？
6. 能否说出 barrel export 开得太宽的代价？
