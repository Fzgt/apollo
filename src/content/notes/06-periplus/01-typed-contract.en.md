---
title: "① Six stages behind typed contracts"
section: Periplus
---

# ① Six stages behind typed contracts

> **Resume line**
>
> **Six-stage LLM pipeline behind typed Pydantic stage contracts** filled by **schema-constrained JSON output**, with **run state and stage artifacts in PostgreSQL**: **a run that dies mid-pipeline resumes from the last completed stage**.

This note covers the contracts and the orchestration; the persistence and resume half of the same line is in [② Persistence and resume](/docs?section=periplus&item=persistence-resume). Note also that "agentic workflow" and "generating frontend types from OpenAPI" are **not on the resume** — the paper says Pydantic and schema-constrained JSON.

## Terms, in one line each

**LLM** — here, a model called as an API.

**Pydantic** — Python's data validation library. **You declare a class with typed fields and it validates and coerces at runtime.** Here it plays the role of the contract between stages.

**Schema-constrained JSON output** — **the JSON schema is sent with the call**, and the model's output is forced to conform. **Not "ask for JSON and hope".**

**Tool call / function calling** — modern model APIs let you tell the model "you may call these functions", and **the model decides when to call and with what arguments.** **This is the enabling capability of a multi-agent system — and there are none here.**

**Multi-agent system** — **defined by the model deciding what happens next and who to call. Control lives in the model.**

**Agentic workflow** — several specialised, prompted units, **but the orchestration lives in code.**

**Orchestrator** — the code that runs the stages in order and manages state. Here it is called `Hermes`.

**Artifact** — a structured object a stage produces, which can be persisted and read by the next stage.

**OpenAPI** — a standard document describing an HTTP API: which endpoints exist, what each accepts, what it returns. **FastAPI generates it from your Pydantic models.**

## What this line has to show

**It is about who holds control.**

Everyone is calling their pipeline a multi-agent system right now. **The wording of this line is itself a judgement call**, and it can prove it did not overclaim with three pieces of code evidence. **The section on why this is not a multi-agent system is the part of this note to memorise.**

## What the system does

Periplus does travel research: given a brief — where, which dates, what you care about — it researches, verifies, plans, writes, edits and illustrates, **producing content where every sentence traces back to a source.**

## Why this is an agentic workflow and not a multi-agent system

**This is the question to prepare, and answering it in the wrong direction makes you look like you are overclaiming.**

**Three hard pieces of evidence, each pointing at code.**

**One: the control flow is fixed.**

```python
#: The pipeline's full, fixed order. Hermes only ever runs a contiguous prefix of it — a
#: run may stop after plan and skip Chronicler, but it may never run write without having
#: run everything before it.
STAGE_ORDER: tuple[Stage, ...] = (
    Stage.RESEARCH, Stage.VERIFY, Stage.PLAN,
    Stage.WRITE, Stage.EDIT, Stage.ILLUSTRATE,
)
```

**Note it is a `tuple`, not a `list` — immutable** — and the orchestrator only ever runs a **contiguous prefix** of it. The comment is quotable as it stands: **a run may stop after plan, but it may never run write without having run everything before it.**

**Two: zero tool calls.** Searching the model layer and the agent layer for `tool` / `function_call` returns **nothing.** The model has no channel to invoke anything external; **it is only asked to produce structured output at fixed positions.**

**Three: even the part that most resembles self-planning is computed in code.** The function that builds the research plan says so in its docstring: **it computes the plan without spending a model call.**

**The one-paragraph answer** (worth memorising):

> A multi-agent system is defined by the model deciding what happens next and who to call, and **in this system the model never has that power** — the stage order is a fixed tuple, there are zero tool calls between agents, and even the research plan, the thing that looks most like planning, is computed by an ordinary function. The model only produces structured output at six fixed positions, **so the accurate term is an agentic workflow: several specialised, prompted units, with the orchestration in code.**

**Calling it multi-agent is overclaiming, and one question about the control flow exposes it.** Making the distinction unprompted **suggests you have judgement about the terminology in this field** — precisely because everyone is calling workflows multi-agent right now.

## The names have to translate three ways

The resume uses the full stage names, **the code uses short ones, and the docs use codenames.** Asked "what is that stage called", you need the name in the code.

Research is `Stage.RESEARCH`, codenamed **Explorer**. Verify is `Stage.VERIFY`, codenamed **Auditor**. Plan is `Stage.PLAN`, codenamed **Navigator**. Write is `Stage.WRITE`, codenamed **Chronicler**. Edit is `Stage.EDIT`, codenamed **Editor**. Illustrate is `Stage.ILLUSTRATE`, codenamed **Illustrator**.

Codenames appear in docstrings and comments — `ResearchBundle` is documented as **"Output of the Explorer. Claims here are unverified by construction."** **Note those last two words: not "happened not to be verified", but "this layer is by definition not responsible for verification".**

## Why not one big prompt

**One big prompt means no intermediate checkpoints.** If research invented a source or planning used a stale price, **you only find out in the final output, and you cannot attribute it.**

Split into six stages, **every step has a typed artifact plus a gate**, and the gate rejects artifacts that are **structurally valid but substantively empty** — a failing one never reaches the next stage.

Splitting also lets **each stage use a different model and a different reasoning effort.** **Extended reasoning is switched off for verification, because what that step needs is a reader doing a literal comparison, not a reasoner constructing justifications for its own conclusions.** That sentence is worth memorising; **it demonstrates judgement about model behaviour at the same time.**

## What typed stage contracts buy

**Three things**:

- **Swappable** — replacing a stage's implementation affects nothing else, because **the orchestrator only knows the contract.**
- **Testable** — each stage can be fed an input and checked, which is what [the test suite](/docs?section=periplus&item=scripted-seams) is built on.
- **Resumable** — artifacts are typed and persistable, so a run can [resume](/docs?section=periplus&item=persistence-resume) from any completed stage.

## How the backend contract stays in sync with the frontend

```
Pydantic models (api/schemas.py)
  → FastAPI generates the OpenAPI description
  → the frontend runs one command to turn it into TypeScript types
```

**The point is that the types are generated, not written by hand**: rename a field in the backend and, after regeneration, the frontend gets a **compile-time error** rather than an `undefined` at runtime.

**State the cost**: generated types are **tightly coupled** to the backend, so a backend change forces a frontend change. **Which is what you want — a problem surfacing at compile time is far cheaper than one surfacing in production.**

## The 30-second answer

> Periplus does travel research: give it a brief and it researches, verifies, plans, writes, edits and illustrates, producing content where every sentence traces back to a source. The key design is that the six stages hand off only through typed Pydantic contracts — each stage takes a structured object and returns a structured object, and the orchestrator knows the contract and nothing about what happens inside a stage. So I can replace one stage's implementation, test it on its own, or have a stage make no model call at all, without touching a line of the orchestrator. And the contract runs all the way to the frontend: the backend's Pydantic models generate an OpenAPI description, the frontend generates TypeScript types from it, and a renamed field is a compile error rather than a white screen in production.

## Self-check

1. Can you state the definitional difference between an agentic workflow and a multi-agent system?
2. Can you give the three pieces of evidence, and explain what a tool call is?
3. Can you give all six stages' enum values and their codenames?
4. Can you explain why not one big prompt, especially why verification runs with extended reasoning off?
5. Can you name the three things typed contracts buy?
6. Can you describe the OpenAPI type-generation chain and volunteer the tight-coupling cost?
7. Why is `STAGE_ORDER` a `tuple` rather than a `list`, and what does "contiguous prefix" mean?
