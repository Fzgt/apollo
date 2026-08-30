---
title: 数字口径总表（21 条审计记录）
section: 速查
icon: repeat
day: 99
level: 前置
status: doing
---

# Day 1 · 数字口径审计

> 这一天的目的只有一个：**每个数字被追问「你怎么测的」时答得上来**。不是自我审查，是准备口径。

## 怎么填

对下面 21 个数字声明逐项回答五个问题：

1. 这个数字从哪来？
2. 怎么测的？工具、环境、样本、基线？
3. 是我测的 / 团队的 / 产品规模 / 基准测试？
4. 时间范围和口径是什么？
5. 现在还能复现或拿出证据吗？

然后给每项打一个标签：

`Directly measured by me` · `Team-measured` · `Product scale` · `Benchmark result` · `Needs rewording`

**当日产出**：每个数字写清来源、测量方式、归因范围，以及被追问时的一句话答法。答不住口径的，当天把措辞改掉再往下走，别拿旧措辞练十三天。

> **对齐到简历 v72。**打删除线的三条是自 v66 起就不在简历上的数字，题目仍要会答——撤掉不等于不会被问到相邻话题。

## 总表

| # | 数字 / 声明 | 出处 | 审什么 |
|---|---|---|---|
| 1 | 60-second, usage-scoped keys | Beyz 凭证 | 为什么 60 秒；谁签发；过期与续签；scope 限了什么 |
| 2 | ~~six subscription events~~ | Beyz Stripe | **已从简历删除**（v66，2026-08-27）；事件模型与「哪六个」仍要会答 |
| 3 | ~~LCP under 500 ms~~ | BioMap | **已从简历删除**（2026-08-20），换成 `detail pages open instantly`；分析仍要会答 |
| 4 | 5M+ daily page views | 百度虚拟列表 | 日均 PV 还是别的口径；平台数据还是页面数据 |
| 5 | DOM 节点恒定 ~100 | 百度虚拟列表 | 怎么统计；不同 viewport / overscan 下变不变 |
| 6 | 30 → 60 FPS | 百度虚拟列表 | 工具、设备、交互场景；是否稳定值 |
| 7 | 2,000+ peak QPS | 百度提现 | 峰值还是持续；监控还是压测；系统规模 vs 个人实现 |
| 8 | ~~without a single dollar of financial loss~~ | 百度提现 | **已从简历删除**（2026-08-19），话题仍要会答 |
| 9 | 10+ incompatible packages | 百度 Webpack | 具体哪几类问题；能否举 1–2 个代表案例 |
| 10 | ~15% bundle reduction | 百度 Webpack | 比较范围、压缩方式、构建模式 |
| 11 | 70% build-time reduction | 百度 Webpack | cold 还是 warm；local 还是 CI；样本与机器 |
| 12 | 30M+ DAU | 百度白屏 | 公开产品规模；不得暗示为个人成果 |
| 13 | First to diagnose | 百度白屏 | 归因声明，和数字一样会被追 |
| 14 | 461 pytest tests | Periplus | ✅ 2026-08-27 实测 461 passed / 464 collected。**注意 v40 印的 406 是收集数，v66 的 461 是通过数，口径换了** |
| 15 | 1.5 seconds end to end | Periplus | ✅ 2026-08-27 实测 pytest 报 1.52s、`time` 报 2.02s。简历报的是 pytest 那个数；串行单进程，无 xdist |
| 16 | golden set 相关数字 | Periplus | ✅ 已实测：4 case / 8 claim / 8727 tokens / 0.009s |
| 17 | 1,020 generated layouts | WinterFell | ✅ 2026-08-19 实跑复现：`--sections 20 --trials 51` = 1,020；480 只是脚本默认值。要主动交代末 3 段障碍为 0，有内容的是 867 |
| 18 | 129 → 76 draw calls | WinterFell | 哪个 probe；同场景同设备；p50 过滤条件 |
| 19 | ~~2.6× triangles~~ | WinterFell | **已从简历删除**（v66）；代价那半句改成了大白话，但 26,230 → 69,112 仍要会答 |
| 20 | ~~no gap narrower than 15 units~~ | WinterFell | **已从简历删除**（v66，随机散布对照组一并撤下）；阈值口径仍要会答 |
| 21 | twenty scenes | WinterFell | ✅ 2026-08-27 实测 `SCENES` 数组正好 20 项，每 1,800 世界单位换一景，末景不循环 |

