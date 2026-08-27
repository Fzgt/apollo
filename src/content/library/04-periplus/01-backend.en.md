---
title: Backend walkthrough
section: Periplus
---

# Periplus backend notes (aligned to the resume bullets)

> **Resume version: v28 (revised 2026-08-17).** The old summary line, *"Delivered a FastAPI/React app with generated OpenAPI types, PostgreSQL persistence and crash recovery"*, is no longer on the resume; v27 split it into two more specific bullets:
>
> - **v27 bullet 1:** a six-stage pipeline — research, verification, planning, writing, editing, illustration — where **the orchestrator only knows a typed stage contract**, and that contract carries all the way to the React client, whose types are **generated from the OpenAPI schema**. → section 3 here.
> - **v27 bullet 3:** run state, stage artifacts and the pgvector evidence cache persisted to PostgreSQL under a **per-run token and time budget**, with **a run that dies mid-way resuming from the last completed stage**. → sections 4 and 5 here (the budget part is in section 4.3 of the AI note).
>
> Two things actually changed with the wording, worth noting while revising: first, v27 emphasises **the architectural property that "the orchestrator only knows a typed contract"**, not merely "we used generated types"; second, crash recovery is now tied to the stronger, concrete promise of "resuming from the last completed stage", so section 5 has to cover "resume from where, and how do we know where" rather than stopping at "it can recover".
>
>
> This document only covers the backend engineering side (the API layer, storage, type generation, deployment) and doesn't go into the AI pipeline itself — the Periplus backend drives an **agentic workflow** shaped AI pipeline (Explorer→Auditor→Navigator→Chronicler→Editor→Illustrator, driven by the `Hermes` orchestrator; those six are internal codenames, and the real class names are `ResearchAgent` / `VerificationAgent` / `NavigationAgent` / `ContentAgent` / `EditorAgent` / `IllustrationAgent`, with the codenames appearing only in docstrings and comments). That part has its own document; here it's treated as a black-box dependency: the API layer submits a `TripBrief`, gets back a `Run` executing in a background task, and polls for status.

---

## 1. Project layout at a glance

```
server/periplus/
├── api/          FastAPI routes, request/response models (the focus of this document)
├── storage/      Postgres persistence + crash recovery (the focus of this document)
├── orchestrator/ the Hermes orchestrator (skipped; the AI document covers it)
├── agents/       the six agents (skipped)
├── llm/          the model call wrapper (skipped)
├── retrieval/    search and fetching (skipped)
web/src/
├── api/          consumes the generated OpenAPI types
├── routes/ components/  UI
```

Stack: Python 3.11 + FastAPI + Pydantic v2 + **psycopg3 (not SQLAlchemy)** + pgvector + React 19 + TanStack Query + openapi-typescript.

---

## 2. The FastAPI layer: how the routes are organised

