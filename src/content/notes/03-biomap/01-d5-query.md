---
title: "Day 5 · 必看 · TanStack Query 三层"
section: BioMap · Day 5
icon: microscope
day: 5
level: B
status: done
---

# Day 5 · 必看 · server state 这条怎么答赢

> 🔴 **必看**。回答 **Q1**（为什么不在组件里直接 `useQuery`）、**Q2**（为什么集中管 queryKey）、**Q3**（invalidation vs refetch）、**Q6**（`staleTime` vs `gcTime`）、**Q7**（hover prefetch 会不会浪费请求）。
>
> **这是 BioMap 四条里面试价值最高的一条**——server state 管理是前端面试的高频区，而且这套三层结构是能直接搬到任何项目的通用做法。

## 对应简历原句

BioMap 第 3 条 bullet（v40）：

> **Layered TanStack Query in three tiers — API functions, queryOptions factories, typed hooks** — single-source cache keys, mutation-driven invalidation, route preloading and hover prefetch: detail-page LCP under 500 ms。

> ⚠️ **`LCP under 500 ms` 那半句的口径问题在 [Day 1 #3](/docs?section=numbers&item=n03-lcp) 讲过了**（SPA 软导航不产生 LCP、代码里没有测量埋点），这里不重复。**参照实现在 `~/Desktop/projects/github/Prometheus`，不是 BioMap 本体。**

---

## 先立住：这条 bullet 在解决什么

**面试官不关心你用了什么库，关心你知不知道 server state 为什么特殊。**

**开场一句话定调：**

> 「client state 是你说了算的——弹窗开没开、表单填了什么。**server state 不是：它的真身在服务器上，你手里只有一份可能已经过期的副本。** 所以它天然带着一堆问题：什么时候重新拉、拉的时候要不要显示旧数据、多个组件同时要同一份数据要不要发两次请求、改完之后哪些副本该作废。用 `useState` + `useEffect` 手写这套，就是在每个组件里**重新发明一个缓存系统**。」

**这段讲完，后面所有设计都有了依据。**

---

## Q1：为什么不在每个组件里直接 `useQuery`

### ① 我当时怎么做的

一个文件导出三样东西（`Prometheus/src/features/blog/api/get-posts.ts`）：

```ts
// 第 1 层：纯 API 函数  :50-54
export const getPosts = (options = {}): Promise<PostsResponse> =>
  api.get('/api/posts', { params: options });

// 第 2 层：queryOptions 工厂  :72-77
export const getPostsQueryOptions = (options = {}) =>
  queryOptions({
    queryKey: ['posts', options],
    queryFn: () => getPosts(options),
  });

// 第 3 层：类型化 Hook  :96-104
export const usePosts = ({ options = {}, queryConfig } = {}) =>
  useQuery({ ...getPostsQueryOptions(options), ...queryConfig });
```

### ② 每一层各买到什么

| 层 | 买到什么 |
|---|---|
| **API 函数** | **不依赖 React**，可以单独测试、可以在 loader / 脚本 / SSR 里直接调 |
| **queryOptions 工厂** | ⭐ **同一份配置能被三个入口复用**：`useQuery` / `prefetchQuery` / `ensureQueryData` |
| **Hook** | 组件层最简洁的使用方式，类型全推导好 |

**中间那层是枢纽。** 组件里直接写 `useQuery` 的代价：

- **queryKey 散落各处** → 见 Q2，直接决定预取生不生效
- **预取和读取用不同的配置** → 预取写进缓存的数据，详情页读不到
- **改一次 queryFn 要改 N 处**

### ③ 生产级会怎么做

**这套结构本身就是生产级的**（它是 bulletproof-react 的标准模式）。真要往上加：

- **queryKey 用 factory 统一管理**（`postKeys.all` / `postKeys.detail(id)`），比字符串数组更抗重构
- **配合 codegen**：后端 OpenAPI 直接生成 API 函数层，**手写的只剩 queryOptions 和 hook**

> **一句话答法**：三层不是为了好看。API 函数不依赖 React 所以能单独测、能在路由 loader 里调；**queryOptions 独立成层，才能让预取和读取共用同一份 key 和 fn**；hook 只是给组件的糖。**在组件里直接写 useQuery，第二层就不存在了——而预取的收益全靠第二层。**

---

## Q2：为什么集中管理 queryKey（这一问是题眼）

### ② 原理：key 对不上，预取就白做

假设 queryKey 写在两个地方：

```
列表页预取时写   ['post', slug]
详情页读取时写   ['posts', slug]     ← 多了个 s
```

**结果是：预取照样发请求、照样写缓存，但详情页一个字节都读不到，还得自己再发一次。**

**用户看不出区别，你还白白多打了一倍请求。**

> **所以 queryKey 单一来源不是代码整洁问题，是「预取到底生不生效」的问题。**

### ① 代码里怎么强制的

不是靠自觉，是靠类型（`Prometheus/src/lib/react-query.ts:98-101`）：

```ts
export type QueryConfig<T extends (...args: never[]) => unknown> = Omit<
  ReturnType<T>,
  'queryKey' | 'queryFn'
>;
```

**调用方能覆盖 `enabled`、`staleTime` 这些配置，但 `queryKey` 和 `queryFn` 在类型层面被 `Omit` 掉了——传进去直接编译报错。**

> **这和 [Day 3 的四态机](/docs?section=beyz&item=d3-statemachine)、[Stripe 的 `ne(Lifetime)`](/docs?section=numbers&item=n02b-convergence) 是同一个思想：把「不该发生的事」从「靠自觉」变成「做不到」。** 三个项目串起来讲，是 Day 14 跨项目题的素材。

### ③ 生产级

**key factory** 是更强的形态：

```ts
const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (filters) => [...postKeys.lists(), filters] as const,
  detail: (slug) => [...postKeys.all, 'detail', slug] as const,
};
```

**收益是失效的粒度可控**：`invalidateQueries({ queryKey: postKeys.lists() })` 只作废列表、不动详情。

---

## Q3：invalidation 和 refetch 差在哪

**这一问答不好会显得只会用不懂原理。关键是讲清 TanStack Query 的状态模型。**

### ② 原理：fresh / stale / inactive 三态

| 概念 | 含义 |
|---|---|
| **fresh** | 数据在 `staleTime` 内，**被认为是新的**，组件挂载也不会重新请求 |
| **stale** | 过了 `staleTime`，**被认为可能过期**，触发条件满足时会后台重新请求 |
| **inactive** | 没有任何组件在用它，等 `gcTime` 到了就被垃圾回收 |

**两个动作的差别：**

| | 做什么 | 什么时候发请求 |
|---|---|---|
| **`invalidateQueries`** | 把匹配的缓存**标记为 stale** | **只有当前有组件在用它时**，才立刻后台重新请求；没人用就等下次被用到 |
| **`refetch`** | **立刻重新请求**这一条 | 无条件，马上 |

> **核心区别：invalidate 是「声明这份数据不可信了」，refetch 是「现在就去拿」。**
>
> **前者是声明式的**——你不需要知道现在哪些组件在用这份数据，TanStack Query 自己决定要不要立刻拉。**这正是为什么 mutation 之后该用 invalidate 而不是 refetch。**

### ① 代码里的用法

```ts
// Prometheus/src/features/comments/api/create-comment.ts:96-98
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['comments', postId] });
}
```

**评论发布成功 → 评论列表标记为 stale → 正在显示列表的组件自动重新请求。**

### ③ 生产级：什么时候该用别的

| 场景 | 用什么 |
|---|---|
| mutation 之后刷新相关数据 | **`invalidateQueries`** ✅ |
| 用户点「刷新」按钮 | `refetch` |
| **已经知道新值，不想再发请求** | **`setQueryData`** 直接写缓存 |
| 要即时反馈、失败可回滚 | **乐观更新**：`onMutate` 里 `cancelQueries` + `setQueryData`，`onError` 里回滚 |

**主动提乐观更新是加分项**，但要能说出它的代价：**回滚逻辑要自己写，而且失败时用户会看到内容"跳回去"**——所以只在成功率很高、即时感很重要的场景用（点赞、勾选）。

---

## Q6：`staleTime` 和 `gcTime` 设错了会怎样

**这两个最容易混，分清就赢了。**

```ts
// Prometheus/src/lib/react-query.ts:46-52
export const queryConfig = {
  queries: {
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 1000 * 60,      // 1 分钟
  },
} satisfies DefaultOptions;
```

| | 控制什么 | 关心的对象 |
|---|---|---|
| **`staleTime`**（默认 **0**） | 数据多久后被认为"可能过期" | **要不要重新请求** |
| **`gcTime`**（默认 **5 分钟**） | 没人用的缓存多久后被删掉 | **占不占内存** |

**一句话记住：`staleTime` 管新鲜度，`gcTime` 管生命周期。数据可以是 stale 但还在缓存里（所以你能立刻看到旧数据，同时后台在刷新）。**

### 设错各会怎样

| 设置 | 后果 |
|---|---|
| **`staleTime: 0`（默认）** | 每次组件挂载都重新请求。**页面来回切就一直在打接口** |
| **`staleTime` 太长** | 数据改了用户看不到，**除非手动刷新** |
| **`gcTime` 太短** | 缓存刚没人用就被删，返回上一页时**又是白屏 + loading**，失去了"秒回"的体验 |
| **`gcTime` 太长** | 内存涨，长会话下累积一堆没人用的数据 |

**代码里设 1 分钟的理由**（注释写了）：博客这类内容变化不频繁，1 分钟内不重复请求。**同时关掉了 `refetchOnWindowFocus`**——切标签页回来不重新拉。

> ⚠️ **`retry: false` 要能自圆**：注释写的是"开发阶段关闭方便调试"。**生产环境该开**，而且要配退避。被问到就照实说：「这个值是开发期设的，生产应该开重试加指数退避。」

---

## Q7：hover prefetch 会不会浪费请求

### ① 我当时怎么做的

```ts
// Prometheus/src/features/blog/components/post-card.tsx:84-85, :97
const prefetchPost = () => {
  queryClient.prefetchQuery(getPostQueryOptions(post.slug));
};
<motion.article onMouseEnter={prefetchPost} onClick={...}>
```

**hover 是个意图信号**：鼠标停到卡片上到真正点下去，通常还有 200–500 ms。**这段时间白白浪费了，用来提前拉数据正好。**

### ② 会不会浪费——诚实答案：会

**用户扫过一排卡片，每张都触发一次预取。**

**但代价没有想象中大，三条理由：**

1. **`staleTime` 兜住重复**——已经在缓存里且 fresh 的，`prefetchQuery` 直接返回不发请求
2. **预取的是详情数据，不是大资源**——通常几 KB
3. **不 `await`**（`:80-83` 的注释写明了）——预取失败不阻塞任何 UI

### ③ 生产级会怎么做

**代码注释自己就指出了改进方向（`post-card.tsx:44-47`）：**

> `prefetchQuery`：无论缓存里有没有，都会发起请求
> **`ensureQueryData`：只有缓存里没有 / stale 时才请求，更符合"预取"的语义**

**还有三条：**

| 做法 | 解决什么 |
|---|---|
| **加延迟**（hover 超过 ~100 ms 才预取） | 挡掉"扫过"，只留"停留" |
| **`onFocus` 也预取** | 键盘 Tab 的无障碍用户同样受益（注释 `:49-51` 也提了） |
| **看 `navigator.connection`** | 弱网或省流量模式下不预取 |

> **一句话答法**：会有一部分浪费——鼠标扫过一排卡片会触发一排预取。但 staleTime 会兜住重复请求，预取的又是几 KB 的详情数据，而且不 await 所以不阻塞任何东西。**要更严谨的话该用 `ensureQueryData` 而不是 `prefetchQuery`（前者缓存命中就不发请求），再加一个 100 毫秒的 hover 延迟挡掉"扫过"，弱网下直接关掉。**

---

## 一页速查

| 面试官问 | 赢的答法骨架 |
|---|---|
| 为什么不直接 `useQuery` | **queryOptions 那层是枢纽**——它让预取和读取共用 key 和 fn |
| 为什么集中管 queryKey | **key 对不上，预取就白做**（还多打一倍请求）；代码里用 `Omit` 在类型层面锁死 |
| invalidate vs refetch | **invalidate = 声明不可信（声明式）**，refetch = 现在就拿。mutation 后用前者 |
| staleTime vs gcTime | **新鲜度 vs 生命周期**；数据可以 stale 但还在缓存里 |
| retry: false 合理吗 | ⚠️ **开发期设的，生产该开 + 退避**——照实说 |
| hover prefetch 浪费吗 | **会有一部分** → staleTime 兜底 + 不 await；生产级用 `ensureQueryData` + hover 延迟 + 弱网关闭 |
| LCP 那个数字 | 见 [Day 1 #3](/docs?section=numbers&item=n03-lcp)——**SPA 软导航不产生 LCP，措辞要改** |
