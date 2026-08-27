---
title: Frontend walkthrough
section: Periplus
---

# Periplus frontend (web/) — the basics

> Why this exists: Periplus isn't where the resume's frontend weight sits (that's WinterFell / WebGPU), but if an interviewer asks in passing "how is the frontend of this built", you need to be able to describe **the basic structure** without going deep into how each library works. This note stays at that level.
>
> **v27 revision (2026-08-17):** one part is now heavier — **v27's bullet 1 explicitly says "the typed stage contract carries all the way to the React client, whose types are generated from the OpenAPI schema"**. So section 2 (the `openapi-typescript` chain) is now something the resume promises, not something you mention only when asked. **You must be able to explain it unprompted: where the contract is defined, how the types are generated, how the generated file is consumed, and what happens when the schema changes and nobody regenerates.** The rest (TanStack Query, MSW) stays at the basics level.

---

## 1. The stack

Repository path: `periplus/web`, a standalone SPA built with Vite.

| Layer | What's used | Notes |
|---|---|---|
| UI framework | React 19 | the newest React, with `react-dom` |
| Routing | React Router v7 (`react-router-dom`) | the traditional declarative `<Routes>/<Route>` form, not the data router / loader mode |
| State / data fetching | TanStack Query v5 (`@tanstack/react-query`) | there is no Redux/Zustand-style global store; server data lives in Query's cache and local UI state uses `useState` or the form library's own state |
| Forms | React Hook Form + `@hookform/resolvers/zod` | validation rules are declared as a Zod schema and bridged to RHF through the resolver |
| Validation / types | Zod v4 | used for runtime validation **in forms only**; types for talking to the backend come from a different route (section 2) |
| Build tool | Vite 8 (`@vitejs/plugin-react` + `@tailwindcss/vite`) | the dev server proxies `/api` to the local backend at `127.0.0.1:8000` |
| Styling | Tailwind CSS v4 | wired in through the Vite plugin, with no separate `tailwind.config.js` (the v4 approach) |
| Animation | GSAP | a small amount of decorative motion (the spinner on the submit button), reading `prefers-reduced-motion` to decide whether to play it |
| UI primitives | Radix UI (Dialog, Popover) | accessible (a11y) overlay primitives; the project's own `DatePicker`/`TagInput` wrap Radix in a business-specific appearance |
| Testing | Vitest + Testing Library + MSW + Playwright | unit/component tests in Vitest, end-to-end in Playwright (section 4) |
| Lint | oxlint | a high-performance ESLint replacement written in Rust |

**Directory layout (`web/src/`)**:

```
app/         the QueryClient factory (with the global defaults)
routes/      page-level components, one file per route (TripInputPage / RunProgressPage / RunResultPage / ArticlePage)
api/         everything that talks to the backend (section 2)
hooks/       small custom hooks (useMediaQuery and friends)
lib/         pure utilities (date formatting, stage label mapping, verdict colour mapping)
schemas/     Zod form validation schemas
components/  reusable UI (AppShell, DatePicker, Stepper, TagInput, StageRoute…)
mocks/       the browser-side MSW worker (for local preview, section 4)
test/        test infrastructure: fixtures, MSW handlers, Testing Library wrappers
```

The entry point (`main.tsx`) wraps everything in `<Router><QueryClientProvider><App /></QueryClientProvider></Router>`, and `App.tsx` is four `<Route>`s plus a `*` catch-all that redirects home. The whole application is 4 pages in one linear flow: fill in the form → submit and generate a trip → poll progress → see the result → read the generated article.

---

## 2. How type safety between frontend and backend is achieved (the important part)

This is the most notable engineering discipline in the project. It doesn't reach as far as tRPC (which is typed at runtime too), but for **a plain REST API on a FastAPI backend** it's a very practical middle ground.

### The tool: `openapi-typescript`

`package.json` has this script:

```json
"generate:api": "openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.generated.ts"
```

The flow:
1. Start the backend (FastAPI generates `/openapi.json`, the OpenAPI/Swagger document, automatically).
2. Run `npm run generate:api` on the frontend; the CLI **requests that OpenAPI JSON** and statically converts every path, request body and response body's JSON Schema into a pure TypeScript declaration file, `src/api/schema.generated.ts` (close to 1000 lines, with a header saying it's auto-generated and must not be hand-edited).
3. The generated file has two kinds of types: `paths` (request/response types per path) and `components['schemas']` (a TS type for every backend Pydantic model — `RunSummary`, `TripBriefCreate`, `Itinerary`, `Claim`, `Evidence`, `Verdict`, and so on).

### How it's consumed

`src/api/contracts.ts` is a thin hand-written layer that re-exports the generated file's verbose types under usable aliases:

```ts
import type { components } from './schema.generated'

export type ApiSchemas = components['schemas']
export type TripBriefCreate = ApiSchemas['TripBriefCreate']
export type RunSummary = ApiSchemas['RunSummary']
export type RunResultView = ApiSchemas['RunResultView']
// ... and so on
```

