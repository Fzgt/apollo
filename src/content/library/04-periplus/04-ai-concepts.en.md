---
title: AI concepts
section: Periplus
---

# AI engineering interview notes (the concepts)

> Resume anchor (**the skills row, word for word**): `AI: LLM Integration, Streaming Responses, Structured Outputs, Embeddings, Vector Search, RAG`
>
> ⚠️ **`Evals` is not in the skills row**; the row says the more specific `Streaming Responses`, with `RAG` at the end. **Evals is therefore a project detail, not a skills-row promise** — it's still in Periplus's last bullet and section 9 still has to be tellable, just a notch less likely to come up.
>
> **Evals was in the skills row for a while and is not any more** (above). Section 9 here still has to work as general principle, independent of Periplus. **Streaming has no section here, and Periplus contains no streaming implementation at all** (neither SSE nor WebSocket). That skill comes entirely from **Beyz**, over two channels: audio upstream and transcripts downstream go over Deepgram's **WebSocket** (`hooks/useDeepgram.ts`, `useAudioToText.ts`), and the LLM suggestions come down over a **Next.js RSC stream** (`createStreamableValue` / `readStreamableValue` from `ai/rsc`, `server/actions/copilot.ts:101`, `CopilotSection.tsx:257`) — **not SSE**, and don't get that wrong when asked. See `LEARNING_NOTES_BEYZ_V40.md`.
>
> Note: the skills row says **LLM Integration**, not "LLM Agents", and **"Agent Orchestration" isn't in the skills row at all**. Sections 1 (agents) and 6 (orchestration) therefore **have no skills-row backing** — but they are the substance of the Periplus project bullets (bullets 1 and 2 are about the multi-agent pipeline and the stage contract), so they still get asked and you should still read them. The only difference: **don't point at the skills row and say "I wrote agent orchestration"; point at the project bullet.**
> Where this fits: this isn't a walkthrough of Periplus (that's `LEARNING_NOTES_PERIPLUS_AI.md`). This is organised **by knowledge module**, covering the general CS/AI concepts any competent interviewer might push on regardless of project — definitions, why they exist, the design trade-offs and the alternatives. Each section ends with a sentence or two of how it appears in Periplus (without going into implementation), plus follow-ups that could be asked of any system, not just this one.

---

## Contents

1. LLM agents and agent architectures: ReAct, pipeline orchestration, single-shot
2. RAG (retrieval-augmented generation)
3. Structured outputs: JSON mode, function calling, schema validation and the repair loop
4. Embeddings: vector representations and similarity
5. Vector search: ANN, indexing strategy, pgvector vs a dedicated vector database
6. Agent orchestration: stage gates, budgets, retry/backoff, idempotency and replay
7. Claim / Evidence / Verification: provenance and mitigating hallucination
8. Prompt injection and handling untrusted content
9. Evaluating LLM systems: offline evals, golden sets, LLM-as-a-judge

---

## 1. LLM agents and agent architectures

### Definition
In an LLM context, an "agent" is a system that can **decide its own next action** (call a tool, retrieve information, change state), iterate on what it observes, and keep going until it reaches its goal or a stopping condition — as opposed to a purely generative call of one input for one output. Agent architectures fall into roughly three classes:

- **Single-shot**: one prompt, one output, with no loop and no intermediate tool calls.
- **ReAct (interleaved reasoning and acting)**: within one context and one conversation, the model alternates between emitting a Thought and an Action, with the Action's result (the Observation) appended back into the context, looping until the model decides it can give a final answer. This is the mainstream "one agent using tools" paradigm today (the function calling / tool use loop).
- **Pipeline / orchestrated multi-agent**: split a large task into several single-responsibility stages, each one (or a few) independent model calls, passing **structured artifacts** between stages rather than a shared conversation or chain of thought, with an external orchestrator — not the model — deciding which stage runs next.

### Why it exists / what it solves
A single generation can't handle a task that needs multi-step information gathering, external tools, or a plan adjusted mid-way on what it observes — the model's knowledge is static and its context window is finite, so as soon as complexity exceeds "what can be worked out in one inference", you need some loop or division of labour to break the task down and feed in information from the outside world.

ReAct exists because a model relying on internal knowledge alone invents things and needs real intermediate observations to correct itself — by explicitly alternating thought and action, every decision rests on what a tool actually returned, rather than planning the entire task out of nothing in one shot.

Pipelines and orchestrated multi-agent systems solve a different problem: **one agent doing several jobs produces conflicting responsibilities and contaminated context**. The classic case is the self-grading fallacy — when the same agent both researches and self-checks, the check invokes the reasoning it already committed to during research, so it examines its own conclusion rather than the evidence. That isn't a capability problem, it's structural: inside one context and one chain of thought, later judgements anchor on what has already been written. Splitting generation and checking into two independent agents whose prompts can't even see each other's reasoning is the direct way to break that anchoring.

