---
title: "③ The pgvector evidence cache and local embeddings"
section: Periplus
---

# ③ The pgvector evidence cache and local embeddings

> **Resume line**
>
> **Cached evidence embeddings in pgvector** on an **ivfflat cosine index**, generated **locally by MiniLM**.

## What this line has to show

In one sentence: the same evidence is never fetched twice or embedded twice, and embedding costs no money and touches no network. The cache hits on meaning, not on URL.

## What the cache key is, and why not the URL

It hits on embedding similarity. The same fact is scattered across different sites, different URLs and different titles; a URL key only prevents refetching the identical page, and does nothing about "I already have this passage".

An embedding turns text into a list of numbers such that similar meanings produce similar numbers. That turns "do I have anything that means roughly this?" into a question a database can answer.

The table stores a canonical key, the URL, the title, the text, the source kind, the published date, the fetch time, the query that found it, and a 384-dimension vector column. 384 is the embedding model's output dimension, and the vector column type itself comes from pgvector.

## What "generated locally" means and why it matters

The model is a small one — roughly eighty megabytes, 384 dimensions — running on CPU through sentence-transformers, calling no paid embedding API.

This line and [the scripted seams line](/docs?section=periplus&item=scripted-seams) are two sides of the same position: the whole system runs with no API keys and no network. If embeddings required a network call, that claim would be false.

There is a cost angle too: the research stage may fetch dozens of pages, every one of which needs an embedding. On an API that means paying, on every run, to find out that you might already have it.

## What the query looks like, and where cosine comes in

The query takes the single nearest row, then converts the distance to a similarity in application code and applies a threshold, defaulting to 0.90. pgvector supplies a cosine distance operator, used for both the ordering and the value.

Why cosine rather than Euclidean: cosine is the conventional choice for semantic similarity, and it is insensitive to vector magnitude — two passages with the same meaning but different lengths are still judged close.

Why apply a threshold rather than taking the nearest: taking the nearest always returns a row, even when the closest thing in the database is entirely unrelated. The threshold is the step that turns "nearest neighbour" into "close enough", and without it a wrong cache entry gets passed off as evidence. That is the sentence to lead with here, because it is a correctness problem rather than a performance one.

## What ivfflat and the list count are

ivfflat is an approximate nearest neighbour index: it partitions the vector space into clusters and a query scans only the nearest few instead of comparing against the whole table. The index is built with a hundred lists.

Answer honestly on where that number came from: a hundred is a common starting point, the code records no tuning rationale, and if asked, say it is the default and was never measured.

Why ivfflat rather than HNSW is also unrecorded in the code. A good answer: my understanding is that ivfflat builds quickly and uses little memory, which suits a write-heavy cache of moderate size, while HNSW queries faster but builds slowly and consumes more memory — and be clear that this is a trade-off, not a settled conclusion.

Saying "I do not know" applies especially well at these two points, because they are verifiable implementation details, and an invented reason collapses under one follow-up.

## What happens on an empty database

This is the best detail in the line, and the comment states it directly: ivfflat needs training data to build useful lists; an empty or near-empty table — every fresh database — just gets a single-list index, which degrades to a full scan until enough rows accumulate. That is a correct, if slow, index — never a wrong answer.

Slow rather than wrong is the same value ordering as [never guessing a date](/docs?section=periplus&item=evidence-judgment) in the evidence line. Told together the two are far more convincing than either alone.

## What happens when the database goes down

The cache is best-effort as a whole: when embedding fails or the database errors, it returns "no similar match" instead of raising. The comment says it plainly — a cache outage must degrade, never crash a run.

So a wobble in PostgreSQL costs one extra page fetch, not the run.

The connection pool is also configured to ping a connection before handing it out and replace it if it is dead. The reasoning: since the caller already swallows exceptions anyway, paying for a doomed round trip and then missing is worse than pinging first.

## Background

**How the cache expires.** It does not have a TTL. Expiry is judged by date at the point of consumption, through [the freshness windows](/docs?section=periplus&item=evidence-judgment). That distinction is worth volunteering: the cache does not decide what is fresh, it only avoids repeating work. Freshness is business semantics and belongs to the function that judges staleness.

**Why only the first two thousand characters are embedded.** Two reasons, both in the comments: the embedding model only attends to roughly its first couple of hundred tokens, so feeding it more does not change its judgement; and storing every fetched page's full text indefinitely would make this the largest table in the database while buying no matching benefit. Twenty-four thousand characters of body text are stored for downstream use, and only the first two thousand are embedded — two limits serving two different purposes, so do not conflate them.

**Why one instance for the whole process.** The comment is blunt about it: this cache's value comes entirely from being queried by many runs, not from being rebuilt once per run. Open and close bracket the connection pool's lifetime, and one instance lives for the process.

## The 30-second answer

> The research stage fetches a lot of pages, and the same fact is usually scattered across different URLs, so the evidence cache does not hit on URL — it hits on meaning. Each passage stores a 384-dimension embedding computed by a small model on local CPU, with no paid API involved, which is what lets the whole system run without keys and without network. The query uses pgvector's cosine distance operator to take the nearest row, then applies a 0.90 similarity threshold, because taking the nearest always returns a row and the threshold is the step that turns "nearest neighbour" into "close enough". The index is ivfflat cosine with a hundred lists. On an empty database it degrades to a full scan, and I like the comment there: that is a correct, if slow, index — never a wrong answer. The whole cache is best-effort, so a database problem is treated as a miss, costing one extra page fetch rather than the run.

## Self-check

1. Can you explain why it hits on meaning rather than URL?
2. Can you explain the cosine distance operator, and why a similarity threshold is still required?
3. Can you state cosine's advantage over Euclidean distance?
4. Can you admit honestly that the list count and index type are defaults with no measurement behind them?
5. Can you quote the "correct, if slow, index" line and connect it to the freshness rule?
6. Can you separate the two-thousand-character embedding limit from the twenty-four-thousand-character storage limit?
7. Can you explain that the cache does not handle expiry, and say who does?
