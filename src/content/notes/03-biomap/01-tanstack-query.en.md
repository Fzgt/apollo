---
title: "① The three TanStack Query tiers"
section: BioMap
---

# ① The three TanStack Query tiers

> **Resume line**
>
> **Layered TanStack Query in three tiers — API functions, queryOptions factories, typed hooks** — **single-source cache keys**, **mutation-driven invalidation** and **hover prefetch**: detail pages open instantly, **with no request at all**.

> ⚠️ **The reference implementation lives in the `Prometheus` repo, not in BioMap itself.** Say so plainly if asked: this is the shape I settled on in my own project.

## First, what this line is not about: "I used a data-fetching library"

Of the four BioMap lines this one is worth the most in an interview. Two reasons: server-state management comes up constantly in front-end interviews, and this structure transfers to any project unchanged.

Adopting TanStack Query only solves the caching mechanism itself. Three problems sit outside the mechanism, and the library does not own any of them:

- where the cache key (queryKey) is written, and who guarantees that every entry point writes the same one;
- once data has been changed, who is responsible for invalidating the stale caches;
- how you guarantee that data pulled by a prefetch is actually readable by the page that follows.

All three are questions about how the code is organised. That is what this bullet is about.

## The 30-second version

> Front-end state comes in two kinds. Whether a modal is open, what has been typed into a form — that is client state. A list of posts, a user profile — that is server state: the real thing lives on the server, and all I hold is a copy that may already be out of date.
>
> Because it is only a copy, it brings four problems: when should it be fetched again; while fetching, do I show the old data or a loading state; if three components want the same data at once, do I send three requests; and once the data changes, which copies become invalid.
>
> We put all of that on TanStack Query, and split every endpoint into three tiers: a plain API function, a queryOptions factory, and a typed hook.
>
> The middle tier is the hub. The three entry points — read, prefetch, route preload — share the one key and the one fetch function it exports. **Why sharing is mandatory**: if the queryKey is written out in two places and differs by even one letter, the data the prefetch wrote into the cache is unreadable from the detail page. The user cannot tell the difference, but the request count doubles. So we use TypeScript's `Omit` to lock `queryKey` down at the type level — anyone trying to pass their own gets a compile error.
>
> Combined with prefetch on hover, the data is already in the cache by the time the user clicks into the detail page, and not a single request goes out.

## 1. Why server state has to be treated as its own category

| | What it is | Who decides |
|---|---|---|
| **Client state** | Whether a modal is open, what is in a form, which tab is selected | **You do** — it only exists on this page |
| **Server state** | Post lists, user profiles, orders | ⭐ **The real thing is on the server; you hold a copy that may already be stale** |

**Because it is "only a copy", a pile of problems comes with it for free:**

- When should it be fetched again?
- While fetching, show the old data or show loading?
- Three components want the same data at once — three requests?
- After a change, which copies become invalid?

**Hand-writing those four things with `useState` plus `useEffect` means reinventing a cache system inside every component.** TanStack Query is the library that factors that out. But adopting the library is only step one; how the code is organised afterwards is what this bullet is actually about.

## 2. What the three tiers are

**One file exports three things:**

```ts
// Tier 1: the plain API function
export const getPosts = (options = {}) => api.get('/api/posts', { params: options });

// Tier 2: the options factory
export const getPostsQueryOptions = (options = {}) =>
  queryOptions({
    queryKey: ['posts', options],     // ⭐ what this data is called
    queryFn: () => getPosts(options), // ⭐ how to go and get it
  });

// Tier 3: the hook components use
export const usePosts = ({ options = {}, queryConfig } = {}) =>
  useQuery({ ...getPostsQueryOptions(options), ...queryConfig });
```

**First, what a `queryKey` (cache key) is**: TanStack Query keeps an internal cache table, and ⭐ **the `queryKey` is this data's key into that table**. Two places using the same key read the same cache entry; different keys mean two unrelated pieces of data.

