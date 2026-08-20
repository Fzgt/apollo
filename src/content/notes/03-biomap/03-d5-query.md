---
title: "③ TanStack Query 三层"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# server state 这条怎么答赢

> 🔴 **必看**。**BioMap 四条里面试价值最高的一条**——server state 管理是前端高频区，这套结构能直接搬到任何项目。
>
> ✅ 简历里 `LCP under 500 ms` 已换成 `detail pages open instantly, with no request at all`。**为什么原来那个指标不成立、现在这句凭什么成立，见 [Day 1 #3](/docs?section=biomap&item=n03-lcp)。** 参照实现在 Prometheus，不是 BioMap 本体。

## 先立住（开场定调）

> 「client state 是你说了算的——弹窗开没开、表单填了什么。**server state 不是：它的真身在服务器上，你手里只有一份可能已经过期的副本。** 所以它天然带一堆问题：什么时候重新拉、拉的时候要不要显示旧数据、多个组件要同一份数据要不要发两次请求、改完之后哪些副本该作废。用 `useState` + `useEffect` 手写这套，**就是在每个组件里重新发明一个缓存系统**。」

## 三层是哪三层

```ts
// features/blog/api/get-posts.ts —— 一个文件导出三样东西
export const getPosts = (o = {}) => api.get('/api/posts', { params: o });        // :50 纯函数
export const getPostsQueryOptions = (o = {}) =>                                  // :72 ⭐ 枢纽
  queryOptions({ queryKey: ['posts', o], queryFn: () => getPosts(o) });
export const usePosts = ({ options = {}, queryConfig } = {}) =>                  // :96 Hook
  useQuery({ ...getPostsQueryOptions(options), ...queryConfig });
```

| 层 | 买到什么 |
|---|---|
| API 函数 | **不依赖 React**——能单独测、能在 loader/脚本/SSR 里直接调 |
| **queryOptions 工厂** | ⭐ **同一份配置被三个入口复用**：`useQuery` / `prefetchQuery` / `ensureQueryData` |
| Hook | 组件层最简洁的用法，类型全推导好 |

> **在组件里直接写 `useQuery`，第二层就不存在了——而预取的收益全靠第二层。**

## ⭐ 为什么集中管 queryKey（题眼）

```
列表页预取写   ['post', slug]
详情页读取写   ['posts', slug]     ← 多了个 s
```

**结果：预取照样发请求、照样写缓存，但详情页一个字节都读不到，还得自己再发一次。用户看不出区别，你白打了一倍请求。**

> **所以这不是代码整洁问题，是「预取到底生不生效」的问题。**

**代码里不是靠自觉，是靠类型**（`lib/react-query.ts:98-101`）：

```ts
export type QueryConfig<T> = Omit<ReturnType<T>, 'queryKey' | 'queryFn'>;
```

调用方能覆盖 `enabled`、`staleTime`，但 **`queryKey`/`queryFn` 在类型层面被 `Omit` 掉了，传进去直接编译报错**。

> 和 [四态机](/docs?section=beyz&item=d3-statemachine)、[Stripe 的 `ne(Lifetime)`](/docs?section=beyz&item=n02b-convergence) 同一个思想：**把「不该发生的事」从「靠自觉」变成「做不到」。**

**生产级**：用 **key factory**（`postKeys.all / lists() / detail(slug)`），收益是**失效粒度可控**——`invalidateQueries({ queryKey: postKeys.lists() })` 只作废列表不动详情。

## invalidate vs refetch

**先讲状态模型**：

| 态 | 含义 |
|---|---|
| **fresh** | 在 `staleTime` 内，**组件挂载也不重新请求** |
| **stale** | 过了 `staleTime`，触发条件满足时后台重新请求 |
| **inactive** | 没有组件在用，等 `gcTime` 到了被回收 |

| | 做什么 | 什么时候发请求 |
|---|---|---|
| **`invalidateQueries`** | 把匹配的缓存**标记为 stale** | **只有当前有组件在用时**才立刻后台请求 |
| **`refetch`** | **立刻重新请求**这一条 | 无条件 |

> ⭐ **核心区别：invalidate 是「声明这份数据不可信了」，refetch 是「现在就去拿」。前者是声明式的**——你不需要知道现在哪些组件在用它。**这正是为什么 mutation 之后该用 invalidate。**

**什么时候用别的**：用户点刷新 → `refetch`；已经知道新值不想再发请求 → `setQueryData`；要即时反馈可回滚 → **乐观更新**（`onMutate` 里 `cancelQueries` + `setQueryData`，`onError` 回滚）。**提乐观更新要能说代价**：回滚逻辑自己写，失败时用户看到内容"跳回去"，**所以只在成功率高、即时感重要的场景用**。

## staleTime vs gcTime

| | 控制什么 | 默认 |
|---|---|---|
| **`staleTime`** | 数据多久后被认为"可能过期" → **要不要重新请求** | **0** |
| **`gcTime`** | 没人用的缓存多久后被删 → **占不占内存** | **5 分钟** |

> **一句话：`staleTime` 管新鲜度，`gcTime` 管生命周期。数据可以是 stale 但还在缓存里**（所以你能立刻看到旧数据，同时后台在刷新）。

| 设错 | 后果 |
|---|---|
| `staleTime: 0`（默认） | 每次挂载都重新请求，**页面来回切就一直打接口** |
| `staleTime` 太长 | 数据改了用户看不到 |
| `gcTime` 太短 | 返回上一页**又是白屏 + loading**，失去"秒回" |
| `gcTime` 太长 | 内存涨 |

> ⚠️ **`retry: false` 要能自圆**：注释写的是"开发阶段关闭方便调试"。**生产该开 + 指数退避**——被问到照实说。

## hover prefetch 会不会浪费

```ts
// post-card.tsx:84-85, :97
const prefetchPost = () => queryClient.prefetchQuery(getPostQueryOptions(post.slug));
<motion.article onMouseEnter={prefetchPost} ...>
```

**hover 是意图信号**：鼠标停到卡片到真正点下去通常还有 200–500 ms，这段时间白白浪费了。

**诚实答案：会浪费一部分**（扫过一排卡片会触发一排预取）。**但代价没想象中大**：`staleTime` 兜住重复（fresh 的不发请求）、预取的是几 KB 详情、**不 `await`** 所以不阻塞任何 UI。

**生产级三条**（代码注释自己就指出了第一条）：**用 `ensureQueryData` 而不是 `prefetchQuery`**（前者缓存命中就不发请求，更符合"预取"语义）、**加 100ms hover 延迟**挡掉"扫过"只留"停留"、**看 `navigator.connection`** 弱网或省流量下不预取。（另外 `onFocus` 也预取，键盘用户同样受益。）
