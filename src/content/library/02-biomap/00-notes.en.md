---
title: BioMap · the four bullets
section: BioMap
---

# BioMap — the four resume bullets (v40)

> ⚠️ **This is historical material preserved in v40 order. The current resume order is: ① architecture boundaries ② design system ③ TanStack Query ④ LIMS.** Use the four rewritten notes under Plan for current interview wording; "Bullet 1–4" below only denotes the old numbering.
>
> The structure matches **the four BioMap bullets on the resume**, no more and no less. Each one has four parts: **the text** / **where to look** / **how to tell it** / **likely follow-ups**.
> The old "toolchain + Docker/Nginx/Jenkins" bullet is no longer on v40, so that whole section is deleted.

## Which repository to open — don't mix these up

| v40 bullet | Where the code is |
|---|---|
| ① LIMS + Luckysheet + CLI | `~/Desktop/BioMap/biomap-web-lims`, `~/Desktop/BioMap/biomap-cli` — **the real BioMap code** |
| ② Digital OS architecture + ESLint module boundaries | `~/Desktop/projects/github/Prometheus` |
| ③ Three TanStack Query layers + prefetch | `~/Desktop/projects/github/Prometheus` |
| ④ Radix + Storybook + CVA + MSW | `~/Desktop/projects/github/Prometheus` |

**LIMS / Luckysheet / CLI are in the BioMap repos; the other three are all in Prometheus.** Prometheus is the reference implementation of this architecture (the bulletproof-react line), and every line number for ② ③ ④ below points into it.

---
## Bullet 1: the LIMS platform + the Luckysheet SDK + the CLI

> v40 text: Developed the LIMS platform in Vue 3 and TypeScript for sample management and SOP workflows, integrating the Luckysheet SDK and a CLI for one-command project scaffolding.

### Where to look ⭐ (updated 2026-08-18: the code turned up, so this is no longer from memory)

`~/Desktop/BioMap/biomap-web-lims/src/views/sop/sop-edit/`

