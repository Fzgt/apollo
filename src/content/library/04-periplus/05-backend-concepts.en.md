---
title: Backend concepts
section: Periplus
---

# Backend engineering concepts (interview preparation, by topic)

> Resume anchor: **"Backend & Data: Node.js, NestJS, FastAPI, Django, PostgreSQL, pgvector, MongoDB"**
>
> This document divides labour with `LEARNING_NOTES_PERIPLUS_BACKEND.md` in the same directory: that one is a walkthrough of how Periplus is actually built; this one doesn't go route by route but takes the **general backend concepts** behind that resume line topic by topic — the definition, why it exists, the trade-offs and alternatives, a short Periplus example (a pointer, not a repeat), and how the concept itself might be pushed on. The backend isn't this candidate's strongest direction, so this is deliberately lighter than the project document: the core concepts in full, the peripheral ones briefly.

---

## 1. Two models of backend framework: synchronous vs asynchronous (Node.js/NestJS, FastAPI, Django)

**What it is:** once an HTTP request arrives, how does the server handle many requests "at once"? Broadly two roads. Under a synchronous blocking model, each request occupies a thread or process, the thread is suspended while waiting on IO (the database, an external API), and concurrency comes from piling up threads and processes. Under an asynchronous event loop, all IO waits in a single thread are registered as callbacks or `await` points, the thread never truly blocks, and concurrency comes from switching to another request during the gaps.

**Why the distinction exists:** most backend requests spend their time waiting on IO (the database, a downstream service) rather than on CPU. Dedicating a whole OS thread to a task that is mostly waiting is wasteful, and the async model sustains far higher concurrency on fewer system resources. But it demands more of whoever writes the code — one piece of synchronous CPU-bound work in the wrong place stalls the whole event loop and slows every concurrent request, a trap the synchronous model doesn't have.

**Mapping to the frameworks, and the trade-offs:**
- **Node.js / NestJS**: Node is a single-threaded event loop by nature and `async/await` is native to the language; NestJS adds an Angular-style modular architecture on top (`Module`/`Controller`/`Provider` and a DI container), solving "Express is too free-form and large projects lack a consistent structure", at the cost of many concepts, many decorators, and a steeper curve than bare Express.
- **FastAPI**: Python's asynchronous option, on ASGI + `asyncio`, using Pydantic for type annotations and automatic OpenAPI generation — the best "types drive the developer experience" of the three.
- **Django**: traditionally synchronous, multi-threaded/multi-process (WSGI), with `async def` views added in recent years — but a great many third-party libraries in the ecosystem (ORM-related above all) are still synchronous, so its async story is half-finished and taking real advantage of it requires care. Django's selling point was never async performance; it's batteries included (the ORM, the admin, authentication, forms, all out of the box).

**Periplus example:** the backend is fully asynchronous FastAPI — route functions are `async def`, Postgres goes through an async pool, and the long-running AI pipeline is handed to `asyncio.create_task` so the response returns immediately without blocking the event loop.

**Possible follow-ups:**
- In an async model, how do you call a third-party library that only has a synchronous interface (an older SDK) without blocking the event loop? (Direction: hand it to a thread pool, `run_in_executor` / `asyncio.to_thread`.)
- Why doesn't the async model help with CPU-bound work — and why can it be worse?
- What real problem does NestJS's dependency injection solve? How does it compare to passing arguments by hand, and what does it cost?

---

## 2. REST API design, and schema-first vs code-first

**What it is:** REST is a set of conventions for API design around resources, HTTP verbs and status codes (a style, not a protocol). The API's schema (its contract) can be produced in two orders: **code-first** writes the business code and lets the framework reflect a description at runtime (FastAPI generating `/openapi.json` from Pydantic models); **schema-first** writes the description file (YAML/JSON) by hand first, then generates server skeletons and client code from it.

**Why the distinction exists:** teams — frontend and backend, or service to service — need one contract everybody accepts. Code-first keeps the contract and the implementation in sync by construction (change a signature and the contract follows, with no chance of a typo); its downside is that the contract depends on the host language's reflection, and without an independent contract reviewed up front you can end up with endpoints that don't follow REST conventions. Schema-first is the mirror image: the contract exists before the code, can be reviewed and frozen, and several teams can build against it in parallel — but the contract and the implementation can easily say different things (unless a lint or CI check enforces it).

