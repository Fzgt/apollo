---
title: "① 六阶段与类型化契约"
tier: must
section: Periplus
icon: workflow
day: 8
level: S
status: done
---

# ① 六阶段与类型化契约

> **简历原句**
>
> **Six-stage LLM pipeline behind typed Pydantic stage contracts** filled by **schema-constrained JSON output**, with **run state and stage artifacts in PostgreSQL**: **a run that dies mid-pipeline resumes from the last completed stage**.
>
> ---
>
> 六阶段 LLM 流水线，阶段之间只认带类型的 Pydantic 契约，由受 schema 约束的 JSON 输出填充；运行状态与阶段产物都落在 PostgreSQL 里：流水线中途挂掉的运行可以从最后一个已完成阶段续跑。

本篇讲契约与编排，同一条 bullet 的持久化与续跑那一半在[② 持久化与断点续跑](/docs?section=periplus&item=persistence-resume)。另外「agentic workflow」和「用 OpenAPI 生成前端类型」两个说法不在简历上，**别当原句背**——纸上写的是 Pydantic 与受 schema 约束的 JSON。

## 先把词说清

**LLM（Large Language Model，大语言模型）**：这里指作为 API 调用的模型。

**Pydantic**：Python 的数据校验库。**你写一个类声明字段和类型，它负责在运行时校验并转换。**这条 bullet 里它扮演的是「阶段之间的契约」。

**schema-constrained JSON output（受 schema 约束的 JSON 输出）**：调模型时**把 JSON schema 一起传过去**，模型的输出被强制符合这个结构。**不是「求模型输出 JSON 然后祈祷」。**

**tool call / function calling（工具调用）**：现代模型接口允许你告诉模型「你可以调用这几个函数」，**模型自己决定什么时候调、传什么参数**。**这是多智能体系统的基础能力——而这套系统里一个都没有。**

**multi-agent system（多智能体系统）**：**定义特征是模型自己决定下一步做什么、该调用谁——控制权在模型手里。**

**agentic workflow（智能体工作流）**：有多个专职的、带提示词的处理单元，**但编排权在代码手里**。

**orchestrator（编排器）**：负责按顺序调各阶段、管状态的那段代码。这个项目里它叫 `Hermes`。

**artifact（产物）**：一个阶段产出、可以落库、可以被下一阶段读取的结构化对象。

**OpenAPI**：一份描述 HTTP 接口的标准格式文件——有哪些接口、每个接口收什么、返回什么。**FastAPI 会根据你的 Pydantic 模型自动生成它。**

## 这条要讲清什么

**它讲的是控制权在谁手里。**

现在满世界都在把流水线叫成多智能体系统。**这条 bullet 的措辞选择本身就是个判断题**，而且它能用三条代码依据证明自己没有超售。**「凭什么说它不是多智能体系统」那一节，是这一篇最该背下来的部分。**

## 这个系统在干什么

Periplus 是个做旅行研究的系统：给它一份行程简报——去哪、几号到几号、想看什么——它去检索、核实、规划、写稿、编辑、配图，**产出一份每句话都能追溯到原文出处的内容**。

## 凭什么说它是智能体工作流而不是多智能体系统

**这是最该准备的一问，答错方向会显得你在超售。**

**三条硬依据，都能当场指代码。**

**第一，控制流是写死的。**

```python
#: The pipeline's full, fixed order. Hermes only ever runs a contiguous prefix of it — a
#: run may stop after plan and skip Chronicler, but it may never run write without having
#: run everything before it.
STAGE_ORDER: tuple[Stage, ...] = (
    Stage.RESEARCH, Stage.VERIFY, Stage.PLAN,
    Stage.WRITE, Stage.EDIT, Stage.ILLUSTRATE,
)
```

**注意 `tuple` 不是 `list`——它是不可变的**，而且编排器只允许跑它的**连续前缀**。注释的原话可以直接引：**a run may stop after plan, but it may never run write without having run everything before it.**

**第二，零个工具调用。**在整个模型层和 agent 层里搜 `tool` / `function_call` 相关的关键字，**结果是空的**。模型没有任何调用外部能力的口子，**它只被要求在固定位置产出结构化输出**。

**第三，连看起来最像「自己规划」的部分都是代码算的。**检索阶段那个构建检索计划的函数，文档字符串直接写着：**不花一次模型调用就把检索计划算出来。**

**一句话答法**（值得背下来）：

> 多智能体系统的定义特征是模型自己决定下一步做什么、调用谁，**我们这套里模型一次都没有这个权力**——阶段顺序是写死的 tuple，agent 之间没有任何工具调用，连检索计划这种看着最像自己规划的东西都是普通函数算出来的；模型只负责在六个固定位置上产出结构化输出，**所以准确的说法是 agentic workflow：有多个专职的、带提示词的处理单元，但编排权在代码手里**。

