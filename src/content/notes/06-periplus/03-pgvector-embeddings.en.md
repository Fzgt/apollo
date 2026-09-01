---
title: "③ The pgvector evidence cache and local embeddings"
section: Periplus
---

# ③ The pgvector evidence cache and local embeddings

> **Resume line**
>
> **Cached evidence embeddings in pgvector** on an **ivfflat cosine index**, generated **locally by MiniLM**.

## Terms, in one line each

**Embedding** — a piece of text turned into a list of numbers, **where similar meanings give similar numbers**. That turns "do I already have something that means this?" **into a question a database can answer.**

**pgvector** — a PostgreSQL extension that **adds a `vector` column type and a set of distance operators.**

**MiniLM** — a small model, around 80 MB, producing **384-dimensional** vectors. **CPU is enough.**

**Cosine similarity** — treats vectors as directions and **compares the angle**, **insensitive to length**.

**Euclidean distance** — straight-line distance, **affected by length**.

**ANN (approximate nearest neighbour)** — do not scan everything; **trade a little recall for speed.**

**ivfflat** — an ANN index that **partitions the vector space into lists and scans only the nearest few.**

**HNSW** — another ANN index: **faster queries, slower builds, more memory.**

**Fail soft** — on error, return a safe default **rather than throwing into the caller.**

## What this line has to show

In one sentence: **the same evidence is never fetched twice or embedded twice, and embedding costs no money and no network. The cache hits on meaning, not on URL.**

## What the cache key is, and why not the URL

**Embedding similarity.** The same fact is spread across sites, URLs and headlines; **keying on URL only stops re-fetching the identical page, not "I already have this passage".**

The table stores a normalised key, URL, title, text, source kind, published date, fetch time, the query that found it, **and the 384-dimensional vector column.**

## What "generated locally" means, and why it matters

**sentence-transformers running MiniLM on local CPU, with no paid embedding API.**

**This is the other face of the position in [scripted seams](/docs?section=periplus&item=scripted-seams): the whole system can run to completion with no API keys and no network. If embeddings required the network, that sentence would not be true.**

**A cost note as well**: the research stage may fetch dozens of pages, each needing an embedding. **Going through an API means paying, on every run, for "I might already have this".**

## What the query looks like, and where cosine appears

```sql
SELECT url, title, text, source_kind, published_at, fetched_at,
       embedding <=> %s AS distance     -- ← <=> is pgvector's cosine distance operator
FROM evidence_cache
ORDER BY embedding <=> %s
LIMIT 1
```

Take the nearest row, then **convert distance to similarity in the application and apply a threshold, defaulting to 0.9.**

**Why cosine and not Euclidean**: cosine is the convention for semantic similarity, **and it is insensitive to vector length** — two passages that mean the same thing at different lengths still come out close.

**Why the threshold is required rather than just taking the nearest**: `LIMIT 1` **always returns a row, even when the closest thing in the table is unrelated.** **The threshold is what turns "nearest neighbour" into "close enough"; without it you serve a wrong cache entry as evidence.**

**That is the sentence to lead with here, because it is a correctness problem, not a performance one.**

## What ivfflat and that list count are

```sql
CREATE INDEX IF NOT EXISTS evidence_cache_embedding_idx
    ON evidence_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**`lists = 100`** is the partition count.

**Answer honestly about where it came from**: 100 is a common starting point, **the code records no tuning rationale, and if asked you should say it is a default that was never measured.**

**The code gives no reason for ivfflat over HNSW either.** Phrase it as: my understanding is that **ivfflat builds quickly and uses little memory, which suits a write-heavy cache of moderate size, while HNSW queries faster but builds slowly and costs memory** — **and be explicit that this is a trade-off, not a settled verdict.**

**"I do not know" applies especially here** — both are verifiable implementation details, **and an invented reason collapses under one follow-up.**

## What happens on an empty database

**The best detail in this line, and the comment says it outright:**

```python
#: ivfflat needs training data to build useful lists; an empty or near-empty table (every
#: fresh database) just gets a single-list index, which degrades to a full scan until
#: enough rows accumulate. That is a correct, if slow, index — never a wrong answer.
```

**Slow beats wrong** — the same value ordering as ["rather no date than a guessed one"](/docs?section=periplus&item=evidence-judgment). **Telling the two together is more convincing than either alone.**

## What happens when the database is down

```python
except Exception:  # noqa: BLE001 - a cache outage must degrade, never crash a run
    return None
```

**The whole cache is best-effort**: an embedding failure or a database error **returns "no similar entry" rather than raising.**

**So a PostgreSQL wobble costs one repeated page fetch, not the run.**

The connection pool also has **a ping check before handing out a connection**, replacing dead ones. **The reasoning: since the downstream already swallows exceptions, it is better to ping than to pay for a doomed round trip and take a pointless miss.**

## Background

**How the cache expires.** **It has no TTL.** Expiry is judged **at the point of consumption**, by date, through the [freshness window](/docs?section=periplus&item=evidence-judgment). **Say that distinction unprompted: the cache does not decide freshness, it only avoids repeated work; freshness is business meaning and belongs to the staleness function.**

**Why only the first 2,000 characters are embedded.** **Two reasons, both in the comments**: the model itself **only attends to roughly the first 256 tokens**, so feeding it more changes nothing; and storing every fetched page's full text indefinitely **would make this the largest table in the database while buying no additional matching.**

**Two limits serving two different purposes — do not collapse them into one**: **24,000 characters is the text stored for downstream use; 2,000 characters is what gets embedded.**

**Why one instance for the whole process.** The comment is blunt: **this cache's value comes entirely from being queried by many runs, not from being rebuilt each run.** Open and close bracket the pool's lifetime, **and one instance lives for the process.**

## The 30-second answer

> The research stage fetches many pages, and the same fact is often spread across different URLs, so the evidence cache hits on meaning rather than URL. Each passage stores a 384-dimensional embedding computed by MiniLM on local CPU with no paid API — which is what makes it possible for the whole system to run with no keys and no network. The query takes the nearest row using pgvector's `<=>` cosine distance operator, then applies a 0.9 similarity threshold, because LIMIT 1 always returns a row and the threshold is what turns nearest neighbour into close enough. The index is ivfflat cosine with a hundred lists. On an empty database it degrades to a full scan, and the comment there is one I like: that is a correct, if slow, index — never a wrong answer. The whole cache is best-effort, so a database problem is a cache miss and one extra fetch, never a failed run.

## Self-check

1. Can you explain why the cache hits on meaning rather than URL?
2. Can you explain what `<=>` is, and why a similarity threshold is still required?
3. Can you say what cosine gives you over Euclidean?
4. Can you admit honestly that `lists = 100` and the index type are defaults with no measurement behind them?
5. Can you quote the "correct, if slow, index" comment and connect it to the freshness rule?
6. Can you distinguish the 2,000-character embedding limit from the 24,000-character storage limit?
7. Can you explain that the cache does not own expiry, and who owns freshness?
