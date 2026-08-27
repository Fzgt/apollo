---
title: "② Persistence and resuming"
section: Periplus
---

# ② Persistence and resuming

> **Resume line**
>
> **Six-stage LLM pipeline behind typed Pydantic stage contracts** filled by **schema-constrained JSON output**, with **run state, stage artifacts and a pgvector cache of local MiniLM embeddings in PostgreSQL**: **a run that dies mid-pipeline resumes from the last completed stage**.

> ℹ️ **This page shares the resume's first bullet with [① Six stages behind typed contracts](/docs?section=periplus&item=typed-contract).** "Per-run token and time budgets" came off the resume, but the section on budgets across resumes is the most valuable part of this page and has been left intact.

## What this bullet is about

**On the surface it says "I built resumable runs". What is actually valuable is three boundary judgements**: ⭐ **what kind of artifact counts as a legal resume point, why the budget must not reset on resume, and why "unrecoverable" and "start over" are two different things.** All three are in section 3.

## 1. The problem

**One run of this pipeline takes minutes and costs money** (every stage calls a model or fetches web pages).

**If the process dies at stage four, re-running means the money and time spent on the first three stages are wasted entirely.**

**So: the run's state, every stage's artifact and all retrieved evidence go into PostgreSQL. On restart, unfinished runs are picked up and continued.**

## 2. The 30-second version (usable with light editing)

> One run of this pipeline takes minutes and costs money. **If the process dies at stage four, re-running wastes the first three stages entirely.**
>
> So the run's state, every stage's artifact and all retrieved evidence land in PostgreSQL. **On restart the process scans for every run still marked "running" and continues from after its last gate-passing stage.**
>
> **The qualifier "gate-passing" is the key**: we keep failed artifacts too — for later inspection — **but they are never a legal resume boundary**. And the budget is a ceiling for the whole run that **does not reset on resume; it is seeded with what has already been spent** — otherwise **repeatedly restarting would let you spend past the quota one stage at a time.**

## 3. ⭐ Three design decisions that show depth

### ① The resume boundary has to be a gate-passing artifact

**First, what a "gate" is**: after each stage runs there is a check — **is the artifact structurally valid, is its content empty?** Failing it means the stage did not pass.

The file header of `artifacts.py`, verbatim:

> *"Every stage attempt's produced artifact is retained, **whether or not it passed the stage's gate**... A rejected or superseded attempt stays retrievable for inspection; **it is simply never a valid replay boundary**."*

> ⭐ **Keeping failed artifacts is for investigation; allowing a resume from one is a different question entirely. Separating the two is the half of this design that is easiest to miss.**

### ② ⭐ The budget does not reset on resume (the most valuable point here)

**First, what a "budget" is**: a run has four ceilings — **how many searches, how many pages fetched, how many tokens, how many seconds.**

The file header of `budget.py`, verbatim:

> *"A budget is a ceiling for the whole Run, **replays included**: a BudgetTracker built for a replay is **seeded with everything the run already spent**, not reset to zero. **Resuming a run repeatedly cannot be used to spend past a configured ceiling one stage at a time.**"*

> ⭐ **This is a genuine security property**: if the budget reset on resume, then "making it crash repeatedly" **becomes a way to bypass the quota.**
>
> **Volunteering this shows you thought about how the mechanism could be abused — which is a level above explaining how it works.**

**The timing of the check matters too** (same comment): the budget is checked **after a stage finishes and before the next one starts, never interrupting a stage from inside** — so it "**cannot preempt a stage in flight; it can only refuse to pass it, or refuse to let the next attempt start**".

### ③ Where it died decides how it recovers

**`runs.py:219-251` has three branches:**

| Case | What happens | Why |
|---|---|---|
| **Died before any gate passed** | Marked **failed**, not re-run | The comment: *"a fresh start would **silently pretend this attempt never happened** instead"* |
| **Every stage passed and it died while recording success** | Marked **succeeded** directly | *"rather than replaying a pipeline that already finished"* |
| **Died after some middle stage** | Resume from the next stage | The normal path |

> ⭐ **The first case is the one worth telling**: **"unrecoverable" and "start over" are not the same thing.**
>
> Re-running outright makes the failed attempt **vanish from the record** — **and that record is exactly what you need when investigating.**

## 4. Four must-answer questions

### Q: Stage four died — how does it continue from after stage three?

> "On startup the process scans the database for every run still marked 'running' — **that state is itself the signal**, because a normal finish always writes a 'completed'. Then it walks the stage order and **finds the latest stage with a gate-passing artifact, and starts from the one after it.**"

> ⚠️ **A question about location that looks bad if answered wrong:**
>
> **The resume logic is not in the orchestrator; it is in the API layer's run store (`api/runs.py`).**
>
> **The orchestrator only runs the pipeline from a given starting point. "Where did it get to last time and should it continue" is the persistence layer's responsibility.**

