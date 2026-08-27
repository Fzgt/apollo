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
> Built a **six-stage agentic workflow** — research, verification, planning, writing, editing and illustration — where the **orchestrator knows only typed stage contracts**, carried through to the React client as **types generated from the OpenAPI schema**.
>
> ---
>
> 构建六阶段 agentic 工作流 —— 检索、核实、规划、写作、编辑与配图 —— 编排器只认识带类型的阶段契约；这套契约一路延伸到 React 客户端，类型由 OpenAPI schema 生成。

## 这条 bullet 在讲什么

⭐ **它讲的是「控制权在谁手里」。**

现在满世界都在把流水线叫成 multi-agent system。**这条 bullet 的措辞选择本身就是个判断题** —— 而且它能用三条代码依据证明自己没有超售。**第三节是这一篇最该背下来的部分。**

## 一、这个系统在干什么

**Periplus 是个做旅行研究的系统**：给它一份行程简报（去哪、几号到几号、想看什么），它去检索、核实、规划、写稿、编辑、配图，**产出一份每句话都能追溯到原文出处的内容**。

**六个阶段依次跑**：research（检索）→ verify（核实）→ plan（规划）→ write（写稿）→ edit（编辑）→ illustrate（配图）。

## 二、30 秒口播稿（改一改就能用）

> Periplus 是个做旅行研究的系统：给它一份行程简报，它去检索、核实、规划、写稿、编辑、配图，产出一份**每句话都能追溯到原文出处**的内容。
>
> **关键设计是六个阶段之间只通过「带类型的契约」交接** —— 每个阶段吃一个结构化对象、吐一个结构化对象，**编排器只认这个契约，完全不知道每个阶段内部在干什么**。所以我能单独换掉某一个阶段的实现、单独测它、或者让某个阶段根本不调模型，**编排器一行都不用改**。
>
> **而且这套契约一直延伸到前端** —— 后端的数据模型自动生成接口描述，前端再从描述生成 TypeScript 类型。**后端改了字段名，前端是编译期报错，不是线上白屏。**

## 三、⭐ 最该准备的一问：凭什么说它是 agentic workflow 而不是 multi-agent system

**简历用的词是 `six-stage agentic workflow`（六阶段的智能体工作流）。这是个会被追问的措辞选择，而且答错方向会显得你在超售。**

### 先说清这两个词的区别

| | 定义特征 |
|---|---|
| **multi-agent system**（多智能体系统） | ⭐ **模型自己决定下一步做什么、该调用谁** —— 控制权在模型手里 |
| **agentic workflow**（智能体工作流） | 有多个**专职的、带提示词的**处理单元，**但编排权（orchestration）在代码手里** |

### 三条硬依据，都能当场指代码

| 依据 | 代码 |
|---|---|
| **① 控制流是写死的，不是模型决定的** | `hermes.py:45-52` 的 `STAGE_ORDER` 是一个**固定的元组**，而且**只允许跑它的连续前缀** —— 注释原话：「一次运行可以在 plan 之后停下，**但永远不能在没跑 research 的情况下跑 write**」 |
| **② 零个工具调用** | `grep -rn "tools=\|tool_choice\|function_call" periplus/llm/ periplus/agents/` **返回空**。**模型没有任何调用外部能力的口子** —— 它只被要求在固定位置产出结构化输出 |
| **③ 连「看起来像自己规划」的部分都是代码算的** | `research.py:107` 那个函数的文档字符串直接写着 *"Build a stable search plan **without spending a model call**"*（**不花一次模型调用**就把检索计划算出来） |

> **「工具调用」（tool call / function calling）是什么**：现代模型 API 允许你告诉模型「你可以调用这几个函数」，模型自己决定什么时候调、传什么参数。**这是 multi-agent 系统的基础能力 —— 而这里一个都没有。**

### 一句话答法

> 「**multi-agent system 的定义特征是模型自己决定下一步做什么、调用谁。我们这套里模型一次都没有这个权力** —— 阶段顺序是写死的元组，agent 之间没有任何工具调用，**连检索计划这种看着最像『自己规划』的东西都是普通函数算出来的**。模型只负责在六个固定位置上产出结构化输出。**所以准确的说法是 agentic workflow：有多个专职的、带提示词的处理单元，但编排权在代码手里。**」

> ⚠️ **说成 multi-agent 是超售，面试官一问控制流就露馅。**
>
> ⭐ **而主动做出这个区分，反而会让人觉得你对这个领域的术语有判断力** —— **因为现在满世界都在把 workflow 叫成 multi-agent。**

