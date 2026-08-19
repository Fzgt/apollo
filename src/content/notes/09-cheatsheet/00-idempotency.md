---
title: 幂等的四种实现
section: 速查
icon: repeat
day: 99
level: —
status: todo
---

# 幂等在四个场景里的四种实现

> Day 7 当日附加，Day 14 Round 3 必考。四个场景来自四个不同项目，这题答好了能一次证明「我理解的不是某个库，是这个问题本身」。

| 场景 | 重复来自哪 | 怎么做到幂等 | 代价 / 局限 |
|---|---|---|---|
| Beyz 重叠生成 | 用户在生成中再次触发 | | |
| Stripe webhook 重复投递 | Stripe 的至少一次投递 | | |
| 百度提现重复请求 | 用户连点、网络重试 | | |
| Periplus resume | 崩溃后从上一个 gate 重跑 | | |

## 每一格怎么填

**Beyz** —— 四态状态机 + `statusRef.current === Generating` 直接 return。这是**客户端状态机去重**，只挡本地。

**Stripe** —— 没有 event id 去重表，靠**收敛写**（每条改档路径 where 里带 `ne(users.subscribedPlan, Lifetime)`）。被问到照实说：这是幂等写而不是去重表，重复投递会重复执行但结果收敛。

**提现** —— 前端 locking 只改善用户行为，**一致性来自后端幂等键 + 数据库事务 + 业务不变量**。这句必须先说。

**Periplus** —— resume 的边界是 **gate 通过的产物**；没过 gate 的产物留着供检查，但永远不是合法的 replay 边界。

## 一句话总纲

> 待填 —— 用你自己的话，把这四种收成一句「幂等的本质是什么」。
