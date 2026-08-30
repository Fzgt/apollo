---
title: Interview concept checklist
section: General interview
---

# Interview concept checklist

> Checked against the resume. **Entries that are not on the resume stay** — a line not being on paper does not stop anyone asking about the topic next to it. `Go` and `Evals` are not in the Skills row.

Concept names only, no explanations. Go through it once yourself: cross off what you know, leave what you don't — what's left is what to focus on.

**Marks**

- ★ appears in the resume text; a follow-up is close to guaranteed
- ○ not on the resume, but one step away from a bullet, so it will come up
- ⚠ only appears in the Skills row, with no code on this machine to back it — if asked, all you have is the concept; if you can't hold that, it should come out of Skills

**Source tags**: `[Beyz]` `[BioMap]` `[Baidu]` `[Periplus]` `[WinterFell]` `[Skills]`

---

## 1. Frontend

### 1.1 Language and types

- ★ TypeScript: generics, conditional types, mapped types, `infer`, `Pick`/`Omit`/`Exclude`, literal types
- ★ discriminated unions, narrowing, exhaustiveness checking
- ○ structural typing (duck typing), covariance/contravariance, `unknown` vs `any` vs `never`
- ○ `satisfies`, `as const`, declaration merging, module augmentation, `.d.ts`
- ○ the strict family in `tsconfig`, `noUncheckedIndexedAccess`, where type gymnastics stops paying off
- ★ end-to-end type safety (types shared between frontend and backend) [Beyz][Periplus]
- ○ the JS event loop, macrotasks/microtasks, closures, the prototype chain, `this` binding
- ○ ESM vs CommonJS, what tree shaking actually requires
- ○ `Proxy`/`Reflect`, `WeakMap`, generators, async iterators
- ○ `AbortController`, `structuredClone`, optional chaining / nullish coalescing

### 1.2 React

- ★ function components, the rules of hooks, dependency arrays
- ★ `useState` `useEffect` `useMemo` `useCallback` `useRef` `useReducer` `useContext`
- ○ `useLayoutEffect`, `useTransition`, `useDeferredValue`, `useSyncExternalStore`, `useId`
- ★ React 18 [BioMap]: concurrent rendering, automatic batching, the StrictMode double invoke
- ○ Fiber, reconciliation, the diff algorithm, what `key` does and how it gets misused
- ★ designing custom hooks (`useVirtualList` is one you wrote yourself) [Baidu]
- ○ stale closures, missing dependencies
- ○ `React.memo`, tracing re-renders, the React Profiler
- ○ controlled vs uncontrolled components, lifting state, composition over inheritance, render props, HOCs
- ○ Error Boundary, Suspense, lazy
- ★ Server Components / Server Actions / `'use client'` `'use server'` [Beyz]
- ○ hydration, hydration mismatch, streaming SSR

### 1.3 Next.js [Beyz]

- ★ App Router vs Pages Router, route segments, layout/template, dynamic routes
- ★ typed server actions, server-side validation and the authorisation boundary (this is where the plan gate lands)
- ★ Route Handlers, webhook endpoints, edge runtime vs node runtime
- ○ choosing between SSR / SSG / ISR / CSR, the RSC payload
- ○ the four Next caches: Request Memoization, Data Cache, Full Route Cache, Router Cache
- ○ `revalidate`, `dynamic`, `generateStaticParams`
- ○ the Metadata API, `next/image`, font optimisation
- ○ middleware and putting auth in front

### 1.4 Data layer and state management