| Tier | What it buys | 
|---|---|
| **API function** | ⭐ **No React dependency** — it can be unit tested on its own, called from a router's data preloader, or called from a script |
| **Options factory** | ⭐ **One config reused by three entry points**: `useQuery` (read), `prefetchQuery` (prefetch), `ensureQueryData` (ensure present) |
| **Hook** | The tersest thing to use at the component layer, with types fully inferred |

⭐ **The middle tier is the hub. Writing `useQuery` directly inside a component means tier two does not exist — and every bit of the prefetch payoff depends on tier two.**

## 3. ⭐ Why the queryKey may only be written in one place (the point of the question)

**Suppose the key is written in two places:**

```
written by the list page's prefetch   ['post', slug]
written by the detail page's read     ['posts', slug]     <- an extra s
```

**Result**: the prefetch still fires, still writes its result into the cache — ⭐ **but the detail page turns a different key in the lock and reads nothing at all, so it has to fetch again itself.**

⭐ **The user cannot tell the difference, and you have doubled your request count for nothing. So "the key is defined in exactly one place" is not a tidiness question, it is the question of whether the prefetch works at all.**

**In the code this is not left to discipline; the type system enforces it:**

```ts
export type QueryConfig<T> = Omit<ReturnType<T>, 'queryKey' | 'queryFn'>;
```

**`Omit` is a TypeScript utility type meaning "take this type and drop the named fields".**

So callers can override `enabled`, `staleTime` and the rest, ⭐ **but `queryKey` and `queryFn` have been removed at the type level — passing them is a compile error.**

> **This is the same idea as [② Architecture boundaries](/docs?section=biomap&item=architecture-boundaries), [the four-state machine at Beyz](/docs?section=beyz&item=credential-quota) and [the lifetime-purchase protection in Stripe](/docs?section=beyz&item=stripe-billing): turn "must not happen" from a matter of discipline into something that cannot be expressed.**

**Production grade**: manage keys through a **key factory** (`postKeys.all` / `postKeys.lists()` / `postKeys.detail(slug)`). ⭐ **What that buys is control over invalidation granularity** — you can invalidate only the list and leave the detail alone.

## 4. The difference between invalidate and refetch

**Start with the state model** — TanStack Query tags every cache entry one of three ways:

| State | Meaning |
|---|---|
| **fresh** | Still within the window set by `staleTime`, so **it is considered current** — mounting a component does not refetch |
| **stale** | Past `staleTime`, so **it may be out of date** — refetched in the background when a trigger condition is met |
| **inactive** | No component is currently using it — dropped once `gcTime` elapses |

| | What it does | When a request actually goes out |
|---|---|---|
| **`invalidateQueries`** | **Marks** the matching cache entries **stale** | **Only if a component is using it right now** does it refetch immediately in the background; otherwise it waits until next use |
| **`refetch`** | **Refetches this one entry immediately** | Unconditionally, right now |

⭐ **The core difference: invalidate declares "this data is no longer trustworthy", refetch says "go get it now".**

⭐ **The former is declarative — you do not need to know which components are currently using the data; the library decides whether to fetch now. That is exactly why invalidate is the right call after a mutation.**

```ts
onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', postId] });
```

**Comment posted → the comment list is marked stale → any component currently showing that list refetches on its own.**

**When to use something else:**

| Situation | What to use |
|---|---|
| Refresh related content after a mutation | **`invalidateQueries`** ✅ |
| The user pressed a "Refresh" button | `refetch` |
| **You already know the new value and do not want another request** | `setQueryData` — write the new value straight into the cache |
| You need instant feedback with a rollback on failure | **Optimistic update** |

> **What an "optimistic update" is**: when the user likes something, **pretend it succeeded first** (update the UI immediately), then send the request, and **undo it if it fails**.
>
> ⭐ **If you bring it up, be ready to state the cost**: you have to write the rollback yourself, and on failure the user watches the content "jump back" — **so use it only where the success rate is high and immediacy matters** (likes, ticking off a to-do).