**说成多智能体是超售，面试官一问控制流就露馅。**而主动做出这个区分，**反而会让人觉得你对这个领域的术语有判断力**——因为现在满世界都在把工作流叫成多智能体。

## 命名要能三向翻译

简历写的是阶段的全称，**代码里是缩写，文档里还有一套代号**。被问「你们那个阶段叫什么」要报得出代码里的名字。

检索是 `Stage.RESEARCH`，代号 **Explorer**。核实是 `Stage.VERIFY`，代号 **Auditor**。规划是 `Stage.PLAN`，代号 **Navigator**。写稿是 `Stage.WRITE`，代号 **Chronicler**。编辑是 `Stage.EDIT`，代号 **Editor**。配图是 `Stage.ILLUSTRATE`，代号 **Illustrator**。

代号出现在文档字符串和注释里，比如 `ResearchBundle` 的注释写的是 **"Output of the Explorer. Claims here are unverified by construction."**——**注意最后那三个字 `by construction`：不是「碰巧没核实」，是「按定义这一层就不负责核实」。**

## 为什么不用一个大提示词一次做完

**一个大提示词意味着你没有任何中间检查点。**检索阶段编了个来源、规划阶段用了过期的价格，**你只能在最终产出里发现，而且无法归因**。

拆成六个阶段之后**每一步都有类型化的产物加一道关卡（gate）**，关卡会拦掉**结构合法但内容空洞**的产物，不合格的根本进不了下一阶段。

而且拆开之后**每个阶段可以用不同的模型和不同的推理强度**。**核实那一步我们是关掉扩展推理的，因为那里要的是一个逐字比对的读者，不是一个会给自己的结论找理由的推理者。**这句话很值得背，**它同时展示了对模型行为的判断**。

## 带类型的阶段契约换来了什么

**三样**：

- **可替换（swappable）**：换掉某个阶段的实现不影响其他阶段，**编排器只认契约**。
- **可测试（testable）**：每个阶段可以单独喂输入、验输出，[那套测试](/docs?section=periplus&item=scripted-seams)就建在这上面。
- **可恢复（resumable）**：产物有类型、能持久化，所以能从任意已完成的阶段[续跑](/docs?section=periplus&item=persistence-resume)。

## 后端契约怎么和前端保持同步

```
Pydantic 模型（api/schemas.py）
  → FastAPI 自动生成 OpenAPI 描述
  → 前端跑一条命令，把描述转成 TypeScript 类型
```

**关键是「生成」而不是「手写」**：后端改了字段名，前端重新生成之后是**编译期报错**，不是运行时拿到一个 `undefined`。

**代价要能说**：生成的类型和后端是**强耦合（tightly coupled）**的，后端一改前端就得跟着改。**但这正是你想要的——问题在编译期暴露，比在线上暴露便宜得多。**

## 英文怎么说

**两句最容易说错的。**区分那两个词的一句话是 **in a multi-agent system the model decides what happens next; here it never does — the stage order is a fixed tuple and there are zero tool calls**。「编排权在代码手里」说 **the orchestration lives in code, not in the model**。

**术语对照**：智能体工作流 agentic workflow（对应 multi-agent system）／ 编排器 orchestrator ／ 编排 orchestration ／ 控制流 control flow ／ 阶段 stage ／ 契约 contract ／ 结构化输出 structured output ／ 工具调用 tool call、function calling ／ 关卡 gate ／ 产物 artifact ／ 可替换、可测、可恢复 swappable、testable、resumable ／ 接口描述 API schema ／ 类型生成 generated types ／ 强耦合 tightly coupled ／ 编译期报错 compile-time error ／ 超售 overclaim ／ 按定义如此 by construction。

## 30 秒回答

> Periplus 是个做旅行研究的系统：给它一份行程简报，它去检索、核实、规划、写稿、编辑、配图，产出一份每句话都能追溯到原文出处的内容。关键设计是六个阶段之间只通过带类型的 Pydantic 契约交接——每个阶段吃一个结构化对象、吐一个结构化对象，编排器只认这个契约，完全不知道每个阶段内部在干什么。所以我能单独换掉某一个阶段的实现、单独测它、或者让某个阶段根本不调模型，编排器一行都不用改。而且这套契约一直延伸到前端：后端的 Pydantic 模型自动生成 OpenAPI 描述，前端再从描述生成 TypeScript 类型，后端改了字段名，前端是编译期报错，不是线上白屏。

## 自检

1. 能否说清 agentic workflow 和 multi-agent system 的定义差别？
2. 能否说出三条硬依据，并解释 tool call 是什么？
3. 能否报得出六个阶段在代码里的枚举值和它们的代号？
4. 能否说出不用一个大提示词的理由，尤其是核实阶段关掉扩展推理的原因？
5. 能否说出类型化契约换来的三样东西？
6. 能否讲清 OpenAPI 生成类型的链路，并主动说出强耦合这个代价？
7. `STAGE_ORDER` 为什么是 `tuple` 而不是 `list`，「连续前缀」是什么意思？