### Q: Why can run state not live in memory only?

**Three reasons:**

1. **Processes die** — that is the premise of the whole mechanism
2. **It has to scale horizontally** — another instance has to see the state
3. **Users refresh the page to see progress** — the front end polls the database, not one process's memory

### Q: How is the resumed stage made idempotent?

**Not by making the stage itself idempotent, but by keeping the boundary clean:**

- **Resuming happens only from a gate-passing artifact**, so **the resumed input is deterministic**
- The re-run stage produces **a new attempt number** and **does not overwrite the old one**

> ⚠️ **There is a fine trap worth telling** (`runs.py:253-262`): **a crash can happen in the middle of a stage**, so the stage being resumed **may already have a recorded attempt that failed its gate.**
>
> The code **fills in placeholder history first**, so the orchestrator's attempt counter continues from there **instead of colliding with a number already present in the artifact store.**
>
> ⭐ **Being able to explain this shows you really handled "died mid-stage" rather than only "died between stages".**

### Q: What is in the vector cache, and how is it invalidated?

**It holds fetched evidence passages and their embeddings**, so that **the same passage is never fetched twice or embedded twice.**

**What an "embedding" is**: turning a piece of text into a list of numbers such that **texts with similar meaning have similar numbers**. That lets you ask "is there anything I already fetched that means roughly this?"

**Invalidation comes from [the freshness windows in ⑤](/docs?section=periplus&item=evidence-judgment))** — **the cache itself has no expiry; freshness is decided by date at the point of consumption.**

> ⭐ **This distinction is worth stating**: **the cache does not judge freshness, it only avoids repeated work. Freshness is business semantics and belongs to the function that decides staleness.**

## 5. The pgvector choices (checked against the code)

```sql
CREATE INDEX evidence_cache_embedding_idx
    ON evidence_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**pgvector is a PostgreSQL extension that lets the database store vectors and run "find the most similar" queries.**

| Question | Answer |
|---|---|
| **Why cosine similarity rather than Euclidean distance** | Cosine is the conventional choice for semantic similarity, **and it is insensitive to vector magnitude** — two passages with the same meaning but different lengths still come out close |
| **How was `lists = 100` chosen** | The index **cuts the vector space into 100 clusters** and a query scans only the nearest few. **It is the knob between "fast to query" and "finds everything"**, and 100 is a common starting point. ⚠️ **The code records no tuning rationale, so say plainly that it is a default** |
| **Why ivfflat rather than HNSW** | ⚠️ **The code gives no reason.** My understanding: ivfflat **builds fast and uses little memory**, suiting a cache with frequent writes and a moderate row count; HNSW queries faster but builds slowly and eats memory. **If asked, say this is a trade-off rather than a settled conclusion** |

**But one comment is worth quoting** (`postgres_evidence.py:71-72`):

> *"a fresh database just gets a single-list index, which degrades to a full scan until enough rows accumulate. **That is a correct, if slow, index — never a wrong answer.**"*

> ⭐ "**Rather slow than wrong**" — the same value as [the "rather no date than a guessed one" rule in ⑤](/docs?section=periplus&item=evidence-judgment)).

**There is also a fail-soft design**: when embedding fails or the database errors, the cache **returns "no similar match" instead of raising** — so **a PostgreSQL blip only causes one page to be fetched again; it does not kill the run.**

## Glossary

| 中文 | English |
|---|---|
| 一次运行 | **a run** |
| 持久化 | **persist** (*persisted run state*) |
| 阶段产物 | **stage artifacts** |
| 续跑 / 断点恢复 | **resume** (*resumes from the last completed stage*) |
| 重放 | **replay** |
| 续跑边界 | **replay boundary** |
| 关卡 | **gate** (*gate-passed artifact*) |
| 尝试 | **attempt** (*a rejected attempt stays retrievable*) |
| 预算 / 上限 | **budget · ceiling** |
| 计数器带入初值 | **seeded** (⭐ *seeded with what the run already spent, not reset*) |
| 抢占 | **preempt** (*it cannot preempt a stage in flight*) |
| 幂等 | idempotent |
| 占位历史 | placeholder history |
| 向量 | **embedding** |
| 向量检索 | **vector search** |
| 余弦相似度 | **cosine similarity** |
| 近似最近邻 | **approximate nearest neighbour (ANN)** |
| 索引退化成全表扫描 | **degrades to a full scan** |
| 优雅失败 | **fail soft** (*returns no match instead of throwing*) |

> ⭐ **The three easiest to get wrong**:
>
> 1. "The budget is seeded rather than reset" is **the tracker is seeded with what the run already spent, not reset to zero** — the most valuable sentence here
> 2. "Unrecoverable ≠ start over" is **restarting would silently pretend the failed attempt never happened**
> 3. "A correct if slow index, never a wrong answer": **a correct, if slow, index — never a wrong answer**
