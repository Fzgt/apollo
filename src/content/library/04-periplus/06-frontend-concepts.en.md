---
title: Frontend concepts
section: Periplus
---

# Frontend engineering concepts (interview prep, by topic)

> Scope: this is not a project walkthrough (`LEARNING_NOTES_PERIPLUS_FRONTEND.md` already does that). It anchors on the resume line "Frontend: React, Next.js, Vue, Angular, TanStack Query, Zustand, React Three Fiber, Three.js" and walks topic by topic through the **general, transferable frontend concepts** behind it. The frontend is this candidate's secondary direction, so the goal here is "one pass, enough to explain the mechanism and the trade-offs", not to dig deep on every point.

---

## 1. React vs Vue vs Angular: mental models and reactivity

All three solve the same problem — "the data changed, how does the UI follow automatically" (declarative rendering) — but they implement reactivity differently:

- **React**: one-way data flow plus explicit re-rendering. A state change re-runs the component function, and Virtual DOM diffing produces the minimal update. The mental model is "UI = f(state)". There is no automatic dependency tracking, so fine-grained optimization means reaching for `memo` / `useMemo` / `useCallback` by hand (or letting the React 19 Compiler do it).
- **Vue**: a Proxy-based reactivity system (Vue 3) that tracks dependencies automatically — whichever reactive variable a component reads, it subscribes to. When the variable changes only the affected part re-renders, with none of React's manual memoization. The template syntax (SFC) is also naturally friendlier to diffing.
- **Angular**: a heavier framework with dependency injection, RxJS-driven reactivity, two-way binding (`[(ngModel)]`) and a strongly prescribed module structure. It suits large enterprise teams: a steep learning curve, but strong conventions.

**Trade-offs**: React is flexible but requires team discipline (state design, render optimization). Vue has a lower mental cost and is quicker to pick up, but its ecosystem and deep TS integration are less mature than React's. Angular works out of the box but is heavy and inflexible. React has the largest ecosystem today and dominates hiring, which is why it comes first on the resume.

**Likely follow-ups**:
1. What is the essential difference between React's Virtual DOM diffing and Vue's dependency tracking? In which scenarios do their performance characteristics flip?
2. What problem is the React 19 Compiler trying to solve? Is it converging on the same place as Vue's automatic dependency tracking?
3. If you had to decide React or Vue for a new project, which dimensions would you weigh?

---

## 2. Client state vs server state: why TanStack Query exists separately from Zustand/Redux

This is the concept pair most likely to come up about a modern React data layer.

- **Client state**: state that lives only in the frontend and has nothing to do with the backend — form input, whether a modal is open, the current tab. The frontend owns it outright.
- **Server state**: the truth lives in the backend and the frontend only holds a **cached snapshot**, which can go stale, may need refetching, and may be changed by another user or another tab.

Redux and Zustand were designed to manage **client state**. Force server data into them and you end up hand-writing loading/error states, cache invalidation, deduplication, retries and polling. TanStack Query was built for server state and makes "a cache entry addressed by a `queryKey`" a first-class citizen with all of that built in. It is not really a state management library — it is an **async data synchronization engine**.

**In Periplus**: the Periplus frontend has no Redux or Zustand, because almost all state is server data (trip creation, run status, results). The TanStack Query cache is the single source of truth, and the genuinely local UI state is small enough that `useState` covers it.

**Likely follow-ups**:
1. In what sense is a TanStack Query `queryKey` really an "address" into the cache?
2. If a page has both server data and a lot of client state shared across components, how would you combine the two kinds of tool?
3. What UX problem does an optimistic update solve compared with a plain `refetch`, and what risk does it introduce?

---

## 3. Global state: choosing between Context, Zustand and Redux

All three share state across components, but they fit different situations:

- **Context**: built into React, good for "changes rarely, passed down many levels" cases (theme, language, current user). The downside is that every consumer under the Provider re-renders when the context value changes, so it is a poor fit for frequently updated state.
- **Zustand**: a minimal external store based on subscriptions rather than Context. A component subscribes only to the slice it uses (a selector), so unrelated re-renders disappear. It has none of Redux's boilerplate (no action types, reducers or dispatch ceremony), which suits global state in small and mid-sized projects.
- **Redux (especially Redux Toolkit)**: stronger predictability and debuggability (time travel, a middleware ecosystem, strict one-way data flow). It suits large teams with complex derived-state logic that need firm conventions, at a higher cost in boilerplate and mental overhead.

A practical rule of thumb: **first ask whether this state is server data** (yes → TanStack Query), **then whether it is low-frequency, narrow configuration state** (yes → Context is enough). Only when it is neither, and the state is complex or updates often, do you need a dedicated global store like Zustand or Redux.

