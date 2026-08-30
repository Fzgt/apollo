---
title: "③ The pgvector evidence cache and local embeddings"
section: Periplus
---

# ③ The pgvector evidence cache and local embeddings

> **Resume line**
>
> **Cached evidence embeddings in pgvector** on an **ivfflat cosine index**, generated **locally by MiniLM**.

## What this line has to show

In one sentence: **the same piece of evidence is never fetched twice and never embedded twice**, and **the embedding itself costs no money and no network**. The cache is hit by meaning, not by URL.

## Layer one: answer these without thinking

### 1. What is the cache keyed on? Why not the URL?

On **embedding similarity**. The same fact is spread across different sites, different URLs and different titles. A URL key only catches "I fetched this exact page before". It cannot catch "I already have this passage".

**What an embedding is**: a piece of text turned into a list of numbers, where **text with similar meaning gets similar numbers**. That turns "do I already have something that means roughly this?" into a question a database can answer.

The table (`postgres_evidence.py`):

```sql
CREATE TABLE IF NOT EXISTS evidence_cache (
    canonical_key TEXT PRIMARY KEY,
    url          TEXT NOT NULL,
    title        TEXT,
    text         TEXT NOT NULL,
    source_kind  TEXT NOT NULL,
    published_at DATE,
    fetched_at   TIMESTAMPTZ NOT NULL,
    query        TEXT,
    embedding    vector(384) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`vector(384)`** is the column type pgvector adds, and 384 is MiniLM's output size.

### 2. What does "locally by MiniLM" mean, and why does it matter?

The model is `all-MiniLM-L6-v2`, running **on CPU, about 80MB, 384 dimensions**, through sentence-transformers. **No paid embedding API is called.**

This is the same position as [④ the scripted seams](/docs?section=periplus&item=scripted-seams), seen from another side: **the whole system runs with no API keys and no network.** If embeddings needed a network call, that sentence would not be true.

There is a cost angle too. The research stage may fetch dozens of pages, and every one needs an embedding. On a paid API, every run pays to find out it might already have the answer.

### 3. What does the query look like? Where is the "cosine" part?

```sql
SELECT url, title, text, source_kind, published_at, fetched_at,
       embedding <=> %s AS distance
FROM evidence_cache
ORDER BY embedding <=> %s
LIMIT 1
```

**`<=>` is pgvector's cosine distance operator.** It takes the nearest row, then Python converts and applies the threshold:

```python
similarity = 1.0 - distance
if similarity < self.similarity_threshold:   # default 0.90
    return None
```

**Why cosine rather than Euclidean distance**: cosine is the usual choice for semantic similarity, and it **ignores vector length** — two passages that mean the same thing but differ in length still come out close.

**Why the 0.90 threshold instead of just taking the nearest**: `ORDER BY ... LIMIT 1` always returns a row, even when the closest thing in the table is completely unrelated. **The threshold is the step that turns "nearest neighbour" into "close enough"** — without it, the cache would hand back wrong evidence.

### 4. What are `ivfflat` and `lists = 100`?

```sql
CREATE INDEX IF NOT EXISTS evidence_cache_embedding_idx
    ON evidence_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

ivfflat is an **approximate nearest neighbour (ANN) index**: it splits the vector space into clusters and only scans the nearest few at query time, instead of comparing against every row.

| Question | Answer |
|---|---|
| **Where does `lists = 100` come from** | It splits the space into 100 clusters. It is the dial between "fast to query" and "finds everything", and 100 is a common starting point. ⚠️ **The code gives no tuning rationale — say plainly that it is a default and was never measured** |
| **Why ivfflat and not HNSW** | ⚠️ **The code gives no reason.** My understanding: ivfflat builds fast and uses little memory, which suits a write-heavy cache of moderate size; HNSW queries faster but builds slowly and costs memory. **Present it as a trade-off, not a settled answer** |

### 5. What happens on an empty database?

This is the best detail in the bullet, and the comment says it outright (`postgres_evidence.py:70-72`):

> *"ivfflat needs training data to build useful lists; an empty or near-empty table (every fresh database) just gets a single-list index, which degrades to a full scan until enough rows accumulate. **That is a correct, if slow, index — never a wrong answer.**"*

On an empty table, ivfflat gets a single-list index, which is a full scan — **slow, but never wrong**.

> ⭐ **"Slow beats wrong"** is the same value as [⑥ "no date beats a guessed date"](/docs?section=periplus&item=evidence-judgment). Telling both together is far stronger than telling either alone.

### 6. What happens if the database goes down?

**The whole cache is best-effort**: if embedding fails or the database errors, it returns "no match" instead of raising.

```python
except Exception:  # a cache outage must degrade, never crash a run
    return None
```

So **a wobble in PostgreSQL costs one repeated page fetch, not the run.** The pool also sets `check=AsyncConnectionPool.check_connection`, which pings a connection before handing it out and replaces it if the ping fails — since the caller already swallows errors, a dead connection would have been silently lost anyway, and a ping costs less than a doomed round trip plus a wasted miss.

## Layer two: extra background

### How does the cache expire?

**It does not.** Freshness is decided when the evidence is consumed, by the date windows in [⑥ evidence and judgment](/docs?section=periplus&item=evidence-judgment).

> ⭐ **Worth raising yourself**: the cache does not decide whether something is fresh, only whether work can be skipped. **Freshness is business meaning, and it belongs to the function that judges expiry.**

### Why embed only the first 2,000 characters?

```python
MAX_REPRESENTATIVE_CHARS = 2_000
MAX_STORED_CHARS = 24_000
```

Two reasons, both in the comment: **MiniLM only attends to roughly the first 256 tokens anyway**, so feeding it more changes nothing; and **storing the full text of every fetched page forever would make this the largest table in the database for no matching benefit**.

The 24,000 characters are the body text downstream stages read. The 2,000 are what gets embedded. **Two limits for two different purposes** — do not describe them as one.

### Why one shared instance for the whole process?

The comment is direct: **the cache's value comes entirely from being consulted across many runs, not from being rebuilt per run.** `open`/`close` bracket the pool's lifetime, and one instance lives for the process.

## The 30-second answer

> The research stage fetches a lot of pages, and the same fact often sits under several different URLs — so the evidence cache is hit by meaning, not by URL. Every piece of evidence is stored with a 384-dimension vector, produced by `all-MiniLM-L6-v2` locally on CPU, with no paid embedding API. That is what lets the whole system run with no keys and no network. The lookup uses pgvector's cosine distance operator to take the nearest row, then applies a 0.90 similarity threshold — because LIMIT 1 always returns something, and the threshold is what turns "nearest neighbour" into "close enough". The index is ivfflat on cosine with 100 lists. On a fresh database it degrades to a full scan, and I like the comment for it: that is a correct, if slow, index — never a wrong answer. The whole cache is best-effort: if the database has a problem it reports a miss, which costs one extra fetch and never the run.

## Self-check

1. Can you explain why the cache is keyed on meaning rather than URL?
2. Can you say what `<=>` is, and why a similarity threshold is still needed on top of it?
3. Can you give cosine's advantage over Euclidean distance (insensitive to length)?
4. Can you admit plainly that `lists = 100` and ivfflat are defaults with no measurement behind them?
5. Can you quote the empty-database line and connect it to the freshness rule?
6. Can you keep the 2,000-character (embedding) and 24,000-character (stored text) limits apart?
7. Can you explain that the cache does not expire, and who owns freshness instead?
