---
title: "③ TanStack Query: one cache identity"
section: BioMap
---

# ③ TanStack Query: one cache identity

> **Resume line**
>
> Layered TanStack Query in three tiers — **API functions, queryOptions factories, typed hooks** — **single-source cache keys, mutation-driven invalidation and hover prefetch**: detail pages open instantly, with no request at all.

## What this line has to show

Three tiers are worth nothing on their own; anyone can split code into three files. What is worth something is that four paths — the list, the detail page, the prefetch and the invalidation — reuse one query identity. The same resource is always described by the same key and the same query function, which is the only way a cache hit becomes reliable. So the weight of this line sits on how the middle tier locks that identity down, not on "I made three layers".

## Why not fetch in useEffect

API data is server state, not component state. It has an async lifecycle, it is cached, it goes stale, it needs deduplication across concurrent callers, and it needs re-syncing when the window regains focus.

`useEffect` can certainly fire a request, but it forces every page to rewrite loading, error, cancellation and race handling — each page slightly differently. You end up with different versions of the same data on different screens and no way to say which one is right. TanStack Query pulls all of that into one cache.

## What the three tiers do

The first tier is the API function. It only does HTTP: give it a slug, get a promise. It knows nothing about React.

The second tier is the `queryOptions` factory. It binds the query key and the query function together into the resource's one identity, and it is also where defaults like `enabled` live.

The third tier is a typed hook for components. It spreads the factory's result into `useQuery` and lets the caller layer config on top.

The part actually worth talking about is the config type that third tier uses. It is the factory's return type with `queryKey` and `queryFn` omitted. So a caller can tune `enabled`, `select`, `staleTime` — behaviour — but has no way to quietly swap the resource identity on one page.

That is the sentence to memorise. It turns "everyone remembers to use the same key" from a discipline into something that cannot be done wrong.

## Why the key must have one source

The cache identifies data by key. If the card prefetch writes `['posts', slug]` and the detail page hand-writes `['post', slug]`, or the two put parameters in a different order, those are two unrelated caches: the prefetch appears to succeed and the detail page still fetches from scratch, with no error anywhere.

The reverse is worse. Same key, different response — because a filter parameter that affects the result was left out — serves the wrong data. So the key is derived from the business identity, includes every parameter that changes the response, and is built in exactly one place: the factory.

## What hover prefetch actually does

Hovering a card triggers a prefetch using options from that same factory. Between the mouse settling and the actual click there is usually two to five hundred milliseconds, and that window is spent pulling the data into the cache.

When the user clicks, the route changes and the detail page mounts and calls the hook, the key matches exactly and the data is still fresh, so the component reads the cache instead of firing a second request on mount.

That is precisely what "with no request at all" means: no second request on the detail page. It does not promise zero network in all cases — if the user clicks faster than the prefetch, if the prefetch failed, or if the data has gone stale, it goes to the network. Volunteer those three cases; it reads far better than being caught on them.

## Does prefetchQuery always fetch

No. It respects `staleTime`. The project sets a global `staleTime` of sixty seconds, turns off refetch on window focus and turns off automatic retries, so if the cached copy is under a minute old, hovering again does not refetch.

The value of this question is that it separates "I configured a prefetch" from "I know when the prefetch actually happens".

## Why mutations only invalidate

After a mutation succeeds, the cache is invalidated by resource prefix rather than hand-synced page by page.

Invalidation says "this group of cached data can no longer be trusted", and the currently active queries re-sync themselves. Writing to the cache by hand only works when the response shape is fully determined, and it is very easy to miss a derived list — and the list you miss keeps showing stale data until the user reloads. Invalidation is more conservative and much harder to get wrong.

## Background

**`staleTime` versus `gcTime`.** `staleTime` is about freshness: how long the data is trusted without refetching. `gcTime` is about retention: how long the cached entry survives in memory once nothing is observing it. One decides whether to refetch, the other decides when to collect. In v4 `gcTime` was called `cacheTime`; v5 renamed it. Just recognise the old name if it comes up.

**Why keys are hierarchical.** A layered key can be hit exactly for one post and also handled in bulk by prefix — invalidating everything under `posts` is one call. A flat string key cannot do that.

**Invalidate versus refetch.** Invalidate marks the data stale and lets active state and config decide whether a request actually goes out; refetch commands one query to run again now. After a mutation, saying "the old data is no longer valid" is easier to maintain than imperative refreshes scattered around.

**Does prefetching waste bandwidth.** Yes — a user may hover and never click. You can add a short delay before firing, enable it only on high-click-through entry points, or gate it on payload size and connection quality. Also, `onMouseEnter` only serves mouse users; tabbing to a card with the keyboard is the same signal of intent, so `onFocus` deserves the same treatment. Raising this yourself shows you thought about accessibility.

## The 30-second answer

> I split server data into three tiers: the API function does HTTP only, the queryOptions factory binds the key and the fetcher into the resource's one identity, and a typed hook hands it to components. The tier count is not the point — the factory is. The hook's config type omits the key and the fetcher, so the list, the detail page and the hover prefetch can only reuse the same identity; nobody can swap the key on one page. Hovering a card writes the data into the cache, and when the user opens the detail page it hits the same key and, while still fresh, fires no second request. After a mutation I invalidate by resource prefix and let the active queries re-sync themselves, instead of every page maintaining its own copy of the state.

## Self-check

1. Can you say exactly what the config type's `Omit` prevents?
2. Can you explain that "no request at all" means "no second request on the detail page", and name the three cases where it does not hold?
3. Can you explain that `prefetchQuery` respects `staleTime` rather than always fetching?
4. Can you distinguish `staleTime`, `gcTime`, invalidate and refetch?
5. Can you raise the `onFocus` gap and the wasted-prefetch cost yourself?
