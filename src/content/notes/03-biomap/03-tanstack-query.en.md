---
title: "③ TanStack Query: one cache identity"
section: BioMap
---

# ③ TanStack Query: one cache identity

> **Resume line**
>
> Layered TanStack Query in three tiers — **API functions, queryOptions factories, typed hooks** — **single-source cache keys, mutation-driven invalidation and hover prefetch**: detail pages open instantly, with no request at all.

## What this line has to show

Three tiers on their own are worth nothing. What matters is that four paths — list, detail, prefetch and invalidation — all reuse **the same query identity**. One resource is always described by the same key and the same query function. That is the only reason the cache can be hit reliably.

## Layer one: answer these without thinking

### 1. Why not just fetch in `useEffect`?

API data is **server state**, not component state. It has an async lifecycle, caching, staleness, deduplication of parallel requests, and re-syncing when the window regains focus. `useEffect` can send a request, but then every page rewrites loading, error, cancellation and race handling by hand — each one slightly differently — and the same data ends up in different versions on different pages. TanStack Query pulls all of that into one cache.

### 2. What does each tier do?

```ts
// Tier 1: API function — HTTP only, knows nothing about React
export const getPost = (slug: string): Promise<Post> => {
  return api.get(`/api/posts/${slug}`);
};

// Tier 2: queryOptions factory — binds key and query function into one identity
export const getPostQueryOptions = (slug: string) => {
  return queryOptions({
    queryKey: ['posts', slug],
    queryFn: () => getPost(slug),
    enabled: !!slug,
  });
};

// Tier 3: typed hook — what components use
type UsePostOptions = {
  slug: string;
  queryConfig?: QueryConfig<typeof getPostQueryOptions>;
};

export const usePost = ({ slug, queryConfig }: UsePostOptions) => {
  return useQuery({
    ...getPostQueryOptions(slug),
    ...queryConfig,
  });
};
```

The important piece is the `QueryConfig` type:

```ts
export type QueryConfig<T extends (...args: never[]) => unknown> = Omit<
  ReturnType<T>,
  'queryKey' | 'queryFn'
>;
```

It **removes** `queryKey` and `queryFn` from what a caller can configure. A page can still change behaviour — `enabled`, `select`, `staleTime` — but it **cannot quietly swap out the identity of the resource**. That is the one sentence to say about the three tiers.

### 3. Why must the key have a single source?

The cache finds data by key. If the card prefetches with `['posts', slug]` and the detail page hand-writes `['post', slug]`, or puts the arguments in a different order, those are two unrelated caches. The prefetch looks like it worked, and the detail page still fetches from scratch.

The opposite mistake also hurts: the same key with a different response — for example leaving out a filter that changes the result — mixes data together. So build the key from the business identity, include every argument that changes the response, and generate it in one place: the factory.

### 4. What actually happens on hover prefetch?

```tsx
<article
  onMouseEnter={() => queryClient.prefetchQuery(getPostQueryOptions(post.slug))}
  onClick={() => navigate(paths.post.getHref(post.slug))}
>
```

Between the mouse landing on a card and the actual click there is usually 200–500ms. That window is used to pull the data into the cache. When the user clicks, the route changes and the detail page calls `usePost(slug)`, the key matches exactly and the data is still fresh — so the component **reads the cache and sends no second request for the mount**.

That is what "with no request at all" means on the resume: **the detail page does not send a second request**. It is not a promise of zero network in every case. If the user clicks faster than the prefetch, if the prefetch fails, or if the data has gone stale, there is still a request. Say this yourself in the interview — better than being caught on it.

### 5. Does `prefetchQuery` always fetch?

No. It checks `staleTime` to decide whether what it already has is fresh enough. The global config:

```ts
export const queryConfig = {
  queries: {
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 1000 * 60,   // fresh for 60 seconds
  },
} satisfies DefaultOptions;
```

If the cached copy is under 60 seconds old, hovering again does not refetch.

### 6. Why does a mutation only invalidate instead of updating every page?

```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['comments', postId] });
},
```

`invalidate` says "this group of cached data can no longer be trusted", and the queries currently in use re-sync by the normal rules. Writing the cache by hand (`setQueryData`) only fits cases where you know the exact response shape, and it is easy to miss a derived list. Invalidation is the safer default and much harder to get wrong.

## Layer two: extra background

### `staleTime` versus `gcTime`

`staleTime` is about **freshness**: how long the data counts as current, so no refetch is needed. `gcTime` is about **retention**: how long a cache entry stays in memory after no component is watching it any more. One decides whether to fetch again, the other decides when it gets collected.

> In v4 `gcTime` was called `cacheTime`. It was renamed in v5. Just recognise the old name if they use it.

### Why should query keys be layered?

A layered key can be matched exactly, as `['posts', slug]`, or by prefix: `invalidateQueries({ queryKey: ['posts'] })` marks every posts query stale at once. A flat string key cannot do that.

### `invalidate` versus `refetch`

`invalidate` marks the data stale first, and whether a request actually goes out depends on what is active and how it is configured. `refetch` orders one query to run again right now. After a mutation, saying "the old data expired" is easier to maintain than issuing refresh commands all over the app.

### Does prefetching waste bandwidth?

Yes, sometimes. Users hover over things they never click. You can add a short delay before firing, only prefetch on high-click entry points, or decide based on response size and connection. Also, `onMouseEnter` only helps mouse users — tabbing to a card is the same intent signal, so `onFocus` deserves the same handler.

## The 30-second answer

> I split server data into three tiers. The API function only does HTTP. The queryOptions factory binds the query key and the query function into one identity for that resource. The typed hook is what components use. The tier count is not the point — the factory is. `QueryConfig` uses `Omit` to strip `queryKey` and `queryFn` out of what callers can set, so the list, the detail page and the hover prefetch are forced to reuse the same identity and nobody can swap the key inside one page. Hovering a card prefetches into the cache, and when the user opens the detail page it hits the same key and sends no second request while the data is fresh. After a mutation I invalidate by resource prefix and let the active queries re-sync themselves, instead of every page keeping its own copy of the state.

## Self-check

1. Can you explain exactly what the `Omit` in `QueryConfig` prevents?
2. Can you state that "no request at all" means "no second request from the detail page", and name the three cases where it does not hold?
3. Can you say that `prefetchQuery` respects `staleTime` rather than always fetching?
4. Can you tell apart `staleTime`, `gcTime` (v4's `cacheTime`), invalidate and refetch?
5. Can you raise the `onFocus` gap and the wasted-prefetch cost yourself?
