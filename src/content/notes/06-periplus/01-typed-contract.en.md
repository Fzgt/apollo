---
title: "① Six stages behind typed contracts"
section: Periplus
---

# ① Six stages behind typed contracts

> **Resume line**
>
> **Six-stage LLM pipeline behind typed Pydantic stage contracts** filled by **schema-constrained JSON output**, with **run state and stage artifacts in PostgreSQL**: **a run that dies mid-pipeline resumes from the last completed stage**.

> ℹ️ **This page covers the contracts and the orchestration**; the persistence and resuming half of the same bullet is in [② Persistence and resuming](/docs?section=periplus&item=persistence-resume). **The phrases "agentic workflow" and "frontend types generated from OpenAPI" are not on the resume** — do not quote them as if they were. What is on paper is Pydantic and schema-constrained JSON.

## What this bullet is about

⭐ **It is about who holds control.**

Everyone is currently calling their pipeline a multi-agent system. **The wording of this bullet is itself a judgement call** — and it can prove it is not overclaiming with three pieces of code evidence. **Section 3 is the part of this page to memorise.**

## 1. What the system does

**Periplus is a travel-research system**: give it a trip brief (where, which dates, what you want to see) and it searches, verifies, plans, writes, edits and illustrates, **producing content where every sentence traces back to a source.**

**Six stages run in order**: research → verify → plan → write → edit → illustrate.

## 2. The 30-second version (usable with light editing)

> Periplus is a travel-research system: give it a trip brief and it searches, verifies, plans, writes, edits and illustrates, producing content where **every sentence traces back to a source.**
>
> **The key design is that the six stages hand off only through typed contracts** — each stage eats a structured object and emits a structured object, and **the orchestrator knows only the contract and nothing about what happens inside a stage**. So I can replace one stage's implementation, test it in isolation, or have a stage make no model call at all, **without changing a line of the orchestrator.**
>
> **And the contract reaches all the way to the front end** — the backend data models generate an API schema automatically, and the front end generates TypeScript types from that schema. **A renamed backend field is a compile error, not a white screen in production.**

## 3. ⭐ The question to prepare hardest: why call it an agentic workflow rather than a multi-agent system

**The resume used the phrase `six-stage agentic workflow`. It is a wording choice that invites a follow-up, and answering it in the wrong direction makes you look like you are overselling.**

### First, the difference between the two terms

| | Defining characteristic |
|---|---|
| **Multi-agent system** | ⭐ **The model decides what happens next and who to call** — control sits with the model |
| **Agentic workflow** | Several **specialised, prompted** processing units, **but the orchestration lives in code** |

### Three hard pieces of evidence, all pointable at code

| Evidence | Code |
|---|---|
| **① The control flow is hard-coded, not model-decided** | `STAGE_ORDER` at `hermes.py:45-52` is a **fixed tuple**, and **only a contiguous prefix of it may run** — the comment says: "a run may stop after plan, **but it can never run write without having run research**" |
| **② Zero tool calls** | `grep -rn "tools=\|tool_choice\|function_call" periplus/llm/ periplus/agents/` **returns nothing.** **The model has no channel to call any external capability** — it is only asked to produce structured output at fixed points |
| **③ Even the part that looks like self-planning is computed in code** | The docstring at `research.py:107` says outright: *"Build a stable search plan **without spending a model call**"* |

> **What a "tool call" (function calling) is**: modern model APIs let you tell the model "you may call these functions", and the model decides when to call them and with what arguments. **It is the base capability of a multi-agent system — and there is not one here.**

### The one-paragraph answer

> "**The defining characteristic of a multi-agent system is the model deciding what happens next and who to call. In ours the model never has that power** — the stage order is a fixed tuple, there are no tool calls between agents, **and even the search plan, the thing that looks most like self-planning, is computed by an ordinary function.** The model's only job is producing structured output at six fixed points. **So the accurate term is agentic workflow: several specialised prompted units, with orchestration in code.**"

> ⚠️ **Calling it multi-agent is an overclaim, and one question about the control flow exposes it.**
>
> ⭐ **Whereas volunteering the distinction makes you look like you have judgement about this field's terminology** — **because right now everyone is calling their workflow a multi-agent system.**

## 4. The names have to translate three ways