**Likely follow-ups**:
1. Why is "abusing Context for high-frequency state" such a common performance trap, and how do you avoid it (splitting Contexts, `useSyncExternalStore`, …)?
2. How do Zustand and Redux each trade off on "do I want a middleware ecosystem" and "do I want strict one-way flow"?
3. If a project starts with Context and the state later gets complicated, how would you judge that it is time to move to Zustand?

---

## 4. Talking to the backend about long-running work: polling vs WebSocket vs SSE

The backend has a slow async job (a multi-stage pipeline, say) and the frontend needs the progress or the result. Three common approaches:

- **Polling**: the frontend asks for the status on a fixed interval until it reaches a terminal state. Simple, stateless, and the least demanding on infrastructure (plain HTTP requests). The costs are wasted requests and latency — in the worst case you wait a full interval to notice a change.
- **SSE (Server-Sent Events)**: the server pushes over an ordinary long-lived HTTP connection, one-way (server → client). The browser's native `EventSource` reconnects automatically. It fits "the server just needs to push messages to the frontend" and is lighter than WebSocket.
- **WebSocket**: a full-duplex long-lived connection, right for high-frequency two-way communication (chat, collaborative editing). It costs the most in infrastructure: connection lifecycle, heartbeats, reconnection, and backend support for the protocol.

The choice is really buying real-time behaviour with implementation and operational complexity. When the job is short, concurrency is manageable and you do not need two-way communication, polling is usually the best value. SSE or WebSocket earn their keep when you need frequent low-latency updates and the backend already has the infrastructure.

**In Periplus**: Periplus polls once per second with TanStack Query's `refetchInterval` and stops when the run reaches a terminal state — the job takes minutes, request volume is manageable, and polling is a few lines of code with no long-lived connection to maintain.

**Likely follow-ups**:
1. How do you improve polling's worst-case latency and its wasted requests (adaptive intervals, exponential backoff)?
2. On the question of "does the client need to send messages too", which scenarios suit SSE and which suit WebSocket?
3. If the backend has no WebSocket or SSE infrastructure yet but the product demands second-level freshness, how would you weigh it up?

---

## 5. Compile-time type safety vs runtime validation: a boundary you can get caught on

This is the core concept behind any "share types across frontend and backend" approach (`openapi-typescript`, tRPC, GraphQL Codegen): **compile-time safety is not runtime safety**.

- **Compile-time type safety**: TypeScript only exists while you write and compile. A tool like `openapi-typescript` statically converts the backend's OpenAPI/Swagger document into TS type declarations to annotate your code. The benefit is that when a backend field changes, every use site fails to compile, and the IDE autocompletes. But it constrains nothing about **the data you actually receive at runtime** — `response.json() as T` is a **type assertion**, not validation. The compiler believes the type you wrote, not the bytes that came over the network.
- **Runtime validation**: with Zod, Yup or io-ts you genuinely parse the data at the moment you receive it (`schema.parse(data)`), and on failure you can throw immediately or fall back. That catches the things that really do happen in production: a backend bug returning the wrong field type, or an API version mismatch.

These are not either/or; they cover two different lines of defence, development time and runtime. tRPC is considered the more thorough approach because it defines the schema as a runtime object (usually with Zod), so one schema gives you both the compile-time type and the runtime validation with no extra layer.

**In Periplus**: Periplus uses `openapi-typescript` to generate the types that annotate `api/client.ts`, which is pure compile-time safety. The only real runtime validation is on the frontend form (Zod + React Hook Form); nothing on the backend-communication path runs `safeParse` over a response body. That boundary is a deliberate trade in this project (types at zero backend cost), not an oversight.

**Likely follow-ups**:
1. Give a concrete production bug where the compile-time type was right and the runtime data was wrong.
2. To add runtime validation to a pure REST + `openapi-typescript` project, how would you land it (generate Zod schemas, or hand-parse the critical fields on `response`)?
3. Where exactly is tRPC or GraphQL Codegen stronger than the "generate once, statically" approach of `openapi-typescript` on the point of binding?

---

## 6. Next.js SSR/SSG/ISR vs a pure SPA (CRA/Vite)

A pure SPA (bundled by Vite or CRA) makes the browser download a nearly empty HTML file plus a pile of JS, and nothing renders until the JS runs — a long blank first paint and poor SEO (crawlers may not wait for JS). It is architecturally simple, and fits internal tools or apps that live behind a login. Next.js offers several pre-rendering strategies for this:

- **SSR (Server-Side Rendering)**: on every request the server renders the React components to HTML and returns it. Fast first paint, SEO friendly, but every request costs server compute, so load and latency grow linearly with traffic.
- **SSG (Static Site Generation)**: pages are rendered to static HTML at build time and served as static files. The best possible performance (put it straight on a CDN), but updating content means rebuilding and redeploying — right for blogs and docs, where content changes rarely.
- **ISR (Incremental Static Regeneration)**: the middle ground. Static pages regenerate in the background on a set interval, so users mostly get a cached static page while the content still refreshes automatically, without a full redeploy for every change.

