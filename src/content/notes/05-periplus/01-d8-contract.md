---
title: "① 六阶段与 typed contract"
tier: must
section: Periplus
icon: workflow
day: 8
level: S
status: done
---

# 编排这条怎么讲

> 🔴 **必看**。⚠️ **机制原理以 [Library 的 Periplus AI 笔记](/library?section=periplus&item=ai) 为主**（618 行，六个 agent 逐一精读）。**这一篇只给三样它没有的**：口播稿、命名对照、以及那个会决定你可信度的追问。
>
> 数字口径见 [#14 · 406 tests](/docs?section=periplus&item=n14-server-tests) · [#15 · 一秒](/docs?section=periplus&item=n15-end-to-end)。

## 30 秒口播稿（改一改就能用）

> Periplus 是个做旅行研究的系统：给它一个行程简报，它去检索、核实、规划、写稿、编辑、配图，产出一份**每句话都能追溯到原文出处**的内容。
>
> **关键设计是六个阶段之间只通过「带类型的契约」交接**——每个阶段吃一个 Pydantic 模型、吐一个 Pydantic 模型，编排器只认这个契约，**完全不知道每个阶段内部在干什么**。所以我能单独换掉某一个阶段的实现、单独测它、或者让某个阶段根本不调模型，编排器一行都不用改。
>
> **而且这套契约一直延伸到前端**——后端的 Pydantic 模型生成 OpenAPI schema，前端用 `openapi-typescript` 直接生成 TS 类型。**后端改了字段名，前端是编译期报错，不是线上白屏。**

## ⭐ 最该准备的一问：凭什么说它是 agentic workflow 而不是 multi-agent system

**简历 v41 用的词是 `six-stage agentic workflow`。这是个会被追问的措辞选择，而且答错方向会显得你在超售。**

**三条硬依据，都能当场指代码：**

| 依据 | 代码 |
|---|---|
| **控制流是写死的，不是模型决定的** | `hermes.py:45-52` 的 `STAGE_ORDER` 是一个**固定 tuple**，而且只允许跑它的**连续前缀**——「可以在 plan 之后停下，但永远不能在没跑 research 的情况下跑 write」 |
| **零个 tool call** | `grep -rn "tools=\|tool_choice\|function_call" periplus/llm/ periplus/agents/` **返回空**。模型只被要求在固定位置产出结构化输出，**它没有任何调用外部能力的口子** |
| **连「看起来像 agent 自己规划」的部分都是代码算的** | `research.py:107` 的 `build_research_queries`，docstring 直接写着 *"Build a stable search plan **without spending a model call**"* |

> **一句话答法**：「**multi-agent system 的定义特征是模型自己决定下一步做什么、调用谁。我们这套里模型一次都没有这个权力**——阶段顺序是写死的 tuple，agent 之间没有任何 tool call，连检索计划这种看着最像『自己规划』的东西都是普通函数算出来的。模型只负责在六个固定位置上产出结构化输出。**所以准确的说法是 agentic workflow：有多个专职的、带 prompt 的处理单元，但编排权在代码手里。**」
>
> ⚠️ **说成 multi-agent 是超售，面试官一问控制流就露馅。** 而主动做出这个区分，反而会让人觉得你对这个领域的术语有判断力——**因为现在满世界都在把 workflow 叫成 multi-agent。**

## 命名要能三向翻译

**简历写的是阶段的全称，代码里是缩写，文档里还有一套代号——被问「你们那个阶段叫什么」要报得出代码里的名字。**

| 简历（全称） | 代码 `Stage` 枚举 | 代号 | 文件 |
|---|---|---|---|
| research | `RESEARCH = "research"` | **Explorer** | `agents/research.py` |
| verification | `VERIFY = "verify"` | **Auditor** | `agents/verification.py` |
| planning | `PLAN = "plan"` | **Navigator** | `agents/navigation.py` |
| writing | `WRITE = "write"` | **Chronicler** | `agents/content.py` |
| editing | `EDIT = "edit"` | **Editor** | `agents/editor.py` |
| illustration | `ILLUSTRATE = "illustrate"` | **Illustrator** | `agents/illustration.py` |

> 代号出现在 docstring 和注释里（比如 `ResearchBundle` 的注释是 *"Output of the Explorer"*），**类名是另一套**（`EditorAgent`、`IllustrationAgent`）。**三套名字都要能对上。**

## 另外三个必答

**Q：为什么不用一个大 prompt？**

> 「一个大 prompt 意味着**你没有任何中间检查点**。研究阶段编了个来源、规划阶段用了过期的价格，你只能在最终产出里发现，而且无法归因。拆成六个阶段之后每一步都有**类型化的产物 + 一道 gate**——`stages.py` 里的 stage gate 会拦掉『结构合法但内容空洞』的产物，不合格的根本进不了下一阶段。**而且拆开之后每个阶段可以用不同的模型和不同的 thinking 级别**——verify 那步我们是关掉扩展推理的，因为那里要的是一个逐字比对的读者，不是一个会给自己找理由的推理者。」

**Q：typed stage contract 换来了什么？**

三样：**可替换**（换掉某个阶段的实现不影响其他）、**可测试**（每个阶段单独喂输入验输出，[#14](/docs?section=periplus&item=n14-server-tests) 的 406 个测试就建在这上面）、**可恢复**（产物有类型、能持久化，所以能从任意已完成阶段续跑——Day 10 的内容）。

**Q：后端契约怎么和 React 保持同步？**

```
Pydantic 模型 (api/schemas.py)
  → FastAPI 自动生成 OpenAPI schema
    → npm run generate:api
       openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.generated.ts
         → 前端拿到 TS 类型
```

> **关键是「生成」而不是「手写」**：后端改字段名，前端重新生成之后是**编译期报错**，不是运行时 undefined。**这就是简历里 `carried through to the React client as types generated from the OpenAPI schema` 的字面出处。**
>
> ⚠️ **代价要能说**：生成的类型和后端是强耦合的，后端一改前端就得跟着改——**但这正是你想要的**，问题在编译期暴露比在线上暴露便宜得多。

## Library 导航

| 读什么 | 为什么 |
|---|---|
| **系统全貌：六阶段总览** | 建立整体图景 |
| **六个 agent 逐一精读** | 每个 agent 吃什么吐什么 |
| **Claim / Evidence / Verdict 三层对象模型** | ⭐ Day 9 的核心，今天先看一遍 |
| **Hermes：stage gate / budget / bounded retry / replay** | ⭐ **今天的重点**，尤其 stage gate 拦什么 |