**The resume uses full stage names, the code uses abbreviations, and the docs use a third set of code names** — asked "what is that stage called", you need the name in the code.

| Resume (full name) | Enum value in code | Code name | File |
|---|---|---|---|
| research | `RESEARCH = "research"` | **Explorer** | `agents/research.py` |
| verification | `VERIFY = "verify"` | **Auditor** | `agents/verification.py` |
| planning | `PLAN = "plan"` | **Navigator** | `agents/navigation.py` |
| writing | `WRITE = "write"` | **Chronicler** | `agents/content.py` |
| editing | `EDIT = "edit"` | **Editor** | `agents/editor.py` |
| illustration | `ILLUSTRATE = "illustrate"` | **Illustrator** | `agents/illustration.py` |

> The code names appear in docstrings and comments (a data structure's comment reads *"Output of the Explorer"*), **and the class names are a third set again** (`EditorAgent`, `IllustrationAgent`). **You need all three to line up.**

## 5. Three more must-answer questions

### Q: Why not one big prompt doing it all at once?

> "One big prompt means **you have no intermediate checkpoints at all**. If research invents a source or planning uses a stale price, **you only find out in the final output, and you cannot attribute it.**
>
> Split into six stages, every step has **a typed artifact and a gate** — the gates in `stages.py` reject output that is structurally valid but substantively empty, **so a failing artifact never reaches the next stage.**
>
> **And once split, each stage can use a different model and a different reasoning effort** — for verification we **turn extended reasoning off**, because what that step needs is a reader comparing word for word, **not a reasoner constructing justifications for its own conclusions.**"

### Q: What do typed stage contracts buy?

**Three things:**

| | Note |
|---|---|
| **Swappable** | Replace a stage's implementation without affecting the others — the orchestrator knows only the contract |
| **Testable** | Each stage can be fed inputs and checked in isolation, which is what [the 461 tests](/docs?section=periplus&item=scripted-seams) are built on |
| **Resumable** | Artifacts are typed and persistable, **so a run can resume from any completed stage** (see [② Persistence and resuming](/docs?section=periplus&item=persistence-resume))) |

### Q: How does the backend contract stay in sync with React?

```
Python data models (api/schemas.py)
  → FastAPI generates the OpenAPI schema automatically
    → the front end runs one command:
       openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.generated.ts
         → producing a TypeScript type definition file
```

**What "OpenAPI" is**: a standard file format describing an API — which endpoints exist, what each accepts and what it returns. **FastAPI generates it from your Python data models automatically.**

> ⭐ **The key word is "generated", not "hand-written"**: rename a backend field, regenerate on the front end, and **you get a compile error rather than a runtime undefined.**
>
> **That is the literal source of `carried through to the React client as types generated from the OpenAPI schema` on the resume.**

> ⚠️ **Be able to state the cost**: the generated types are **tightly coupled** to the backend — a backend change forces a front-end change. **But that is precisely what you want**: a problem surfacing at compile time is far cheaper than one surfacing in production.

## Glossary

| 中文 | English |
|---|---|
| 智能体工作流 | **agentic workflow** ↔ **multi-agent system** |
| 编排器 / 编排 | **orchestrator · orchestration** |
| 控制流 | **control flow** (*the control flow is hard-coded*) |
| 阶段 | **stage** |
| 契约 | **contract** (*typed stage contracts*) |
| 结构化输出 | **structured output** |
| 工具调用 | **tool call / function calling** |
| 关卡 | **gate** (*a gate rejects structurally valid but empty output*) |
| 产物 | **artifact** |
| 可替换 / 可测 / 可恢复 | **swappable · testable · resumable** |
| 接口描述 | **API schema** (OpenAPI) |
| 类型生成 | **generated types** (*types generated from the OpenAPI schema*) |
| 强耦合 | **tightly coupled** |
| 编译期报错 | **compile-time error** |
| 超售 | **overclaim** (⚠️ *calling it multi-agent would be an overclaim*) |

> ⭐ **The two easiest to get wrong**:
>
> 1. The sentence separating the two terms: **"In a multi-agent system the model decides what happens next. Here it never does — the stage order is a fixed tuple and there are zero tool calls."**
> 2. "Orchestration sits in the code" is **the orchestration lives in code, not in the model**
