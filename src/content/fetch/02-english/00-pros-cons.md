---
title: 说优点和缺点该用哪个词
section: 面试英语
icon: scale
---

# 优点、缺点、取舍 —— 选词表

> 你问的就是这一篇：**downside 还是 drawback？advantage 还是别的？**
> 结论先给：缺点默认说 **downside**，取舍说 **trade-off**，优点说 **advantage** 或干脆不用名词。
> 剩下的都是「什么时候换一个词更准」。

## 缺点：四个词分工不同，不是同义词

| 词 | 什么时候用 | 例句 |
|---|---|---|
| **downside** ✅ 默认 | 口语最自然，中性，不带批评。跟 upside 成对 | The downside is that every consumer re-renders. |
| **trade-off** ✅ 高分词 | **你主动选的代价**，不是缺陷。面试官问「怎么权衡」时他要的就是这个词 | It's a trade-off: fewer draw calls, but more vertices. |
| **limitation** | 它**做不到**某件事，不是做得不好。描述边界，不是抱怨 | The main limitation is that it only works in Chromium. |
| **cost** | 你**付出去的**那样东西。后面接具体的量 | You pay for it in bundle size. / The cost is one extra round trip. |
| **catch** | 「有个坑」——听起来像内部人在提醒你 | It works, but there's a catch: the callback may never fire. |

**drawback** 也对，只是更书面一点，用了不扣分，但一句话里别跟 downside 混着来回换。

**这两个别用：**

- ❌ **disadvantage** —— 语法没错，但是「英语作文体」。母语者聊技术时几乎不说，一出口就有背单词的味道。
- ❌ **weakness** —— 说工具、说方案时太重，像在人身攻击。留给「你最大的弱点是什么」那种问题。

**shortcoming / demerit** 这类更不用碰，`demerit` 基本是中式英语教材词。

## 优点：少用名词，直接说它给你什么

母语者讲优点，一半时候根本不用名词，直接说结果。

| 说法 | 什么时候用 | 例句 |
|---|---|---|
| **The advantage is…** | ✅ 安全牌，任何场合都对 | The advantage is that the type comes straight from the schema. |
| **What you get is…** | ✅ 最自然，母语者最常用 | What you get is one place to change the threshold. |
| **The win is…** | 强调「最值的那一条」 | The big win was that the list stopped stuttering. |
| **upside** | 只在明确对比时用 | The upside is speed, the downside is memory. |
| **benefit** | 讲**用户/团队**得到什么，不讲技术本身 | The benefit for the team was fewer support tickets. |
| **strength** | 讲一个工具擅长什么 | React Query's strength is server state, not client state. |

`pros and cons` 可以说，但那是**列清单**的口吻（"let me give you the pros and cons"），不适合顺着话说。

## 把两边连起来的句式 —— 这才是加分的地方

只说优点或只说缺点都是半句话。面试官真正在听的是**你知不知道代价**。

```text
X buys you A, at the cost of B.
    → Virtualizing buys you a flat frame time, at the cost of losing Ctrl+F on the page.

The trade-off is A for B.
    → The trade-off is a bigger bundle for a faster first interaction.

We traded A for B.
    → We traded some memory for a much shorter first paint.

It's faster, but you pay for it in ___.
    → It's faster, but you pay for it in build time.

The downside is that ___ — which was fine here because ___.
    → The downside is that it only runs in Chromium — which was fine here
      because our traffic is 90% Chrome.
```

**最后那个句式最值钱**：先承认代价，再说为什么在这个场景下能接受。这句话说完，面试官不用再追问了。

## 三句话的模板：被问「这个方案怎么样」

```text
1. 它给你什么   The main thing you get is ___.
2. 代价是什么   The trade-off is ___.
3. 为什么能接受 In our case that was fine, because ___.
```

三句话讲完，比讲三分钟强。**答不出第 2 条，等于没答。**
