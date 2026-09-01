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

## 先把词说清

**server state（服务端状态）**：来自接口、真正的主人在服务器上的那部分数据。**和组件自己的 UI state 是两类东西**——它会过期、要去重、要重新同步。

**query key（查询键）**：缓存里认数据的那把钥匙，通常是个数组，比如 `['posts', slug]`。**key 相同 = 同一份缓存。**

**queryFn**：真正去取数据的那个函数。

**queryOptions 工厂**：把 `queryKey` 和 `queryFn` 绑在一起产出配置的函数。**这条 bullet 的核心就在这一层。**

**stale（陈旧） / fresh（新鲜）**：缓存里的数据是否还在 `staleTime` 之内。**fresh 就不重新请求。**

**prefetch（预取）**：在用户真正需要之前先把数据取回缓存。

**invalidate（失效）**：把一组缓存标记成 stale，让还活着的查询自己去重新同步。**它不是「立刻重新请求」。**

**mutation（写操作）**：增删改这类会改变服务端数据的请求。

## 这条要讲清什么

**三层本身不值钱**，任何人都能把代码分成三个文件。值钱的是：**列表、详情、预取、失效这四条路径复用同一份 query identity（查询身份）。**

同一个资源永远由同一个 key 和同一个 queryFn 描述，缓存才可能被稳定命中——**讲这条 bullet 的时候，重点要落在中间那一层怎么把身份锁死**，而不是「我分了三层」。

## 为什么不用 useEffect 发请求

接口数据是 **server state**，不是组件状态。它有异步生命周期、有缓存、会过期、需要**并发去重（deduplication）**、窗口重新聚焦之后要重新同步。

`useEffect` 当然能发请求，但它**逼着每个页面自己重写一遍 loading、error、取消和竞态处理，而且各写各的**。最后同一份数据在不同页面有不同的版本，谁也说不清哪个是对的。

## 三层分别做什么

```ts
// 第一层：只管 HTTP，完全不认识 React
const fetchPost = (slug: string): Promise<Post> => http.get(`/posts/${slug}`);

// 第二层：把 key 和 fn 绑成这个资源的唯一身份
export const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ['posts', slug],
    queryFn: () => fetchPost(slug),
    enabled: Boolean(slug),
  });

// 第三层：交给组件用；注意这个配置类型
type PostQueryConfig = Omit<
  ReturnType<typeof postQuery>,
  'queryKey' | 'queryFn'          // ← 把身份从可配置项里删掉
>;

export const usePost = (slug: string, config?: PostQueryConfig) =>
  useQuery({ ...postQuery(slug), ...config });
```

**真正该讲的是第三层那个 `Omit`。**调用方能调 `enabled`、`select`、`staleTime` 这些**行为**，**但没有任何办法在某个页面里偷偷换掉资源身份**。

**这一句是三层里最该背下来的——它把「大家记得用同一个 key」从一条纪律变成了一件做不到的事。**

## 为什么 key 必须只有一个来源

缓存靠 key 认数据。**如果卡片预取写成 `['posts', slug]`，详情页手写成 `['post', slug]`，那就是两份互不相干的缓存**：预取看起来成功了，详情页照样从零发请求，**而且没有任何报错**。

**反过来更危险**：key 相同但响应不同——比如漏了一个会影响结果的筛选参数——**会直接串数据**。所以 key 要从业务身份出发，**把所有影响响应的参数都放进去，而且只在工厂里生成一次**。

## hover prefetch 具体发生了什么

鼠标停到卡片上时触发一次 `prefetchQuery`，**用的是同一个工厂产出的 options**。从鼠标停下到真正点下去，**通常有两三百毫秒到半秒**，这段时间用来把数据取回缓存。

用户点击、路由跳转、详情页挂载调用那个 hook 的时候，**key 完全一致，数据还 fresh，组件直接读缓存**，不会为了挂载再发第二个请求。

**简历里 `with no request at all` 的准确含义就是这一句：详情页不再发第二个请求。**它**不承诺**任何情况下都零网络——**用户点得比预取快、预取失败、或者数据已经 stale** 的时候，仍然会走网络。**这三种情况要主动说出来，比被问出来好看得多。**

## prefetchQuery 自己每次都会发请求吗

