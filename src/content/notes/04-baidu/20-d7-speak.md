---
title: "②⑤ 虚拟列表与生产白屏"
tier: must
section: 百度
icon: landmark
day: 7
level: S
status: done
---

# 虚拟列表与生产白屏

> 🔴 **必看**。⚠️ **这一天机制原理以 [Library 的百度笔记](/library?section=baidu&item=notes) 为主**——那边虚拟列表和白屏各有两百多行，写得比我细。
>
> **这一篇只给三样 Library 没有的**：两段口播稿、Library 导航、以及几个它没覆盖的追问。数字口径见 [#5 DOM 节点](/docs?section=baidu&item=n05-dom-nodes) · [#6 FPS](/docs?section=baidu&item=n06-fps)。

## 一、虚拟列表 · 30 秒口播稿

> 这是个信息流页面，日均五百万 PV 量级。**问题是无限滚动会让 DOM 一直涨**——用户滚十屏就是两百多条，滚久了五百条以上，滚动直接掉到三十帧。
>
> 关键认知是：**用户在视口里同时能看到的其实就十来条，其余的「假装存在」就够了**。所以我写了个 `useVirtualList`，只渲染可视区加上下各几条缓冲，外层用一个撑满总高度的容器保住滚动条，每一条用 `transform: translateY` 定位。
>
> **真正的收益不是「少了多少个节点」，是复杂度的量级变了**——优化前 DOM 数随已加载条数增长，是 O(n)；优化后只随视口高度增长，跟数据量无关，用户滚一万条 DOM 里还是那二十来个。**滚动回到稳定 60 帧。**

**接下来三层追问的答法在**：`transform` vs `top`（只走 composite，跳过 layout 和 paint）、`IntersectionObserver` vs scroll 监听（避免 `getBoundingClientRect` 的强制同步布局）、60 FPS = 每帧 16.67ms 预算。**全在 Library。**

## 二、生产白屏 · 30 秒口播稿

> 好看视频的搜索页在一次发布后白屏，是个 P2 事故，那个产品是亿级 DAU 的量级。
>
> **根因链条是四层**：有人本地的 Node 版本和团队不一致 → 他的 npm 版本跟着不同 → 装依赖时 **`package-lock.json` 被重新生成**了 → 锁文件里某个依赖的版本被放行到了一个带 breaking change 的新版本，上线就炸。
>
> **表面看是「某个库出了问题」，实际是「我们的锁文件根本没锁住」。** 所以修完之后做的不是改那一个依赖，是**锁 Node 版本、CI 里改用 `npm ci`、加发布前的预发布验证**——因为同样的机制会以任何一个依赖的形式再来一次。

> ⭐ **这条 bullet 的价值全在最后那句转折**：从「修一个 bug」上升到「消除一类 bug」。**只讲排查过程会浪费掉它。**

## 三、Library 导航（按这个顺序读）

| 读什么 | Library 行号 | 为什么必看 |
|---|---|---|
| **为什么 500 个 DOM 会掉帧** | `① 149-167` | 渲染流水线 JS→Style→Layout→Paint→Composite，**layout 时间随节点数线性涨** |
| **虚拟列表核心思想 + spacer** | `② ③ 169-202` | 外层撑总高度保住滚动条，内层 absolute + translateY |
| ⭐ **`transform` vs `top`** | `④ 203-217` | **必背那张表**：top 触发 Layout+Paint+Composite，transform **只走 Composite**（GPU） |
| ⭐ **IntersectionObserver** | `⑤ 218-244` | 替代 scroll + `getBoundingClientRect`，**避免强制同步布局** |
| **60 FPS 预算 + RAIL** | `⑥ 245-254` | 16.67ms/帧，留给 JS 的实际只有 ~10ms |
| **完整 hook 实现骨架** | `255-324` | 面试要白板写的话看这个 |
| **动态高度两种方案** | `325-338` | 预估+`ResizeObserver` 测量修正 / offset table + 二分 |
| **`passive: true`** | `339-346` | 告诉浏览器不会 `preventDefault`，**滚动不用等 JS** |
| **白屏：semver / lockfile / npm ci** | `716-790` | `^` `~` 放行范围、lockfileVersion 随 npm 走、`npm ci` vs `install` |

## 四、Library 没覆盖的四个追问

**Q：为什么自己写而不用现成库（react-window / TanStack Virtual）？**

> 「诚实说：**当时更多是团队约束而不是技术判断**——引三方库要走评估流程，而这个需求边界很清楚、我们的 item 结构也固定。**自己写的代价是动态高度、键盘导航、无障碍这些边角要自己补，而成熟库已经处理过。** 现在做的话我会先用 TanStack Virtual，除非它的 API 拦住了某个必须的定制。」

**主动说「现在会选库」比硬撑「自己写更好」可信得多。**

**Q：`~20` 这个数字到底是节点数还是条目数？**

✅ **已解决**：简历现在写 `live DOM nodes stay near 100 at any scroll depth`。原来的 `roughly 20` 是把条目数写成了节点数（一个 feed 卡片本身就是 8–15 个节点）。**现在这个写法更强**——`at any scroll depth` 说的是「不随滚动深度增长」，正是虚拟列表真正的收益。详见 [#5](/docs?section=baidu&item=n05-dom-nodes)。

**Q：白屏那条「第一个定位到」怎么讲？**

> 「当时还有别人在查，**我是最先把根因指到锁文件被重新生成这一层的**。」——**说清「第一个」指的是定位到根因，不是第一个发现故障**，这个区分能挡住大多数追问。

**Q：排查过程怎么组织？**

**用 observe → hypothesize → verify → fix → prevent 五步讲**，重点在最后两步的分离：**fix 是让这次好，prevent 是让这类不再来。** 这正好呼应第二段口播稿的转折。

## 五、当日附加

**幂等在四个场景的四种实现**已经填好了 → [速查 · 幂等的四种实现](/docs?section=cheatsheet&item=idempotency)。**Day 14 Round 3 必考，今天顺手过一遍。**
