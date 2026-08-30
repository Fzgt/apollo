---
title: "③ TanStack Query: three tiers and one cache identity"
section: BioMap
---

# ③ TanStack Query: three tiers and one cache identity

> **Resume line**
>
> Layered TanStack Query in **three tiers — API functions, queryOptions factories, typed hooks** — with **single-source cache keys, mutation-driven invalidation and hover prefetch**: detail pages open instantly, with no request at all.

> ⚠️ **Evidence boundary**: the verifiable implementation lives in my later personal project, `Prometheus`, not in the BioMap source available on this machine. I can discuss the architecture, but I should not call the reference repository the Digital OS production codebase.

## Establish this first: three tiers are not inherently impressive

The tiers only matter because list queries, detail queries, prefetching, and invalidation reuse one query identity. The same resource is always described by the same key and query function, so the cache can be hit reliably and declared stale precisely.

## First layer: answer these cleanly

### 1. Why use TanStack Query instead of putting requests in `useEffect`?

API data is server state: it has asynchronous status, caching, freshness, request deduplication, and resynchronisation concerns. `useEffect` can send a request, but every page then recreates loading, error, cancellation, cache, and race handling. TanStack Query puts that lifecycle into one shared cache.

### 2. What does each tier do?

- **API function** owns only HTTP input and output and knows nothing about React.
- **queryOptions factory** binds the `queryKey` and `queryFn` into the resource's canonical description.
- **typed hook** exposes the query to components with a limited set of behavioural options.

In the reference implementation, `QueryConfig` explicitly omits `queryKey` and `queryFn`. A caller can tune behaviour but cannot silently redefine the resource identity inside a page.

### 3. Why is the `queryOptions` factory the hub?

`useQuery`, hover prefetching, and other cache operations consume the same factory. If the detail key is `['posts', slug]`, card prefetching must generate exactly that key. Otherwise prefetching appears to work while the detail page creates a second cache entry and requests again.

### 4. What exactly happens when hover prefetch leads to no request?

The card's `onMouseEnter` calls `queryClient.prefetchQuery(getPostQueryOptions(slug))`. Once that completes, the detail page's `usePost(slug)` uses the same key. While that data remains fresh, the component reads the cache and does not send a second request merely because it mounted.

This is not a promise that every click produces zero network traffic. A click may beat the prefetch, the prefetch may fail, or the data may already be stale. The resume describes the successful warm-cache path.

### 5. Does `prefetchQuery` itself always send a request?

No. It uses `staleTime` to decide whether existing data is fresh enough. The reference implementation has a global `staleTime` of 60 seconds; prefetching a fresh entry does not fetch it again. The old note stated this incorrectly.

### 6. Why invalidate after a mutation instead of manually synchronising every page?

After a comment is created or deleted, the code invalidates `['comments', postId]`. That expresses “this cache group is no longer trustworthy”, allowing active queries to resynchronise under TanStack Query's rules. Manual cache edits suit cases where the new response shape is certain; invalidation is more conservative and less likely to miss derived lists.

## Second layer: only if they keep digging

### What is the difference between `staleTime` and `gcTime`?

`staleTime` controls how long data is considered fresh and therefore whether it needs another fetch. `gcTime` controls how long an unobserved cache entry is retained. One governs freshness; the other governs lifetime after nobody is using it.

### Why should query keys be hierarchical?

Hierarchical keys can identify one `['posts', slug]` entry precisely and also operate on a resource group by prefix. Keys should reflect business identity and include every parameter that changes the response. Different keys for the same data duplicate caches; the same key for different data mixes results.

### What is the difference between invalidate and refetch?

Invalidation first marks data stale, then active state and configuration determine whether it fetches. Refetch directly asks a query to execute again. After a mutation, expressing “the old data is invalid” is usually easier to maintain than issuing imperative refresh commands across pages.

## Current gaps

- The code I can verify line by line is `Prometheus`, not the Digital OS production repository.
- Hover only serves pointer users; the same intent signal should cover keyboard focus.
- Global `retry: false` is direct for development, but production needs a retry policy based on error type and network conditions.
- The reference project uses `prefetchQuery` from TanStack Query v5.32; the latest official guide has moved to `queryClient.query`, so an upgrade should follow the current API rather than preserving an old method name by habit.

## 30-second answer

> I separated server data into API functions, queryOptions factories, and typed hooks, but the important part was not the number of tiers. The options factory fixed the key and query function as one identity, and lists, details, and hover prefetching all reused it. Once prefetching completed and the cache was still fresh, the detail page mounted against the same key and sent no second request. Successful mutations invalidated the relevant resource prefix, so the cache resynchronised instead of every page maintaining its own copy.

## Self-check

1. Can I explain why the queryOptions factory is more central than the hook?
2. Can I state the conditions for “no request” without promising zero requests on every click?
3. Can I distinguish `staleTime`, `gcTime`, invalidation, and refetching?
4. Can I identify the current gaps in hover accessibility, retry policy, and API migration?