The `ApiClient` interface in `src/api/client.ts`, and every request function's arguments and return type, are annotated with those. Application code (pages, hooks) imports only from `contracts.ts` and never touches the generated file directly.

**What this solves**:
- When the backend renames a field, adds one or changes an enum value, one re-run of `generate:api` makes every place that references the type **fail at compile time**, instead of discovering the mismatch at runtime.
- No separate "frontend-only interface" to maintain, which avoids the classic problem of two type definitions drifting apart through manual syncing.

**Know where it stops** (an easy follow-up in an interview): this is **compile-time** type safety, not runtime validation. If the backend genuinely returns data that doesn't match the schema (a production bug making a field `null` where the type says non-null), the frontend **doesn't error** — it quietly uses the wrong type at runtime. `schema.generated.ts` is only used for TS annotations, and `response.json() as Promise<T>` in `client.ts` is a **type assertion**, with no runtime check on the body (unlike tRPC/Zod, which do types and runtime validation together). That's a real difference from tRPC or from "run the response through a Zod parse too", and being able to state it scores points.

### How requests are actually sent

`api/client.ts` is a plain `fetch` wrapper (no axios):
- It prefixes everything with `/api` (in development, Vite's proxy forwards to the real backend, configured in `vite.config.ts` as `/api` → `http://127.0.0.1:8000` with a rewrite stripping the `/api` prefix).
- It handles errors in one place: on a non-2xx it tries to parse the backend's `detail` field — a string is an ordinary error message, an array (FastAPI/Pydantic's validation shape, elements like `{loc, msg, type}`) is a list of field-level errors — and wraps it in a custom `ApiError` class (carrying `status` and `issues`).
- One interesting detail: the client also supports an `isDemo` switch (`import.meta.env.MODE === 'demo'`), where every request returns hard-coded fixture data and no network request is made — for a purely static hosted demo (`build:demo` plus `HashRouter`), so an interactive demo runs with no backend at all.

---

## 3. Fetching and caching: TanStack Query

The project has **no** Redux / Zustand-style global store; everything coming from the server is managed by TanStack Query (v5), the mainstream answer for "server state" in today's React ecosystem.

### What it solves

Hand-rolling `useEffect + fetch + useState(loading/error/data)` means a lot of boilerplate, no caching, no request deduplication, awkward sharing between components, and polling and retries to implement yourself. Query treats server data as **a keyed cache**: one `queryKey` identifies one piece of data, and several components subscribing to the same key share one cache entry rather than firing duplicate requests.

### How it's used here

`src/api/queries.ts` is where all the Query hooks live:

```ts
export const runKeys = {
  all: ['runs'] as const,
  detail: (runId: string) => ['runs', runId] as const,
  result: (runId: string) => ['runs', runId, 'result'] as const,
}

export function useCreateTrip() {
  return useMutation({ mutationFn: (brief) => api.createTrip(brief) })
}

export function useRunSummary(runId: string) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: () => api.getRun(runId),
    refetchInterval: (query) => {
      const summary = query.state.data
      return summary && isTerminalStatus(summary.status) ? false : 1_000
    },
  })
}

export function useRunResult(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: runKeys.result(runId),
    queryFn: () => api.getResult(runId),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}
```

