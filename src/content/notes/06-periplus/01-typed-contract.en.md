---
title: "① Six stages behind typed contracts"
section: Periplus
---

# ① Six stages behind typed contracts

> **Resume line**
>
> **Six-stage LLM pipeline behind typed Pydantic stage contracts** filled by **schema-constrained JSON output**, with **run state and stage artifacts in PostgreSQL**: **a run that dies mid-pipeline resumes from the last completed stage**.

This note covers the contracts and the orchestration; the persistence and resume half of the same resume line is in [② Persistence and resume](/docs?section=periplus&item=persistence-resume). Also, "agentic workflow" and "generating frontend types from OpenAPI" are not on the resume, so do not recite them as the original wording — the paper says Pydantic and schema-constrained JSON.

## What this line has to show

It is about who holds control.

Everyone right now is calling pipelines multi-agent systems. The word choice in this line is itself a judgement call, and it can prove it is not overclaiming with three pieces of evidence from the code. The section on why this is not a multi-agent system is the part of this note to memorise.

## What the system does

Periplus does travel research. Give it a brief — where, which dates, what you want to see — and it retrieves, verifies, plans, writes, edits and illustrates, producing content where every sentence traces back to a source quote.

Six stages run in order: research, verify, plan, write, edit, illustrate.

## Why this is an agentic workflow and not a multi-agent system

This is the question to prepare hardest, because answering it in the wrong direction makes you sound like you are overclaiming.

First the distinction. The defining characteristic of a multi-agent system is that the model decides what happens next and who gets called — control lives in the model. An agentic workflow has several specialised, prompt-driven units, but the orchestration lives in code.

Three pieces of hard evidence, each pointing at code.

First, the control flow is hard-coded. The stage order is a fixed tuple, and only a contiguous prefix of it may run. The comment's words: a run may stop after plan, but it can never run write without having run research.

Second, zero tool calls. Grep the whole model layer and agent layer for tool-calling keywords and it comes back empty. The model has no channel to any external capability; it is only asked to produce structured output at fixed positions.

Third, even the part that looks most like the model planning for itself is computed in code. The function that builds the search plan in the research stage says so in its docstring: it builds a stable search plan without spending a model call.

For context, tool calling is the modern API feature where you tell the model it may call certain functions and the model decides when to call them and with what arguments. It is the foundational capability of a multi-agent system — and there is not one here.

The one-sentence answer: in a multi-agent system the model decides what happens next and who gets called; here it never has that power — the stage order is a fixed tuple, there are no tool calls between agents, and even the search plan, the thing that looks most like self-planning, is computed by an ordinary function. The model only produces structured output at six fixed positions. So the accurate term is agentic workflow: several specialised, prompt-driven units, with the orchestration in code.

Calling it multi-agent would be an overclaim, and one question about control flow exposes it. Making the distinction yourself, on the other hand, reads as judgement about the vocabulary of the field — because everyone is currently calling workflows multi-agent.

## The names translate three ways

The resume uses the stages' full names, the code uses short ones, and the docs use a third set of codenames. If asked what a stage is called, be able to give the name in the code.

Research is `research` in the enum, codename Explorer. Verification is `verify`, codename Auditor. Planning is `plan`, codename Navigator. Writing is `write`, codename Chronicler. Editing is `edit`, codename Editor. Illustration is `illustrate`, codename Illustrator.

The codenames appear in docstrings and comments — one data structure's comment reads "Output of the Explorer" — and the class names are yet a third set. All three need to map.

## Why not one big prompt

One big prompt means no intermediate checkpoints anywhere. If the research stage invented a source or the planning stage used a stale price, you only find out in the final output, and you cannot attribute it.

Split into six stages, every step produces a typed artifact and passes a gate, and the gate rejects output that is structurally valid but empty. Anything failing it never reaches the next stage.

Splitting also lets each stage use a different model at a different reasoning effort. Verification runs with extended reasoning turned off, because what that step needs is a reader comparing text word for word, not a reasoner that will find justifications for its own conclusions. That sentence is worth memorising; it demonstrates judgement about model behaviour as well as architecture.

## What typed stage contracts buy

Three things. Swappable: replace one stage's implementation without touching the others, because the orchestrator only knows the contract. Testable: each stage can be fed inputs and checked in isolation, which is what [the test suite](/docs?section=periplus&item=scripted-seams) is built on. Resumable: the artifacts are typed and can be persisted, which is what makes [resuming from any completed stage](/docs?section=periplus&item=persistence-resume) possible.

## How the backend contract stays in sync with the frontend

The chain: the Python data models live in the API schema module, FastAPI generates an OpenAPI description from them automatically, and the frontend runs one command turning that description into TypeScript type definitions.

OpenAPI is a standard format describing an API: which endpoints exist, what each accepts, what each returns. FastAPI generates it from your Python models.

The point is that it is generated, not hand-written. Rename a field on the backend, regenerate, and the frontend gets a compile-time error rather than an `undefined` at runtime.

State the cost: the generated types are tightly coupled to the backend, so a backend change forces a frontend change. But that is what you want — a problem surfacing at compile time is far cheaper than the same problem surfacing in production.

## The 30-second answer

> Periplus does travel research: give it a brief and it retrieves, verifies, plans, writes, edits and illustrates, producing content where every sentence traces back to a source quote. The key design is that the six stages only hand off through typed contracts — each stage takes a structured object and returns a structured object, and the orchestrator knows only the contract and nothing about what happens inside a stage. So I can replace one stage's implementation, test it in isolation, or make a stage skip the model entirely, without touching a line of the orchestrator. And the contract extends to the frontend: the backend's data models generate the API description, and the frontend generates TypeScript types from it, so renaming a backend field is a compile error rather than a blank page in production.

## Self-check

1. Can you state the definitional difference between an agentic workflow and a multi-agent system?
2. Can you give the three pieces of hard evidence, and explain what tool calling is?
3. Can you give the six stages' enum values and their codenames?
4. Can you give three reasons against one big prompt, particularly why verification runs without extended reasoning?
5. Can you name the three things typed contracts buy?
6. Can you walk the OpenAPI type generation chain and volunteer the coupling cost?