- ★ the three TanStack Query layers: API functions → a queryOptions factory → typed hooks [BioMap]
- ★ queryKey design and a single source of truth, invalidation driven by mutations
- ★ route-level preload, hover prefetch
- ○ `staleTime` vs `gcTime`, `invalidateQueries` vs `refetch` vs `setQueryData`
- ○ optimistic updates and rollback, structural sharing, `select`, request deduplication
- ○ infinite query, suspense mode, offline and retry strategy
- ★ where the line sits between server state and client state
- ★ Zustand [Skills]: store slices, selectors, `shallow`, middleware (persist/immer)
- ★ tRPC [Beyz]: procedures/routers, input validation, context, middleware
- ○ Redux/RTK, SWR, Jotai (for comparison — to explain why you didn't pick them)
- ○ how Drizzle's inferred types travel all the way to the frontend [Beyz]

### 1.5 Rendering performance

- ○ LCP (an old BioMap line claimed `< 500ms`; it was removed from the resume because it had no measurement evidence)
- ○ the whole Core Web Vitals family: LCP / CLS / INP (formerly FID) / TTFB, field data vs lab data
- ★ virtualized lists: computing the visible window, fixed vs variable height, overscan, keeping the DOM node count down [Baidu]
- ★ `IntersectionObserver` vs scroll events, scroll anchoring
- ★ 60 FPS, the 16.6ms frame budget, how to locate a dropped frame
- ○ reflow / repaint / composite, layers, why `transform`/`opacity` go through the compositor
- ○ long tasks, blocking the main thread, `requestIdleCallback`, Web Workers
- ○ the critical rendering path, `preload`/`prefetch`/`preconnect`, code splitting
- ○ image formats and lazy loading, font FOIT/FOUT, CDNs, HTTP cache headers

### 1.6 Build and dependency engineering

- ★ the breaking changes in the Webpack 3 → 5 migration [Baidu]
- ★ `SplitChunksPlugin`, extracting the runtime chunk, reusing shared dependencies
- ★ persistent (filesystem) caching, how to measure build time
- ○ loader vs plugin, Tapable hooks, the build lifecycle
- ○ tree shaking and `sideEffects`, the source map levels, module federation
- ★ Vite [Skills]: esbuild prebundling, the native ESM dev server, Rollup output, how HMR works
- ★ how `package-lock.json` gets regenerated, lockfileVersion, npm shipping with the Node version [Baidu]
- ★ semantic versioning, what the caret risks, `npm ci` vs `npm install`, version pinning strategy
- ○ peerDependencies, phantom dependencies, pnpm's hard links and isolation
- ○ bundle analysis, size budgets, monorepos (Turborepo/workspaces)

### 1.7 Testing and code quality

- ★ Playwright [Skills][WinterFell]: locators, auto-waiting, traces, driving headless Chromium
- ★ Jest / Vitest [Skills]: mocks, spies, jsdom, how snapshot tests get abused
- ★ the MSW mock layer: how interception works, organising handlers, the risk of contract drift [BioMap]
- ★ custom ESLint rules, enforcing module boundaries, the AST and writing a rule [BioMap]
- ○ the Testing Library philosophy, the testing pyramid / trophy
- ○ flaky tests in CI, parallelism and workers, retry strategy
- ★ Storybook, CVA (the variant API) [BioMap]
- ○ visual regression testing, what coverage numbers mean and where they stop meaning anything

### 1.8 Browser and Web APIs

- ★ `getDisplayMedia`: capturing tab/system audio, permissions, how it differs from `getUserMedia` [Beyz]
- ★ MediaStream, tracks, pausing the microphone and keeping things alive
- ○ AudioContext, AudioWorklet vs ScriptProcessor, sample rates and resampling, PCM/Opus
- ★ WebSocket [Beyz][Skills]: the handshake, heartbeats, reconnect with backoff, binary frames, backpressure
- ○ choosing between WebSocket, SSE and long polling
- ★ `IntersectionObserver` [Baidu]; ○ `ResizeObserver`, `MutationObserver`
- ★ jsBridge / WebView-to-native communication, iOS vs Android differences, URL schemes [Baidu]
- ○ same-origin policy, CORS and preflight, cookie SameSite/HttpOnly/Secure
- ○ XSS, CSRF, CSP, clickjacking
- ○ localStorage/sessionStorage/IndexedDB, Service Workers, PWAs
- ○ analytics and reporting: `sendBeacon`, sampling, when the page unloads [Baidu]

### 1.9 Styling and design systems

- ★ Tailwind [Skills]: utility classes, JIT, design tokens, when `@apply` is worth it
- ★ Radix UI [BioMap]: headless components, accessibility primitives, Portal, focus management
- ★ design systems: component API design, variants, theming, token layers
- ○ the cascade and specificity, BFC, Flexbox, Grid, container queries, CSS variables
- ○ accessibility: semantic elements, ARIA, keyboard navigation, focus traps, contrast

### 1.10 Vue / Angular

- ★ Vue 3 + TS [BioMap]: the Composition API, `ref` vs `reactive`, `watch` vs `watchEffect`
- ★ Vue 2 [Baidu]: the Options API, `Object.defineProperty` reactivity, the array-change detection traps
- ★ the core differences between Vue 2 and Vue 3 (Proxy reactivity, multiple root nodes, renamed lifecycle hooks)
- ○ Pinia / Vuex, Vue Router, the virtual DOM and diffing, `key`
- ○ integrating an SDK (Luckysheet), wrapping and tearing down a large third-party component [BioMap]
- ○ CLI scaffolding: templates, code generation, convention-based directories [BioMap]
- ⚠ Angular [Skills]: modules, dependency injection, RxJS, change detection, Zone.js, signals — **code exists**: `~/Desktop/projects/Golang/Code/concept-tracker`, `~/Desktop/projects/Python/job-tracker` (Angular 22 is zoneless by default — don't explain it in terms of Zone.js)

---

## 2. Backend

### 2.1 The Node ecosystem

- ★ NestJS [Beyz]: modules, dependency injection, providers, guards/interceptors/pipes/exception filters
- ★ the Fastify adapter vs Express, and why Fastify
- ○ DTOs, `class-validator`, lifecycle hooks, Nest microservices and queues
- ○ the phases of the Node event loop, libuv, streams and backpressure, `cluster`/`worker_threads`
- ★ PM2: daemonising, restart policy, logs, multiple instances [Beyz]
- ○ tracking down memory leaks, heap snapshots, the basic GC model

### 2.2 The Python ecosystem

- ★ FastAPI [Periplus]: Pydantic v2, dependency injection, `async def` vs `def`, background tasks
- ★ the chain from an auto-generated OpenAPI schema to generated frontend types [Periplus]
- ○ ASGI vs WSGI, uvicorn, the concurrency model, the GIL, asyncio (tasks/gather/timeouts/cancellation)
- ★ pytest [Periplus]: fixtures, parametrisation, monkeypatch, collection, how 461 tests are organised
- ○ SQLAlchemy, Alembic migrations, connection pooling
- ⚠ Django [Skills]: the ORM, middleware, DRF, admin — **code exists**: `~/Desktop/projects/Python/job-tracker/server`

### 2.3 APIs and protocols

- ★ typed stage contracts and decoupling them from the orchestrator [Periplus]
- ★ OpenAPI → generated client types, guarding against contract drift [Periplus]
- ★ choosing between tRPC, REST and GraphQL [Beyz]
- ○ REST design: modelling resources, idempotency, status codes, pagination, versioning
- ⚠ GraphQL [Skills]: schema/resolvers, N+1 and DataLoader, over/under-fetching, subscriptions
- ○ HTTP/1.1 vs 2 vs 3, keep-alive, the TLS handshake
- ○ WebSocket servers: connection management, rooms, scaling out and sticky sessions

### 2.4 Databases and retrieval

- ★ PostgreSQL [Beyz][Periplus]: index types, `EXPLAIN`, transactions and isolation levels, MVCC, locks
- ★ pgvector [Periplus]: vector columns, distance metrics (cosine/L2/inner product), IVFFlat vs HNSW, recall vs parameters, dimensions
- ★ the design that persists run state, stage artefacts and cached evidence (the precondition for resuming a run) [Periplus]
- ★ Drizzle ORM [Beyz]: defining a schema, type inference, migrations, how it differs from Prisma
- ○ connection pooling, finding slow queries, JSONB, partial indexes, forward-compatible migrations
- ○ SQL: joins, aggregation, window functions, transactions, deadlocks
- ⚠ MongoDB [Skills]: the document model, the aggregation pipeline, indexes, transactions
- ○ Redis: caching patterns (cache-aside), distributed locks, expiry and eviction policies

### 2.5 Auth, payments and webhooks [Beyz]

- ★ Stripe Checkout Sessions, trials, one-off purchase vs subscription
- ★ webhook signature verification, the six subscription events, event idempotency, out-of-order delivery and replays
- ★ the entitlement model: who is allowed to write it, and how "a lifetime purchase can never be downgraded" is actually enforced
- ★ short-lived credentials: 60 seconds, usage-scoped keys, least privilege, never holding a long-lived secret in the frontend
- ○ key rotation, signing on the server, the blast radius of a leaked credential
- ○ JWT vs sessions, OAuth2 / OIDC, RBAC
- ○ reconciliation, refunds, disputes, SCA/3DS, tax and currency
- ○ metering and quotas: recording token usage per request, keeping quota deduction consistent

### 2.6 Concurrency, reliability and state

- ★ a request lock plus a defensive fallback, and what 2,000+ peak QPS actually means (which layer was measured) [Baidu]
- ★ idempotency and preventing double submission, optimistic vs pessimistic locking
- ★ a four-state machine that discards overlapping generations: modelling the states, the race, propagating cancellation [Beyz]
- ★ resuming a run: restarting from the last completed stage, persisting stage artefacts [Periplus]
- ★ budget control: a token budget and a time budget per run [Periplus]
- ○ rate limiting (token bucket / leaky bucket), circuit breakers, backoff and retries, layered timeouts
- ○ consistency and eventual consistency, transaction boundaries, compensation / sagas
- ○ observability: structured logs, metrics, distributed tracing, alert thresholds

### 2.7 Deployment and CI/CD

- ★ Docker [Beyz]: image layers, multi-stage builds, size optimisation, health checks
- ★ GitHub Actions [Beyz]: workflows/jobs/steps, caching, matrices, secrets, CI gates (lint/typecheck/build)
- ★ cron-triggered scheduled jobs: drift, duplicate triggers, idempotency, time zones
- ○ what deployment looks like on EC2, process supervision, zero-downtime restarts, rollback
- ⚠ AWS [Skills]: the basic model of EC2/S3/IAM; ⚠ Cloudflare: CDN, Workers, cache rules
- ⚠ Jenkins [Skills]: pipelines, agents, how it differs from GitHub Actions
- ○ blue-green / canary releases, release checklists, version pinning (the follow-up action from your P2) [Baidu]
- ⚠ Go [Skills]: goroutines, channels, select, context, GC — **code exists**: `~/Desktop/projects/Golang/Code/concept-tracker` (hand-written SQL, which pairs neatly against job-tracker's Django ORM)

---

## 3. Graphics [WinterFell]

### 3.1 Rendering pipeline basics

- ★ draw calls: why they're expensive, and the trade-off against triangle count
- ★ culling: frustum culling, backface culling, occlusion culling
- ★ bounding volumes (boxes/spheres) and the granularity of culling
- ○ vertex shader → rasterisation → fragment shader, depth testing, blending, MSAA
- ○ the cost of state changes, batching, telling a GPU bottleneck from a CPU one
- ○ LOD, merging geometry, texture atlases

### 3.2 WebGL / WebGPU

- ★ what it means that WebGPURenderer drives both WebGPU and its own WebGL2 backend
- ★ why the TSL node pipeline can't run on the classic WebGLRenderer
- ★ the fallback strategy: capability detection, and degrading loudly rather than silently
- ○ WebGPU: pipelines, bind groups, command encoders, explicit resource management, compute shaders
- ○ where WebGL2's capabilities end, extensions, context loss
- ○ the browser support matrix, detecting `navigator.gpu`

### 3.3 three.js / React Three Fiber

- ★ the TSL (three shading language) node system, `pass`, the post-processing chain
- ★ the bloom pass, tone mapping, HDR, the threshold parameter
- ★ a material's program key and shader recompilation: what triggers a scene-wide recompile
- ★ fog is part of a material's program key — the root cause of your stutter bug
- ★ R3F: the cost of JSX rebuilding an object declaratively vs mutating the existing one
- ★ `useFrame`, the render loop, Canvas, the R3F reconciler
- ○ the scene graph, `Object3D`, Mesh/Geometry/Material, cameras, lights, textures and samplers
- ○ `renderer.info` (draw call / triangle counts), a per-frame probe counting pipeline builds
- ○ releasing resources: `dispose`, memory leaks, the lifecycle of textures and geometries

### 3.4 Instancing and measurement

- ★ `InstancedMesh`: a shared matrix set, per-instance transforms, at the cost of losing per-instance culling
- ★ 129 → 76 draw calls, 2.6× the triangles submitted: how those numbers were collected
- ★ how to sample renderer stats frame by frame in headless Chromium
- ○ frame time vs FPS, percentiles (p95/p99), the traps in microbenchmarks
- ○ alternatives to GPU instancing: merged geometry, BatchedMesh, doing the culling yourself

### 3.5 Physics and the loop

- ★ Cannon [WinterFell]: rigid bodies, colliders, broadphase
- ○ fixed timesteps, the accumulator, interpolation/extrapolation, decoupling physics from rendering
- ○ continuous collision detection, tunnelling, sleeping

### 3.6 Maths

- ○ vectors/matrices, model-view-projection, coordinate systems and handedness, NDC
- ○ quaternions, Euler angles and gimbal lock, `slerp`/`lerp`
- ○ the normal matrix, homogeneous coordinates, the projection matrix and near/far planes, depth precision
- ○ curves and easing, noise (Perlin/Simplex)

### 3.7 Procedural generation

- ★ the reachability sweep over 1,020 layouts: horizontal reach vs the speed of that level
- ★ a guaranteed constraint (narrowest gap ≥ 15 units) against a randomly scattered control group
- ○ seeds and reproducible randomness, parameter sweeps, locating the failing samples
- ○ the difficulty curve, playability checks, regression tests for a generator

### 3.8 Colour and post-processing

- ○ linear space vs sRGB, colour management, gamma
- ○ tone mapping operators, exposure
- ○ fog types (linear / exp2) and how they relate to switching palettes

---

## 4. AI [Periplus][Beyz]

### 4.1 LLM basics

- ★ tokens and tokenizers, the context window, the cost model (input/output pricing)
- ★ streaming output: returning token by token, SSE vs WebSocket, TTFT
- ★ accounting for token usage per request and enforcing plan quotas [Beyz]
- ○ temperature / top-p / sampling, stop conditions, seeds and determinism
- ○ the system/user/assistant roles, prompt structure, few-shot
- ○ function calling / tool use, parallel tool calls
- ○ hallucination, the knowledge cutoff, long-context degradation (lost in the middle)
- ○ picking a model and falling back (what happens when a provider is down)

### 4.2 RAG and retrieval

- ★ evidence separated from judgment: the research stage only produces "claim + source quote", the verification stage rules on it
- ★ checking that a citation is a member of the evidence set, and the freshness window — both enforced by application code, not by prompt
- ★ a claim with no quote may not advance: which layer that constraint lives in
- ★ embeddings, vector search, the pgvector evidence cache
- ○ chunking strategy and overlap, metadata filtering
- ○ similarity metrics, recall vs reranking, rerankers, hybrid search (BM25 + vectors)
- ○ context compression, retrieval failure modes (missed, noisy, stale)
- ○ grounding, attribution, whether a citation can be verified

### 4.3 Structured output

- ★ Structured Outputs [Skills]: JSON mode, schema constraints, Pydantic validation
- ○ constrained decoding, retry and repair strategies, partial parsing
- ○ schema evolution and backward compatibility

### 4.4 Orchestration and agents

- ★ the six-stage pipeline: research / verification / planning / writing / editing / illustration
- ★ the orchestrator only knows the typed stage contract (never what happens inside a stage)
- ★ persisting run state and stage artefacts, resuming from the last completed stage after a crash
- ★ a token budget and a time budget for every run
- ★ **agentic workflow vs multi-agent system**: is the control flow written in code or decided by the model — in this project `STAGE_ORDER` is a hard-coded tuple with zero tool calls, so it's the former; the resume's wording was chosen on that basis, and it goes further — **"agentic workflow" was replaced by the plainer "Six-stage LLM pipeline"**
- ○ multi-agent vs one model over several turns: what you get and what it costs
- ○ running stages concurrently, rate limiting, retrying failures and dead letters
- ○ human-in-the-loop, approval points

### 4.5 Evals

- ★ the golden set: frozen briefs, frozen retrieved pages, a frozen clock
- ★ asserting on ranges rather than literal output — why you can't compare strings
- ★ the metrics: evidence gap rate, citation completeness, token cost
- ★ a prompt or control-flow change → a metric-by-metric before/after diff
- ★ scripted seams: the model provider, search, page fetching and the clock are all replaceable → it runs with no key and no network
- ★ 461 tests in 1.5 seconds: where the determinism comes from
- ○ offline vs online evaluation, A/B tests, shadow traffic
- ○ LLM-as-judge and its biases, human labelling, inter-annotator agreement
- ○ regression gates: does a metric getting worse block the merge

### 4.6 Reliability and safety

- ○ prompt injection, indirect injection (instructions inside a fetched page), jailbreaks
- ○ output filtering, PII, data retention and compliance
- ○ vendor dependence, rate limits, backoff, caching, the defences against runaway cost

### 4.7 Voice and real-time recognition [Beyz]

- ★ Deepgram streaming recognition: interim vs finalized transcripts
- ★ reconciling the transcript on the client — why that's necessary
- ★ using the utterance-end event to trigger generation: what endpointing is for
- ★ keeping the socket alive while the microphone is paused
- ○ VAD (voice activity detection), the endpointing threshold and the latency trade-off
- ○ word error rate (WER), speaker diarization, domain word lists
- ○ audio encoding, chunk size vs latency, packet loss and retransmission

---

## Appendix: the ⚠ list — Skills row only, no code on this machine

~~Go~~, ~~Angular~~, ~~Django~~, MongoDB, AWS, Cloudflare, Jenkins.

(GraphQL has been removed from this list: it isn't in the Skills row; it was carried over from an older version by mistake.)

Go / Angular / Django now have code on this machine behind them (concept-tracker, job-tracker), so they're crossed off — how to talk about them, and the answers to follow-ups, are in `skills/LEARNING_NOTES_SKILLS_DAY13.md`.

**The remaining four — decided on 2026-08-18: they stay on the resume.** Since they stay, you must be able to hold a conceptual answer: what problem it solves, when you'd choose it, how it differs from what you've actually used. The minimum version of each answer is in section 9 of that note. The standard sentence when pushed on detail is "I know this at the concept level; what I've actually built with is X". **Pretending you've used it is what really gets you caught.** (AWS isn't quite zero-support: the Beyz email service runs on EC2, and that bullet says so.)

---

## Suggested way through this

1. Do one thing first: go top to bottom and cross off everything you could talk about for three minutes on sight.
2. Split what's left into two piles — the ★ ones you have to fill in, the ○ ones only if there's time.
3. Out of the ★ pile, pull the **numeric** ones (5M PV, 30→60 FPS, 2,000 QPS, 15%, 70%, 129→76, 1,020, 461, 1.5 seconds, 60 seconds, twenty scenes; 2.6×, 15 units, six events and 500ms are off the resume now, but neighbouring topics still get asked) — every one of these draws a "how did you measure that?".
4. Only after that pass, move on to walking through the projects and mock follow-ups.