### Trade-offs and alternatives
- **ReAct (a single agent loop) upsides**: simple to build, all state in one conversation, no cross-agent data contract to design; good for exploratory tasks with few tool rounds where each step depends on the last observation ("check what this API returns, then decide what to check next"). **Downsides**: the context grows without bound (every tool call's input and output stays in it), the model tends to "forget" early constraints down a long chain, and there are no clean, independently testable stage boundaries — when something goes wrong it's hard to say which step did it. More importantly, it can't isolate anything physically, so it's the wrong shape when a reviewer must not be influenced by the reasoning of what it reviews.
- **Pipeline / orchestrated multi-agent upsides**: each stage has one responsibility, its inputs and outputs are serialisable structured artifacts, and it can be tested, replayed and prompt-tuned on its own; different stages can use different model settings (one needing heavy reasoning, another needing reasoning off so it doesn't justify a conclusion it already holds); and stage boundaries are the only clean place to insert deterministic code (validation, trimming, overwriting). **Downsides**: several independent model calls mean more total latency and cost (partly offset because each call's input is more focused and may need less reasoning); a cross-stage data contract (the schema) to design and maintain; and the orchestration itself (retries, budgets, gates) is extra engineering.
- **One big prompt (all responsibilities in one generation)**: the fewest calls and the lowest latency, but when the task requires one step's judgement not to be contaminated by another's reasoning, it structurally cannot isolate anything — everything lives in the same attention window of the same generation, and the model has no way to genuinely "not see" what it already wrote.

The three aren't mutually exclusive: in practice you often see an orchestrated pipeline dividing the large stages, with a ReAct loop doing tool-call exploration inside one of them.

### How it appears in Periplus
Periplus uses an orchestrated multi-agent pipeline (Explorer → Auditor → Navigator → Chronicler → Editor → Illustrator), motivated precisely by the self-grading fallacy: the Auditor's input is strictly limited to `Claim` and `Evidence`, and it can't see the Explorer's search process or reasoning at all.

### Follow-ups
1. How do a ReAct loop and an orchestrated multi-agent pipeline fundamentally differ in failure recovery — what happens after one step goes wrong?
2. If you were converting a ReAct-style single agent into a multi-agent pipeline, what criterion would you cut the stage boundaries on first?
3. What engineering measures can mitigate a multi-agent pipeline's latency and cost disadvantage without changing the architecture?
4. What features of a task would tell you "one agent with tool calls is enough here, don't split it into stages"?

---

## 2. RAG (retrieval-augmented generation)

### Definition
RAG is the pattern of retrieving relevant content from an external knowledge source (a document store, a database, a search engine) before generating an answer, then feeding that content to the model as context. As a formula: `answer = generate(question, retrieve(question, knowledge))`, as opposed to purely parametric knowledge where the model answers from what it memorised during training.

### Why it exists / what it solves
A model's knowledge comes from its training data, which has three inherent flaws: (1) **recency** — it doesn't know what happened after the cutoff; (2) **coverage** — long-tail, private or domain-specific knowledge may not have appeared in training at all, or appeared too rarely to be "remembered"; (3) **hallucination** — when a model is unsure of a fact it doesn't honestly say so, it generates something statistically plausible, which may be invented. RAG decouples knowledge from reasoning and expression — the knowledge lives in external, updatable, auditable storage and the model only reads it and puts it into words — which addresses all three at the root: the source can be updated any time (no retraining), coverage depends on the knowledge base rather than parameter capacity, and if nothing relevant is retrieved, the system can decide there is no basis instead of letting the model improvise.

Fundamentally, RAG pulls "factuality" out of the model's parametric memory and turns it into an external resource that can be retrieved, verified and updated independently.

### Trade-offs and alternatives
- **RAG vs a long context (put everything in the window)**: a long context removes retrieval's complexity and its failure risk, but cost grows at least linearly with length, and the model's attention to the middle of a very long context degrades ("lost in the middle") — retrieval's value is **filtering for relevance first**, so only genuinely relevant content enters the limited window and the signal-to-noise ratio goes up.
- **RAG vs fine-tuning**: fine-tuning burns knowledge into the parameters, which suits changing behavioural style or domain vocabulary, but updating knowledge means retraining — expensive and slow — and fine-tuned knowledge is equally untraceable (you can't say which document a sentence rests on). RAG's knowledge can be added and removed on demand, labelled with a source, and scoped per user, at the cost of retrieval latency and the risk of retrieval quality itself. They also stack: fine-tuning improves how the model uses retrieved content, RAG supplies the factual basis.
- **Choosing a retrieval strategy**:
  - **Sparse retrieval (BM25 / keyword inverted index)**: strong on exact terms, proper nouns and code symbols, highly interpretable, with no embedding model to train or maintain — but blind to semantically close wording ("ticket price" vs "how much is admission").
  - **Dense retrieval (embeddings plus vector similarity)**: captures semantic similarity and is robust to paraphrase and cross-language search, but depends on the embedding model's quality, can be less precise than keyword search on exact entity names and numbers, and adds vectorisation and index maintenance.
  - **Hybrid retrieval**: fuse sparse and dense results (reciprocal rank fusion, for example) to get both strengths — the common default in production systems today.
  - **Reranking**: a first pass (sparse or dense) recalls a larger candidate set, then a more expensive but more precise model (a cross-encoder) rescores and reorders it, fixing the coarseness of vector similarity alone.
- **RAG's failure modes**: nothing relevant retrieved (recall), retrieved but ranked low and truncated out of the context (ranking), retrieved content that is itself stale or wrong (source quality), and the model being given correct content and still inventing or distorting it (faithfulness at generation time — which is why RAG can't eliminate hallucination, only sharply reduce the conditions for it).

### How it appears in Periplus
Periplus's Explorer stage is essentially RAG: search for pages about the destination, then have the model produce candidate facts (`Claim`) from the fetched text, rather than answering "when does this museum open" from internal knowledge.

### Follow-ups
1. If a RAG system "retrieved the right document and still answered wrongly", how would you determine whether the problem is retrieval or generation?
2. Where does each of sparse and dense retrieval typically go wrong? How would you design an A/B test to show hybrid retrieval beats either alone?
3. Can RAG eliminate hallucination? Why not?
4. How do you choose top-k for retrieved documents? Is a larger k always better?

---

## 3. Structured outputs: JSON mode, function calling, schema validation and the repair loop

### Definition
Structured output means constraining an LLM's output to a predefined, machine-parseable format (usually JSON conforming to a schema — JSON Schema, or an in-language type such as a Pydantic model). There are three main mechanisms:
- **Prompt-level constraints**: natural-language instructions asking for JSON only, with no enforcement whatsoever.
- **JSON mode / structured output APIs**: the provider constrains decoding (OpenAI's `response_format: json_schema`, or constrained decoding / grammar-based sampling where every token must come from the set consistent with the schema), guaranteeing syntactic validity and sometimes schema conformance.
- **Function calling / tool use**: the model emits a structured "call this function with these arguments" request — a specialisation of structured output, usually for triggering an external action rather than only producing data.

### Why it exists / what it solves
An LLM is a free-text sampler and naturally produces prose. Downstream systems (an agent orchestrator, a database write, an API call) almost always need **deterministically parseable** output — one missing field, one extra explanatory sentence, one enum value with the wrong case, and downstream code either crashes or silently writes bad data. Structured output bridges "LLM output" and "data a program can safely consume": every step an agent produces can be caught by the type system and validation, instead of every caller writing its own fragile string parsing or regex extraction.

### Why "prompting nicely" isn't enough, and you need schema validation plus a repair loop
Relying on "please return valid JSON" in the prompt is unreliable for structural reasons, not because the model isn't smart enough:
- The model samples probabilistically, and even at 99% compliance, "1% fails" is a certainty at production call volumes.
- Complex schemas (nested objects, enum constraints, required fields, cross-field consistency rules) exceed what natural-language instructions can express precisely — a cross-field rule like "when the verdict is supported there must be at least one supporting_evidence_id" is nearly impossible to guarantee with one sentence of prompt.
- Even with JSON mode, the provider typically guarantees only syntactically valid JSON, not semantic correctness (whether the values are self-consistent for the business, whether the cited IDs exist) — that layer of validation has to be application code, and can't be delegated to the model.
- Models occasionally wrap the JSON in explanatory text, a code fence or extra escaping even in json_object mode, so downstream needs a robust extraction step (find the first syntactically balanced JSON object) rather than assuming the whole reply is pure JSON.

So the complete answer has three layers: **(1) the prompt** stating the expected schema, **(2) the decoding/API layer** constraining the sample space as far as possible, and **(3) the application layer** validating the parsed result against a real schema (Pydantic/JSON Schema) and, on failure, running a **repair loop** — feeding the model's own bad reply plus the specific validation error back as context so it can see what it got wrong, rather than regenerating from scratch (which loses that signal).

### The key design point: two kinds of failure need different treatment
A structured output call can fail for two entirely different reasons, which need different recovery:
- **Transient (transport-level) failures**: a network timeout, rate limiting (429), a provider 5xx — nothing to do with whether the generated content was right, so the reasonable move is to **replay the same prompt verbatim**, usually with exponential or linear backoff.
- **Schema/validation failures (content-level)**: the returned content doesn't satisfy the schema syntactically or semantically — here you **feed the error back to the model** (rather than replaying, which would most likely produce the same mistake) so it can see what it got wrong and fix it.

Both need **bounded retries** (section 6) rather than infinite ones — past the limit, raise a clear exception carrying the full failure history so the caller can decide what to do (record a gap/caveat and carry on, or fail the stage), instead of swallowing it silently or looping forever burning budget.

### Trade-offs and alternatives
- **JSON mode / constrained decoding vs prompt-only**: the former drastically reduces syntax errors at the root (some implementations guarantee 100% valid syntax), but not every provider or model supports it, and constrained sampling can cost a little generation quality (the model is forced to choose from a restricted token set, which may not be the most natural phrasing); the latter is free and has an uncontrolled error rate. Production systems almost always do both: JSON mode as the floor, application-level schema validation as the backstop.
- **A repair loop vs regenerating**: repair (feeding the error back) converges faster and costs fewer tokens (the model doesn't rethink from zero), but if the previous output was very long, appending all of it to the conversation raises the cost of the next call substantially; regenerating is simpler but can repeat the same mistake indefinitely (the correction signal is gone).
- **The retry limit**: too low and an occasional small error never gets fixed, raising the failure rate; too high and a systematically broken prompt (an ambiguous schema, a judgement the model can't make) gets retried repeatedly, burning budget for a result that most likely won't come. Retries fix incidental errors, not logical ones — which is why transient and logical failures must be distinguished (section 6).

### How it appears in Periplus
Periplus's `LLMClient.structured()` wraps the whole flow in one place: a transient provider error replays the same prompt with backoff, a schema validation failure (the Auditor's verdict being inconsistent with its evidence citations, say) appends the model's last reply plus the specific validation error to the conversation and asks for a correction, and only past `max_attempts` does it raise a `StructuredOutputError` carrying the full attempt history.

### Follow-ups
1. If a validation rule is cross-field ("this enum value requires that other field to be non-empty"), can JSON Schema express it? Where should the part it can't express be validated?
2. The repair loop appends the model's whole bad output back into the context — what does that cost, hidden? How would you make the loop cheaper in tokens?
3. Why replay the original prompt for a transient failure but not for a validation failure?
4. If your downstream sits on a third-party API you don't control and which has no JSON mode, how would you guarantee parseable structured output?

---

## 4. Embeddings: vector representations and similarity

### Definition
An embedding maps a piece of text (a word, sentence or document) to a fixed-dimensional dense vector of real numbers that tries to capture its meaning — semantically similar text ends up nearby in the vector space. The model producing that mapping is the embedding model, and typical dimensions run from a few hundred (384, 768) to a few thousand (3072 for OpenAI's `text-embedding-3-large`).

### The maths: how similarity is computed
Given two vectors `a` and `b` of the same dimension, the common similarity/distance measures:
- **Cosine similarity**: `cos(θ) = (a·b) / (‖a‖ × ‖b‖)`, which cares only about whether the two vectors point the same way and is unaffected by magnitude, ranging over [-1, 1] with 1 meaning identical direction.
- **Dot product**: `a·b = Σ aᵢbᵢ`, affected by both direction and magnitude — with unnormalised vectors, the dot product folds "this vector is simply longer" (often an artefact of longer or more extreme text) into the similarity, which biases results.
- **Euclidean (L2) distance**: `‖a-b‖ = √(Σ(aᵢ-bᵢ)²)`, the straight-line distance between two points, also affected by magnitude.

**Why text embeddings usually use cosine rather than the dot product**: most embedding models are trained so that semantic similarity corresponds to similar direction, without deliberately constraining magnitude; without normalisation, the dot product systematically gives longer vectors higher scores, and that length usually has nothing to do with relevance (it's a statistical property of the text). Cosine similarity purifies the direction and removes length as a confounder. **The exception**: if the vectors are already unit-normalised (‖a‖=‖b‖=1), cosine and dot product are numerically equivalent (differing only by a division you can skip), and the dot product is then faster — which is why many vector databases require or recommend normalising up front and using the dot product throughout, avoiding a normalisation on every query.

### Why it exists / what it solves
Exact string matching (or keyword matching in sparse retrieval) can't handle "the same meaning in different words" — "when does the museum open", "museum opening hours" and "visiting times" share almost no literal tokens while meaning the same thing. Embeddings turn the fuzzy notion of semantic similarity into a numeric problem you can compute exactly with linear algebra: if two passages map near each other, either can be retrieved by the other, without sharing a single token. That's the infrastructure behind semantic search, deduplication (the same meaning phrased differently) and clustering.

### Trade-offs: choosing an embedding model
- **Dimensions**: more dimensions can encode more information in principle, but storage (disk and memory in the vector database) and query computation both grow linearly with dimension, and beyond a point the returns diminish or even reverse when there isn't enough data (a curse-of-dimensionality effect). 384–1536 is the common practical range.
- **A local open model vs a paid API**: a local model (the `sentence-transformers` family) has zero marginal cost per call, keeps data on your own machine (good for privacy and compliance) and has controllable latency, but is usually smaller and less trained than the leading commercial APIs, so semantic quality can lag on long-tail, cross-lingual or specialist text; a paid API (OpenAI, Cohere) usually gives better quality with no maintenance (no model loading or inference resources to manage) but has ongoing cost and sends your text to a third party (which needs assessment for sensitive data).
- **Whether to fine-tune for a domain**: a general embedding model can underperform in a field dense with specialist terms (legal, medical, internal codenames), and fine-tuning or further contrastive training on domain data raises retrieval precision substantially, at the cost of labelled data and training/maintenance.
- **Sentence-level vs document-level embeddings**: embedding a long document as a whole averages its meaning and dilutes the details; the common approach is to chunk it and embed each chunk, retrieving by chunk. But the chunking strategy itself (size, overlap, whether to split on semantic boundaries) is its own trade-off — too small loses context, too large dilutes relevance.

### How it appears in Periplus
Periplus vectorises evidence text with a local `sentence-transformers` model (`all-MiniLM-L6-v2`, 384 dimensions) rather than a paid embedding API, driven by cost (not wanting to send fetched page text to a paid third party), and searches by cosine distance in pgvector.

### Follow-ups
1. When do the dot product and cosine similarity produce different rankings?
2. How does chunking strategy affect retrieval quality? How should chunk size be chosen?
3. If retrieval is poor in one specialist domain (vector similarity disagrees with human judgement about relevance), how would you determine whether it's the model or the chunking/preprocessing?
4. Do more dimensions always mean better retrieval? Why not?

---

## 5. Vector search: approximate nearest neighbours and index strategy

### Definition
Vector search means finding the top-k most similar (nearest) vectors to a query vector within a collection of high-dimensional vectors. The exact solution (brute force) computes the similarity against every vector and sorts, at O(n×d) (n vectors, d dimensions) — fine at small scale, unacceptable in latency once you're past a million vectors. **Approximate nearest neighbour (ANN)** algorithms trade a little recall (no guarantee of finding the true top k, but close enough in the overwhelming majority of cases) for an order-of-magnitude speedup.

### Why it exists / what it solves
An O(n) scan is too slow at production scale (millions to billions of vectors), while the use cases (real-time semantic search, online retrieval for RAG) need responses in milliseconds to hundreds of milliseconds. An ANN index organises the collection in advance (into a structure that narrows the candidate set quickly), taking query time from linear down to near-logarithmic or sublinear, at the cost of index build time, storage, and results that are no longer a guaranteed optimum (a tiny probability of missing the true nearest neighbour).

### Common index strategies (conceptually)
- **IVF (inverted file index)**: cluster the vector space first (with k-means, say) into buckets (clusters/lists), assigning each vector to the bucket of its nearest centroid. A query finds the few buckets it most likely falls into and compares exactly only within those, rather than scanning everything. `nlist` (the number of buckets) is the key parameter — too few and each bucket holds too many vectors, degenerating toward a full scan; too many and each holds too little data, hurting index quality and build cost. **IVF depends on training the centroids in advance**, so building an index on too little data produces a poor one, typically degenerating into an effective full scan — that isn't a bug, it's the structure behaving reasonably but inefficiently when starved of data.
- **HNSW (hierarchical navigable small world)**: organise the vectors into a multi-layer graph where each node connects to several neighbours, with sparse long-range links in the upper layers for fast jumps and dense short-range links below for fine positioning. A query starts at the top and greedily navigates toward the query vector, descending and refining layer by layer. HNSW usually gives lower query latency than IVF at the same recall and needs no clustering pre-training, but builds more slowly and uses more memory (the graph's links have to be stored).
- **PQ (product quantization)**: split a high-dimensional vector into sub-vectors and quantise each against a small codebook into a short code, compressing storage dramatically (approximations replacing raw floats). Often combined with IVF as IVF-PQ for very large, memory-constrained deployments, at the cost of further precision.

### pgvector vs a dedicated vector database (Pinecone / Weaviate / Milvus)
- **pgvector**: a PostgreSQL extension adding a vector column type to ordinary relational tables, supporting IVFFlat and HNSW indexes. **Upsides**: vectors live alongside the rest of your structured data (metadata, foreign keys, transactions), so one SQL statement can combine vector similarity with ordinary WHERE filters (hybrid queries) with no synchronisation between two storage systems; low operational cost (if the team already runs Postgres); and transactional and consistency guarantees come with the relational database. **Downsides**: at very large scale (billions of vectors) it trails dedicated systems on performance, offers fewer index algorithms and tuning options, and scales horizontally less well than something designed distributed from the start.
- **Dedicated vector databases (Pinecone/Weaviate/Milvus)**: purpose-built distributed architectures, a richer choice of index algorithms, native horizontal scaling and high availability — right when the vector count is huge, QPS is high and retrieval is the core workload. **Downsides**: another storage system to operate, consistency with the primary database to design (dual writes, replication lag), and probably over-engineering at small to medium scale.
- **What actually decides it**: data scale (under a few million, pgvector is usually enough), whether vector search and relational queries have to mix with strong consistency, the team's existing operational capability and infrastructure, and whether Postgres is already in use (reusing existing infrastructure costs far less at the margin than introducing a new system). It's the classic "nothing is absolutely better, only better suited to this scale and these constraints" engineering decision.

### How it appears in Periplus
Periplus uses pgvector's `ivfflat` index with the cosine distance operator for the semantic cache over evidence text. It chose pgvector over a dedicated vector database because the data (cached page evidence) is nowhere near the scale that needs a distributed vector database, and reusing the existing Postgres avoids operating a second system.

### Follow-ups
1. How do IVF and HNSW trade off across query latency, build time and memory? Which would you choose where?
2. Where exactly is a vector index "approximate"? Can you quantify an ANN index's recall loss?
3. If retrieval quality suddenly degrades (similarity scores generally low or the ranking nonsensical), how would you determine whether it's the index, the embedding model or the data distribution?
4. When would you conclude "no vector database needed, a brute-force scan is fine"?

---

## 6. Agent orchestration: stage gates, budgets, retry/backoff, idempotency and replay

### Definition
Orchestration is the layer that manages execution of a multi-step or multi-agent system — deciding what runs next, what counts as success worth proceeding on, what should be retried versus failed outright, how resource ceilings are enforced, and how the system recovers after a crash or interruption. The orchestration layer typically **contains no business or domain logic at all** (it doesn't know what the prompts say or which model is used) and knows only a uniform "stage" abstraction — separation of concerns, directly applied.

### The core mechanisms

**1. Stage gates**
A stage finishing without an exception doesn't mean its output is good enough to proceed — the model may have returned something structurally valid and substantively empty (retrieval succeeded but not one usable fact came out). A gate is a function that checks the stage's output at the business level, deciding whether it meets the minimum bar to continue. **Why it must be separate from structural validation**: schema validation only guarantees the format is right, while a gate guarantees the content means something for this task — two different levels of correctness that must be checked separately. A gate failure is generally a **logical failure** rather than a transient one: the same input re-run will most likely produce the same result, so a gate failure should not trigger an automatic retry.

**2. Budgets**
In a multi-step system, any step can run away with resources (call counts, tokens, real money, wall-clock time), so you need a runtime accumulator tracking consumption across dimensions and refusing to continue once a configured ceiling is passed. **The key design question is when to check**: the check should happen after an atomic operation completes rather than during it (you usually can't interrupt a model call cleanly half way), which means one operation can in theory exceed the ceiling once, but nothing will be attempted after that — a practical compromise between a hard real-time limit and a soft after-the-fact one, since a truly hard real-time limit requires safely interruptible operations, which costs far more to build.

**3. Bounded retries, and separating transient from logical failure**
This is one of the most important principles in the orchestration layer: **you must strictly distinguish failures worth retrying from failures where a retry changes nothing**.
- **Transient failures**: network timeouts, rate limits, temporary provider faults — the execution environment was unstable, and the same input at a different moment will most likely succeed, so retry with backoff (increasing waits, so an immediate retry doesn't worsen congestion).
- **Logical failures**: the input itself is wrong, the model's judgement simply isn't up to it, the gate check failed — none of these causes disappear on a retry, which only wastes budget and time, so fail immediately and propagate a clear reason.
A system that doesn't make this distinction fails in one of two typical ways: treating everything as transient and retrying blindly until the budget is gone, or treating everything as logical and giving up even on incidental faults a simple retry would have fixed, so robustness suffers.
The retry count must have a hard ceiling (never unlimited), and the default should lean toward not retrying (retrying is behaviour you explicitly turn on), so nothing silently consumes resources in the background.

**4. Idempotency and replay**
Idempotency means performing an operation several times has the same effect as performing it once — in an orchestration system, that a stage which already completed successfully shouldn't be re-executed with side effects (a duplicate charge, a duplicate message) because of a restart or a repeated upstream trigger. Replay extends this: after a crash, or when someone wants to restart from an intermediate stage (having changed one stage's prompt and wanting to re-run verification without re-running expensive retrieval), the orchestrator needs to find the output of the last successfully completed stage and treat it as the recovery point rather than running the whole flow again. That requires: (a) each stage's output persisted (not just the most recent attempt, but distinguishing which attempt actually passed its gate); (b) resources spent during a replay counted against the run's total budget, or "replay the same task repeatedly" becomes a way to route around the ceiling — spending a little at a time to break through a limit that was supposed to hold.

**5. Checkpointing**
The mechanism replay rests on: persist the state at key points (usually as each stage completes) so an interrupted system resumes from the most recent checkpoint rather than from zero. Checkpoint granularity is a trade-off — too coarse (saving only at the end of the whole flow) and an interruption costs a lot of re-work; too fine (saving after every model call) and storage and maintenance overhead rise for little benefit (many intermediate attempts are failed attempts destined to be discarded anyway).

### Trade-off: why not "retry everything automatically until it works"
This counter-intuitive design gets asked about. If the orchestration layer retried every failure until success, the system would look more robust while actually hiding the real problem: a badly designed prompt producing consistently wrong answers would silently eat the budget with no meaningful progress, and the failure would never surface for a developer to find and fix. Bounded retries plus an explicit notion of logical failure is the right balance between recovering from incidental faults automatically and exposing problems that genuinely need a human.

### How it appears in Periplus
Periplus's Hermes orchestrator configures a gate per stage (verification only passes when every claim received a verdict), splits model call failures strictly into `TransientStageError` (retry with backoff) and `StageFailure` (fail immediately, no retry), and on replay initialises the new budget tracker with everything every previous attempt in that run already spent, so repeated replays can't route around the ceiling.

### Follow-ups
1. How would you decide whether a new failure type is transient or logical? Are there genuinely ambiguous cases?
2. In the worst case, how much can "check the budget only after a stage completes, never during" waste? How do you weigh precision against implementation complexity?
3. When does idempotency matter most (operations with external side effects — sending email, charging money)? How would you design an operation to be idempotent by construction?
4. How do you choose checkpoint granularity? What does each extreme cost?

---

## 7. Claim / Evidence / Verification: provenance and mitigating hallucination

### Definition
This is a design pattern used widely in systems that must generate trustworthy factual content. The core idea is to lift factual statements out of free-form prose into structured objects carrying an explicit source, then rule on each statement independently and verifiably:
- **Claim**: a single falsifiable factual statement ("this museum closes on Mondays"), not a paragraph mixing several facts together.
- **Evidence**: the source passage supporting or contradicting a claim, normally a verbatim excerpt rather than a paraphrase.
- **Verdict / verification**: an explicit judgement on whether the claim is supported by that evidence (supported / partially supported / contradicted / unsupported / no evidence), reached independently of whatever produced the claim.

This pattern is sometimes called grounding — making sure every factual sentence in the generated content lands on a traceable, checkable source rather than hanging in the air on the model's internal memory.

### Why it exists / what it solves
Hallucination — fluent output that isn't true — is the most fundamental limitation of generative models, because the training objective is "generate a statistically plausible next token", not "speak only when sure". For low-tolerance domains (medicine, law, or the opening hours and prices in a travel plan that a reader will act on directly), telling the model not to make things up is not enough, because hallucination isn't carelessness, it's intrinsic to the paradigm. The Claim/Evidence/Verification pattern constrains it **structurally** rather than **by instruction**:

- Requiring every statement to be bound to a quote that can be **checked verbatim** against the original source, rather than letting the model paraphrase — a paraphrase introduces "looks right, was quietly rewritten" risk (a tidied number, two sentences merged, a paraphrase in quotation marks), and if verification checks against the model's own paraphrase rather than the real source, it verifies nothing at all.
- Splitting "produce candidate facts" and "check those facts" into separate steps and separate agents, avoiding the self-grading fallacy (section 1).
- Giving "not yet verified" and "failed verification" explicit states distinct from "verified", so unchecked content is never silently treated as trustworthy.

### A general taxonomy of hallucination mitigation (not tied to any one system)
1. **Retrieval grounding (RAG)**: anchor generated content in real retrieved text, section 2.
2. **Citation grounding**: require a traceable source for every factual statement, and have application code verify that source at the string or semantic level (does it really exist in the original), rather than trusting the citation the model claims.
3. **Independent verification / self-consistency**: generate the same question several times independently or have a separate checking step review the conclusion, judging trustworthiness by agreement — or use a dedicated checking step that cannot see the original reasoning.
4. **Deterministic code as the backstop**: anything decidable by rule or arithmetic (has a date expired, how long is the real journey between two places, is a number within a plausible range) is never left to the model's discretion; ordinary code computes it and overwrites whatever number the model produced. Models don't need to be trusted with that kind of computation, and shouldn't be.
5. **Abstention**: let the system output "cannot confirm" when the evidence is insufficient rather than forcing an answer — which requires training or prompting the model to distinguish a confident judgement from a groundless guess, and requires downstream to handle "no answer" gracefully rather than as an exception.
6. **Human in the loop**: a human review step for high-risk judgements — the most direct and most expensive measure, usually reserved as a backstop rather than the normal path.

### Trade-offs
- **Verbatim quote checking vs semantic similarity checking**: requiring the quote to be an exact substring of the source (case-insensitive, whitespace-folded) is the strictest and also the simplest, most reliable check — no extra semantic model, and no grey area where "semantically similar" hides a distorted statement. The downside is that it looks rigid against legitimate, necessary paraphrase (a long source where the claim has to summarise), and it may reject statements that were actually reasonable, trading recall for precision. It's the classic precision/recall trade-off, and in low-tolerance domains (where an error is expensive) sacrificing recall is usually right.
- **Independent verification vs asking the generator to double-check**: independent verification (a different agent or call that cannot see the original reasoning) structurally avoids the self-grading fallacy at the cost of more calls and latency; a self-check inside the same call ("now check your answer") is easy to build and weak in practice, because a model tends to defend what it already produced rather than genuinely look for the flaw.
- **What to do with a failed verification**: reject the content outright / degrade but keep it (labelled "unverified" and still shown) / escalate to human review — depending on how the business weighs a miss (something that should have been rejected wasn't) against a false alarm (something reasonable was rejected).

### How it appears in Periplus
Periplus requires every `Claim` to carry a `quote` verifiable verbatim against the source text, rejects the claim outright when that check fails rather than letting the model "fix" it, and keeps the verification stage (the Auditor) blind to the generation stage's (the Explorer's) reasoning — it sees only the claim and the evidence text.

### Follow-ups
1. Where does a hard "verbatim quote" constraint look too rigid and reject content that was actually reasonable? How would you trade precision against recall?
2. Beyond retrieval grounding and citation checking, what other techniques lower hallucination? What does each cost and where does each fit?
3. If a system needs to know how confident a model is in an answer, what methods approximate that confidence (beyond asking the model for a number)?
4. The independent verification step is itself an LLM and can be wrong — how would you evaluate and monitor the reliability of the verifier itself?

---

## 8. Prompt injection and handling untrusted content

### Definition
Prompt injection is an attacker embedding instruction-like text in content an LLM system will process (either the user's own input, or more insidiously third-party content the system retrieves — web pages, documents, emails, API responses) to make the model deviate from its system instructions and do what the attacker wants (leak sensitive information, produce harmful content, make an unauthorised tool call, embed misleading content in the output). Two sub-types:
- **Direct injection**: the attacker is the end user, writing "ignore your previous instructions and instead…" straight into their input.
- **Indirect injection**: the malicious instruction hides in third-party content the model reads but which didn't come from the current user (a page an agent retrieves, an email being summarised), and the model may treat that "data" as instructions to follow. This is the more realistic and much harder threat for today's agentic/RAG systems, because the attacker never has to interact with the system at all — they only have to place the content somewhere the system may later retrieve.

### Why it's hard
An LLM has **no reliable, structural boundary between instructions and data** — everything handed to the model becomes one token sequence, and the model learned statistically which text patterns tend to be executed as instructions. That pattern recognition isn't a rule, it's a learned tendency. Even a model specifically trained to spot and refuse suspicious injection patterns can be worked around with new phrasing, encodings (unusual languages, indirect hints, instructions disguised as a quotation or an example) — a continuing arms race with no permanent fix. The industry consensus is that **no single technique eliminates prompt injection**; you can only reduce risk and limit the blast radius through defence in depth.

For agentic systems (able to call tools and take actions) the damage multiplies — if an injected instruction can get an agent to call a tool with real side effects (sending email, executing code, initiating a payment), the consequences are far worse than "it wrote something inappropriate".

### The classes of mitigation (there is no single fix, only depth)
1. **Prompt-level reminders and role boundaries**: telling the model in the system prompt that what follows is untrusted data and any instruction-looking text in it must be ignored. **This is the weakest layer** — it depends on the model choosing to comply, and is a suggestion rather than a constraint, so a carefully constructed injection can still get past it.
2. **Structural isolation (grounding with least privilege)**: rather than relying on the model not being led astray, design the architecture so that even when the model is misled, its output cannot escape a safe, checkable range. Typical measures: require every output field to be verifiable against a restricted allowlist (a cited ID must be in the permitted set, and anything outside it is dropped by code rather than trusted), and require every factual statement to be verifiable verbatim against the source (section 7) — even if a model is induced to invent a false statement, unless it can produce a quote matching the source verbatim, deterministic code stops it. That defence doesn't depend on the model complying, which makes it the hardest layer here.
3. **Input sanitisation**: preprocess retrieved third-party content, detecting and stripping or escaping instruction-shaped patterns ("ignore previous instructions" and its known relatives), or marking data-versus-instruction boundaries with delimiters. The limitation is that filter rules always trail new techniques — it stops known attacks, not unknown variants.
4. **Least privilege and human confirmation gates**: restrict the tools an agent can call and the blast radius of each one, and require human confirmation for high-risk actions (sending external messages, spending money, deleting data), so even a successful injection is architecturally limited in what it can do.
5. **Use a low-privilege "distilling" model on untrusted content**: have a separate model with no tool access read the untrusted content and distil it into a structured summary, then give that summary (rather than the raw HTML/text) to the tool-capable main model — so even if the distilling step is misled, the contaminated output never reaches the layer that can act.
6. **Output-side anomaly detection**: run rules or a classifier over the final output and behaviour to spot patterns that look injection-induced (a URL that shouldn't be there, imperative language), as a last backstop.

### The key insight: structural defence vs semantic attack
Even with "fabricated statements are stopped structurally" (verbatim quote checking), a harder attack surface remains: **the attacker doesn't need the model to invent something unrelated to any source, only to bias a judgement inside the legal citation boundary** — carefully worded content leading the verifier to rule contradicting evidence "supported" while citing an evidence ID that really was supplied and is formally valid. That attack breaks no structural rule; it's purely semantic misdirection, and structural self-consistency checks can't catch it. Your options are stronger detection (an independent second judgement) or accepting it as a live exposure that needs watching. **Being able to say honestly "our defence stops class A and doesn't stop class B, and here's why"** is far more convincing in an interview than a vague "we handle prompt injection".

### How it appears in Periplus
Every Periplus agent's system prompt reminds the model that retrieved content is untrusted data whose instructions must be ignored, but what actually defends the system is structural: a claim's quote must verify verbatim against the source, and cross-stage ID references must fall inside an allowlist. For semantic injection that biases a judgement inside the legal citation boundary, the prompt reminder is currently the only backstop — an honestly acknowledged exposure that hasn't been solved structurally.

### Follow-ups
1. How do defences against direct and indirect injection fundamentally differ? Why is indirect injection generally considered the higher risk?
2. If you could add only one layer of defence, would you choose the prompt reminder or the structural check? Why?
3. Give an example of a structurally consistent but semantically misled injection that existing rule-based checks can't catch. How would you design detection for it?
4. If an agent system has to call high-risk tools (transfers, deleting data), what architectural defences would you add so that nothing depends on the model deciding "is this request reasonable"?

---

## 9. Evaluating LLM systems: offline evals, golden sets, LLM-as-a-judge

> **`Evals` once appeared in both the skills row and a project bullet; only the project bullet carries it now** — still answerable, one notch lower in priority. Periplus's implementation is in `LEARNING_NOTES_PERIPLUS_EVALS.md`; this section is only the principle, which holds without the project.

### Definition
Evaluating an LLM system (an "eval") means scoring the quality of its output against a set of **fixed inputs plus measurable criteria**, so that "which is better, before or after" becomes a comparable number instead of a subjective impression. Its relationship to traditional unit testing is worth separating first:

- **A unit test** asserts **deterministic behaviour** — given this input, the function must return this value. It proves the system did what it was told.
- **An eval** asserts **a quality level** — given this input, the system's output must fall within a range on certain metrics. It answers whether what it was told to do is being done well.

A system with an LLM in it needs both: model output is inherently non-deterministic, so unit tests can't cover quality, and without evals, every prompt change, model upgrade or retrieval tweak is signed off on a feeling.

### Why it exists / what it solves
1. **"I improved the prompt" is unfalsifiable without an eval.** Eyeballing a few outputs is both selection-biased and unable to answer whether the whole thing got better or worse.
2. **Regressions go unnoticed.** Degradation in an LLM system is usually local — one class of input got worse, the rest is fine. Without a fixed input set, nobody notices until users complain.
3. **You can't decide on a model or vendor change.** Model upgrades are routine, and without a re-runnable baseline, "the new model is better" comes from the vendor's marketing.
4. **Cost is part of quality.** Tokens and latency have to be measured alongside correctness, or it's easy to pay three times as much for a 1% improvement and think you won.

### The three mainstream approaches (and what each can answer)
| Approach | How it scores | Can answer | Can't answer |
|---|---|---|---|
| **Deterministic metrics on fixed inputs (offline eval / golden set)** | pure code computes metrics from the output and compares to thresholds | whether the system's **code path** regressed; whether cost is running away | the model's language quality, whether it "reads well" |
| **LLM-as-a-judge** | another (usually stronger) model scores the output against a rubric | quality, usefulness and style of open-ended generation | the judge's own bias, its cost, and baseline drift when the judge is upgraded |
| **Human labelling / preference** | people score or run an A/B comparison | the final ground truth | slow, expensive, impractical on every commit |

**The mature answer is all three, layered**: the offline eval runs on every commit as a CI gate, the LLM judge runs periodically, human evaluation runs before key releases. **The worst thing you can do in an interview is blur them** — above all, don't describe "I assert metrics on fixed cases" as "I did LLM-as-a-judge".

### What a golden set has to freeze
A system with an LLM has several sources of non-determinism, and **any one of them left unfrozen makes the eval go red at random**:

1. **The input itself** — a fixed request or query.
2. **The retrieved external content** — pages change, APIs change. Unfrozen, today's failure can't be told apart from a redesign of someone else's website.
3. **Time** — any logic touching "what's today" (freshness, expiry, date arithmetic) must run against a frozen clock, or the same case gives different results on different days.
4. **The model's answers** — either a fixed reply script or a deterministic stand-in that answers from labels. **With the model's judgement pinned, any movement in the metrics can only be attributed to the code**, which is exactly why offline evals work at all.
5. **Randomness** — temperature, seeds, any sampling parameter.

### Design principles that separate people in interviews
- **Assert ranges, not literal output.** Comparing the model's text word for word produces a suite that cries wolf daily, and a test that goes red every day is no test — people switch it off. A range ("gap rate ≤ 0.4", "citation failures == 0") only goes red when something actually broke.
- **An unknown metric name must fail.** If a threshold naming a metric that doesn't exist is silently ignored, the report shows a green case that asserted nothing — worse than no assertion at all.
- **An empty output must not score perfectly.** Metric definitions have to place "produced nothing" at the worst end, or a total failure passes with a perfect score.
- **Cases are data, not code.** An eval set that needs a code change to add a case stops growing; cases as data can also be diffed, reviewed and generated in bulk.
- **You need a control case.** Otherwise, when a case goes red, you can't tell whether the feature under test broke or the shared path did.
- **An attribution column.** The report has to record which version of the prompts a run used, or "the metric improved" can't be attributed to a change and is just an anecdote.
- **Deleting a case must not count as an improvement.** When comparing two reports, cases present on only one side have to be listed explicitly, or deleting a failing case fakes a gain.
- **The eval suite itself needs testing.** An eval set that can't fail is decoration — the usual approach is injecting known bad changes deliberately and asserting the suite really goes red.

### The common metric families
- **Correctness / grounding**: factual error rate, the share of unsupported claims (gap rate), citation integrity (can every statement be traced to a source), refusal rate.
- **Retrieval**: recall@k, precision@k, MRR, nDCG (measuring the retrieval layer, not generation).
- **Cost**: prompt/completion tokens, money, end-to-end latency, retry count. **Total these from the call ledger the system already keeps rather than re-estimating inside the eval**, or the eval report and the production bill won't agree.
- **Safety**: the pass rate on injection cases, the count of unauthorised tool calls.

### Trade-offs
- **A deterministic stand-in vs a real provider**: a stand-in makes the eval free, offline and re-runnable, but can't measure prompt quality; a real provider can measure prompts but is slow, costs money and is noisy (needing several samples for a distribution). The sensible architecture makes **the metrics and report layers provider-agnostic**, so both modes share the same cases and the same metrics.
- **Case count vs maintenance**: every case is an asset to maintain, and a source redesign or a schema change ripples through them. Better few and precise, each pinning one clear failure mode, than hundreds of vague ones.
- **How strict the CI gate should be**: thresholds too tight block merges daily, too loose and it's decoration. The usual answer is zero tolerance on the hard metrics (citation integrity, safety) and ranges on the soft ones.

### How it appears in Periplus
Four JSON cases make up the golden set, each freezing the brief, the corpus and the `as_of` clock; the two seams (retrieval and the model) are replaced by offline stand-ins while Hermes, all six agents, the gates and budget accounting are production code; assertions are written only as ranges over evidence-gap rate, citation integrity, the verdict distribution and token cost; and comparing two reports produces a diff table marking each metric better/worse, with a digest of the system prompts for attribution. **It's a deterministic offline eval, not LLM-as-a-judge** — see `LEARNING_NOTES_PERIPLUS_EVALS.md`.

### Follow-ups
1. Where's the line between an eval and a unit test? What class of problem does a project with only unit tests miss?
2. Why not assert the model's output text directly? How exactly does a snapshot test rot on this kind of system?
3. If the model's answers are pinned in the eval, what does the eval actually measure? Does it still mean anything with a different model?
4. When must you use LLM-as-a-judge? What do you do about baseline drift when the judge is biased, or its version is upgraded?
5. Would you put the eval in CI? How do you set thresholds so it neither cries wolf nor becomes decoration?
6. How does an eval set typically decay after a year? What mechanism would you use to stop it failing quietly?
7. When do you use retrieval metrics (recall@k) versus generation metrics (factual error rate)? What blind spot comes from looking at only one?
8. If a metric improved, how do you prove it was your change and not something else that moved at the same time?

---

## How this note divides labour with the project note

This document teaches **transferable general concepts** — LLM agent architectures, RAG, structured output, embeddings, vector search, orchestration semantics, provenance patterns, prompt injection, system evaluation — all of which hold without Periplus, so an interviewer asking about a different system gets the same answers. `LEARNING_NOTES_PERIPLUS_AI.md` records **how Periplus implements those concepts** (which file, which function, the actual field names and validation rules). Read together, they are what "understands the principles and can show real code" looks like.
