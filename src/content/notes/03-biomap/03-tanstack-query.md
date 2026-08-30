---
title: "③ TanStack Query：一份缓存身份"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ③ TanStack Query：一份缓存身份

> **简历原句**
>
> Layered TanStack Query in three tiers — **API functions, queryOptions factories, typed hooks** — **single-source cache keys, mutation-driven invalidation and hover prefetch**: detail pages open instantly, with no request at all.
>
> ---
>
> 将 TanStack Query 分为 **API 函数、queryOptions 工厂、类型化 hooks** 三层，通过**单一缓存键、mutation 驱动失效和 hover prefetch**，让详情页打开即展示，且不再发请求。

## 这条要讲清什么

三层本身不值钱。值钱的是：列表、详情、预取、失效四条路径复用**同一份 query identity**。同一个资源永远由同一个 key 和同一个 queryFn 描述，缓存才可能被稳定命中。

## 第一层：必须答顺

### 1. 为什么不用 `useEffect` 发请求？

接口数据是 **server state**，不是组件状态。它有异步生命周期、缓存、过期、并发去重、窗口重新聚焦后的重新同步。`useEffect` 能发请求，但会逼着每个页面自己重写一遍 loading、error、取消、竞态处理，而且各写各的，最后同一份数据在不同页面有不同版本。TanStack Query 把这些收进一个统一缓存。

### 2. 三层分别做什么？

```ts
// 第一层：API function —— 只管 HTTP，不认识 React
export const getPost = (slug: string): Promise<Post> => {
  return api.get(`/api/posts/${slug}`);
};

// 第二层：queryOptions 工厂 —— 把 key 和 queryFn 绑成资源的唯一身份
export const getPostQueryOptions = (slug: string) => {
  return queryOptions({
    queryKey: ['posts', slug],
    queryFn: () => getPost(slug),
    enabled: !!slug,
  });
};

// 第三层：typed hook —— 交给组件用
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

关键在 `QueryConfig` 这个类型：

```ts
export type QueryConfig<T extends (...args: never[]) => unknown> = Omit<
  ReturnType<T>,
  'queryKey' | 'queryFn'
>;
```

它把 `queryKey` 和 `queryFn` 从可配置项里**删掉**。调用方能调 `enabled`、`select`、`staleTime` 这些行为，但**没有办法在某个页面里偷偷换掉资源身份**。这是三层里最该讲的一句。

### 3. 为什么 key 必须只有一个来源？

缓存靠 key 认数据。如果卡片预取写 `['posts', slug]`，详情页手写成 `['post', slug]`，或者参数顺序不一样，那就是两份互不相干的缓存——预取看起来成功了，详情页照样从零发请求。

反过来，key 相同但响应不同（比如漏了会影响结果的筛选参数），会串数据。所以 key 要从业务身份出发，把所有影响响应的参数放进去，而且只在工厂里生成一次。

### 4. hover prefetch 具体发生了什么？

```tsx
<article
  onMouseEnter={() => queryClient.prefetchQuery(getPostQueryOptions(post.slug))}
  onClick={() => navigate(paths.post.getHref(post.slug))}
>
```

鼠标停到卡片上，到真正点下去，通常有 200–500ms。这段时间用来把数据取回缓存。用户点击、路由跳转、详情页挂载调用 `usePost(slug)` 时，key 完全一致，数据还 fresh，组件**直接读缓存，不为挂载再发第二个请求**。

简历里 "with no request at all" 的准确含义就是这个：**详情页不再发第二个请求**。不是承诺任何情况下都零网络——用户点得比预取快、预取失败、或数据已经 stale 时，仍然会走网络。这句话面试时要主动说清楚，比被问出来好。

### 5. `prefetchQuery` 自己每次都会发请求吗？

不会。它按 `staleTime` 判断已有数据够不够新。全局配置：

```ts
export const queryConfig = {
  queries: {
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 1000 * 60,   // 60 秒内视为新鲜
  },
} satisfies DefaultOptions;
```

缓存里那份还在 60 秒内，重复 hover 不会重新拉。

### 6. mutation 为什么只做 invalidate，不手工同步每个页面？

```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['comments', postId] });
},
```

`invalidate` 表达的是"这组缓存不再可信"，然后由当前活跃的查询按规则重新同步。手工改缓存（`setQueryData`）只适合响应结构完全确定的场景，而且很容易漏掉某个派生列表。失效更保守，也更难写错。

## 第二层：概念补充

### `staleTime` 和 `gcTime` 的区别？

`staleTime` 管**新鲜度**：数据多久之内不需要重新获取。`gcTime` 管**留存**：没有任何组件在观察这份缓存之后，它还在内存里待多久。一个决定要不要重新请求，一个决定什么时候被回收。

> v4 里 `gcTime` 叫 `cacheTime`，v5 改的名。被问到旧名字时能对上即可。

### query key 为什么要分层？

层级 key 既能精确命中 `['posts', slug]`，也能按前缀批量处理：`invalidateQueries({ queryKey: ['posts'] })` 会把所有 posts 相关的查询一起标记过期。扁平的字符串 key 做不到这件事。

### invalidate 和 refetch 的区别？

`invalidate` 先把数据标成 stale，是否真的重新请求由活跃状态和配置决定；`refetch` 是命令某个查询立刻再执行一次。mutation 之后表达"旧数据失效"比到处命令式刷新更容易维护。

### 预取会不会浪费流量？

会。用户可能 hover 了并不点。可以加一个短延迟再触发、只对点击率高的入口开、或按响应体积和网络状况决定。另外 `onMouseEnter` 只照顾鼠标用户，键盘 Tab 到卡片同样是意图信号，`onFocus` 也该加上。

## 30 秒回答

> 我把服务端数据分成三层：API 函数只管 HTTP，queryOptions 工厂把 queryKey 和 queryFn 绑成资源的唯一身份，typed hook 交给组件用。层数不是重点，重点是工厂——`QueryConfig` 用 `Omit` 把 `queryKey` 和 `queryFn` 从可配置项里删掉，所以列表、详情和 hover prefetch 只能复用同一份身份，没人能在某个页面里换掉 key。卡片 hover 时预取写进缓存，用户点进详情页命中同一个 key，只要还 fresh 就不再发第二个请求。mutation 成功后按资源前缀 invalidate，让活跃查询自己重新同步，而不是每个页面各维护一份状态。

## 自检

1. 能否说清 `QueryConfig` 的 `Omit` 到底防住了什么？
2. 能否准确解释 "no request at all" 是"详情页没有第二个请求"，并说出它不成立的三种情况？
3. 能否说出 `prefetchQuery` 受 `staleTime` 影响，而不是每次都发请求？
4. 能否区分 `staleTime`、`gcTime`（v4 的 `cacheTime`）、invalidate 和 refetch？
5. 能否主动提出 `onFocus` 和预取浪费这两个缺口？