**Periplus example:** FastAPI is code-first — the route's `response_model` and the request body's Pydantic model are the single source of truth, and the framework reflects the OpenAPI JSON at runtime; there is no hand-written schema file.

**Possible follow-ups:**
- Where is schema-first clearly the better fit? (Polyglot microservices; an external party that needs to integrate against your API before you've finished it; gRPC/Protobuf-style systems where contract-first is mandatory.)
- What API styles exist besides REST, and what does each suit? (GraphQL solves fetching several resources in one request and avoids over/under-fetching; gRPC solves high-performance binary communication between services with a strongly typed contract.)
- What's the real difference between a genuinely RESTful API and one that merely uses HTTP verbs?

---

## 3. Why generate a typed client from OpenAPI

**What it is:** once the backend produces an OpenAPI contract, a tool (`openapi-typescript`, `openapi-generator`) translates it into type definitions in the frontend's language, so calling the API is checked at compile time instead of the response being `any`.

**Why it exists:** frontend and backend are two independently evolving codebases (especially in different languages — a Python backend and a TypeScript frontend can't share types directly), and a renamed field or changed type easily becomes a hard-to-diagnose runtime bug. A generated typed client moves those errors forward to compile time.

**Trade-offs and alternatives:**
- **Compared with tRPC** (a common follow-up): tRPC shares types at the runtime level — it requires the frontend and backend to be one TypeScript monorepo, the client imports the server's types directly, there is no generation step, and the types are always in sync; but it binds you to TS and can't work across languages. The OpenAPI route applies far more widely (any backend language, any frontend language), at the cost of **a generation step between contract and implementation**: change the schema and forget to regenerate, and the frontend types are stale without anyone knowing — so a CI step that regenerates and checks the diff is empty is needed, or the defence is decorative.
- You can also generate nothing and hand-write the frontend types, or use `any` — the easiest and most fragile option.

**Periplus example:** `npm run generate:api` runs `openapi-typescript` against `/openapi.json` from a locally running FastAPI service and commits the generated `.ts` file; today that step is manual, with no CI check for staleness.

**Possible follow-ups:**
- What happens when the generated types go stale? How do you prevent it in practice?
- Which class of bug does this really prevent, and which does it not? (It catches renamed fields and mismatched types; it can't catch a semantic change where a field's meaning changed and its type didn't.)

---

## 4. ORM vs raw SQL: why "no ORM" can be a legitimate choice

**What it is:** an ORM (SQLAlchemy, Prisma, TypeORM) maps database tables to objects and classes in the host language, so reading and writing becomes manipulating objects and the ORM translates to SQL behind the scenes. Raw SQL (using `psycopg` directly) means the application writes the SQL itself.

**Why ORMs exist:** they solve two things — describing data with the host language's object model is closer to application logic than hand-written SQL strings and cuts boilerplate, especially with many tables and complex relationships; and they usually come with a migration tool (Alembic, Prisma Migrate) that versions schema evolution, so "whose local schema disagrees with whose" becomes a solved problem for a team.

**Trade-offs:** an ORM costs you a layer of abstraction; complex queries (multi-table joins, window functions, recursive CTEs) are often more awkward expressed through an ORM than in native SQL, sometimes forcing you out into a raw query anyway; the SQL an ORM generates isn't always optimal (the N+1 query being the classic trap); and the team has one more API's semantics to learn. Raw SQL's costs are symmetrical: more boilerplate, no automatic type mapping, and schema evolution either means hand-written migration scripts or (as small projects do) idempotent `CREATE TABLE IF NOT EXISTS`, giving up versioned migrations. **Whether to use an ORM is fundamentally a question of scale**: few tables, simple query patterns and a small team can make raw SQL the lighter mental load; many tables, complex relationships and a large team make the ORM's discipline clearly worth its abstraction cost.

**Periplus example:** it writes SQL directly through `psycopg3` with no SQLAlchemy, on the grounds that the schema is simple (a few tables, mostly wide JSONB ones) so the ORM's mapping layer and migration tooling don't pay for their complexity.

**Possible follow-ups:**
- What is the N+1 query problem, and how do you find and fix it with an ORM? (Eager-loading mechanisms like `select_related`/`joinedload`.)
- At what scale or complexity would you switch to an ORM? What's the criterion?
- How does raw SQL prevent injection? (Parameterised queries / prepared statements, never string concatenation.)

---

## 5. Connection pooling

**What it is:** establishing a database connection (TCP handshake, authentication, possibly TLS) has real cost, so a pool creates a set of connections up front and lends one out per request and takes it back, instead of opening and closing one every time.

**Why it exists:** creating a connection per request becomes a visible bottleneck under concurrency, and the database itself caps how many connections can be open at once (Postgres defaults are in the low hundreds), so opening them freely can take the database down. A pool decouples the application's concurrent request count from the number of connections actually made to the database, supporting far more concurrent requests than open connections.

**The key trade-offs and traps:** pool size needs tuning — too small and requests queue for a connection, too large and the database side suffers. The subtler trap is a connection that looks alive in the pool while the server has quietly dropped it (a network interruption, or a serverless / auto-sleeping database reclaiming its compute instance after idling); if the pool hands out a dead connection, the query fails outright. Mature implementations either health-check (ping) before lending, or use a pool that reconnects automatically.

**Periplus example:** it uses `psycopg_pool`'s `AsyncConnectionPool` with an explicit health check before lending, to handle a serverless Postgres (Neon) suspending after idling and invalidating connections.

**Possible follow-ups:**
- How do you size a pool? How does it relate to the database's max connections and to the number of application instances?
- Besides health checks, what else handles "the pool lent out a connection that was already dead"? (Retries, a shorter connection lifetime.)

---

## 6. Request validation

**What it is:** checking external input (the HTTP body, query parameters) for type, format and bounds before any business logic runs, so an invalid request is rejected at the outermost layer.

**Why it exists:** it's the first wall of defensive programming — unvalidated input can crash the program (wrong type), produce logic errors (a missing required field treated as a default), or create security problems (a large share of injection attacks depend on the backend trusting input with no assumptions at all). Doing validation centrally at the framework layer is much harder to miss than scattering `if` checks through business code.

**Common implementations:** Pydantic in Python (deeply integrated with FastAPI), Zod or class-validator in TypeScript (NestJS is deeply integrated with class-validator) — all of them replacing imperative validation code with a declarative schema or type. A validation failure normally returns `400`/`422` rather than letting dirty data flow downstream.

**A detail that gets asked:** whether an undefined field is rejected outright or silently dropped is two different strengths of defence — the former (Pydantic's `extra="forbid"`) surfaces a client typo or an unexpected field immediately; the latter is more forgiving and better at hiding the caller's mistakes.

**Periplus example:** request body models use `ConfigDict(extra="forbid")`, so an extra field is a 422 rather than being silently dropped; and there are cross-field `@model_validator`s (the end date can't precede the start date).

**Possible follow-ups:**
- Which layer should validation live in? Is the outer API boundary enough, or should business logic defend itself too?
- How much detail should a validation error return to the client? (Too little is hard to debug, too much can leak internals.)

---

## 7. PostgreSQL vs MongoDB: relational vs document

**What it is:** PostgreSQL is a relational database (RDBMS) organising data into tables with a fixed schema, related by foreign keys, emphasising ACID transactions and SQL. MongoDB is a document database organising data into BSON/JSON-style documents with a flexible schema (documents in one collection needn't have identical fields), naturally close to nested object structures.

**Why both paradigms coexist:** the relational model's strengths are **consistency and complex querying** — multi-table joins, aggregation, and transactions guaranteeing several writes all succeed or all roll back, which suits data with complex relationships and high correctness requirements (orders, accounting, inventory). The document model's strengths are **schema flexibility and storing things shaped like application objects** — no need to know every field up front, no splitting a nested structure across tables and joining it back, which suits data whose structure changes often or that is naturally one blob of nested JSON.

**The key trade-offs:**
- Relational databases can now store JSON too (Postgres's `JSONB`), eating into part of the document database's territory — if most of your core data has stable fields and only a small part is flexible, a `JSONB` column in a relational table is enough and there's no need for a whole MongoDB.
- Document databases' transactions and cross-document consistency are generally weaker than a relational database's (MongoDB has added multi-document transactions in recent years, but it isn't the design's native strength).
- The choice comes down to: how complex are the relationships? How strong is the correctness requirement? How often does the schema evolve? Is the query pattern mostly by primary key / single document, or aggregation across entities?

**Periplus example:** it uses Postgres, but leans heavily on wide `JSONB` tables (serialising a whole domain object into one column) — a textbook case of borrowing document-database thinking inside a relational one. The upside is that adding a field needs no migration; the cost is that the inner fields can't be indexed or queried in SQL without a redundant column.

**Possible follow-ups:**
- When would you choose MongoDB over Postgres's JSONB? (When you genuinely need document-level schema flexibility, large-scale horizontal sharding, and a query pattern dominated by single-document access rather than cross-entity joins.)
- Can a Postgres `JSONB` column be indexed, and how? (Yes — a GIN index accelerates queries into the JSONB's inner fields.)

---

## 8. pgvector: adding vectors to Postgres, and when you still need a dedicated vector database

**What it is:** `pgvector` is a PostgreSQL extension adding a `vector` data type plus distance/similarity queries (cosine similarity, approximate nearest neighbour indexes), so embeddings can be stored in relational tables and searched by similarity.

**Why it exists:** semantic search and RAG need to embed text, store the vector, and later retrieve by vector similarity. Before `pgvector`, that usually meant introducing a dedicated vector database (Pinecone, Weaviate, Milvus, Qdrant). `pgvector`'s value: if your data already lives in Postgres, you don't have to operate an entire new database system just because you also need a bit of vector search — the vector column sits in the same table and the same transaction as the rest of the data, and a query can mix vector similarity with ordinary SQL filters.

**When you still want a dedicated vector database:** when vector search is the system's **core, large-scale, high-QPS** workload — tens of millions of vectors and up, very high throughput and low latency, or the finer index algorithms and distributed scaling only a dedicated system offers. In short: `pgvector` suits "vector search is one capability among many, the scale is moderate, and we'd like one fewer system to run"; a dedicated vector database suits "vector search is the main event, at enormous scale".

**Periplus example:** it uses `pgvector` for a semantic cache (an embedding cache) that reuses similar page content already fetched and processed in earlier runs — a side component for performance. Its position differs from core data that must be strongly consistent: on failure it should degrade gracefully (treat it as a cache miss) and never let a failed vector lookup break the main flow.

**Possible follow-ups:**
- What does `pgvector`'s approximate nearest neighbour index (IVFFlat/HNSW) sacrifice for speed compared with a brute-force scan? (Absolute retrieval accuracy — it's an approximate rather than exact answer.)
- What should the system do when vector search fails? Where do retrieval-augmentation components belong in a reliability classification?

---

## 9. Idempotency, crash recovery for long tasks, and checkpointing

**What it is:** idempotency means performing the same operation once or many times produces the same result — a repeated call causes no repeated side effect. Checkpointing means a long task persists its progress in stages, so after a failure or restart it resumes from the last known-good checkpoint instead of starting over.

**Why it exists:** long-running backend tasks (calling an external LLM, running a multi-step pipeline, batch processing) face a practical reality — the process can be interrupted at any moment by a deployment, a crash or a resource limit, and such tasks often involve **real, non-repeatable costs** (paid API calls, fetching external resources), so re-running from scratch wastes real money and time. At the same time, careless recovery logic easily applies the same side effect twice on replay (processing one record twice), which is why checkpointing and idempotency have to be discussed together — checkpoints answer "where to continue", idempotency guarantees that even an accidental repeat of a step causes no wrong duplicate effect.

**The common patterns:**
- **A state machine plus persisted transitions**: split the task into explicit phases (pending → running → succeeded/failed) and persist before each transition, so after a restart, "stuck in an intermediate state with no matching terminal record" identifies the tasks that died half way through last time.
- **Checkpoint at stage boundaries**, not at arbitrary granularity: too fine and persistence overhead dominates; too coarse and one failure re-runs a lot of work. Choosing where to checkpoint is a trade-off between recovery precision and persistence cost.
- **The write semantics trade-off**: writing checkpoints synchronously and strongly consistently (waiting for each one to land before continuing) is safer and slower; an asynchronous "echo" write (update memory, persist in the background) is faster but accepts a narrow window where the process dies with memory updated and persistence incomplete — and the design must state that the worst case in that window is "re-run one step", never "corrupt history that was already confirmed".

**These mechanisms generally guarantee at-least-once, not exactly-once** — engineering rarely chases true exactly-once (extremely expensive) and retreats to at-least-once plus idempotency: a step may be replayed in extreme cases, but the cost is bounded and confirmed results aren't damaged.

**Periplus example:** a checkpoint scheme built on stages and gates — one table records whether a run finished, another records each stage's output and gate result keyed on `(run_id, stage, attempt)`; on restart it finds the furthest stage that passed its gate and continues from the next incomplete one rather than re-running the whole pipeline. It's an application-level checkpoint mechanism, not the database's own crash recovery.

**Possible follow-ups:**
- Why is exactly-once semantics near-impossible in distributed or multi-process settings, and what do people settle for instead?
- What goes wrong if checkpoints are too coarse (one checkpoint for the entire task)? How do you weigh granularity?
- How does idempotency land at the API design level? (The client sends an idempotency key, the server records the keys it has handled, and a repeat returns the previous result instead of executing again.)

---

## 10. CI/CD and containerisation: what a mature setup looks like (even if this project doesn't have one yet)

**What it is:** containerisation (Docker) packages an application together with its runtime dependencies into a portable, environment-consistent image, largely closing the gap between "it runs on my machine" and "it runs on the server". CI/CD is an automated pipeline: on commit, run tests, lint and an image build, and on success deploy automatically (or after a human confirmation).

**Why it exists:** manual deployment produces two classes of problem — "fine locally, broken in production" from environment differences, and human error (forgetting to run the tests, skipping a step). CI/CD freezes those steps into automation so every change goes through the same checks, removing the "did I forget something again" uncertainty. Containerisation goes further, turning "what system dependencies and versions this application needs" from something written in a README and remembered by people into something written in a Dockerfile and enforced by tooling.

**A mature setup roughly contains:**
- **A Dockerfile**: how the image is built, usually a multi-stage build (a build stage installing dependencies and compiling, a final stage copying only the artefacts, for a smaller and safer image).
- **A CI pipeline** (GitHub Actions and the like): triggered on PR/push, running tests and lint (`pytest`/`ruff`), blocking a merge on failure; some teams also run bespoke checks here, like "has the OpenAPI contract drifted".
- **A CD pipeline**: on green, build the image, push it to a registry, then trigger deployment (blue-green or rolling, aiming at zero downtime). Database migrations are normally a separate step in the deployment flow rather than run at application startup (so multiple instances don't race to run them).
- **Environment tiers**: at minimum dev/staging/prod separated, with production deployment usually requiring an extra human confirmation or stricter gates.

**Where Periplus stands (stated honestly, not dodged):** there is no Dockerfile today; running locally means a virtual environment and `uvicorn` directly. The only CI workflow in the repository builds the frontend into a static demo page and publishes it to GitHub Pages; there is no CI running backend tests or lint, and no automated deployment. That's acceptable for a small, single-developer project, but if it moves toward team collaboration or a real launch, this is clearly the gap to fill.

**Possible follow-ups:**
- Why is running database migrations automatically at application startup generally discouraged? (Several instances starting concurrently run the same migration at once, with races and locking complexity.)
- What does a multi-stage Docker build solve?
- What are blue-green deployment and rolling updates, and what does each trade off?

---

## How this note divides labour with the project note

`LEARNING_NOTES_PERIPLUS_BACKEND.md` answers "how this backend is actually implemented" — how the routes are organised, the `runs`/`artifacts` schema, the exact OpenAPI generation command, the six steps of crash recovery — the project details to quote when asked "what did you actually do in your project". This document answers "what the general backend concepts behind that resume line are, why they exist and what they trade off" — for the "what is X" and "why A rather than B" questions that test understanding independently of any project. When preparing, read this one first to build the framework, then read the project note to see each concept landed in real code.