## 5. What goes wrong when `staleTime` and `gcTime` are set wrong

| | What it controls | What it cares about | Default |
|---|---|---|---|
| **`staleTime`** | How long before data is considered possibly out of date | **Whether to refetch** | **0** (stale immediately) |
| **`gcTime`** | How long an unused cache entry survives before deletion | **Memory** | **5 minutes** |

⭐ **In one line: `staleTime` governs freshness, `gcTime` governs lifetime.**

⭐ **Data can be "stale but still cached" — which is what lets you see the old data instantly (no blank screen) while a refresh runs in the background.**

| Set wrong | Consequence |
|---|---|
| **`staleTime: 0` (the default)** | Every mount refetches — **flipping between pages hammers the API continuously** |
| `staleTime` too long | Data changes and the user does not see it without a manual refresh |
| **`gcTime` too short** | The entry is dropped the moment nobody uses it, so **going back a page means a blank screen and a spinner again**, losing the instant-return feel |
| `gcTime` too long | Memory grows; a long session accumulates piles of unused data |

**The project sets it to 1 minute**, on the grounds that blog-style content does not change often. It also **turns off refetch-on-window-focus**.

> ⚠️ **One thing you need an answer for**: `retry: false` (no retry on a failed request) — the comment says "disabled during development to make debugging easier". **Production should have it on, with exponential backoff. If asked, say so straight.**

## 6. Does hover prefetch waste requests?

```ts
const prefetchPost = () => queryClient.prefetchQuery(getPostQueryOptions(post.slug));
<article onMouseEnter={prefetchPost} onClick={跳转}>
```

**The idea** (this is called **hover prefetch**): from the moment the pointer lands on a card to the actual click there is **usually 200–500 milliseconds**. That window is otherwise wasted, **so use it to pull the detail data early** — ⭐ **by the time the user clicks through, the data is already in the cache, not a single request goes out, and the page renders content directly. That is the literal meaning of `with no request at all` in the resume.**

### The honest answer: some of it is wasted

**A user sweeping across a row of cards triggers a prefetch on each one. But the cost is smaller than it looks, for three reasons:**

1. **`staleTime` absorbs the repeats** — anything already cached and still fresh returns from the prefetch without a request
2. **What is prefetched is detail data, usually a few KB**
3. ⭐ **Nothing waits on it** — a failed prefetch blocks no UI, and if the user really does open the detail page it goes through the normal loading / error path

### Three production-grade improvements

| Change | What it fixes |
|---|---|
| ⭐ **Switch to `ensureQueryData`** | `prefetchQuery` **fires a request whether or not the cache has the data**; `ensureQueryData` **only fires when the entry is missing or stale** — closer to what "prefetch" should mean |
| **Add a 100 ms delay** | Only prefetch once the pointer has rested for 100 ms, **filtering out "swept past" and keeping "paused on"** |
| **Look at the connection** | Turn it off entirely on a weak connection or in data-saver mode |

**Also**: prefetch on `onFocus` too, ⭐ **so keyboard users tabbing through get the same benefit** — that sentence goes down well in interviews, because most people only think about the mouse.

## 7. ⚠️ Two phrases in this bullet could not be defended (now changed)

**The original read** `route preloading and hover prefetch: detail-page LCP under 500 ms`. **Both were cut:**

| Phrase | Problem |
|---|---|
| `route preloading` | ⚠️ **Nothing to point at in the code** — only hover prefetch was built; the route-level version exists solely in a doc comment |
| `detail-page LCP under 500 ms` | ⚠️ **The metric does not even apply in an SPA**, and there is no measurement instrumentation in the code |

### ⭐ Why LCP does not apply here (this section is good interview material on its own)

