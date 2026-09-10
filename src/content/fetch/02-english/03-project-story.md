---
title: 讲项目的英文骨架
section: 面试英语
icon: presentation
---

# 讲一个项目：四句话的骨架

> 中文里你讲得清楚，英文里容易讲散——因为句子一长就顾不上结构。
> 所以固定成四句：**是什么 → 问题 → 做了什么 → 结果**。
> 每句一件事，讲完停一下。对方要细节会问。

```text
1. 是什么   It's a ___ that ___.
2. 问题     The problem was ___.
3. 做了什么 So I ___.
4. 结果     After that, ___.
```

## 套进你的四张牌

**百度 · 信息流性能**

> It's a feed inside a product with about five million page views a day.
> The problem was that once you scrolled fast, it dropped to around thirty frames per second.
> So I built a virtual list on top of IntersectionObserver — only the rows near the viewport exist.
> After that it held a steady sixty, and the fix held up under the real traffic.

**百度 · 白屏排查**

> The problem was a blank screen on first load, and everyone assumed it was the network.
> I profiled it first, and the bottleneck turned out to be the bundle, not the network.
> So I split it by route with SplitChunksPlugin and made the vendor chunk cache properly.
> First paint went from a few seconds to well under one.

**BioMap · 设计系统 + loading states**

> It's an internal product where three of us shipped UI in parallel.
> The problem was that every screen invented its own loading and error handling.
> So we built the component layer on Radix with CVA for variants, and put all the
> server state behind React Query, so loading and error were handled in one place.
> After that a new screen was mostly composition — you weren't rewriting the same states.

**Beyz · 逐 token 流式**

> It's a real-time interview copilot, so perceived speed mattered more than total time.
> The problem was that waiting for a full answer felt broken, even when it was fast.
> So we streamed it token by token — the first word lands in a few hundred milliseconds.
> The total time barely changed. It just stopped feeling slow.

**最后那句是全场最好用的一句话**：`The total time barely changed. It just stopped feeling slow.`
JD 里写的是 "make the app feel fast"——这句话直接回答了它。

## 开场自我介绍（30 秒，别超过）

```text
I've been doing frontend for six years, three of them professionally.
I have broad technical exposure and I am familiar with the frontend ecosystem.
I'm skilled in React, Vue and frontend engineering.
I also have full-stack development capability. I'm happy to take on new technologies.
```

## 讲项目时的三个禁忌

1. **别从技术栈开头。** "It uses React, TypeScript, Vite, Zustand…" —— 对方听不出你做了什么。先说这是个什么东西。
2. **别一次给两个以上数字。** 一段一个数字，其余用形容词。数字堆多了没人记得住，还容易被追问到自己都不确定的那个。
3. **别讲你没量过的收益。** 说不出「改之前是多少」的优化，就别当成果讲——`we took a baseline first` 这句话才是加分项。