The decision comes down to whether content differs per user, how often it updates, and whether SEO matters. A pure client-side SPA is one end of the spectrum (everything renders in the browser, simplest build and deploy); Next.js lets you mix the strategies per page.

**Likely follow-ups**:
1. A dashboard behind a login whose content differs per user — SSR, SSG or ISR, and why?
2. Who triggers ISR's regeneration? If two requests hit the "time to regenerate" moment at once, how does Next.js handle it so users never see a half-built page?
3. What do Server Components in the Next.js App Router solve beyond traditional SSR (shipping less JS to the browser, for instance)?

---

## 7. React Three Fiber / Three.js: a declarative wrapper over imperative WebGL

Three.js wraps the browser's native WebGL API, giving you Scene, Camera, Mesh, Material and lighting — but the usage is **imperative**: you `new THREE.Mesh(...)` by hand, attach it to the scene by hand, update properties inside a `requestAnimationFrame` loop by hand, and clean up by hand. That imperative code clashes with React's declarative mental model ("the UI is a function of state").

React Three Fiber (R3F) maps the Three.js object tree onto a React component tree. You write JSX like `<mesh><boxGeometry /><meshStandardMaterial /></mesh>`, and underneath R3F's custom renderer (built on `react-reconciler`) calls the real Three.js APIs to create, update and dispose objects. Which 3D objects to add or remove when state changes is handled by React's diffing, so you write no imperative bookkeeping, and you can organize a 3D scene with the rest of the React ecosystem (state management, hooks, component reuse).

**When it is worth putting 3D inside React**: when the scene has to stay in step with the rest of the application's state (forms, routing, business data), and when you want to compose and reuse 3D elements as components. If it is an isolated visualization that rarely interacts with outside state, plain Three.js (or an off-the-shelf 3D library or editor) is probably simpler, and R3F only adds a layer of abstraction and mental overhead.

**Likely follow-ups**:
1. R3F's renderer and `react-dom`'s renderer are the same mechanism (`react-reconciler`) doing two different jobs — how do you read that statement?
2. When updating a 3D object's position frequently inside a React component (animation, say), why is it discouraged to store the coordinates in React state and re-render, in favour of mutating properties on a `ref` from `useFrame`?
3. Should a 3D scene be managed as a React component tree, or treated as one "black box canvas" driven imperatively from outside? What factors decide it?

---

## 8. Testing strategy: mocking at the network layer with MSW

In frontend testing you cannot avoid the question of whether to make real network requests. Two mainstream approaches:

- **Mock the business function itself** (e.g. `vi.mock('./api/client')`): quick and blunt, but it bypasses the real request construction, error handling and status-code branches, so that code is never actually tested.
- **Intercept at the network layer** (MSW, Mock Service Worker): do not mock the business code; intercept the real `fetch` / `XHR` requests, match on URL and method, and return a canned response. The business code takes its full real path (how the request is built, how the response is parsed, how errors are converted) — only the destination is replaced with fake data, so the test sits much closer to real runtime behaviour.

MSW's other advantage is that **one set of handlers is reusable across scenarios**: unit tests (Vitest) use `setupServer` on the Node side, component and integration tests use the same handlers so behaviour stays consistent, and the browser can even use `setupWorker` to run an interactive demo or local preview with no real backend. One set of fixtures, many uses, instead of maintaining fake data per scenario.

**In Periplus**: Periplus's `handlers.ts` is shared by Vitest's Node-side `server.ts` (unit and component tests) and the browser-side `browser.ts` (`?mock=1` local preview), and the tests genuinely exercise `client.ts`'s handling of non-2xx status codes and the `detail` field rather than skipping past it.

**Likely follow-ups**:
1. MSW intercepts the network layer — compared with intercepting the module-import layer (`vi.mock`), which code paths does each leave untested?
2. If the backend has 100 endpoints, should every one get an MSW handler? How would you control the maintenance cost (generating mocks from the OpenAPI document, for instance)?
3. What roles do end-to-end tests (Playwright against a real or mocked backend) and MSW-intercepted component tests play in the testing pyramid, and why can neither replace the other?

---

## How this document divides labour with the project notes

`LEARNING_NOTES_PERIPLUS_FRONTEND.md` answers "how the Periplus frontend is actually built" — directory structure, which libraries, exactly how `openapi-typescript`, TanStack Query and MSW are wired in this project. That is the material for walkthrough questions like "tell me about this project's frontend". This document answers "what are the general concepts behind those choices, why do they exist, and how do they compare with the alternatives", covering the parts of that resume line Periplus does not directly use but which may still come up (Vue/Angular comparisons, Zustand/Redux, Next.js rendering strategies, React Three Fiber). The point is that when the question goes to the mechanism, the candidate can lay out a clear set of trade-offs whether or not the technology was actually used in this project, instead of stalling as soon as the question leaves the project.
