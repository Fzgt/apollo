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

代码按业务 feature 纵向组织，依赖只能单向流动，而这个方向不是写在文档里靠人记，是用 ESLint 在编辑器和 CI 里直接拦住。讲的时候重点不是「我配了几条 lint 规则」，是「我把一个口头约定变成了每次提交都会执行的检查」。约定和检查之间的那道坎，才是这条 bullet 的全部内容。

## Digital OS 是什么，「主导架构」是什么意思

Digital OS 是团队的核心 C 端产品。主导不是说所有页面都由我写，而是三件事由我定：代码怎么分层、feature 怎么组织、哪些 import 不允许出现并且怎么自动检查。前两件事谁都可以提意见，第三件事是把意见固化下来的那一步——也是唯一能拿出证据的那一步。

## 依赖方向

一共三层，从上往下是 app、features、共享层。app 管路由、Provider 和全局入口，职责是装配；features 按业务能力纵向切，每个 feature 自带自己的接口层、组件、hook 和类型；共享层是 components、hooks、lib、types、utils 这几个目录，放稳定的、不含业务的通用能力。

规则只有一句：上层可以依赖下层，下层不能反过来知道上层；两个 feature 之间也不能互相伸进对方的内部文件。

## 五条 import zone 各守什么

用的是 eslint-plugin-import 的 no-restricted-paths 规则。它的写法就三个字段：target 是「谁」，from 是「这个谁不能碰哪里」，except 是「除了自己这一格」。三个字段的含义要能张口就答，因为面试官通常会顺手让你解释配置本身。

前三条守 feature 之间的隔离，一个 feature 一条。以 blog 为例：target 指向 blog 自己的目录，from 指向整个 features 目录，except 留出 blog 自己——意思是 blog 里的代码不能引用 features 下的任何东西，除了它自己。comments 和 theme 各写一条，形状完全一样。

第四条挡住反向依赖：target 是整个 features 目录，from 是 app。features 里不允许出现任何指向 app 的 import，入口层可以知道业务，业务不能知道入口层。

第五条挡住共享层知道业务：target 是那五个共享目录，from 是 features 和 app。一个通用按钮不许 import 某个 feature 的类型，否则它就不再通用了。

另外单开一条 no-cycle 规则，把 zone 覆盖不到的循环依赖一起拦下来。

「为什么是五条不是一条」是必然会来的追问，答案在 except 上：feature 隔离必须一个 feature 写一条，因为 except 要指向它自己，没法写成通配。feature 增加，zone 数量跟着增加——这既是它的代价，也是它精确的原因。

## 为什么用 ESLint，不写进 README

README 只能提醒。它要靠人记住，靠 code review 恰好有人看见，靠新人入职时有人告诉他。这三件事都会失效，而且失效的时候没有任何信号。

ESLint 不一样：违规的 import 在写代码时编辑器里就是红的，在 CI 里直接挡住 merge。架构约定从一句口头协议变成了一道每次提交都跑的检查——这句话就是这条 bullet 想说的全部。

## 两个 feature 需要合作怎么办

三条合法路径，任选一条。第一，通过对方 feature 的公开入口调用，也就是它的 barrel export，不碰内部文件。第二，在上层的 app 或页面层做编排，让两个 feature 在更高一层组合起来。第三，把真正通用、没有业务归属的那部分下沉到共享层。

边界限制的是依赖方式，不是禁止业务组合——这句话要主动说出来，否则听起来像是这套规则让人没法干活。

## 概念补充

**feature-first 比按文件类型分目录好在哪。** 按 components、hooks、services 横向铺开的时候，一个需求的代码散在三四个目录里，改动的影响范围看不出来，想删掉一个功能得全局搜索。按 feature 纵向切之后，一个功能的接口、组件、hook、类型在同一个文件夹里，能整块迁移，也能整块删掉。

**TypeScript 已经检查类型了，为什么还要 ESLint。** TypeScript 判断的是「这个 import 能不能编译通过」，不判断「这一层该不该知道那一层」。一个类型完全正确的 import 照样可以破坏架构。类型正确和架构正确是两件事，这一问答不上会显得没想过分工。

**barrel export 的代价。** feature 的入口文件决定外部能用什么。入口开得太宽，内部实现会慢慢变成事实上的公共 API，以后想重构就动不了。入口收紧，feature 内部才敢改。

**边界会不会太死。** 会。所以规则要跟着真实的依赖图演进。同一个跨 feature 的需求反复出现，通常说明缺一层公开 API 或者缺一个共享抽象，而不是说明规则该关掉。

## 30 秒回答

> Digital OS 变大以后，我不希望模块边界只靠团队记忆。我按业务 feature 纵向组织代码，依赖方向定成 app 到 features 再到共享层，然后用五条 ESLint import zone 固化下来：前三条让每个 feature 只能引用自己，第四条禁止 features 反向依赖 app，第五条禁止共享层知道业务，另外单开一条规则拦循环依赖。违规的 import 在编辑器里就是红的，在 CI 里直接挡住 merge。跨 feature 的需求走公开入口、上层编排或者下沉共享层，不允许直接穿透内部目录。

## 英文怎么说

「主导架构」用 led the architecture，不要说 designed all of it。「feature 边界」是 feature boundaries，「依赖只能单向流动」说 dependencies only flow one way。规则那一层的说法是 enforced in the editor and in CI, not in a README——这句是这条 bullet 最好的一句英文。跨 feature 合作的三条路径分别是 through the feature's public entry point、composed one layer up、lifted into the shared layer。承认代价时说 one zone per feature, so the count grows with the features。

## 自检

1. 不看笔记，能否画出 app、features、共享层这个方向？
2. 能否说清 target、from、except 三个字段各是什么意思？
3. 能否说出五条 zone 分别守哪一类边界，以及为什么 feature 隔离要一个 feature 写一条？
4. 能否给出跨 feature 合作的三种合法路径？
5. 能否解释 ESLint 边界和 TypeScript 类型检查的分工？
