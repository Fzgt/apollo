---
title: "③ TanStack Query: one source for cache rules"
section: BioMap
---

# ③ TanStack Query: one source for cache rules

> **Resume line**
>
> Layered TanStack Query in **three tiers — API functions, queryOptions factories, typed hooks** — with **single-source cache keys, mutation-driven invalidation and hover prefetch**: detail pages open instantly, with no request at all.

> ⚠️ **Version limit**: the BioMap work was in 2022. Here, “queryOptions factory” should mean a project function that returned `queryKey` and `queryFn`. Do not say the project used the v5 `queryOptions()` helper, because that helper appeared in 2023. `Prometheus` is a v5 example built in 2026 and only shows how the same idea can be written today.

## What this bullet needs to show

The important part is not the number of layers. Lists, detail pages, prefetching, and cache updates all use one query definition. When the key and request function come from one place, the detail page can find the data that was prefetched.

## First layer: answer these clearly

### 1. Why not use a separate `useEffect` on every page?

API data has loading, error, cache, expiry, repeated requests, and update problems. Handling all of this on each page creates repeated code and can leave different pages with different data. TanStack Query puts this work into one shared cache.

### 2. What did the three layers do?

- **API function** sent the request and returned data without depending on React.
- **Options factory** returned the `queryKey`, `queryFn`, and needed query settings.
- **Typed hook** gave the query to components and allowed safe settings.

For the 2022 work, the key point is this project structure, not the `queryOptions()` helper later added in v5.

### 3. Why should the query key have one source?

The cache uses the key to identify data. If card prefetching uses `['posts', slug]`, the detail page must use exactly the same key. Writing the key in two places can easily create two cache entries because of a different order, name, or parameter.

### 4. How did hover prefetch make the detail page faster?

When the user moved the pointer over a card, the code called `prefetchQuery`. If that request finished before the click, the detail page could read fresh data under the same key. It did not need to send a second request just because the page opened.

The resume phrase “with no request at all” should mean **no second request from the detail page**. The prefetch itself still uses the network when data is missing or stale.

### 5. Does `prefetchQuery` always send a request?

No. It checks whether cached data exists and is still fresh. Fresh data can be reused. The detail page may still need a request if the user clicks too quickly, the prefetch fails, or the data is already stale.

### 6. Why invalidate after a successful mutation?

After data is created or deleted, related cache data may be wrong. Invalidation marks the matching key as stale and lets active pages update under the query rules. Each page does not need to keep its own list in sync by hand.

## Second layer: useful concepts

### What is the difference between `staleTime` and cache storage time?

`staleTime` says how long data is fresh. Cache storage time says how long an unused query stays in memory. TanStack Query v4 called the second setting `cacheTime`; v5 renamed it to `gcTime`.

### What is the difference between invalidate and refetch?

Invalidate says the old data cannot be trusted and lets query state decide whether to fetch. Refetch directly asks the query to run again. After a mutation, saying “this cache is old” is usually easier to manage.

### Can prefetching waste network data?

Yes. A user may hover and never click. The project can add a short delay, prefetch only links with a high click rate, or decide based on data size and network quality.

## What we cannot prove from local code

- The BioMap TanStack Query source is not available, so we cannot check the old function names, keys, `staleTime`, or exact pages.
- The `QueryConfig`, posts example, and v5 helper in `Prometheus` are not BioMap code evidence.
- There is no 2022 measurement, so do not promise a fixed number of milliseconds or say every click has zero network use.

## 30-second answer

> I split server data into API functions, query option factories, and typed hooks. The factory kept the query key and request function in one place, and lists, detail pages, and hover prefetching all used it. After prefetching finished, the detail page read fresh cache data under the same key and sent no second request. After a successful mutation, I invalidated the related key so active data could update instead of each page managing its own copy.

## Self-check

1. Can I explain the job of each layer?
2. Can I explain why prefetching and the detail page must use the same key?
3. Can I explain “no request” as “no second request from the detail page”?
4. Can I separate the 2022 options factory from the v5 `queryOptions()` helper added in 2023?
5. Can I explain that v4 `cacheTime` and v5 `gcTime` are the old and new names for the same setting?
