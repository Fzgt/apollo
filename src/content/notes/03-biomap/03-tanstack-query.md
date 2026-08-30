---
title: "③ TanStack Query：让缓存定义只有一份"
tier: must
section: BioMap
icon: microscope
day: 5
level: B
status: done
---

# ③ TanStack Query：让缓存定义只有一份

> **简历原句**
>
> 将 TanStack Query 分为 **API 函数、queryOptions 工厂、类型化 hooks** 三层，通过**单一缓存键、mutation 驱动失效和 hover prefetch**，让详情页打开即展示，且不再发请求。

> ⚠️ **版本边界**：BioMap 经历发生在 2022 年。这里的 “queryOptions 工厂” 应理解为项目自己写的配置函数，返回 `queryKey` 和 `queryFn`；不要说当时使用了 v5 的 `queryOptions()` helper，因为它到 2023 年才出现。`Prometheus` 是 2026 年的 v5 示例，只用于理解今天的写法。

## 这条要讲清什么

重点不是“三层”这个数字，而是列表、详情、预取和缓存更新都使用同一份查询定义。只要 key 和请求函数来自同一个地方，预取的数据才能被详情页正确命中。

## 第一层：必须答顺

### 1. 为什么不用每个页面自己的 `useEffect`？

接口数据有 loading、error、缓存、过期、重复请求和更新问题。每个页面自己处理会产生很多重复代码，也容易让多个页面保存不同版本的数据。TanStack Query 把这些工作放进统一缓存。

### 2. 三层分别做什么？

- **API function**：只负责发送请求和返回数据，不依赖 React。
- **options factory**：返回 `queryKey`、`queryFn` 和需要的查询设置。
- **typed hook**：给组件使用，并暴露安全的配置项。

2022 年的重点是这个项目结构，不是后来 v5 才加入的 `queryOptions()` helper。

### 3. 为什么 query key 必须只有一个来源？

缓存通过 key 识别数据。如果卡片预取使用 `['posts', slug]`，详情页也必须使用完全相同的 key。两个地方各写一份，很容易因为顺序、参数或命名不同而产生两份缓存。

### 4. hover prefetch 怎样让详情页更快？

用户把鼠标移到卡片上时，代码先调用 `prefetchQuery`。如果请求在点击前完成，详情页打开后就能读取同一个 key 下的 fresh 数据，不需要因为页面挂载再发第二个请求。

简历里的 “with no request at all” 应解释成**详情页不再发第二个请求**。预取本身在缓存缺失或过期时仍然会访问网络。

### 5. `prefetchQuery` 是否每次都会请求？

不会。它会根据缓存是否存在以及数据是否仍然 fresh 来决定。数据已经 fresh 时可以直接复用；用户点击太快、预取失败或数据已经 stale 时，详情页仍可能需要请求。

### 6. mutation 成功后为什么做 invalidate？

创建或删除数据后，相关缓存已经可能不准确。invalidate 先把对应 key 标记为 stale，再让正在使用它的页面按查询规则更新。这样不需要每个页面手工维护一份列表。

## 第二层：概念补充

### `staleTime` 和缓存保留时间有什么区别？

`staleTime` 决定数据多久仍然算新鲜。缓存保留时间决定一个无人使用的查询在内存里保存多久。TanStack Query v4 把后者叫 `cacheTime`，v5 改名为 `gcTime`。

### invalidate 和 refetch 有什么区别？

invalidate 表示旧数据已经不可信，并由查询状态决定是否重新请求；refetch 是直接要求查询再次执行。mutation 后通常先表达“这份缓存过期了”更容易维护。

### 预取会不会浪费网络？

会。用户可能 hover 以后不点击。可以增加短暂延迟、只对高点击率入口预取，或者根据数据大小和网络情况决定是否启用。

## 当前不能证明的内容

- 本机没有 BioMap 的 TanStack Query 源码，无法核对当时的函数名、key、`staleTime` 和具体页面。
- `Prometheus` 的 `QueryConfig`、posts 示例和 v5 helper 不能当作 BioMap 代码证据。
- 没有 2022 年的测量数据，所以不要承诺固定毫秒数，也不要说每次点击都完全没有网络请求。

## 30 秒回答

> 我把服务端数据分成 API 函数、查询配置工厂和 typed hook 三层。配置工厂集中保存 query key 和请求函数，列表、详情和 hover prefetch 都复用它。预取完成后，详情页通过同一个 key 直接读取 fresh 缓存，不再发第二个请求。mutation 成功后再 invalidate 相关 key，让正在使用的数据自动更新，而不是每个页面各自维护状态。

## 自检

1. 能否说明三层各自负责什么？
2. 能否解释为什么预取和详情页必须使用同一个 key？
3. 能否把 “no request” 准确解释为“详情页没有第二个请求”？
4. 能否区分 2022 年的配置工厂与 2023 年才出现的 v5 `queryOptions()` helper？
5. 能否说清 v4 `cacheTime` 与 v5 `gcTime` 是同一个概念的新旧名字？