**不会。**它按 `staleTime` 判断已有数据够不够新。项目里全局把 `staleTime` 配成 **60 秒**、关掉窗口聚焦重取、关掉自动重试，所以缓存里那份还在 60 秒内的话，**重复 hover 不会重新拉**。

这一问的价值在于：**它区分了「我配了 prefetch」和「我知道 prefetch 什么时候真的发生」。**

## mutation 为什么只做 invalidate

mutation 成功之后**按资源前缀让缓存失效**，而不是手工去同步每个页面的状态。

**`invalidate` 表达的是「这组缓存不再可信」**，然后由当前活跃的查询按规则重新同步。**手工改缓存（`setQueryData`）只适合响应结构完全确定的场景**，而且很容易漏掉某个派生列表——**漏掉的那个列表会一直显示旧数据，直到用户刷新**。失效更保守，也更难写错。

## 概念补充

**`staleTime` 和 `gcTime` 的区别。** **`staleTime` 管新鲜度**：数据多久之内不需要重新获取。**`gcTime` 管留存**：没有任何组件在观察这份缓存之后，它还能在内存里待多久。**一个决定要不要重新请求，一个决定什么时候被回收。**v4 里 `gcTime` 叫 `cacheTime`，v5 才改的名，被问到旧名字时能对上就行。

**query key 为什么要分层。** 层级 key 既能精确命中某一篇文章，**也能按前缀批量处理**：让 `['posts']` 前缀下的所有查询一起标记过期，一行就够。扁平的字符串 key 做不到这件事。

**`invalidate` 和 `refetch` 的区别。** **`invalidate` 先把数据标成 stale**，是否真的重新请求由活跃状态和配置决定；**`refetch` 是命令某个查询立刻再执行一次**。mutation 之后表达「旧数据失效」比到处命令式刷新更容易维护。

**预取会不会浪费流量。** **会**，用户可能 hover 了并不点。可以加一个短延迟再触发、只对点击率高的入口开、或者按响应体积和网络状况决定。另外 **`onMouseEnter` 只照顾鼠标用户，键盘 Tab 到卡片同样是意图信号，`onFocus` 也该加上**——主动提这一条能显示你想过无障碍。

## 30 秒回答

> 我把服务端数据分成三层：API 函数只管 HTTP，queryOptions 工厂把 queryKey 和 queryFn 绑成资源的唯一身份，类型化 hook 交给组件用。层数不是重点，重点是工厂——hook 的配置类型用 Omit 把 queryKey 和 queryFn 从可配置项里删掉了，所以列表、详情和 hover prefetch 只能复用同一份身份，没人能在某个页面里换掉 key。卡片 hover 时预取写进缓存，用户点进详情页命中同一个 key，只要还 fresh 就不再发第二个请求。mutation 成功后按资源前缀让缓存失效，让活跃查询自己重新同步，而不是每个页面各维护一份状态。

## 英文怎么说

「服务端状态」是 **server state**，别说 remote data。「同一份查询身份」说 **one query identity, reused by the list, the detail page, the prefetch and the invalidation**。`Omit` 那一层说 **the config type omits queryKey and queryFn, so a caller can tune behaviour but cannot swap the identity**。简历那句要主动限定：**"no request at all" means no second request on the detail page — not zero network in every case**。区别说 **invalidate marks it stale; refetch commands it to run now**。

**术语对照**：服务端状态 server state ／ 查询身份 query identity ／ 缓存键 cache key ／ 并发去重 deduplication ／ 陈旧/新鲜 stale / fresh ／ 预取 prefetch ／ 失效 invalidate ／ 写操作 mutation ／ 派生列表 derived list ／ 垃圾回收时间 gcTime ／ 乐观更新 optimistic update。

## 自检

1. 能否说清那个配置类型的 `Omit` 到底防住了什么？
2. 能否准确解释 `no request at all` 是「详情页没有第二个请求」，并说出它不成立的三种情况？
3. 能否说出 `prefetchQuery` 受 `staleTime` 影响，而不是每次都发请求？
4. 能否区分 `staleTime`、`gcTime`、`invalidate` 和 `refetch`？
5. 能否说出两个 key 写法不一致时，为什么完全没有报错？
6. 能否主动提出 `onFocus` 和预取浪费这两个缺口？
