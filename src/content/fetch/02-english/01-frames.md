---
title: 万能句式（讲项目、讲决策、卡住时）
section: 面试英语
icon: message-square-quote
---

# 十二个句式，把一小时撑下来

> 每个句式都是**简单词**。面试英语不靠词汇量，靠句子起得来、收得住。
> 用法：把 `___` 换成你自己的项目，出声念三遍。念不顺的句式直接划掉，别背。

## 一、开一个话题

```text
So the way it worked was ___.
    → So the way it worked was, the list rendered every row up front.

The problem we had was ___.
    → The problem we had was that the feed dropped to about 30 frames per second.

I'll give you the short version first, then go deeper if you want.
```

第三句是**控场句**，非常好用：先给 30 秒版本，对方要细节自然会追问。比一口气讲三分钟安全得多。

## 二、讲你做的决定

```text
I went with ___ over ___ because ___.
    → I went with TanStack Query over Redux because most of that state
      was server state, and Redux would have meant caching it by hand.

It came down to ___.
    → It came down to how often the data actually changed.

We ended up ___.        （中性，不邀功）
We settled on ___.      （暗示讨论过、比较过）
```

**`over` 这个词一定要会用**：`A over B` = 在 A 和 B 之间选了 A。比 "I choose A, not B" 自然得多。

## 三、讲测量和数字（性能题必用）

```text
First we measured, then we changed one thing at a time.
The bottleneck turned out to be ___, not ___.
It went from ___ to ___.
That's roughly ___.        （roughly / about / around：不确定时用，比说死一个数诚实）
```

例句串起来：

> The bottleneck turned out to be layout, not the network.
> Once we virtualized the list, it went from about 30 frames per second to a steady 60.

**`turned out to be` 是高分表达**：它自带「我一开始猜错了，是量出来才知道的」这层意思——正好是面试官想听的工程习惯。

## 四、承认不会（比硬编强太多）

```text
I haven't used ___ in production. The closest thing I've done is ___.
    → I haven't used React Native in production. The closest thing I've done
      is a web app embedded in a native shell, talking to it through a bridge.

I don't know off the top of my head, but here's how I'd find out: ___.
That's not something I've hit myself — how do you handle it here?
```

第三句把问题转回去，还显得你想学。**别说 "I'm not familiar with that"** 然后停住，那是句死话。

## 五、卡住、没听清、要时间

```text
Let me think about that for a second.        ← 完全正常，说完真的可以停两秒
Just so I understand — are you asking about ___ or ___?
Sorry, could you say that again?             ← 不丢人，说三次也不丢人
Can I check I've got the question right? You want ___.
```

**没听懂就问，别猜着答。** 答错方向比听不懂扣分多得多。

## 六、收尾一个回答

```text
So that's the short version — happy to go deeper on any part of it.
Does that answer what you were asking?
```

讲完一段主动收口，对方就知道该接话了。省掉那种「他还在说吗」的尴尬空档。

## 七、反问他们（面试最后那五分钟）

```text
How do you decide what to build in Framer versus in the Next.js app?
Who owns the design tokens right now?
When something feels slow in production, how do you find out — do you have RUM in place?
What does the first month look like for whoever takes this role?
```

前三个都指向你已经查过他们的东西（官网 Framer、产品 Next.js、JD 里的 observability），这比问薪水结构有用。