The API surface here is small — four endpoints, all defined inside the `create_app()` factory in one file, `server/periplus/api/app.py` (no split into router files, because there simply aren't many endpoints):

- `POST /trips` — submit a trip brief, returns 202 plus a `RunSummary` (the async task has started but hasn't finished)
- `GET /runs` — list all runs (those running in memory merged with the history in Postgres)
- `GET /runs/{run_id}` — the status/progress of one run (what the frontend polls)
- `GET /runs/{run_id}/result` — the final result; while the run is `pending`/`running`, it returns 409

**A few things worth talking about:**

- **A factory function plus "manual" dependency injection**: instead of FastAPI's `Depends()`, there's a `create_app(*, run_store=None)` factory, where `run_store` is the seam for tests — a test passes a fake `RunStore` (with a fake Hermes factory) and skips real Postgres and real model calls; production passes nothing and the app assembles a real `PostgresRunPersistence` + `PostgresArtifactStore` itself. It's a plainer form of dependency injection than `Depends()` and just as effective — both are "swap the implementation at runtime without touching the caller".
- **`lifespan` (rather than the deprecated `@app.on_event("startup")`)**: an `asynccontextmanager` wraps `lifespan`, opening the connection pool, creating tables and loading the optional embedding cache before `yield`, and closing them in `finally`. This is FastAPI's current recommended startup/shutdown hook.
- **Asynchronous throughout**: every route function is `async def`, and Postgres goes through psycopg's async pool (`AsyncConnectionPool`), so nothing blocks the event loop. The expensive AI pipeline runs inside `asyncio.create_task` (specifically `asyncio.ensure_future`) and `POST /trips` returns immediately without waiting — the standard "long task plus polling" shape, rather than a blocking synchronous request or a WebSocket push.
- **What Pydantic does here**: every endpoint's input and output is a Pydantic `BaseModel` (`TripBriefCreate`, `RunSummary`, `RunResultView`…, defined in `api/schemas.py`). FastAPI uses them to ① validate the request body (types, required fields, custom validators) ② generate the OpenAPI schema automatically (the basis of the type generation in section 3) ③ serialise responses.

**Two concrete details of the validation (visible in the tests):**
- `model_config = ConfigDict(extra="forbid")`: a field the schema doesn't define produces a 422 rather than being silently dropped — defensive by design.
- Server-owned fields like `id` and `created_at` don't appear in `TripBriefCreate` at all, so a client sending them gets a 422 through `extra="forbid"` — not the weaker "we'll ignore it" semantics.
- Custom validators: `@field_validator("destination", mode="before")` trims, and `@model_validator(mode="after")` does the cross-field check (`end_date` can't be before `start_date`).

---

## 3. OpenAPI type generation: how full-stack type safety actually lands (a core resume selling point)

This is the mechanism behind "generated OpenAPI types" on the resume, and it's worth explaining properly:

**What FastAPI gives you for free:** as long as the routes annotate the request body and `response_model` with Pydantic models, FastAPI reflects a complete **OpenAPI 3 JSON schema** at runtime and serves it at `/openapi.json` — without a line of schema definition code. It's one of FastAPI's biggest advantages over Flask/Express.

**The concrete flow in Periplus (the script in `web/package.json`):**

```json
"generate:api": "openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.generated.ts"
```

1. Run the FastAPI service locally (`uvicorn periplus.api.app:app`)
2. Run `npm run generate:api`; the `openapi-typescript` CLI requests `/openapi.json` and **translates the JSON Schema inside into TypeScript `interface`/`type` declarations** (types only, no runtime code), writing to `web/src/api/schema.generated.ts` (972 lines, committed to the repository rather than generated at build time)
3. `web/src/api/contracts.ts` re-exports the types the app actually uses from the generated file (`TripBriefCreate`, `RunSummary`, `Run`, `Stage`…), giving the component layer a cleaner import surface and hiding the generated file's deep paths (`components['schemas']['xxx']`)
4. `web/src/api/client.ts` annotates the `fetch` calls with those types, and `web/src/api/queries.ts` wraps them in TanStack Query's `useQuery`/`useMutation`

**The difference from tRPC is worth being clear about** (interviewers often ask "why not tRPC"):
- tRPC shares types **at runtime** — the frontend and backend must be one TS monorepo, and the client imports the server's type definitions directly, which is inherently tight coupling.
- OpenAPI type generation is **contract-driven** — the backend is Python and the frontend is TS, so there's no way to share types directly; a language-neutral contract in the middle (the OpenAPI JSON) is the single source of truth, translated one way into the target language's types. This is the standard answer for type safety across a **mixed-language stack** (a Python backend with a TS frontend).
- The cost: the generated file isn't live. Change the backend schema and forget to re-run `generate:api`, and the frontend types are stale (unlike tRPC, which errors at compile time). In practice you'd add a CI step that regenerates and checks the diff is empty — Periplus doesn't have that step (there's no such CI job in the repo), which is an honest improvement to mention in an interview.

**The Vite dev proxy:** `vite.config.ts` proxies `/api` → `http://127.0.0.1:8000` (with a `rewrite` stripping the `/api` prefix), so in local development the frontend hits relative paths like `/api/trips` and never deals with CORS.

---

## 4. PostgreSQL persistence: schema design and consistency

**There is no ORM.** The dependency file (`server/requirements.txt`) has `psycopg[binary]` + `psycopg_pool`, not SQLAlchemy/asyncpg + alembic. There's no separate migration tool either — each table's DDL sits in a `_SCHEMA` constant at the top of its module and runs idempotently through `CREATE TABLE IF NOT EXISTS` in `open()` (that is, in the FastAPI lifespan at startup). That's a reasonable trade for a project whose schema is small and evolves slowly, and you can say so directly in an interview without dressing it up.

**Three tables, one Postgres wrapper class each (all under `periplus/storage/`):**

| Class | Table | Purpose |
|---|---|---|
| `PostgresRunPersistence` (`storage/postgres.py`) | `runs` | The brief, status and final result (JSONB) of each run — the source of the "did this run finish" signal for crash recovery |
| `PostgresArtifactStore` (`storage/postgres_artifacts.py`) | `artifacts` | The artifact (JSONB) produced by every attempt of every stage of every run, plus whether it passed its gate (the `passed` column) — the source of the "how far did it get" signal for crash recovery |
| `PostgresEvidenceCache` (`storage/postgres_evidence.py`) | `evidence_cache` | The pgvector semantic cache, reusing already-fetched pages across runs (nothing to do with crash recovery; a retrieval-layer optimisation, optional, and silently degrading on failure) |

**The `runs` table** (simplified):
```sql
CREATE TABLE runs (
    run_id TEXT PRIMARY KEY,
    destination TEXT NOT NULL,
    status TEXT NOT NULL,          -- pending/running/succeeded/failed/cancelled
    brief JSONB NOT NULL,          -- the whole TripBrief, serialised
    result JSONB,                  -- the whole Run result, serialised (only once finished)
    error TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
```

**A wide table with JSONB rather than several normalised tables** is a deliberate choice here: the whole `TripBrief`/`Run` (nested Pydantic models) goes through `model_dump(mode="json")` and into one column as `psycopg.types.json.Jsonb`. The upside is that adding a field to a model needs no migration; the cost is that you can't query or index the inner fields in SQL (filtering historical runs by destination would mean scanning the JSONB, or adding a redundant column — which is exactly what the redundant `destination TEXT` column is for, a detail worth noticing).

**How consistency is maintained:**
- Writes use **`INSERT ... ON CONFLICT (run_id) DO UPDATE`** (an upsert) rather than SELECT-then-decide, which avoids the race.
- `save_started` uses `ON CONFLICT DO NOTHING`: a run should only "start" once, and if a concurrent `save_finished` already wrote the terminal state, a late `save_started` must not overwrite it.
- Each database operation is a single SQL statement inside `async with self._pool.connection() as conn: await conn.execute(...)` — for a single statement psycopg3 runs it in an implicit transaction with commit/rollback managed by the context manager, and there are no hand-written multi-statement transactions (because nothing here needs several statements to succeed together).
- **Connection pool robustness** (a trap the tests cover deliberately, and worth telling): `AsyncConnectionPool` doesn't by default detect a connection the server has closed while the pool still thinks it's alive (serverless Postgres like Neon suspends the compute instance after some idle time and the underlying socket goes away quietly). The code passes `check=AsyncConnectionPool.check_connection` explicitly, so the pool pings a connection before handing it out and swaps in a fresh one when the ping fails, rather than handing over a dead connection and failing a query. `server/tests/test_postgres_reconnect.py` reproduces this by hand with `socket.shutdown(SHUT_RDWR)` on the underlying fd, proving the reconnect works once `check=` is set.

---

## 5. Crash recovery: the actual mechanism (the core of this resume promise — get it right)

**Start with the problem it solves:** inside the FastAPI process, each run is driven by an `asyncio.Task`. Restart or crash the process and that task is simply gone — **in-memory state is never recoverable**. Crash recovery has to answer: after a restart, which runs were stranded mid-way, and **where to continue from rather than starting over** (starting over means calling the LLM again and fetching pages again, which is real money and real time — which is why this earns its own resume bullet).

**What it really is: a checkpoint scheme built on stages and gates**, not some advanced Postgres feature — two levels of application-level record:

**Level one — the `runs` table only answers "did this run finish":**
- On submission a row is written immediately with `status='running'` (`save_started`, fire-and-forget alongside actually starting the pipeline)
- When the run ends (success or failure) the same row is upserted with the terminal state (`save_finished`)
- If the process crashes, `save_finished` is never called and the row stays at `status='running'` — **that's the crash signal**: after a restart, a new process seeing a "running" row it never submitted itself can only be looking at the previous process dying mid-way.

**Level two — the `artifacts` table answers "how far did it get":**
- The pipeline is staged (Stage: research → verify → plan → write → edit → illustrate), each stage produces an artifact, and it has to pass a gate (a check) before that stage counts as done
- The `artifacts` table records each attempt's artifact (JSONB) keyed on `(run_id, stage, attempt)`, plus a `passed BOOLEAN` marking whether that attempt passed its gate
- Writes go through `PostgresArtifactStore` wrapping an in-memory `InMemoryArtifactStore`: the synchronous methods (`put`/`mark_passed`) write memory first (Hermes's call path is synchronous and must not stall on network IO), then `asyncio.ensure_future` echoes the write to Postgres without waiting. That's an explicitly accepted trade-off: if the process dies in the window between "memory written" and "the echo has landed", the restart treats that attempt as never having happened and at worst re-runs one stage — **it never silently corrupts history that already passed a gate**.

**The recovery flow at startup** (`RunStore._resume_crashed_runs` / `_resume_one`, in `server/periplus/api/runs.py`):

1. FastAPI's `lifespan` calls `store.open()`
2. Iterate every row in `runs` with `status == RUNNING` — those are the runs stranded by the last crash
3. For each, call `PostgresArtifactStore.preload(run_id)` to read that run's history out of `artifacts` back into the in-memory `InMemoryArtifactStore` (rebuilding the runtime state the orchestrator needs)
4. Walk the fixed stage order (`STAGE_ORDER`) from the start and find **the last stage whose `latest_passed()` is non-empty** — the furthest stage that passed its gate
5. Three cases:
   - No gate passed at all → mark it `FAILED` with the reason `"crashed before any stage passed its gate"`, rather than guessing at a re-run (if even the first output can't be trusted, there's nothing to build on)
   - Every stage passed → the process died in the window between finishing the last stage and writing the terminal state, so mark it `SUCCEEDED` without re-running anything
   - Stranded in the middle → continue from **the next** incomplete stage, calling the orchestrator's `hermes.replay(run, from_stage=resume_from)`, reusing the already-persisted, already-gated artifact as that stage's input instead of re-running the pipeline from research
6. Start a fresh `asyncio.Task` for that replay, sharing the same `RunEntry`/polling logic as a normally submitted run, so it's completely transparent to the frontend API

**One sentence on what this mechanism is:** it isn't the database's own crash recovery (Postgres's WAL/redo durability), it's **an application-level, stage-boundary checkpoint and replay mechanism** — using Postgres's durability (JSONB plus transactional upserts) as the record of "was this step completed", and having the orchestrator replay from the right point based on that record. That's what "crash recovery" actually means in this project, and the tests (`TestRunStoreResume` in `server/tests/test_api.py`) cover both "resume from the gated stage without re-running it" and "mark it failed when no stage passed".

---

## 6. Docker / CI as it stands (the basics)

- **No Dockerfile and no docker-compose.** There's no container configuration anywhere in the repository; running locally means `.venv` + `pip install -r requirements.txt` + `uvicorn periplus.api.app:app`, with the database being a bare Postgres URL, local or remote (`PERIPLUS_DATABASE_URL` in `.env`).
- **`.github/workflows/pages.yml`** is the only CI/CD workflow in the repository, and it does one thing: build the frontend `web/` into a static demo (`npm run build:demo`, a demo mode on mock data — `vite.config.ts` switches to fake data instead of the real API when `mode === 'demo'`) and publish it to GitHub Pages.
- **There is no CI for the backend** (no workflow running `pytest`/`ruff`); tests and lint are run by hand locally (the README documents the commands). This is an honest "not done yet" to mention in an interview rather than dodge.

---

## 7. Backend tests at a glance

- `server/tests/test_api.py`: covers `RunStore` (submission, querying, and the three crash-recovery paths) and the FastAPI routes themselves (using `fastapi.testclient.TestClient` + `create_app(run_store=...)` to inject a fake Hermes factory and fake persistence, touching no real Postgres, network or LLM). All three branches of the recovery logic (resume from the furthest gated stage / everything passed so mark it succeeded / nothing passed so mark it failed) have their own tests in `TestRunStoreResume`.
- `server/tests/test_postgres_reconnect.py`: the only "online" test file, running only when a reachable `PERIPLUS_DATABASE_URL`/`DATABASE_URL` is configured (`pytest.mark.skipif`) and skipping automatically otherwise, so CI passes without a database. It reproduces the "pool hands out a connection the server already closed" trap and verifies that `check=AsyncConnectionPool.check_connection` fixes it.

---

## Follow-ups to expect

1. **Why raw SQL through psycopg3 rather than SQLAlchemy/asyncpg?** — The schema is simple (3 tables, all wide JSONB tables), so an ORM's mapping layer and migration tooling don't pay for their complexity; raw SQL plus a hand-written `_SCHEMA` constant is more direct and controllable at this size. Whether that reads as "a considered trade" or "laziness" depends entirely on how you tell it.
2. **What level of consistency does crash recovery actually guarantee? Can it be exactly-once?** — No. The `artifacts` write is a fire-and-forget async echo, so the process can die between "memory updated" and "Postgres written", which at worst re-runs one stage and never corrupts gated data (at-least-once, with an idempotent replay of one stage in the worst case).
3. **If two FastAPI processes start at once (horizontal scaling), do both try to recover the same stranded run?** — There's no distributed lock or leader election today; `_resume_crashed_runs` runs unconditionally in `lifespan`, so multiple instances really do race. It's a good thread to pull on (adding `SELECT ... FOR UPDATE SKIP LOCKED`, or an optimistic "whoever flips the status from RUNNING to RESUMING owns it").
4. **What if the generated OpenAPI types drift from the backend schema? Is there anything preventing that?** — Today `npm run generate:api` is run by hand, with no CI check that regenerating produces an empty diff. Good ground for discussing how you'd close that gap.
5. **Why 202 rather than 200/201 for `POST /trips`? Why polling rather than a WebSocket/SSE push?** — 202 Accepted says precisely "accepted but not finished", which matches the polling model; polling is simpler to build and takes a few lines with TanStack Query's `refetchInterval`, at the cost of a second of latency and some redundant requests — a trade between complexity and immediacy.
6. **What do you gain and lose by storing `brief`/`result` as whole JSONB rather than normalised tables?** — You gain: adding a field to a model needs no migration, and it lines up naturally with Pydantic serialisation. You lose: no SQL querying or indexing of the inner fields (here, a redundant `destination` column covers the most common query, which is a patch rather than a general answer).
7. **How does `RunStore.list()` merge the in-memory and persisted state, and which wins?** — Records read from Postgres go into a dict first, then the process's in-memory `_entries` overwrite the same keys (`merged.update(self._entries)`), because a run just submitted in this process — whose async write may not have landed — is necessarily fresher and more accurate than what's on disk.
8. **How is `PostgresEvidenceCache` (pgvector) fundamentally different from the other two Postgres components?** — The first two (`runs`/`artifacts`) are persistence that must be reliable, and a failure should fail startup; the evidence cache is a pure performance cache, and any failure (an embedding error, an unreachable database) degrades silently into "treat it as a cache miss" — one failed fetch must never become one failed run. It's a textbook contrast between core data and a side cache, and it's a good way to show you know what must be strongly consistent and what may degrade gracefully.
