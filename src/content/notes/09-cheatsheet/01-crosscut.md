---
title: 跨项目追问
section: 速查
icon: git-compare
day: 99
level: —
status: todo
---

# 跨项目追问

> Day 14 Round 3 的原题。每题的价值在于**用两个不同项目的实例回答同一个抽象问题**。

## 1. 虚拟列表和 GPU instancing 各自减少了哪一类工作？

_待填_

> 提示：一个减少的是浏览器主线程的 style/layout/paint，一个减少的是 GPU 的 draw call 提交；而 instancing 还**增加**了三角形数。两者都是「用一种成本换另一种成本」。

## 2. 哪些保证来自确定性代码，哪些只能靠 eval 衡量？

_待填_

> 提示：Periplus 的 freshness / 引用归属是代码强制的；生成质量只能靠 golden set 断言范围。这题答好了直接证明你懂 LLM 系统的边界在哪。

## 3. 哪些状态必须持久化，哪些可以只活在客户端？

_待填_

> 提示：Beyz 的四态状态机 vs Periplus 的 run state；entitlement 为什么只能由 webhook 写。

## 4. 实时性、正确性、成本、复杂度之间你怎么取舍？

_待填_

> 提示：Beyz 的 250 ms chunk 与 `utterance_end_ms: 2000`；Periplus 的六阶段 vs 一个大 prompt；WinterFell 的 instancing 取舍。

## 5. 从简历任意一句往下追两层，我都答得上来吗？

自测：随机指一句，往下讲两层。答不动的记在这里。

- [ ] 
