---
title: "③ TanStack Query：三层和一份缓存身份"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ③ TanStack Query：三层和一份缓存身份

> **简历原句**
>
> 将 TanStack Query 分为 **API 函数、queryOptions 工厂、类型化 hooks** 三层，通过**单一缓存键、mutation 驱动失效和 hover prefetch**，让详情页打开即展示，且不再发请求。

> ⚠️ **证据边界**：这套可核对实现位于后来个人项目 `Prometheus`，不是本机 BioMap 源码。面试时可以讲架构选择，但不要把参考仓库说成 Digital OS 生产仓库。

## 先立住：这条不是“三层比较高级”

三层本身没有价值。真正的价值是列表、详情、预取和失效都复用同一份 query identity：同一个资源永远由同一个 key 和 queryFn 描述，所以缓存能被稳定命中，也能被精确宣布过期。

## 第一层：必须答顺

### 1. 为什么用 TanStack Query，而不是把请求放进 `useEffect`？

接口数据是 server state：它有异步状态、缓存、过期、并发去重和重新同步问题。`useEffect` 能发请求，却会迫使每个页面重复管理 loading、error、取消、缓存和竞态；TanStack Query 把这些生命周期放到统一缓存里。

### 2. 三层分别做什么？

- **API function**：只负责 HTTP 输入输出，不知道 React。
- **queryOptions factory**：把 `queryKey` 和 `queryFn` 绑定成资源的唯一描述。
- **typed hook**：把查询能力交给组件，并允许有限的查询配置。

参考实现里 `QueryConfig` 明确去掉 `queryKey` 和 `queryFn`，调用者可以调行为，却不能在页面里偷偷改掉资源身份。

### 3. 为什么 `queryOptions` 工厂是中枢？

`useQuery`、hover prefetch 和其他缓存操作都消费同一个工厂。如果详情页 key 是 `['posts', slug]`，卡片预取也必须生成完全相同的 key；否则看起来预取成功，详情页实际上会建立另一份缓存并重新请求。

### 4. “hover prefetch 后不发请求”准确发生了什么？

卡片 `onMouseEnter` 调用 `queryClient.prefetchQuery(getPostQueryOptions(slug))`。预取完成后，详情页的 `usePost(slug)` 使用相同 key；只要这份数据仍处于 fresh 状态，组件直接读缓存，不会为了挂载再发第二个请求。

这不是“每次点击都绝对零请求”：用户点得比预取更快、预取失败或数据已过期时，仍可能需要网络。简历描述的是成功 warm-cache 路径。

### 5. `prefetchQuery` 自己是否每次都会发请求？

不会。它会依据 `staleTime` 判断已有数据是否足够新。参考实现全局 `staleTime` 是 60 秒；fresh 缓存再次 prefetch 时不会重新获取。旧笔记把这一点写反了。

### 6. mutation 为什么只做 invalidate，不手工同步所有页面？

评论创建或删除成功后，代码 invalidate `['comments', postId]`。这表示“这组缓存不再可信”，由当前活跃查询按 TanStack Query 规则重新同步。手工修改缓存适合响应结构完全确定的场景；失效更保守，也更不容易漏掉派生列表。

## 第二层：继续追问时再讲

### `staleTime` 和 `gcTime` 有什么区别？

`staleTime` 决定数据多久仍被视为新鲜，影响是否需要重新获取；`gcTime` 决定没有观察者的缓存保留多久。一个管 freshness，一个管无人在用时的生命周期。

### query key 为什么要分层？

层级 key 既能精确命中 `['posts', slug]`，也能按前缀处理一组资源。设计 key 时要从业务身份出发，并把真正影响响应的参数放进去；对象相同但 key 不同会重复缓存，key 相同但响应不同会串数据。

### invalidate 和 refetch 有什么区别？

invalidate 首先把数据标为 stale，再由活跃状态和配置决定是否获取；refetch 是直接要求某个查询重新执行。mutation 成功后通常先表达“旧数据失效”，比到处命令式刷新更容易维护。

## 当前实现的缺口

- 可逐行验证的是 `Prometheus`，不是 Digital OS 生产代码。
- hover 只照顾鼠标用户；同样的意图信号还应覆盖键盘 focus。
- 全局 `retry: false` 对开发调试直接，但生产网络抖动下需要按错误类型设计重试策略。
- 参考项目使用 TanStack Query v5.32 的 `prefetchQuery`；最新官方指南已转向 `queryClient.query`，升级时应按当前 API 迁移，而不是继续背旧方法名。

## 30 秒回答

> 我把服务端数据拆成 API 函数、queryOptions 工厂和 typed hook 三层，但重点不是层数，而是 queryOptions 把 key 与 queryFn 固定成唯一身份。列表、详情和 hover prefetch 都复用它；预取完成且缓存仍 fresh 时，详情页挂载直接读同一个 key，不会再发第二个请求。mutation 成功后按资源前缀 invalidate，让缓存重新同步，而不是每个页面各自维护一份状态。

## 自检

1. 能否解释为什么 queryOptions 工厂比 hook 更像中枢？
2. 能否准确说出“无请求”成立的条件，而不是承诺每次点击都零请求？
3. 能否区分 `staleTime`、`gcTime`、invalidate 和 refetch？
4. 能否指出 hover、重试策略和 API 升级这三个当前缺口？
