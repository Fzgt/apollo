---
title: "③ TanStack Query: one cache identity"
section: BioMap
---

# ③ TanStack Query: one cache identity

> **Resume line**
>
> Layered TanStack Query in three tiers — **API functions, queryOptions factories, typed hooks** — **single-source cache keys, mutation-driven invalidation and hover prefetch**: detail pages open instantly, with no request at all.

## Terms, in one line each

**Server state** — data that comes from an API and is truly owned by the server. **A different category from component UI state**: it expires, it needs deduplication, it needs resynchronising.

**Query key** — the key the cache identifies data by, usually an array such as `['posts', slug]`. **Same key, same cache entry.**

**queryFn** — the function that actually fetches.

**queryOptions factory** — a function that binds `queryKey` and `queryFn` together into one config. **This tier is the heart of the line.**

**Stale / fresh** — whether cached data is still within its `staleTime`. **Fresh means no refetch.**

**Prefetch** — fetching into the cache before the user needs it.

**Invalidate** — mark a group of cache entries stale so live queries resynchronise themselves. **It is not "refetch now".**

**Mutation** — a write request that changes server data.

## What this line has to show

**Three tiers are worth nothing by themselves** — anyone can split code into three files. What is worth something: **the list, the detail page, the prefetch and the invalidation all reuse one query identity.**

The same resource is always described by the same key and the same queryFn, which is the only way the cache is reliably hit. **Land the emphasis on how the middle tier locks the identity down**, not on "I made three layers".

## Why not fetch in useEffect

API data is **server state**, not component state. It has an async lifecycle, a cache, expiry, **deduplication** needs, and resynchronisation on window refocus.

`useEffect` can certainly fetch, but it **forces every page to rewrite loading, error, cancellation and race handling — each in its own way.** You end up with different versions of the same data on different pages and nobody able to say which is right.

## What each tier does

```ts
// Tier 1: HTTP only, knows nothing about React
const fetchPost = (slug: string): Promise<Post> => http.get(`/posts/${slug}`);

// Tier 2: binds key and fn into this resource's single identity
export const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ['posts', slug],
    queryFn: () => fetchPost(slug),
    enabled: Boolean(slug),
  });

// Tier 3: what components use — note the config type
type PostQueryConfig = Omit<
  ReturnType<typeof postQuery>,
  'queryKey' | 'queryFn'          // ← identity removed from what a caller may set
>;

export const usePost = (slug: string, config?: PostQueryConfig) =>
  useQuery({ ...postQuery(slug), ...config });
```

**The `Omit` in tier three is the thing to talk about.** A caller can tune **behaviour** — `enabled`, `select`, `staleTime` — **and has no way whatsoever to quietly swap the resource identity on one page.**

**That sentence is the one to memorise: it turns "everyone remembers to use the same key" from a discipline into something that cannot be done.**

## Why the key must have one source

The cache identifies data by key. **If the card prefetch writes `['posts', slug]` and the detail page hand-writes `['post', slug]`, those are two unrelated cache entries**: the prefetch looks successful, the detail page still fetches from scratch, **and nothing errors.**

**The reverse is worse**: same key, different response — a filter parameter left out of the key, say — **crosses data between contexts.** So the key is derived from business identity, **contains every parameter that affects the response, and is constructed in exactly one place.**

## What hover prefetch actually does

Hovering a card triggers one `prefetchQuery` **using the options from the same factory**. Between the pointer settling and the click there is **typically two or three hundred milliseconds to half a second** — enough to pull the data into the cache.

When the user clicks, the route changes and the detail page mounts its hook, **the key matches exactly, the data is still fresh, and the component reads the cache** rather than issuing a second request on mount.

**That is precisely what "with no request at all" means: no second request on the detail page.** It **does not promise** zero network in every case — **a click faster than the prefetch, a failed prefetch, or data already stale** all still go to the network. **Volunteer those three; it looks far better than being asked.**

## Does prefetchQuery always fetch?

**No.** It checks `staleTime` to decide whether what it has is fresh enough. The project sets `staleTime` globally to **60 seconds**, disables refetch on window focus and disables automatic retries, so **repeated hovers within 60 seconds do not refetch.**

The value of this question: **it separates "I configured a prefetch" from "I know when the prefetch actually happens".**

## Why mutations only invalidate

After a successful mutation, **the cache is invalidated by resource prefix** rather than each page's state being synchronised by hand.

**`invalidate` says "this group is no longer trustworthy"**, and live queries resynchronise by their own rules. **Writing the cache by hand (`setQueryData`) only suits responses whose shape is fully determined**, and it easily misses a derived list — **and the missed list keeps showing stale data until the user reloads.** Invalidation is more conservative and much harder to get wrong.

## Background

**`staleTime` versus `gcTime`.** **`staleTime` is freshness**: how long before a refetch is needed. **`gcTime` is retention**: how long the entry survives in memory once no component is observing it. **One decides whether to refetch, the other when to collect.** In v4 `gcTime` was called `cacheTime`; just recognise the old name if it comes up.

**Why keys are hierarchical.** A hierarchical key can target one post precisely **and act on a prefix in bulk**: marking everything under `['posts']` stale is one line. Flat string keys cannot do that.

**`invalidate` versus `refetch`.** **`invalidate` marks data stale**, and whether a request actually goes out depends on live state and configuration; **`refetch` commands one query to run now.** After a mutation, saying "the old data is invalid" is far more maintainable than imperative refreshes scattered around.

**Does prefetching waste bandwidth?** **Yes** — a user may hover without clicking. You can add a short delay before triggering, enable it only on high-click-through entry points, or gate it on response size and network conditions. Also, **`onMouseEnter` only serves mouse users; tabbing to a card is the same signal of intent, so `onFocus` belongs there too** — raising that unprompted shows you thought about accessibility.

## The 30-second answer

> I layered server data in three tiers: API functions that only do HTTP, queryOptions factories that bind queryKey and queryFn into a resource's single identity, and typed hooks for components. The tier count is not the point — the factory is. The hook's config type uses Omit to remove queryKey and queryFn from what a caller may set, so the list, the detail page and the hover prefetch can only reuse the same identity and nobody can swap the key on one page. Hovering a card prefetches into the cache; clicking through to the detail page hits the same key and, while it is still fresh, issues no second request. After a mutation I invalidate by resource prefix and let live queries resynchronise, instead of each page maintaining its own copy of the state.

## Self-check

1. Can you say exactly what the config type's `Omit` prevents?
2. Can you explain that "no request at all" means no second request on the detail page, and name the three cases where it does not hold?
3. Can you say that `prefetchQuery` respects `staleTime` rather than always fetching?
4. Can you distinguish `staleTime`, `gcTime`, `invalidate` and `refetch`?
5. Can you explain why two mismatched key spellings produce no error at all?
6. Can you raise `onFocus` and prefetch waste unprompted?