---

## 1. 60-second, usage-scoped keys

**出处**：Beyz 凭证 · ✅ 已完成，详解见 [#1 · 60 秒临时凭证](/docs?section=beyz&item=credential-quota)

为什么是 60 秒不是 5 分钟？谁签发的（服务端哪个路由）？过期之后前端怎么续？`usage:write` 这个 scope 具体允许什么、禁止什么？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 2. ~~six subscription events~~

**出处**：Beyz Stripe · ✅ 已完成，详解见 [#2 · six subscription events](/docs?section=beyz&item=stripe-billing)

> ⚠️ **v66 已把这个数从简历上撤掉**（连同 tRPC 与 typed server action）。现在那条只说「没有任何事件能把买断降级」。**题目不作废**：讲 webhook 写权益就必然讲到有哪些事件、乱序和重复怎么办。

哪六个事件？能不能当场报出名字？每个事件改了 entitlement 的哪一位？漏掉一个会发生什么？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 3. ~~LCP under 500 ms~~（已从简历删除）

**出处**：BioMap TanStack Query · ✅ 已完成，旧指标为何删除及当前缓存口径见 [③ TanStack Query](/docs?section=biomap&item=tanstack-query)

什么工具测的（Lighthouse / WebPageTest / RUM）？lab 还是 field 数据？哪个页面、什么网络条件？优化前的基线是多少？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 4. 5M+ daily page views

**出处**：百度虚拟列表 · ✅ 已完成，详解见 [#4 · 5M+ daily page views](/docs?section=baidu&item=virtual-list)

是日均 PV 还是别的口径？整个平台的数还是这个页面的数？我的个人贡献该怎么表述才不越界？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 5. DOM 节点恒定 ~100

**出处**：百度虚拟列表 · ✅ 已完成，详解见 [#5 · DOM 节点恒定 ~100](/docs?section=baidu&item=virtual-list)

怎么统计的（DevTools Elements 计数 / `document.querySelectorAll`）？不同 viewport 高度、不同 overscan 配置下这个数会变吗？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 6. 30 → 60 FPS

**出处**：百度虚拟列表 · ✅ 已完成，详解见 [#6 · 30 → 60 FPS](/docs?section=baidu&item=virtual-list)

什么工具（Performance 面板 / FPS meter）？什么设备、什么交互场景？60 是稳定值还是峰值？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 7. 2,000+ peak QPS

**出处**：百度提现 · ✅ 已完成，详解见 [#7 · 2,000+ peak QPS](/docs?section=baidu&item=withdrawal)

峰值还是持续值？来自监控还是压测？这是系统规模还是我个人实现的部分？我测的是哪一层——网关、服务还是前端请求数？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 8. ~~without a single dollar of financial loss~~（已从简历删除）

**出处**：百度提现

**2026-08-19：已改措辞，这句话不在简历上了。** 原因是它最难自证——零资损是财务对账结论，前端测不出来：谁告诉你的？口径是活动期间还是全量？拿得出对账报告吗？换成了三个可证的动作（请求锁、幂等 key、不确定按失败处理）。**句子删了，话题还会被问，答法见详解。**

✅ 已完成，详解见 [#8 · 零资损（已从简历删除）](/docs?section=baidu&item=withdrawal)

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 9. 10+ incompatible packages

**出处**：百度 Webpack 迁移 · ✅ 已完成，详解见 [#9 · 10+ incompatible packages](/docs?section=baidu&item=webpack-migration)

具体是哪几类不兼容（loader API 变更 / Node polyfill 移除 / 插件未适配）？能举 1–2 个代表案例并说清怎么定位的吗？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 10. ~15% bundle reduction

**出处**：百度 Webpack 迁移 · ✅ 已完成，详解见 [#10 · ~15% bundle reduction](/docs?section=baidu&item=webpack-migration) · 另见 [SplitChunks 实践](/docs?section=baidu&item=webpack-migration)

比较范围是什么（首屏 chunk / 全量产物）？压缩方式一致吗（gzip 前后）？production 模式对 production 模式？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 11. 70% build-time reduction

**出处**：百度 Webpack 迁移 · ✅ 已完成，详解见 [#11 · 70% build-time reduction](/docs?section=baidu&item=webpack-migration)

cold build 还是 warm build？本地还是 CI？样本几次取平均？机器配置是什么？**这个数最可能来自 filesystem cache 的 warm build，一定要说清。**

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 12. 30M+ DAU

**出处**：百度白屏

这是公开的产品规模数据。讲的时候怎么保证**不暗示成个人成果**？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 13. First to diagnose

**出处**：百度白屏

这是归因声明，和数字一样会被追。当时还有谁在查？「第一个」的依据是什么（工单时间戳 / 群里发言记录）？答不住就换成「我定位到了根因」。

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 14. 461 pytest tests

**出处**：Periplus · ✅ 已完成，详解见 [#14 · 461 pytest tests](/docs?section=periplus&item=scripted-seams)

✅ **2026-08-27 实测**：`uv run pytest` 报 `461 passed, 3 skipped in 1.52s`，`--collect-only` 收集 464（17 个测试文件求和，`test_orchestrator.py` 从 67 涨到 92，新增 `test_observability.py` 13 个）。

> ⚠️ **口径换了，这是最容易被问穿的地方**：v40 印的 406 是**收集数**（那版实跑 403 passed），v66 印的 461 是**通过数**（收集 464）。跳过的 3 个一直是同一批数据库重连测试，条件是需要可连的 PostgreSQL，**不是失败**。

**剩下要能答的是测试类型构成**：单测 / 集成 / eval 各多少？面试前重跑一次 `uv run pytest --collect-only -q`。

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 15. 1.5 seconds end to end

**出处**：Periplus · ✅ 已完成，详解见 [#15 · about a second end to end](/docs?section=periplus&item=scripted-seams)

哪台机器？什么命令？串行还是并行跑的？包不包含 collection 时间？这个「一秒」指的是测试套件还是一次 run？

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 16. golden set 相关数字

**出处**：Periplus evals · ✅ 已完成，详解见 [#16 · golden set 相关数字](/docs?section=periplus&item=golden-set-evals)

✅ 已实测：4 个 case、8 条 claim、8727 tokens、0 引用失败、全套 0.009s。**别把 case 数说多，四个就是四个。** 主动交代它是种子集不是覆盖率主张。

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 17. 1,020 generated layouts

**出处**：WinterFell · ✅ 已完成，详解见 [#17 · 1,020 generated layouts](/docs?section=winterfell&item=level-fairness)

✅ **已实测（2026-08-19 复跑）**：`node bench/fairness.mjs --sections 20 --trials 51`，20 × 51 = **1,020**，报告表头原话 `# Obstacle-layout fairness (51 generated layouts per section)`。**480 是脚本默认值（12 × 40），不是简历口径**——两个数没有冲突，简历那次是显式传参跑的。

同一次跑把这条 bullet 的另两半也一起复现了：`Every layout sampled had a continuous path through it.`；有内容的段里 Tightest gap 最小值是 **15 units**（第 3 段和第 10 段），所以 "no gap narrower than 15 units" 站得住；随机对照组 1338 vs 1224 units。

**必须主动交代的限定**：第 17/18/19 段是终点区，障碍数 0、Tightest gap 为 Infinity——这 3 × 51 = 153 个布局是白送的。真正有内容的是 17 × 51 = **867**。被人算出来不如自己先说。

| 项 | 填写 |
|---|---|
| 数字从哪来 | `bench/fairness.mjs` 的报告表头，20 段 × 每段 51 个布局 |
| 怎么测的（工具/环境/样本/基线） | 脚本经 Vite dev server 导入真实生成器（不是复制逻辑），按该关速度下的横向可达距离逐步扫；基线是同密度同地面的随机散布对照组 |
| 归因（我测 / 团队 / 产品规模 / benchmark） | `Directly measured by me` |
| 时间范围与口径 | 2026-08-17 首跑两轮、2026-08-19 复跑一次，结论一致；口径是「生成的布局数」，含末 3 段空段 |
| 现在能否复现、证据在哪 | 能，`npm run dev` 后 `node bench/fairness.mjs --sections 20 --trials 51` |
| **标签** | `Directly measured by me` |

**被追问时的一句话答法**

> 不是玩出来的，是拿生成器本身量的：20 段、每段 51 个布局共 1,020 个，逐步问「以这一关的速度，飞行器横移得过来吗」——全部有连续通路，有内容的段里最窄缝隙 15 单位，还跟同密度的随机散布做了对照。末三段是终点区没有障碍，所以有内容的是 867 个。


## 18. 129 → 76 draw calls

**出处**：WinterFell · ✅ 已完成，详解见 [#18 · 129 → 76 draw calls](/docs?section=winterfell&item=instancing)

哪个 probe 测的？同场景同设备吗？`bench/run.mjs:123` 那个 `fps.p50 > 115` 的过滤条件为什么这么筛，要能解释。

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 19. ~~2.6× triangles~~

**出处**：WinterFell · ✅ 已完成，详解见 [#19 · 2.6× triangles](/docs?section=winterfell&item=instancing)

> ⚠️ **v66 已把这个数从简历上撤掉**，代价那半句改成了「屏幕外的障碍不能再逐个跳过」。**题目不作废**：一说 draw call 从 129 降到 76，「那代价呢」就跟着来，三角形涨 2.6 倍正是答案。

三角形为什么反而涨了（26,230 → 69,112）？和 draw call 下降是什么关系？对实际帧率的影响是什么？**这条的价值就在于它是反向数字，主动讲出来比被问出来强。**

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填


## 20. ~~no gap narrower than 15 units~~

**出处**：WinterFell · ✅ 已完成，详解见 [#20 · no gap narrower than 15 units](/docs?section=winterfell&item=level-fairness)

> ⚠️ **v66 已把这个阈值和随机散布对照组一起从简历上撤掉**，那条现在只说「每个布局都存在一条走得通的路」。**题目不作废**：「走得通」凭什么判定，答案就是这个阈值。

「单位」在这个场景里是什么？15 这个阈值怎么定的？和飞行器碰撞半径是什么关系？（注意：早先的「14 units」是**看错了列**，14 来自 "how wide"，实测 15–20。）

| 项 | 填写 |
|---|---|
| 数字从哪来 | |
| 怎么测的（工具/环境/样本/基线） | |
| 归因（我测 / 团队 / 产品规模 / benchmark） | |
| 时间范围与口径 | |
| 现在能否复现、证据在哪 | |
| **标签** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**被追问时的一句话答法**

> 待填

---

## 当日收尾

- [ ] 20 项全部打完标签
- [ ] 标成 `Needs rewording` 的，列出改法
- [ ] 需要改的措辞汇总成 v41 清单
- [ ] v41 出版之前，不要拿旧措辞往下练

### 需要改到 v41 的措辞

| # | 现措辞 | 问题 | 改成 |
|---|---|---|---|
| | | | |


## 21. twenty scenes

**出处**：WinterFell 开场 bullet（v66 新增）· ✅ 已完成，详解见 [① 二十个场景与一次开局的种子](/docs?section=winterfell&item=procedural-world)

✅ **2026-08-27 实测**：`src/config/scenes.ts` 的 `SCENES` 数组正好 **20** 项，从 `Neon City` 到 `The Terminus`。
`SCENE_DISTANCE = 1800`，即每飞 1,800 个世界单位换一景；`sceneAt()` 对末景做了 `Math.min` 截断，**飞过终点不循环，停在最后一景**。

配色是另一套：`src/config/levels.ts` 的 `LEVELS` 只有 **6** 组（Signal / Vapour / Circuit / Ember / Toxic / Nova）。

> ⚠️ **别把这两个数说混**：**20 是场景，6 是配色。**换配色那件事正是 [⑤ 一次精确到帧的排查](/docs?section=winterfell&item=fog-freeze) 里雾卡顿的触发点。

| 项 | 填写 |
|---|---|
| 数字从哪来 | `SCENES.length`，源码常量，非运行期统计 |
| 怎么测的（工具/环境/样本/基线） | 直接数数组；`SCENE_DISTANCE` 决定切换间隔 |
| 归因（我测 / 团队 / 产品规模 / benchmark） | `Directly measured by me` |
| 时间范围与口径 | 2026-08-27 的 `main` |
| 现在能否复现、证据在哪 | 能，`src/config/scenes.ts` |
| **标签** | `Directly measured by me` |

**被追问时的一句话答法**

> 「二十个场景是写死的常量，每 1,800 世界单位换一个，飞完最后一个就停在那儿不循环。跟它容易混的是配色，那个只有六组。」
