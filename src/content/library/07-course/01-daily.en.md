---
title: Today's notes
section: Course & old notes
---

# Today's notes

## 1. Frontend performance (virtualized list)

- Browser render pipeline: JS → Style → Layout → Paint → Composite, with a budget of 16.67ms per frame (60 FPS)
- How a virtualized list works: the data layer (`list`) only grows, the render layer (`visibleItems`) keeps only the nodes near the viewport; React's `key` diffing mounts and unmounts the DOM for you, so there is no hand-written "destroy" logic
- Sentinel pattern: put an empty `div` at the bottom and let `IntersectionObserver` trigger the next page. It works alongside the virtualized list — two independent mechanisms, one for the data layer and one for the render layer
- Why `translateY` and not `top`: transform only triggers Composite (GPU), while top triggers a full Layout + Paint + Composite
- Why index works as a key: the real rule is "a key must uniquely and stably identify one row". In a virtualized list the list is append-only, so the index is stable by nature and using it is entirely correct
- `getBoundingClientRect` forces a synchronous layout: any API that reads geometry forces the browser to flush the layout work it had queued up, so alternating writes and reads is a performance trap

## 2. Writing debounce by hand

- The three parts that matter: `leading` (fire immediately), `trailing` (fire after it stops), `cancel` (abort on demand)
- The traps: the setTimeout callback must set `timer=null` when it finishes (otherwise leading only ever fires once for the whole lifetime); leading and trailing must be mutually exclusive (or one trigger fires twice); `cancel` belongs on the returned function, not on the outer factory
- `clearTimeout` only works on a timer that has not expired yet and has not entered the macrotask queue

## 3. Concurrency control and stability

- Promise deduplication (inFlightMap): keyed by argument (such as orderId), so the same order is deduplicated while different orders still run in parallel — only valid inside a single process's memory
- Idempotency: an idempotency-key table persisted in the database catches the case across devices, processes and time. It is the last line of defence for "zero money lost", layered underneath inFlightMap
- Queueing and rate limiting: virtual queues, client-side jitter, exponential backoff retries — all of them spread concurrent requests out over time
- SSE: one-way server push over HTTP, built on the `Content-Type: text/event-stream` header plus the `data:\n\n` format convention. No handshake or protocol upgrade; it reconnects automatically and replays via `Last-Event-ID`

## 4. Debugging production issues

- How Sentry works: the SDK captures errors and stack traces automatically, and with source maps uploaded per release the server translates minified positions back into readable source positions — fully automated
- Source maps: never published publicly, only uploaded privately or archived. The several ways to use them (browser devtools, a self-hosted monitoring system, Sentry) are the same thing underneath
- git bisect: an automated binary search for the commit that introduced a bug; `git bisect run` makes it fully hands-off
- Feature flags as a kill switch: they decouple "code is deployed" from "feature is live", so turning something off is a remote config change and needs no redeploy. The rollout percentage comes from hashing the user ID and taking a modulus, which keeps existing users in the rollout when you widen it

## 5. Understanding the Beyz stack

- tRPC: not a heavyweight RPC protocol. What it really does is let the frontend borrow the backend's function types at compile time through `export type` / `import type`; at runtime it is still ordinary HTTP and JSON. It requires frontend and backend code to sit where they can import each other's types (same repo or monorepo), and has no necessary connection to Next.js
- React Hook Form: built on uncontrolled components reading values through refs, so typing does not trigger a React render (it bypasses state). Values are only read on submit or through `useWatch`, which is what fixes laggy large forms
- Zod: solves the fact that TypeScript only exists at compile time and cannot validate runtime data. One schema produces both a runtime validator (`.parse`) and a TS type (`z.infer`), and `zodResolver` wires it into RHF in one line
- How tRPC and Zod divide the work: tRPC keeps frontend and backend types consistent during development (against human slips), Zod validates that runtime data is real (against malicious or malformed requests that bypass the frontend — the backend can never trust client input)
- Server Action vs Route Handler: the former only serves your own frontend components (a tRPC-like experience: type safe, one less fetch layer); the latter is a genuinely public HTTP endpoint, and anything called from outside such as a third-party webhook has to use it

## 6. Notes on resume wording

- The "500+ → 20 DOM nodes" figure on the virtualized list bullet is optimistic. Better: "node count grows without bound vs. held in a constant range (roughly 100-150 including overscan)", plus the measurement method to make it credible
- When describing the feed work, get the timeline of "first version" and "later optimization" straight so the account does not contradict itself. Where the native-app embedding details were not your responsibility, simply state where the boundary was
- "Docker + EC2 + CI deployment" is low-value as a resume highlight. Compress it, or replace it with something with more substance (such as the idempotency guarantee)