Things worth talking about:
- **The queryKey factory pattern** (`runKeys.detail(id)`): the officially recommended shape, keeping keys in one place so nobody hand-writes an array literal, mistypes it and misses the cache.
- **Polling**: submitting a trip starts an asynchronous background task (six stages: research → verify → plan → write → edit → illustrate), and the frontend polls status every 1 second through `refetchInterval` **until the status is terminal** (`succeeded`/`failed`/`cancelled`, decided by `isTerminalStatus`). It's a textbook long-task polling case, and Query's `refetchInterval` callback (which can read the current cached data) does it in a few lines instead of a hand-written `setInterval` plus cleanup.
- **The `enabled` option**: `useRunResult` only fires when the caller passes `enabled=true`, which sequences "only make this request once the previous one says so" (wait for the run to be succeeded before fetching the final result).
- **`staleTime: Infinity`**: once fetched, the result is considered fresh forever and never refetched — a finished run's result is immutable history and there's nothing to re-fetch.
- **The global defaults** live in `src/app/queryClient.ts`: a custom `retry` policy (never retry 4xx client errors, retry others up to the second attempt) and `refetchOnWindowFocus` turned off (Query refetches on window focus by default; that's explicitly disabled here). Tests build a fresh instance with `createQueryClient()` each time so caches never leak between tests.

---

## 4. Testing: MSW keeps frontend tests off the real backend

This is the core idea of the project's testing approach and worth explaining.

### The layers

1. **Vitest + Testing Library**: component and page tests, running in `jsdom` (`test.environment: 'jsdom'` in `vite.config.ts`).
2. **MSW (Mock Service Worker)**: intercepts the real `fetch` calls made during tests and returns fixture data, instead of reaching the network or a backend service.
3. **Playwright**: end-to-end tests (the `test:e2e` script), driving a real browser over real pages.

### How MSW is wired in

- `src/test/mocks/handlers.ts`: a set of `http.get/post(...)` handlers for the endpoints the app uses (`POST /api/trips`, `GET /api/runs`, `GET /api/runs/:runId`, `GET /api/runs/:runId/result`) returning fixture data (`src/test/fixtures.ts` keeps a full set of fake states: running, succeeded, failed, validation failure).
- `src/test/mocks/server.ts`: wraps them into a server instance with `setupServer(...handlers)` (MSW's Node entry point).
- `src/test/setup.ts` (Vitest's global setup): `server.listen()` in `beforeAll`, `resetHandlers()` after each test, `server.close()` at the end — MSW's recommended lifecycle. It also stubs `window.matchMedia`, because jsdom doesn't implement it and components read `prefers-reduced-motion` to decide whether to run the GSAP animation.
- **The benefit**: components call `fetch` exactly as they normally would, with no need to mock out business functions like `api.createTrip`. MSW intercepts at the network layer, so tests run much closer to real behaviour (the non-2xx handling and `detail` parsing in `client.ts` get exercised too) without a backend running.

### Two different "run it on fake data" scenarios, easy to confuse

- **For tests (Node side)**: `src/test/mocks/server.ts`, used by Vitest unit and component tests, intercepting requests in Node.
- **For local preview (browser side)**: `src/mocks/browser.ts` uses `setupWorker` from `msw/browser`, reusing the same `handlers.ts`. This is for adding `?mock=1` during `npm run dev` — click through the whole UI on fake data with no backend running, which is handy for working on the interface or taking screenshots. It's gated on `import.meta.env.DEV`, so Vite tree-shakes it out of a production build.

### What is actually tested

`src/test/msw.test.ts` tests the request functions in `api.ts` directly (does the fixture come back as expected, are 404/422 correctly turned into an `ApiError`). Page-level tests like `src/routes/TripInputPage.test.tsx` use Testing Library's `userEvent` to simulate real clicking and typing (fill in a destination, pick dates, hit submit) and assert on the validation messages that appear or the route that gets navigated to. Those tests go through the `renderRoutes` wrapper in `renderWithProviders.tsx`, which wraps the component under test in a `MemoryRouter` plus a fresh `QueryClientProvider` so `useParams`/`useNavigate` and the Query hooks all work.

---

## 5. Follow-ups to expect

1. **"Why not tRPC or GraphQL for this project, rather than REST + openapi-typescript?"**
   The answer: the backend is FastAPI, which generates an OpenAPI document natively, so this approach gets types with zero backend work; the downside is that it's compile-time only, with no runtime validation and none of tRPC's tight binding where a backend change immediately breaks the frontend build (you have to re-run the generation script by hand).

2. **"What happens when the types in `schema.generated.ts` don't match what the backend really returns?"**
   The answer: nothing errors. `response.json() as Promise<T>` is only a type assertion with no runtime check, so a wrong shape becomes a quiet bug in application code (reading a field that is actually `undefined`). To add a runtime safety net, you'd pair the generated types with a Zod schema and `safeParse` inside `request()`.

3. **"Why TanStack Query instead of a global store like Redux?"**
   The answer: almost all state here is server data (run status, results), with no complex cross-page client state needing a general store. Query is built for server state and brings caching, deduplication, polling and retries with it, which beats assembling a request state machine on Redux by hand; the local UI state that does exist (form values, dialog open state) is fine in `useState` or RHF's own state.

4. **"For progress, why polling rather than WebSocket or SSE?"**
   The answer: it uses simple polling (`refetchInterval`, once a second until terminal), presumably because the task isn't long, the total request volume is manageable, and polling is simple with no long-lived connection to maintain. If you were optimising toward WebSocket/SSE, discuss the trade (better immediacy, but connection lifecycle, reconnection, and one more transport for the backend to maintain).

5. **"What does MSW give you over just `vi.mock('./api/client')`?"**
   The answer: `vi.mock` replaces the whole API client at the module level, so the test skips the real fetch call, the error handling and the status-code branches in `client.ts` — that code goes untested. MSW intercepts at the network layer, so the application's code path (including error parsing) runs as it really would, which is closer to runtime behaviour; and the same handlers are reused by the browser-side mock (`src/mocks/browser.ts`), so one set of fixtures serves both.

6. **"How exactly do Zod and React Hook Form work together for the form here?"**
   The answer: `schemas/tripBrief.ts` defines `tripBriefSchema` (with a `.refine` for the cross-field rule that the end date can't precede the start date), passed to `useForm` through `zodResolver(tripBriefSchema)`. On submit, RHF runs the schema, failing fields land in `formState.errors`, and a `<span>` next to the input renders them; on top of that, a 422 from the backend (`ApiError.issues`) is written back into the form's error state with `setError` after a failed submit, so frontend validation and backend validation errors appear in the same UI.
