---
title: "② Persistence and resume"
section: Periplus
---

# ② Persistence and resume

> **Resume line**
>
> **Six-stage LLM pipeline behind typed Pydantic stage contracts** filled by **schema-constrained JSON output**, with **run state and stage artifacts in PostgreSQL**: **a run that dies mid-pipeline resumes from the last completed stage**.

This note shares the resume's first line with [① Six stages behind typed contracts](/docs?section=periplus&item=typed-contract). The per-run token and time budget is not on the resume, but **the budget-on-replay section is still the most valuable part of this note.**

## Terms, in one line each

**Run** — one whole execution, from a brief through the six stages. **It has an id, a status, and it persists.**

**Stage artifact** — the structured object a stage produces.

**Attempt** — a stage may run more than once; each run of it is a numbered attempt.

**Gate** — the check after a stage: **is the artifact structurally valid, and is it substantively empty?** Failing it means the stage did not pass.

**Replay / resume** — continuing from after some completed stage.

**Budget** — a run's four ceilings: **how many searches, how many pages fetched, how many tokens, how many seconds.**

**Idempotent** — repeating it produces no additional effect.

**Embedding** — a piece of text turned into a list of numbers, **where similar meanings give similar numbers.**

## What this line has to show

On the surface it is "I implemented resume". **What is actually valuable are three boundary judgements**:

1. **what kind of artifact is a legal place to resume from;**
2. **why the budget must not reset on replay;**
3. **why "unrecoverable" and "start over" are different things.**

## The problem

One run takes minutes and costs money, with every stage calling models and fetching pages. **If the process dies in stage four, re-running throws away the money and time of the first three.**

So run state, every stage's artifacts, and the retrieved evidence all live **in PostgreSQL**, and a restarted process picks up what was unfinished.

## The resume boundary must be an artifact that passed its gate

The artifact module's header is explicit: **everything a stage attempt produced is kept, whether or not it passed that stage's gate; a rejected or superseded attempt can still be pulled up and inspected — it just may never be the starting point for a replay.**

**Keeping failed artifacts is for investigation; allowing a resume from one is a different question. Separating the two is the easiest half of this design to miss, and the sentence that most separates you when asked.**

## The budget does not reset on replay — the most valuable point here

The budget module's header, quotable as it stands:

```python
"""
Checking never happens inside an adapter's own ``run()`` call; nothing here can
preempt a stage already in flight, only stop it from being counted as having
passed, or stop the next attempt from starting.

A budget is a ceiling for the whole Run, replays included: a BudgetTracker built
for a replay is seeded with everything the run already spent, not reset to zero.
Resuming a run repeatedly cannot be used to spend past a configured ceiling one
stage at a time.
"""
```

**This is a genuine security property: if the budget reset on resume, "crash it repeatedly" would become a way around the quota.**

**Raising this unprompted shows you thought about how the mechanism could be abused — a level above explaining how it works. That applies to any bullet describing a mechanism.**

**The timing matters too.** The budget is checked **after a stage attempt completes and before the next one starts**, **never inside a stage.** So it **cannot preempt a stage in flight**; it can only refuse to count it as passed, or refuse to start the next attempt.

## Where it died decides how it recovers

**Three branches, each with a reason:**

1. **Died without passing a single gate → marked failed, not re-run.** The comment's reason: **restarting would silently pretend the failed attempt never happened.**
2. **All stages passed, died while recording success → marked succeeded directly**, rather than replaying a pipeline that already finished.
3. **Died after some middle stage → resume from the next one.** The normal path.

**The first is the one worth telling: "unrecoverable" and "start over" are not the same.** Re-running makes the failed attempt **vanish from the record** — which is exactly what you need in order to investigate.

## How stage four's death resumes after stage three

On startup, scan the database for **every run still marked running** — **that status is itself the signal**, because a normal end always writes a completion. Then walk `STAGE_ORDER` and **find the latest stage with an artifact that passed its gate, and start from the one after it.**

**Getting the location wrong here looks bad: the resume logic is not in the orchestrator, it is in the API layer's run store.** The orchestrator only runs the pipeline **from a given starting point**; **where the last run got to, and whether it should continue, belong to the persistence layer.**

## Why run state cannot live only in memory

**Three reasons**: processes die, **which is the premise of the whole mechanism**; horizontal scaling requires **another instance to see the state**; and users refresh the page to check progress, **so the frontend polls the database, not one process's memory.**

## How the resumed stage stays idempotent

**Not by making the stage itself idempotent, but by keeping the boundary clean.** Resume only happens from an artifact that passed its gate, **so the input is determined**; and the re-run stage produces **a new attempt number rather than overwriting the old one.**

**One fine detail worth telling**: the crash may have happened **mid-stage**, so the stage being resumed **may already have attempt records that never passed their gate.** The code **fills in placeholder history** so the orchestrator's attempt counter continues from there **rather than colliding with a number that already exists in the artifact store.**

**Being able to tell that shows you actually handled "died mid-stage", not just "died between stages".**

## What is in the embedding cache and how it expires

It holds **fetched evidence passages and their embeddings**, so **the same evidence is not fetched twice or embedded twice.**

Expiry comes from the [freshness window](/docs?section=periplus&item=evidence-judgment): **the cache itself has no TTL; staleness is judged by date at the point of consumption.**

**Say that distinction unprompted: the cache does not decide freshness, it only avoids repeated work. Freshness is business meaning, and it belongs to the function that judges staleness.**

## The embedding cache is not part of this line

pgvector, the cosine index and the local embedding model are their own resume line; the details live in [③ The pgvector evidence cache](/docs?section=periplus&item=pgvector-embeddings).

All this note needs is the relationship: **run state and stage artifacts go through the run-persistence class; the evidence cache goes through the evidence-cache class** — a different class, a different table, a different lifecycle. They share PostgreSQL, **but their failure semantics differ completely: losing resume data wastes the run, while losing the evidence cache just means fetching a page again.**

## The 30-second answer

> One run of the pipeline takes minutes and costs money. If the process dies in stage four, re-running throws away the first three. So run state, every stage's artifacts and the retrieved evidence all land in PostgreSQL. On restart the process scans for runs still marked running and continues after the last stage whose artifact passed its gate. The qualifier "passed its gate" is the point: we keep failed artifacts for inspection, but a failed artifact is never a legal resume boundary. And the budget is a ceiling for the whole run — a replay does not reset it, it is seeded with what the run already spent, because otherwise repeatedly crashing a run would let you spend past the quota one stage at a time.

## Self-check

1. Can you explain why failed artifacts are kept but cannot be a resume point?
2. Can you state the budget-not-reset rule, and the abuse it prevents?
3. Can you say why the budget is checked between stages rather than inside one?
4. Can you give the three crash branches, especially why the first is not re-run?
5. Can you explain that resume logic lives in the persistence layer, not the orchestrator?
6. Can you tell the placeholder-history detail, and that it handles "died mid-stage"?
7. Can you explain that the cache does not own expiry, and who owns freshness?