**LCP (Largest Contentful Paint)** is Google's performance metric: **how long from the start of page load until the largest piece of content in the viewport has rendered.** The official thresholds are read at the 75th percentile: ≤2.5 s is good, >4 s is poor. **So 500 ms is "very fast" — and precisely because it looks good, it invites follow-up questions.**

⭐ **The fatal problem: LCP's clock starts when the browser begins loading a page.** This is an SPA — **clicking a link to the detail page does not reload the page**, JavaScript simply swaps the components on screen. **That kind of "soft navigation" produces no new LCP value.**

| How you reach the detail page | Is there an LCP | Does hover prefetch help |
|---|---|---|
| **Typing the URL / arriving from outside** (a real page load) | ✅ Yes | ❌ **No** — the user never passed through the list page |
| **Clicking through from the list** (soft navigation) | ❌ **No new LCP** | ✅ **Yes** |

⭐ **Hover prefetch optimises exactly the path that produces no LCP.**

**None of this makes the bullet false** — prefetching really does make detail pages open instantly, and the user's experience of that is real. ⭐ **The problem was attaching that experience to "LCP", a name with a strict definition.**

**Why `with no request at all` is better**: **it is a fact you can prove by pointing at code** — the prefetch put the data into the cache, and the detail page hits it with the same key. **One provable sentence replaced two unprovable ones.**

### If asked "how did you measure it"

**Five audit questions for any performance number; failing any one of them means the number is made up:**

| Question | What the answer must contain |
|---|---|
| **What tool measured it** | **Lab data** (Lighthouse, the performance panel) or **field data** (`web-vitals` reporting, CrUX)? **This distinction is the core of it** |
| **In what environment** | Lighthouse defaults to 4× CPU throttling plus slow 4G on mobile. **The same page can differ threefold between mobile and desktop** |
| **How large a sample** | Lab data swings a lot on a single run, so **take the median of at least 5**; field data is read at the **75th percentile** (the official convention, not the mean) |
| ⭐ **What was it before** | **The most important one** — **without a baseline the number just says "this page was always fast" and has nothing to do with your architecture** |

## Glossary

| 中文 | English |
|---|---|
| 服务端状态 ↔ 客户端状态 | **server state ↔ client state** |
| 副本 | **copy** (*you only hold a possibly-stale copy*) |
| 缓存键 | **cache key / queryKey** |
| 单一来源 | **single source** (*single-source cache keys*) |
| 三层 | **three tiers** (*layered in three tiers*) |
| 工厂函数 | **factory** (*queryOptions factory*) |
| 类型化 hook | **typed hook** |
| 新鲜 ↔ 过时 | **fresh ↔ stale** |
| 无人使用 / 待回收 | **inactive** |
| 失效 | **invalidate · invalidation** (*mutation-driven invalidation*) |
| 重新请求 | **refetch** |
| 声明式的 | **declarative** (*invalidate is declarative; refetch is imperative*) |
| 写入缓存 | **prime / set the cache** (`setQueryData`) |
| 乐观更新 | **optimistic update** |
| 回滚 | **roll back** |
| 预取 | **prefetch** (*hover prefetch*) |
| 缓存命中 | **cache hit** ↔ **miss** |
| 垃圾回收时间 | **gcTime** (formerly `cacheTime`) |
| 指数退避 | exponential backoff |
| 软导航 | **soft navigation** (needed for the LCP section) |
| 实验室数据 ↔ 真实用户数据 | **lab data ↔ field data** (RUM) |
| 分位数 | **percentile** (*the 75th percentile*) |
| 基线 | **baseline** (⭐ *no baseline, no claim*) |

> ⭐ **The three easiest to get wrong**:
>
> 1. "Stale but still in the cache" is **stale but still cached** — stale ≠ deleted, and that distinction is the core of that section
> 2. "Not a single request" is the resume's own phrase, **with no request at all**
> 3. When asked for a performance number, ask about its terms first: **lab or field? what percentile? what was the baseline?** — memorise those three
