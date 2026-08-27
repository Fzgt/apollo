---
title: Cross-project follow-ups
section: Cheat sheet
---

# Cross-project follow-ups

> The actual questions from Day 14, Round 3. What makes each one worth practising is that **the same abstract question gets answered with examples from two different projects**.

## 1. What kind of work does a virtual list remove, and what kind does GPU instancing remove?

**On the surface both "do less work", but they are not the same thing at all — that is the point of this question.**

| | What it removes | What it costs |
|---|---|---|
| **Virtual list** | Style / layout / paint on the **browser main thread**. The DOM node count goes from **O(n) (grows with rows loaded) to O(1) (grows only with viewport height)** | Almost nothing — those nodes were off screen anyway |
| **GPU instancing** | **Draw-call submission from CPU to GPU** (driver state validation, command packing), 129 → 76 | ⭐ **Triangles submitted go up 2.6×** (26,230 → 69,112), because culling granularity drops from "per block" to "per whole section" |

> ⭐ **The distinction that matters**: **the virtual list genuinely does less work** — those DOM nodes do not exist. **Instancing moves work from the CPU to the GPU, and the total work actually goes up.**
>
> That trade only pays off when **the bottleneck at the time was the CPU and the GPU had headroom** — the line in the harness about all four scenes sitting at the compositor's 120 fps ceiling is the evidence. **At a higher resolution, or with heavy post-processing, the trade should flip: switch to instancing by spatial chunk and buy some culling granularity back.**

> Hint: one removes style/layout/paint on the browser main thread, the other removes draw-call submission on the GPU — and instancing **adds** triangles. Both are trading one cost for another.

## 2. Which guarantees come from deterministic code, and which can only be measured by an eval?

**The test in one line: if it can be written as an assertion, write it as code; only "is this better or worse" needs an eval.**

| Guaranteed by deterministic code | Where |
|---|---|
| Citation integrity | Periplus: an evidence ID the model cites must exist in the evidence set — **a set membership check** |
| Freshness | Periplus: `as_of` minus the publication date, compared against `FRESHNESS_DAYS` — **date arithmetic** |
| Idempotency | The unique index on the withdrawal idempotency key, the anti-join in the Beyz cron |
| Legal state | The Beyz four-state machine; Periplus `STAGE_ORDER` only runs a contiguous prefix |
| Business invariants | `WHERE balance >= ?`, `ne(subscribedPlan, Lifetime)` |

| Only measurable by an eval | Why |
|---|---|
| The quality of generated content | There is no "correct answer" to assert against |
| The effect of a prompt change | You can only compare before and after, not rule it right or wrong |
| Retrieval recall | It depends on the corpus — a distribution problem, not a logic problem |

> ⚠️ **And one more thing has to be said**: the Periplus offline evals **pin the model's judgment down on purpose** (the oracle reads the case label, not the evidence), so **what they measure is also the deterministic part** — the pipeline, the gates, the budget, citation integrity. **Actually answering "did this prompt make the model a better reviewer" needs a real provider run over the same corpus, and that is a different mode.**

> Hint: freshness and citation attribution in Periplus are enforced by code; generation quality can only be bounded by golden-set assertions. Answering this well proves straight away that you know where the boundary of an LLM system is.

## 3. Which state has to be persisted, and which can live only on the client?

**The test in two lines: anything that must still hold across processes, across devices, or after a crash has to be persisted. Anything whose loss only affects this one session can stay on the client.**

| Must be persisted | Why |
|---|---|
| **entitlement** (Stripe's `subscribedPlan`) | The permission still has to be there after the user changes device or clears the cache |
| **Run state and stage artifacts** (Periplus) | The process can die, and a resume has to know where it stopped |
| "**Reminder already sent**" (the Beyz cron's `upgradeReminders`) | A restart or a different machine must not resend |
| **The record of a processed idempotency key** (withdrawal) | The only basis for dedup across requests and devices |

| Can stay on the client | Why |
|---|---|
| The current state of the four-state machine | A refresh starts over; correctness is unaffected |
| `confirmedTranscript` | It can be reassembled after a reconnect |
| The hover-prefetch cache | Losing it costs at most one extra request |

> ⚠️ **One counter-example to raise myself**: in Beyz the **question quota is only checked on the client** (the server only blocks the Free tier). **By the test above it belongs on the server — this is a gap I know about** ([② Usage and quota](/docs?section=beyz&item=credential-quota)).

> Hint: the Beyz four-state machine vs the Periplus run state; why entitlement can only be written by the webhook.

## 4. How do you trade off latency, correctness, cost and complexity?

**Do not answer in the abstract. Give one concrete decision for each, then draw the test out of them.**

| What was prioritised | The decision | What it cost | How it was covered |
|---|---|---|---|
| **Latency** | Beyz connects the browser **directly** to Deepgram instead of relaying through the server | The browser has to hold a credential | A temporary credential with a 60-second TTL and a single scope |
| **Correctness** | Withdrawal: **uncertain means fail**. Periplus: **no supporting citation means no progress** | False failures, and less content produced | Prompt the user to check their records; report the hole explicitly as a `gap` |
| **Cost** | Beyz carries only 4 turns of history; Periplus budgets tokens, time, queries and fetches on four axes | Long sessions lose their early context | The budget is a ceiling for the whole run — **a resume does not reset it** |
| **Refusing complexity** | Stripe gets **no event-id dedup table**; "write the absolute value" converges on its own | A redelivery does execute again | Only things with an external side effect, like sending email, get explicit dedup |

> ⭐ **Boiled down to one sentence**: **ask first, "if this is wrong here, how much does it cost".**
>
> - **In finance, and in factual content, a wrong answer costs more than a slow or expensive one** — so it is better to refuse, better to flag the hole, better to make the user retry
> - **In real-time interaction, stale costs more than lost** — so the interview copilot drops the overlapping request rather than queueing an answer to a question that has already gone by
>
> **The same person making opposite calls in two kinds of system is not inconsistency. The cost of being wrong is simply different.**

> Hint: the Beyz 250 ms chunk and `utterance_end_ms: 2000`; the six Periplus stages vs one large prompt; the WinterFell instancing trade.

## 5. Can I go two levels deeper from any sentence on the resume?

Self-test: point at a sentence at random and take it down two levels. Write down the ones that stall.

- [ ]