| Step | File | Key lines |
|---|---|---|
| Getting Luckysheet | `index.vue` | `:35` `const luckysheet = window.luckysheet` — **a global, not an npm import** |
| Mounting the container | `index.vue` | `:9` a bare `<div id="luckysheet" ref="lucky">`; Vue never touches what's inside |
| Creating the instance | `index.vue` | `:208-211` `initSop()` → `luckysheet.create(initOptions(metaData))` |
| Initial data | `index.vue` | `:102-127` `loadExcelMetadata()`, three sources: the SOP template / creating a workflow / editing a workflow, falling back to `metaExcel` when none of them return |
| The bridge from sheet to app | `index.vue` | `:133-178` `cellRightClickConfig.customs`, three custom context-menu items: `SOP 配置JSON字段` / `SOP 配置数据验证` / `SOP Mark Fields`, each calling `openModal` to open a Vue dialog |
| The bridge from app to sheet | `index.vue` | `:53-56` `setSheetSopJson()` and `:61-68` `setMark()`, writing back into cells with `luckysheet.setCellValue()` |
| Saving | `index.vue` | `:95-100` `handleUpdate()` → `getAllSheets()`, **setting each sheet's `data` to `undefined` first**, then storing |
| Debounced save | `index.vue` | `:74-93` `debounce(..., 2000, {leading:false})`, triggered by `hook.updated` |
| Resizing | `index.vue` | `:186-206` `useResizeObserver` + `debounce(600)` + a **"micro-jitter" rule** (a width change under 20px doesn't rebuild) |
| Extra cell properties | `MarkModal.vue` | the whole file — writes `sopExpandProperty` into the cell |

### How to tell it (from the real implementation — drop the guesswork from the old version)

**The previous version of this note said the instance was held in a ref and driven by a `watch` on props calling imperative methods. That was a guess, and it's wrong.** What actually happens:

1. **Luckysheet is a global script, not a module.** You get it from `window.luckysheet`, and the container is a bare div that Vue never re-renders — that's the line between an imperative library and a declarative framework: **hand it one region of the DOM outright, and Vue does not go in.**
2. **The two directions of the bridge take different routes.** Sheet → app: Luckysheet's context-menu extension point `cellRightClickConfig.customs`; clicking an item opens a Vue Modal. App → sheet: once the modal is confirmed, it calls `setCellValue()` to write back. **There is no reactive binding; the two sides exchange through events and explicit calls.**
3. **What gets stored is configuration, not data.** The object from `getAllSheets()` has `sheet.data` — the whole expanded cell matrix, which is enormous. Each one is set to `undefined` before saving, leaving only structure and custom properties. That's the decision in this bullet most worth talking about.
4. **Saving is `hook.updated` + a 2-second debounce with `leading:false`** — continuous editing never hits the API; it saves once, two seconds after the user stops.
5. **The dirtiest trap: Luckysheet has no resize API.** If the container size changes, the only option is a full `create()` rebuild. Hence `useResizeObserver` + a 600ms debounce, plus a rule saying a width change under 20px counts as jitter and doesn't rebuild, plus an `isInit` flag to block the size change the modal itself causes — otherwise opening a dialog from the context menu makes the whole sheet flash and loses the editing state.

### Likely follow-ups

- **Why not handsontable / ag-grid?** → Luckysheet is free and open source; ag-grid's enterprise edition costs money and handsontable needs a commercial licence. What the business wanted was "like Excel" — frozen rows and columns, formulas, multiple sheets, xlsx import/export.
- **How does an imperative SDK coexist with Vue?** → See points 1 and 2 above. One-line version: **give it a region of the DOM, keep the boundary to events and explicit calls, and don't try to push it into the reactivity system.**
- **Why is the context menu the integration point?** → What the business wanted was "attach an SOP field config / validation rule / mark to this cell", which is **cell-level metadata**. Luckysheet has no concept of any of that, so the only way in is to hang your own UI off its extension point.
- **Why delete `sheet.data` before saving?** → It's the full cell matrix used for rendering; storing it makes the payload an order of magnitude bigger, and the next load rebuilds from the template plus the custom properties anyway.
- **What does rebuilding the whole sheet cost?** → The detail endpoint has to be fetched again before `create()`. That's exactly why there's a debounce, a jitter filter and `isInit` — three layers, all of them there to rebuild less.

---


### The CLI (second half of v40 Bullet 1)

The code is in `~/Desktop/BioMap/biomap-cli`, and here is what it actually is (not what the previous version guessed):

| Item | Fact |
|---|---|
| Package / command | `@biomap/cli`, the bin is **`bcli`** |
| Options | `bcli -c [name]` creates a project, `bcli -i <tpl>` installs a template, `-v` prints the version (`index.js:11-20`, using commander's `program.opts()` and taking the first key as the command) |
| Prompts | **`prompts`** (not inquirer), with a `FRAMEWORKS` list in `prompts.js` |
| Templates | **Three, that's all**: `template-vue-ts-prettier`, `template-vue-ts-prettier-form-table` (with a generic form/table), `template-react-ts-prettier` |
| Colours | `kolorist` |
| Version | 1.0.9 |

---

## Bullet 2: feature-driven architecture + custom ESLint rules enforcing module boundaries ⭐

> v40 text: Led the React 18 and TypeScript architecture for Digital OS, the team's core consumer-facing product, enforcing feature boundaries with custom ESLint rules.

### Where to look ⭐ (all in Prometheus)
- **Directory layout**: under `src/` there is `app/`, `features/`, `components/`, `hooks/`, `lib/`, `types/`, `utils/`, `testing/`. Each `features/*` then splits into `api/` and `components/`.
- **The boundary rules**: `.eslintrc.cjs:126-172` (`import/no-restricted-paths`, 5 zones)
- **The dependency direction diagram**: `.eslintrc.cjs:116-124` (drawn in a comment)
- **Naming conventions**: `.eslintrc.cjs:261-269` (kebab-case file names), `282-288` (kebab-case folders)
- **Enforced import order**: `.eslintrc.cjs:205-220`

### How to tell it
- **The core idea of feature-driven**: organise code by business feature, not by technical type.
  - ❌ Traditional: `components/` + `hooks/` + `services/` + `redux/`, where one feature change spans 4 directories
  - ✅ Feature: `features/blog/` (containing its own api and components), where one feature is closed inside one directory
- **Why enforce it with ESLint?**: convention alone does nothing. Sooner or later someone writes `import '../comments/xxx'` inside `features/blog`, and a few months later it's spaghetti. ESLint puts a red squiggle in the IDE the moment it happens and blocks the merge in CI — it turns the convention into a hard constraint.
- **What the 5 zones actually say** (walk through `.eslintrc.cjs:129-170`):
  1. `features/blog` may not import another feature
  2. `features/comments` may not import another feature
  3. `features/theme` may not import another feature
  4. `features/*` may not import `app/` (features are used by the layer above; they shouldn't know about it)
  5. `components/hooks/lib/types/utils` is the bottom layer and may not import `features/` or `app/` back up

### Likely follow-ups
- **What if two features need to share logic?** → Push it down into `components/` or `lib/`, or compose it up in `app/`. Never sideways.
- **Why not a monorepo (Nx/Turborepo)?** → The team isn't big enough and the build complexity doesn't justify it. ESLint zones are "monorepo isolation, lightweight".
- **Why also turn on `import/no-cycle`?** → Circular dependencies make module initialisation order undefined, and you can end up holding `undefined`. See `.eslintrc.cjs:174-182`.
- **Why force kebab-case file names?** → Cross-platform consistency (macOS is case-insensitive, Linux isn't) plus a visual distinction from component names (PascalCase), so you can see at a glance that this is a file and not an identifier.
- **What is this architecture based on?** → bulletproof-react (alan2207/bulletproof-react); Prometheus's README says so.

---


## Bullet 3 (historical): three TanStack Query layers + cache invalidation + hover prefetch ⭐

> v40 text: Layered TanStack Query in three tiers — API functions, queryOptions factories, typed hooks — single-source cache keys, mutation-driven invalidation, route preloading and hover prefetch: detail-page LCP under 500 ms.

### Where to look ⭐ (this is the best-covered bullet in Prometheus)

#### The three layers — three examples
| Layer | File | Lines |
|---|---|---|
| Paged query | `features/blog/api/get-posts.ts` | API fn: `50-54` / queryOptions: `72-77` / hook: `96-104` |
| Single query | `features/blog/api/get-post.ts` | API fn: `30-32` / queryOptions: `34-43` / hook: `50-55` |
| Infinite query | `features/blog/api/get-infinite-posts.ts` | API fn: `39-40` / infiniteQueryOptions: `54-66` / hook: `77-78` |

#### One source for the cache key
- `queryKey: ['posts', options]` inside `getPostsQueryOptions` (`get-posts.ts:74`) — **the queryKey is defined only in the queryOptions; the component layer never writes one.**
- So when the queryKey definition changes, everything referencing it follows automatically, and you never get the classic bug where two places each write their own key and the cache silently misses.

#### Mutations trigger invalidation
- Example: `features/comments/api/create-comment.ts:96-98`
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['comments', postId] });
}
```
- A comment is created → invalidateQueries → React Query marks `['comments', postId]` stale → any hook on the page using that key refetches automatically → the UI updates. **No manual state update.**

#### The QueryConfig / MutationConfig type helpers
- `src/lib/react-query.ts:74-86` (`ApiFnReturnType`), `91-99` (`QueryConfig`), `116-127` (`MutationConfig`)
- What they do: let a caller override part of the `queryOptions` (`enabled`, `staleTime`) but **not `queryKey` / `queryFn`** (excluded with `Omit`).
- The TS features used: `Awaited<ReturnType<T>>`, `Omit<X, K>`, `satisfies` (see the QueryClient config at `react-query.ts:52`).

#### Route-level preloading
❌ Prometheus doesn't do this yet (it could — prefetching in React Router 7's `loader` or `route.lazy`). This part **can only be told from memory of BioMap**: there, `queryClient.prefetchQuery(queryOptions)` ran before the route transition.

#### Hover prefetch ⭐
- `features/blog/components/post-card.tsx:76-84` (the `prefetchPost` function)
- `features/blog/components/post-card.tsx:97` (`onMouseEnter={prefetchPost}`)
- The reasoning is in the comment at the top of `post-card.tsx` (lines 30-60):
  1. The pointer hovers (usually 200–500ms before the click)
  2. `queryClient.prefetchQuery(getPostQueryOptions(slug))` fetches and writes into the cache
  3. The user actually clicks → the route changes → the detail page's `usePost(slug)` hits the same fresh cache → mounting sends no second request

### How to tell it (for the deeper version of the question)
- **Why prefetchQuery instead of fetching it yourself?** → The result goes straight into the React Query cache, and the detail page's useQuery hits it through the same queryKey. No bridge to build.
- **Does prefetchQuery always send a request?** → No; it consults `staleTime` and reuses a fresh cache entry. A fast click, failed prefetch, or stale entry can still require network access, so "zero requests" is not a guarantee for every click.

### Likely follow-ups
- **staleTime vs gcTime?** → staleTime is how long before data is considered stale (default 0, so any mount refetches); gcTime is how long the cache survives before collection (default 5min). Prometheus sets staleTime to 1 minute at `react-query.ts:50`.
- **Part of the cache key is an object — why does it still hit?** → React Query compares queryKeys deeply, not by reference. So `['posts', { page: 1 }]` from two different calls hits the same cache entry.
- **Can an infinite query and a paged query share a queryKey?** → **No.** That's why `get-infinite-posts.ts:56` deliberately adds an `'infinite'` prefix, so the two caches can't overwrite each other.
- **Doesn't hover prefetch waste bandwidth?** → When a user hovers without clicking, yes. But hover→click converts well in practice, and a stale entry in the cache is a few dozen KB. You can tune it further with a `hoverDelay` (only prefetch after, say, 100ms).
- **What is LCP and how do you measure it?** → Largest Contentful Paint, the render time of the largest content element above the fold. Measured with Chrome DevTools Performance or the web-vitals library. The target is <2.5s (Core Web Vitals); with a cache hit, this project is close to 0.

---


## Bullet 4: a Radix UI component library + Storybook + CVA + an MSW mock layer ⭐

> v40 text: Built a design system on Radix UI, Storybook and CVA, plus an MSW mock layer that let frontend delivery run independent of backend progress.

### Where to look ⭐ (all in Prometheus)

#### Radix UI and accessibility
- `src/components/ui/dialog/index.tsx` (the whole file) — Dialog is the most complete example of Radix usage: Portal, Overlay, Content, Title, Description, Close, and the `data-[state=open]` attribute selector driving the animation
- `src/components/ui/button/index.tsx:49-51` (`Slot`, for polymorphic `asChild`)
- The key ideas are explained in detail in the comment at `dialog/index.tsx:1-63` (how Radix primitives divide the work: behaviour belongs to the library, styling belongs to the developer)

#### Type-safe variants with CVA
- `src/components/ui/button/index.tsx:69-112` (the `buttonVariants` definition)
- `src/components/ui/button/index.tsx:127-132` (`ButtonProps` pulling the variant types out with `VariantProps<typeof buttonVariants>`)
- `src/components/ui/badge/index.tsx:31-50` (Badge's CVA — a simpler example)

#### Storybook
- `.storybook/main.ts` (all of it) — configuration (the stories glob, addons, framework)
- `.storybook/preview.ts` (all of it) — global config (pulling in Tailwind CSS, backgrounds, control matchers)
- `src/components/ui/button/button.stories.tsx` (all of it) — 7 stories covering variant + size + disabled
- `src/components/ui/badge/badge.stories.tsx` (all of it) — includes a `render` function showing AllVariants
- `src/components/ui/dialog/dialog.stories.tsx` (all of it) — includes the accessibility case with an sr-only title

#### MSW + @mswjs/data
- `src/testing/mocks/db.ts:42-66` (the `models` definitions: `post` and `comment`)
- `src/testing/mocks/db.ts:69` (`factory(models)` creating the in-memory database)
- `src/testing/mocks/db.ts:85-106` (loadDb — localStorage in the browser, a file in Node)
- `src/testing/mocks/db.ts:125-130` (persistDb — writing back after a change)
- `src/testing/mocks/handlers/posts.ts` / `comments.ts` / `tags.ts` (the handler definitions)
- `src/testing/mocks/browser.ts` (browser-side setup)
- `src/testing/mocks/server.ts` (Node-side setup — for tests)

### How to tell it

#### Why Radix + Tailwind + CVA are layered this way
- **Radix**: owns accessibility, keyboard navigation, state, Portal, focus trapping. These are extremely hard to get right yourself.
- **Tailwind**: owns styling. Utility classes avoid the runtime cost of CSS-in-JS and the naming collisions of plain CSS.
- **CVA**: owns "several visual variants of the same component". The traditional way is a pile of if/else building a className; CVA turns the variants into a declarative object and lets you derive the TS types back out through `VariantProps<typeof buttonVariants>` (`variant: 'default' | 'destructive' | ...`).
- The three together are **the official shadcn/ui pattern**. Prometheus follows it exactly.

#### What MSW is
- Traditional mocking: `mockjs` in development, `jest.mock` in tests — two sets of logic.
- **MSW's core idea**: a **Service Worker** intercepts real `fetch/XHR` requests, so the application code has no idea it's being mocked. The same handler code runs in development and in tests.
- **What @mswjs/data adds**: real CRUD behaviour behind the mock (not just fixed responses), which makes tests more realistic.

#### What decoupling frontend from backend actually buys
- The backend has agreed the API schema but hasn't built it → the frontend mocks it with MSW and finishes the business logic anyway
- At integration time the mock is switched off (`enableMocking()` is controlled in `main.tsx`) and the application code moves to the real backend with zero changes
- **The result: frontend and backend genuinely run in parallel, and nobody is "waiting on the API"**

### Likely follow-ups
- **CVA vs tailwind-variants / stitches?** → CVA is the lightest (className assembly plus type inference, nothing else); tailwind-variants is more specifically optimised for Tailwind; stitches is CSS-in-JS and has a runtime. This project uses CVA because it has zero runtime.
- **Why does Radix ship no styles?** → The headless UI philosophy: the library owns behaviour and accessibility, the developer keeps full control of styling. It avoids the pain of "I want to change one small thing and I can't".
- **Will MSW's Service Worker intercept real requests in production?** → No. `enableMocking()` is only called in development (usually gated on `import.meta.env.DEV`). The production build never registers the Service Worker.
- **Why @mswjs/data instead of Faker?** → They're used together: `@mswjs/data` provides the database behaviour (CRUD, constraints) and `@ngneat/falso` (see `package.json:20`) generates the fake data to fill it. See `src/testing/data-generators.ts`.
- **What is Storybook's `autodocs` tag?** → With `tags: ['autodocs']`, Storybook generates a Docs page automatically, assembling argTypes and stories into documentation. See `button.stories.tsx:38`.
- **When do you use args in a story and when render?** → args for simple components (it renders `<Component {...args} />` for you); render for compound components that need several pieces put together, like Dialog (see `dialog.stories.tsx`).

---

---

## Checklist to run the night before

**The BioMap repos (Bullet 1)**

- [ ] Open `biomap-web-lims/src/views/sop/sop-edit/index.vue` and, without reading the comments, explain: the global `window.luckysheet` plus the bare div, and the two-way bridge of context menu → Vue modal → `setCellValue()`
- [ ] Be able to say why `sheet.data` is set to `undefined` before saving
- [ ] Be able to explain the three layers of protection forced by "there is no resize API": a 600ms debounce + treating a width change under 20px as jitter + `isInit`
- [ ] `biomap-cli`: be clear on `bcli -c` / `-i`, the three templates, and what repeated work it removed

**Prometheus (Bullets 2–4)**

- [ ] Open `.eslintrc.cjs` and, without reading the comments, say what each of the 5 zones is
- [ ] Open `get-posts.ts` and explain what the three layers are and why they're split that way
- [ ] Open `create-comment.ts` and explain how `invalidateQueries` refreshes things automatically
- [ ] Open `post-card.tsx` and explain the timing of hover prefetch (hover → prefetch → click → cache hit)
- [ ] Open `button/index.tsx` and explain CVA's `variants` / `VariantProps` / `Slot` (asChild)
- [ ] Open `dialog/index.tsx` and explain Radix's Portal / Overlay / focus management
- [ ] Open `db.ts` and explain `@mswjs/data`'s `factory + models` and persistence across the browser and Node
- [ ] Run `yarn dev`, open the React Query DevTools, hover a card yourself and confirm the prefetch fires
- [ ] Run `yarn storybook` and open all 3 stories

---

## The one part that still won't hold

**Route-level preloading (the `route preloading` in Bullet 3)** — Prometheus only does hover prefetch; route-level preload was never built. On BioMap it was `queryClient.prefetchQuery(queryOptions)` before the route transition, so this one can only be told from memory, with no line number to point at.
