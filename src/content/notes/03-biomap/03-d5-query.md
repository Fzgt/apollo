---
title: "③ TanStack Query 三层"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# 服务端数据这件事，为什么要单独管

> 🔴 **必看**。**BioMap 四条里面试价值最高的一条** —— 服务端状态管理是前端面试的高频区，这套结构能直接搬到任何项目。
>
> ⚠️ 参照实现在 `Prometheus` 那个仓库，**不是 BioMap 本体**。简历原来那句 `LCP under 500 ms` 已经删掉了，原因见 [③ LCP（已删）](/docs?section=biomap&item=n03-lcp)。

## 对应简历原句

> **Layered TanStack Query in three tiers — API functions, queryOptions factories, typed hooks** — single-source cache keys, mutation-driven invalidation and hover prefetch: detail pages open instantly, with no request at all.

## 一、⭐ 先立住：服务端状态和客户端状态是两种东西

| | 是什么 | 谁说了算 |
|---|---|---|
| **客户端状态** | 弹窗开没开、表单填了什么、选中哪个 tab | **你说了算** —— 它只存在于这个页面里 |
| **服务端状态** | 文章列表、用户资料、订单 | ⭐ **真身在服务器上，你手里只有一份可能已经过期的副本** |

**因为「只是一份副本」，它天然带一堆问题：**

- 什么时候该重新去拉？
- 拉的时候要不要先显示旧的，还是显示 loading？
- 三个组件同时要同一份数据，要发三次请求吗？
- 改完之后，哪些地方的副本该作废？

> ⭐ **用 `useState` + `useEffect` 手写这套，就是在每个组件里重新发明一个缓存系统。** TanStack Query 就是把这套抽出来的库。
>
> **但光引入库还不够 —— 引进来之后怎么组织代码，才是这条 bullet 在说的事。**

## 二、三层是哪三层

**一个文件导出三样东西**（`Prometheus/src/features/blog/api/get-posts.ts`）：

```ts
// 第 1 层：纯粹的 API 函数  :50-54
export const getPosts = (options = {}) => api.get('/api/posts', { params: options });

// 第 2 层：配置工厂  :72-77
export const getPostsQueryOptions = (options = {}) =>
  queryOptions({
    queryKey: ['posts', options],     // ⭐ 这份数据叫什么名字
    queryFn: () => getPosts(options), // ⭐ 怎么去拿到它
  });

// 第 3 层：给组件用的 Hook  :96-104
export const usePosts = ({ options = {}, queryConfig } = {}) =>
  useQuery({ ...getPostsQueryOptions(options), ...queryConfig });
```

**先解释 `queryKey` 是什么**：TanStack Query 内部有一个缓存表，**`queryKey` 就是这份数据在表里的钥匙**。两个地方用同一把钥匙，读到的就是同一份缓存；钥匙不一样，就是两份互不相干的数据。

| 层 | 买到什么 |
|---|---|
| **API 函数** | **不依赖 React** —— 能单独写测试、能在路由的数据预加载里调、能在脚本里调 |
| **配置工厂** | ⭐ **同一份配置被三个入口复用**：`useQuery`（读）、`prefetchQuery`（预取）、`ensureQueryData`（确保有） |
| **Hook** | 组件层最简洁的用法，类型全推导好了 |

> ⭐ **中间那层是枢纽。** 在组件里直接写 `useQuery`，**第二层就不存在了 —— 而预取的全部收益都靠第二层。**

## 三、⭐ 为什么 queryKey 必须只写在一处（题眼）

**假设钥匙写在两个地方：**

```
列表页预取时写   ['post', slug]
详情页读取时写   ['posts', slug]     ← 多了个 s
```

**结果**：预取照样发请求、照样把结果写进缓存 —— **但详情页拿着另一把钥匙去开，一个字节都读不到，只能自己再发一次。**

> ⭐ **用户看不出区别，你还白白多打了一倍请求。**
>
> **所以「钥匙只在一处定义」不是代码整洁问题，是「预取到底生不生效」的问题。**

**代码里不靠自觉，靠类型强制**（`lib/react-query.ts:98-101`）：

```ts
export type QueryConfig<T> = Omit<ReturnType<T>, 'queryKey' | 'queryFn'>;
```

**`Omit` 是 TypeScript 的工具类型，意思是「从这个类型里去掉指定的几个字段」。**

所以调用方能覆盖 `enabled`、`staleTime` 这些配置，**但 `queryKey` 和 `queryFn` 在类型层面被删掉了 —— 传进去直接编译报错。**

> **和 [Beyz 的四态机](/docs?section=beyz&item=d3-statemachine)、[Stripe 的终身档保护](/docs?section=beyz&item=n02b-convergence) 是同一个思想：把「不该发生的事」从「靠自觉」变成「做不到」。**

**生产级**：用一个 **key 工厂**统一管（`postKeys.all` / `postKeys.lists()` / `postKeys.detail(slug)`），**收益是失效粒度可控** —— 可以只作废列表，不动详情。

## 四、invalidate 和 refetch 差在哪

**先讲状态模型** —— TanStack Query 给每份缓存打三种标记：

