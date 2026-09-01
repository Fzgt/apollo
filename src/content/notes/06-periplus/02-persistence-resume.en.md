---
title: "② Persistence and resume"
section: Periplus
---

# ② Persistence and resume

> **Resume line**
>
> **Six-stage LLM pipeline behind typed Pydantic stage contracts** filled by **schema-constrained JSON output**, with **run state and stage artifacts in PostgreSQL**: **a run that dies mid-pipeline resumes from the last completed stage**.

This note shares the resume's first line with [① Six stages behind typed contracts](/docs?section=periplus&item=typed-contract). Per-run token and time budgets are not on the resume, but the section on budgets across a resume is still the most valuable part of this note.

## What this line has to show

On the surface it says "I built checkpoint recovery". What is actually worth something are three boundary judgements: what counts as a legal point to resume from, why the budget must not reset on resume, and why "unrecoverable" and "start over" are two different things.

## The problem

A run takes minutes and costs money; every stage is calling a model and fetching pages. If the process dies at stage four, rerunning throws away the money and time spent on the first three.

So the run state, each stage's artifacts and the retrieved evidence all go into PostgreSQL, and on restart the unfinished runs are picked up and continued.

## The resume boundary must be a gate-passed artifact

First, what a gate is: after each stage there is a check — is the artifact structurally valid, is it empty — and failing it means the stage did not pass.

The artifacts module's file header is explicit: every stage attempt's produced artifact is retained, whether or not it passed the stage's gate; a rejected or superseded attempt stays retrievable for inspection, it is simply never a valid replay boundary.

Keeping failed artifacts is for investigation. Allowing a resume from one is a different thing entirely. Separating those two is the half of this design people miss, and it is the sentence that creates distance when you are asked.

## The budget is not reset on resume, and this is the valuable part

First, what a budget is: a run has four ceilings — how many searches, how many pages fetched, how many tokens, how many seconds.

The budget module's file header reads: a budget is a ceiling for the whole run, replays included; a tracker built for a replay is seeded with everything the run already spent, not reset to zero; resuming a run repeatedly cannot be used to spend past a configured ceiling one stage at a time.

That is a genuine security property. If the budget reset on resume, "make it crash repeatedly" becomes a way around the quota.

Raising this yourself shows you thought about how the mechanism could be abused — which is a level above explaining how it works. That framing applies to any line about a mechanism.

The timing matters too. The budget check happens after a stage completes and before the next one starts, never interrupting a stage from inside. So it cannot preempt a stage in flight; it can only refuse to pass it, or refuse to let the next attempt begin.

## Where it died decides how it recovers

Three branches, each with a reason.

If it died before passing any gate, it is marked failed and not rerun. The comment's reasoning: a fresh start would silently pretend this attempt never happened.

If every stage passed and it died while recording success, it is marked successful — rather than replaying a pipeline that already finished.

If it died after some middle stage, it resumes from the next one. That is the normal path.

The first branch is the one worth telling: unrecoverable and start-over are different things. Rerunning makes the failed attempt vanish from the record, and that record is exactly what you need when investigating.

## How stage four dying resumes after stage three

On start-up the process scans the database for every run still marked as running — that state is itself the signal, because a normal ending always writes a completed record. Then it walks the stage order, finds the latest stage with a gate-passed artifact, and starts from the one after it.

There is a placement question that looks bad if you get it wrong: the resume logic is not in the orchestrator, it is in the API layer's run store. The orchestrator only runs the pipeline from a given starting point; where the last run got to and whether it should continue is the persistence layer's job.

## Why run state cannot live only in memory

Three reasons. The process dies — that is the premise of the whole mechanism. It has to scale horizontally, and another instance has to see the state. And the user has to be able to reload the page and see progress, because the frontend polls the database, not one process's memory.

## How the resumed stage stays idempotent

Not by making the stage itself idempotent, but by keeping the boundary clean. It only resumes from gate-passed artifacts, so the input to the resumed stage is determined; and the rerun stage produces a new attempt number rather than overwriting the old one.

There is a fine detail worth telling: the crash may have happened mid-stage, so the stage being resumed may already have a failed attempt on record. The code fills in placeholder history first, so the orchestrator's attempt counter continues from there rather than colliding with a number already present in the artifact store.

Being able to tell that detail shows you actually handled dying mid-stage, not just dying between stages.

## What is in the vector cache, and how it expires

It stores the fetched evidence passages and their vectors, so the same evidence is neither fetched nor embedded twice.

An embedding turns a piece of text into a list of numbers such that similar meanings produce similar numbers — which turns "do I already have something that means roughly this?" into a question a database can answer.

Expiry runs through [the freshness windows](/docs?section=periplus&item=evidence-judgment): the cache itself has no TTL, and staleness is judged by date at the point of consumption.

That distinction is worth volunteering: the cache is not responsible for deciding what is fresh, only for not repeating work. Freshness is business semantics, and it belongs to the function that judges staleness.

## The vector cache is not part of this line

pgvector, the cosine index and the local embedding model are their own resume line, and the details are all in [③ The pgvector evidence cache](/docs?section=periplus&item=pgvector-embeddings).

For this line, all you need is the relationship: run state and stage artifacts go through the run persistence class, and the evidence cache goes through the evidence cache class — a different class, a different table, a different lifecycle. They share PostgreSQL, but their failure semantics are completely different: losing the resume data destroys the run, losing the evidence cache costs one extra page fetch.

## The 30-second answer

> A run takes minutes and costs money. If the process dies at stage four, rerunning throws away everything the first three stages spent. So the run state, each stage's artifacts and the retrieved evidence all live in PostgreSQL. On restart the process finds every run still marked as running and continues after the last stage that passed its gate. That qualifier matters: we keep failed artifacts too, for inspection, but a failed artifact is never a valid replay boundary. And the budget is a ceiling for the whole run — it is not reset on resume, it is seeded with what the run already spent, or repeatedly restarting would let you spend past the quota one stage at a time.

## Self-check

1. Can you explain why failed artifacts are kept but cannot be a resume point?
2. Can you explain the non-resetting budget, and the abuse it prevents?
3. Can you explain why the budget check sits between stages rather than inside one?
4. Can you give the three crash branches, especially why the first is not rerun?
5. Can you say that the resume logic lives in the persistence layer, not the orchestrator?
6. Can you explain the placeholder history detail?
7. Can you explain that the cache does not handle expiry, and say who does?
