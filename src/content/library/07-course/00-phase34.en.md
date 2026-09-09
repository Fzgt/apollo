---
title: Phase 3 & 4 topic review
section: Course & old notes
---

# Phase 3 / 4 advanced practice — index

> The original notes were spoken shorthand jotted down during class. The technical content has been reorganized into six standalone articles; this page keeps only the course structure, assignments, reading list, and the odds and ends that did not make it into the blog.

---

## Where the technical content went

Each of the six topics became its own article, filling in the details the original notes skipped and correcting what has gone stale since 2022:

| Topic | Article |
|---|---|
| Serverless architecture — BFF/SFF, Cloudflare Workers vs AWS Lambda, IPFS, Service Worker and Workbox, edge SSR | [#79 Serverless and edge deployment](https://github.com/Fzgt/Blog/issues/79) |
| Monorepo toolchain — pnpm hard/symlinks, workspaces, Lerna / Nx / Rush division of labour, verdaccio, lockfile trade-offs | [#80 Monorepo and private registry](https://github.com/Fzgt/Blog/issues/80) |
| State management landscape — Redux / MobX / Recoil / Jotai / Zustand / Valtio / XState, tearing and `useSyncExternalStore` | [#78 React state management landscape](https://github.com/Fzgt/Blog/issues/78) |
| Webpack code splitting — runtime extraction, cacheGroups, why single-entry apps resist splitting, size thresholds, lazy compilation | [#81 Webpack code splitting in practice](https://github.com/Fzgt/Blog/issues/81) |
| React 18 concurrency — useTransition / useDeferredValue, RSC, streaming SSR, Next.js vs Remix, React Query, route preloading | [#82 React 18 concurrency and modern SSR](https://github.com/Fzgt/Blog/issues/82) |
| Component library DX — Storybook, what Tailwind's atomic CSS actually buys and costs, MSW | [#83 Component library developer experience](https://github.com/Fzgt/Blog/issues/83) |

**Claims corrected across those six articles**: Recoil was archived in January 2025 and is unmaintained; Jotai v2 can be used outside React, so "atoms only work inside components" no longer holds; the boilerplate criticism of Redux predates Redux Toolkit; MobX 6 no longer requires decorators but still has not solved tearing; XState v5 moved to the Stately Editor and is incompatible with v4. A summary table is at the end of [#78](https://github.com/Fzgt/Blog/issues/78).

---

## Course structure

**Phase 3** moved through topics: Serverless (Cloudflare / AWS / IPFS) → frontend plus backend architecture (mini-program Serverless) → state library survey and pnpm → private registry setup with pnpm + Lerna → advanced publishing → re-render problems → Zustand + Immer → mainstream frontend recap → performance monitoring SDK → Webpack code splitting → writing React by hand.

**Phase 4** narrowed to three threads: private registry (verdaccio / lerna / pnpm / nx / rush), state management (Jotai / Zustand / XState), and component libraries (Storybook / Tailwind / React 18).

The five-month elite track overall: stage one, mainstream frontend; stage two, graphics, Web AI, Rust, Python, blockchain basics, V8; stage three, blockchain, smart contracts, DApps.

---

## Assignments

**1. End-to-end Serverless exercise**

1. Create a React + TS project with CRA
2. Write a Cloudflare Worker returning JSON, compile it with esbuild, deploy it
3. Add a task that changes the output data every three minutes
4. Deploy the frontend via Git to Workers Pages and call that Worker
5. Add Workbox offline caching — the goal is that the page stays usable whether or not the server is up

Companion question: HTTP cache, local storage, and Workbox offline caching — how is each used in a project, and what is the core difference? (Answered in section 4 of [#79](https://github.com/Fzgt/Blog/issues/79).)

**2. Self-assessment**: write up your strengths, weaknesses, and the technical work you would actually show off.

---

## Interview advice from the course

- **You need one thing you are genuinely deep in.** Being able to say two sentences about everything and stalling on the first follow-up is the fatal pattern. Conversely, one area where you know more detail than the interviewer wins the room.
- **Have a Node-adjacent project on the CV** and be able to explain SFF properly. Listing Node essentially guarantees questions on **libuv internals** and **the hardest problem in deploying isomorphic JS**.
- **Depth direction for senior frontend**: the architecture of Chrome / WebKit / V8. Chrome's own YouTube channels are the primary source.
- **An architecture worth putting on a CV**: hybrid cloud + message queue + multi-level cache on mini-program Serverless — it answers cost, burst QPS, DDoS and scraping in one design. See section 6 of [#79](https://github.com/Fzgt/Blog/issues/79).

---

## Odds and ends not in the blog

### Unit testing

- A deliberate `console.error` (testing an error branch) can fail the suite outright under Node. Mock or intercept `console.error` in Jest configuration.
- **Utility libraries other people depend on need coverage close to 100%** — a library that breaks today and errors tomorrow loses trust permanently. That is a large part of why unit tests exist.

Common Jest options: `verbose`, `testEnvironment`, `collectCoverage` / `collectCoverageFrom`, `coverageReporters`, `testPathIgnorePatterns`, `testRegex`, `transform` (route `.ts` to ts-jest), `moduleFileExtensions`, `setupFilesAfterEnv`.

For TypeScript, extend the community **`@tsconfig/recommended`** rather than pasting a config — it tracks TS releases, so you only bump a version.

### Language and runtime

- **Atomics**: JS thread-locking APIs, used with `SharedArrayBuffer` for cross-thread synchronization.
- **TensorFlow.js / Web AI**: run pre-trained models directly in the browser.
- **Class components** are on a slow path to deprecation; new code should be function components plus hooks.
- **`React.FC` is no longer needed** — current type definitions already treat function components as such.

### Where to keep up

- News: dev.to, bestofjs, Twitter
- Practice: [type-challenges](https://github.com/type-challenges/type-challenges), [bigfrontend.dev](https://bigfrontend.dev/)
- Performance: read through the [web.dev](https://web.dev/) performance series
- Storybook's own [blog](https://storybook.js.org/blog/) for newer patterns

### Reading list

*Nonviolent Communication*, *The Crazy Programmer*, *Beautiful Code*, *Programming Pearls*, *Build Your Own Compiler*. *Beautiful Code* is scenario-style interview material worth revisiting while preparing.