| 状态 | 含义 |
|---|---|
| **fresh（新鲜）** | 还在 `staleTime` 设定的时间内，**被认为是新的** —— 组件挂载也不重新请求 |
| **stale（过时）** | 超过了 `staleTime`，**被认为可能旧了** —— 满足触发条件时后台重新请求 |
| **inactive（没人用）** | 当前没有组件在用它 —— 等 `gcTime` 到了被清掉 |

| | 做什么 | 什么时候真的发请求 |
|---|---|---|
| **`invalidateQueries`** | 把匹配的缓存**标记成过时** | **只有当前有组件正在用它时**才立刻后台请求；没人用就等下次被用到 |
| **`refetch`** | **立刻重新请求**这一条 | 无条件，马上 |

> ⭐ **核心区别：invalidate 是「声明这份数据不可信了」，refetch 是「现在就去拿」。**
>
> **前者是声明式的** —— **你不需要知道现在哪些组件在用这份数据**，库自己决定要不要立刻拉。**这正是为什么改完数据之后该用 invalidate。**

```ts
// create-comment.ts:96-98
onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', postId] });
```

**评论发布成功 → 评论列表标记为过时 → 正在显示列表的组件自动重新请求。**

**什么时候用别的：**

| 场景 | 用什么 |
|---|---|
| 改完数据刷新相关内容 | **`invalidateQueries`** ✅ |
| 用户点了「刷新」按钮 | `refetch` |
| **已经知道新值，不想再发请求** | `setQueryData` —— 直接把新值写进缓存 |
| 要即时反馈、失败能回滚 | **乐观更新** |

> **「乐观更新」是什么**：用户点赞时**先假装成功**（立刻改界面），再发请求，**失败了再改回去**。
>
> **提它要能说代价**：回滚逻辑要自己写，失败时用户会看到内容「跳回去」—— **所以只在成功率高、即时感重要的场景用**（点赞、勾选待办）。

## 五、`staleTime` 和 `gcTime` 设错了会怎样

| | 控制什么 | 关心的是 | 默认值 |
|---|---|---|---|
| **`staleTime`** | 数据多久后被认为「可能过期」 | **要不要重新请求** | **0**（立刻就算过期） |
| **`gcTime`** | 没人用的缓存多久后被删掉 | **占不占内存** | **5 分钟** |

> ⭐ **一句话：`staleTime` 管新鲜度，`gcTime` 管生命周期。**
>
> **数据可以「已过期但还在缓存里」** —— 所以你能立刻看到旧数据（不白屏），同时后台在刷新。

| 设错 | 后果 |
|---|---|
| **`staleTime: 0`（默认）** | 每次组件挂载都重新请求 —— **页面来回切就一直在打接口** |
| `staleTime` 太长 | 数据改了用户看不到，除非手动刷新 |
| **`gcTime` 太短** | 缓存刚没人用就被删，**返回上一页又是白屏 + loading**，失去「秒回」体验 |
| `gcTime` 太长 | 内存涨，长会话下累积一堆没人用的数据 |

**项目里设的是 1 分钟**，注释写了理由：博客这类内容变化不频繁。同时**关掉了「切回标签页就重新拉」**。

> ⚠️ **有一处要能自圆**：`retry: false`（请求失败不重试）—— 注释写的是「开发阶段关闭方便调试」。**生产环境该开，而且要配指数退避。** 被问到就照实说。

## 六、hover 预取会不会浪费请求

```ts
// post-card.tsx:84-85, :97
const prefetchPost = () => queryClient.prefetchQuery(getPostQueryOptions(post.slug));
<article onMouseEnter={prefetchPost} onClick={跳转}>
```

**思路**：鼠标停到卡片上，到真正点下去，**通常还有 200–500 毫秒**。这段时间白白浪费了，**用来提前把详情数据拉回来正好** —— 用户点进去时数据已经在缓存里，**一个请求都不发，页面直接出内容**。

### 诚实答案：会浪费一部分

**用户扫过一排卡片，每张都会触发一次预取。**

**但代价没想象中大，三条：**

1. **`staleTime` 兜住重复** —— 已经在缓存里且还新鲜的，预取直接返回不发请求
2. **预取的是详情数据，通常几 KB**
3. **不等它完成**（`:80-83` 注释写明了）—— 预取失败不阻塞任何界面，用户真进详情页时正常走 loading / error

### 生产级三条改进

**代码注释自己就指出了第一条**（`:44-47`）：

| 改法 | 解决什么 |
|---|---|
| **改用 `ensureQueryData`** | `prefetchQuery` **无论缓存里有没有都会发请求**；`ensureQueryData` **只在缓存里没有或已过期时才发** —— 更符合「预取」的语义 |
| **加一个 100 毫秒延迟** | 鼠标停留超过 100 毫秒才预取，**挡掉「扫过」只留「停留」** |
| **看网络状况** | 弱网或省流量模式下直接关掉 |

**另外**：`onFocus` 时也预取，**键盘 Tab 操作的无障碍用户同样受益**（注释 `:49-51` 提了）。
