---
title: "Day 9 · 证据与裁决"
tier: must
section: Periplus · Day 8–11
icon: workflow
day: 9
level: S
status: done
---

# Day 9 · 「代码而不是 prompt」这条怎么讲

> 🔴 **必看**。⚠️ 机制细节以 [Library 的 Periplus AI 笔记](/library?section=periplus&item=ai) 为主（Claim/Evidence/Verdict 三层对象模型那一节）。**这一篇给口播稿 + 那张最值钱的分工表。**

## 对应简历原句

> **Split evidence from judgment**: the research stage emits claims bound to exact source quotes, a separate verification stage rules on them, and **application code — not prompts — enforces citation membership and freshness windows**. A claim with no supporting quote never advances.

## 30 秒口播稿（改一改就能用）

> LLM 系统最常见的失败是**编造来源**：它说「根据官网，门票 45 澳元」，但那句话原文里根本没有。
>
> 常规做法是在 prompt 里写「务必引用真实来源」——**但 prompt 是请求，不是约束**。所以我们把这件事拆成两半：**研究阶段只负责产出「声明 + 它绑定的原文片段」，一个独立的核查阶段负责裁决**，而且**裁决里最关键的两类判断根本不交给模型**。
>
> 具体说，判决一共六种，模型只被允许返回其中四种；**「证据过期」和「压根没有证据」这两种是应用代码算的，prompt 里明确禁止模型返回它们**。因为过期与否是「当前日期减去页面发布日期」这种确定性计算，交给模型只会得到一个听起来合理的猜测。**结果是没有支持性原文的声明永远进不了下一阶段。**

## ⭐ 最值钱的一张表：六种判决，谁说了算

| 判决 | 含义 | 谁决定 |
|---|---|---|
| `supported` | 证据直接支撑整条声明 | **模型** |
| `partial` | 只支撑一部分，或来源互相冲突 | **模型** |
| `contradicted` | 证据直接反证 | **模型** |
| `unsupported` | **有证据，但它没有回应这条声明** | **模型** |
| `stale` | 证据支撑它，**但早于它的新鲜度窗口** | ⭐ **应用代码** |
| `no_evidence` | 压根没有证据 | ⭐ **应用代码** |

**prompt 里那一行是原话，能引用它比复述强十倍**（`verification.py:369`）：

> *"Never decide freshness and never return stale or no_evidence; **application code owns those**."*

> **这就是简历 `application code — not prompts — enforces ...` 的字面出处。** 面试时**直接引这句英文**——它证明这不是事后包装的说法，是当时就写进 prompt 的设计边界。

**另一个关键常量**（`models.py:180`）：

```python
USABLE_VERDICTS = frozenset({SUPPORTED, PARTIAL, STALE})
```

> ⭐ **`stale` 是可用的**——它的语义是「可用，但要带上时效提醒」，**不是「不能给用户看」**。而 `unsupported` / `contradicted` / `no_evidence` 都不可用。**这个区分很容易答错。**

## 新鲜度窗口是按声明类型分的（`models.py:156-165`）

```python
FRESHNESS_DAYS = {
    HOURS: 180,  PRICE: 180,  AVAILABILITY: 90,  TRANSIT: 365,
    SAFETY: 90,  LOCATION: None,  DESCRIPTION: None,  OTHER: 365,
}
```

> **`LOCATION` 和 `DESCRIPTION` 是 `None`——永不过期。** 「歌剧院在环形码头」这句话不会因为页面是三年前的就失效；但「门票 45 澳元」超过 180 天就必须降级。**`ClaimKind` 的 docstring 一句话讲透了为什么要分：*"Determines how volatile a claim is, and therefore how fast its evidence rots."***

## 四个必答

**Q：为什么 prompt 里写「务必引用真实来源」不够？**

> 「**prompt 是请求，不是约束。** 模型可以照做，也可以不照做，而且你没有任何机制知道它这次做没做到。**更麻烦的是它会失败得很自然**——编出来的引用读起来和真的一模一样。所以我们不请求它，我们**在它给出答案之后用代码校验**：引用的证据 ID 必须真的在这条声明的证据组里，这是集合成员检查，不是判断题。」

**Q：应用代码具体校验了什么？**

两件事，**都是确定性的**：

| 校验 | 怎么算 |
|---|---|
| **citation membership** | 模型引的 evidence ID 必须在这条 claim 的证据组里——**集合成员检查** |
| **freshness window** | `as_of` 减去证据的发布日期，和 `FRESHNESS_DAYS[claim.kind]` 比 |

**`evidence_is_stale` 是个纯函数**（`verification.py:374`），docstring 写明了取日期的优先级：**优先用页面自己声明的发布日期；没有的话退回抓取时间**——因为那是「Periplus 实际观察到这段文字的最后日期」，是**最保守的确定性兜底**。

**Q：证据互相矛盾或者过期怎么办？**

- **矛盾** → 模型返回 `partial`（prompt 第 363 行明确定义了：*"evidence establishes a weaker or incomplete part, **or supplied sources conflict**"*）
- **过期** → 代码判 `stale`，**仍然可用但带时效标注**

**Q：`no_evidence` 和 `unsupported` 差在哪？**（高频，容易混）

> **`unsupported` 是「有证据，但它没回应这条声明」；`no_evidence` 是「压根没有证据」。**
>
> **前者是模型判的**（它读了证据，说这些跟声明无关）；**后者是代码判的**（证据组是空的，根本不用问模型）。**两者的成本也不同——`no_evidence` 一次模型调用都不花。**

## 两个能体现深度的细节

**① `as_of` 为什么要注入**（`verification.py:167-171`）

> *"`as_of` makes replay and freshness tests stable. It defaults to the current UTC date, **never to a date inferred by the model**."*

**时间是业务输入不是环境噪音**——不注入的话，一个测「30 天内的价格应该 supported」的用例过几个月会自己变红。**这和 [#14 里注入时钟](/docs?section=periplus&item=n14-server-tests) 是同一个道理。**

**② 日期抽取只认发布者声明的**（`extract.py:259-265`）

> *"Only a date the publisher declared counts. **Guessing one from the text would hand the freshness rules a number nobody stands behind**, and a wrong date there means stale prices are scheduled as verified."*

**宁可没有日期（退回抓取时间这个保守值），也不要一个猜出来的日期**——因为整条新鲜度规则都建在它上面。**能引这句注释，说明你理解「确定性」是要一路守到底的，不是只在最后一步做个检查。**