## 四、命名要能三向翻译

**简历写的是阶段的全称，代码里是缩写，文档里还有一套代号** —— 被问「你们那个阶段叫什么」要报得出代码里的名字。

| 简历（全称） | 代码里的枚举值 | 代号 | 文件 |
|---|---|---|---|
| research | `RESEARCH = "research"` | **Explorer** | `agents/research.py` |
| verification | `VERIFY = "verify"` | **Auditor** | `agents/verification.py` |
| planning | `PLAN = "plan"` | **Navigator** | `agents/navigation.py` |
| writing | `WRITE = "write"` | **Chronicler** | `agents/content.py` |
| editing | `EDIT = "edit"` | **Editor** | `agents/editor.py` |
| illustration | `ILLUSTRATE = "illustrate"` | **Illustrator** | `agents/illustration.py` |

> 代号出现在文档字符串和注释里（比如某个数据结构的注释是 *"Output of the Explorer"*），**而类名又是第三套**（`EditorAgent`、`IllustrationAgent`）。**三套名字都要能对上。**

## 五、另外三个必答

### Q：为什么不用一个大提示词一次做完

> 「一个大提示词意味着**你没有任何中间检查点**。检索阶段编了个来源、规划阶段用了过期的价格，**你只能在最终产出里发现，而且无法归因**。
>
> 拆成六个阶段之后每一步都有**类型化的产物 + 一道关卡** —— `stages.py` 里的关卡会拦掉『结构合法但内容空洞』的产物，**不合格的根本进不了下一阶段**。
>
> **而且拆开之后每个阶段可以用不同的模型和不同的推理强度** —— 核实那一步我们是**关掉扩展推理**的，因为那里要的是一个逐字比对的读者，**不是一个会给自己的结论找理由的推理者**。」

### Q：带类型的阶段契约换来了什么

**三样：**

| | 说明 |
|---|---|
| **可替换** | 换掉某个阶段的实现，不影响其他阶段 —— 编排器只认契约 |
| **可测试** | 每个阶段可以单独喂输入、验输出，[406 个测试](/docs?section=periplus&item=scripted-seams)就建在这上面 |
| **可恢复** | 产物有类型、能持久化，**所以能从任意已完成的阶段续跑**（见 [② 持久化与 resume](/docs?section=periplus&item=persistence-resume))） |

### Q：后端契约怎么和 React 保持同步

```
Python 数据模型（api/schemas.py）
  → FastAPI 自动生成 OpenAPI 接口描述
    → 前端跑一条命令：
       openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.generated.ts
         → 得到一份 TypeScript 类型定义
```

**「OpenAPI」是什么**：一份描述接口的标准格式文件（**接口描述** = API schema） —— 有哪些接口、每个接口收什么、返回什么。**FastAPI 会根据你的 Python 数据模型自动生成它。**

> ⭐ **关键是「生成」而不是「手写」**：后端改了字段名，前端重新生成之后**是编译期报错，不是运行时 undefined**。
>
> **这就是简历里 `carried through to the React client as types generated from the OpenAPI schema` 的字面出处。**

> ⚠️ **代价要能说**：生成的类型和后端是**强耦合**的 —— 后端一改前端就得跟着改。**但这正是你想要的**：问题在编译期暴露，比在线上暴露便宜得多。

## 六、本篇术语英文对照

| 中文 | 英文 |
|---|---|
| 智能体工作流 | **agentic workflow** ↔ **multi-agent system** |
| 编排器 / 编排 | **orchestrator · orchestration** |
| 控制流 | **control flow**（*the control flow is hard-coded*） |
| 阶段 | **stage** |
| 契约 | **contract**（*typed stage contracts*） |
| 结构化输出 | **structured output** |
| 工具调用 | **tool call / function calling** |
| 关卡 | **gate**（*a gate rejects structurally valid but empty output*） |
| 产物 | **artifact** |
| 可替换 / 可测 / 可恢复 | **swappable · testable · resumable** |
| 接口描述 | **API schema**（OpenAPI） |
| 类型生成 | **generated types**（*types generated from the OpenAPI schema*） |
| 强耦合 | **tightly coupled** |
| 编译期报错 | **compile-time error** |
| 超售 | **overclaim**（⚠️ *calling it multi-agent would be an overclaim*） |

> ⭐ **两个最容易说错的**：
>
> 1. 区分那两个词的一句话：**"In a multi-agent system the model decides what happens next. Here it never does — the stage order is a fixed tuple and there are zero tool calls."**
> 2. 「编排权在代码手里」说 **the orchestration lives in code, not in the model**
