---
title: "⑥ 证据与判断分离"
tier: extend
section: Periplus
icon: workflow
day: 9
level: S
status: done
---

# ⑥ 证据与判断分离

> **简历原句**
>
> **Split evidence from judgment**: the research stage emits **claims bound to exact source quotes**, a separate verification stage rules on them, and **application code — not prompts — enforces citation membership and freshness windows**. **A claim with no supporting quote never advances.**
>
> ---
>
> 把证据和判断拆开：检索阶段产出的每条声明都绑定原文逐字引用，由独立的核实阶段裁决；引用归属和新鲜度窗口由应用代码强制，而不是靠提示词。没有支撑引用的声明永远进不了下一阶段。

**这一篇不在简历上。**Periplus 只有四条 bullet，这条不在其中；上面引的是它当年在简历上时的原句，留作参照。**笔记不删，因为「你怎么防止模型编造来源」是 LLM 岗位的必问题，答案全在这篇。**

## 先把词说清

**hallucination（幻觉）/ fabricated citation（编造来源）**：模型说「根据官网，门票四十五澳元」，**但那句话原文里根本没有**。

**claim（声明）**：一句要告诉用户的话。

**evidence（证据）**：从某个网页上**原样摘下来**的一段文字，加上它的网址和发布日期。

**verbatim quote / exact source quote（逐字引用）**：**一个字都没改**的原文。改成 `$30.00` 就不再是逐字引用了。

**verdict（判决）**：这条声明到底立不立得住。

**citation membership（引用归属）**：模型引用的那个证据编号，**到底在不在这条声明的证据组里**。**这是一次集合查找，不是判断题。**

**freshness window（新鲜度窗口）**：这类声明的证据，**多老就算过期**。

**provenance（溯源）**：从最终一句话回溯到原始出处的那条链。

**pure function（纯函数）**：同样输入永远同样输出、没有副作用。

## 这条要讲清什么

大模型系统最常见的失败是**编造来源**。

常规做法是在提示词里写「务必引用真实来源」。**这条 bullet 的全部内容就是在说：那不管用，因为提示词是请求，不是约束。**

## 三个对象各由谁产出

这个系统里，每一句话都被拆成了三层：

- **声明**（「歌剧院门票四十五澳元」）——**由检索阶段产出**。
- **证据**（原文片段 + 网址 + 发布日期）——**同样由检索阶段产出**。
- **判决**——**由核实阶段给出，绝不由检索阶段写**。

**「声明绑定到确切的原文引用」的意思是：检索阶段不能只说「门票四十五澳元」，它必须同时给出那句话的原文出处。**

## 六种判决，谁说了算

**这是这一篇最值钱的一张清单，要能背下来。**

**模型可以返回四种：**

- **`supported`（有支撑）**——证据直接支撑整条声明。
- **`partial`（部分支撑）**——只支撑一部分，或者来源之间互相冲突。
- **`contradicted`（被反证）**——证据直接反证了这条声明。
- **`unsupported`（无支撑）**——**有证据但它没有回应这条声明**。

**应用代码决定另外两种：**

- **`stale`（过期）**——证据支撑它，**但早于这条声明的新鲜度窗口**。
- **`no_evidence`（没有证据）**——**压根没有证据**。

提示词里那一行是原话，**能引用它比复述强十倍**：

```
- Never decide freshness and never return stale or no_evidence; application code owns those.
```

**这就是简历里「application code — not prompts — enforces」的字面出处。**面试时直接引这句英文——**它证明这不是事后包装的说法，是当时就写进提示词的设计边界。**

**还有一个关键常量很容易答错：**

```python
USABLE_VERDICTS: frozenset[Verdict] = frozenset({
    Verdict.SUPPORTED, Verdict.PARTIAL, Verdict.STALE
})
```

**过期是可用的**，它的语义是「**可用但要带上时效提醒**」，不是不能给用户看。而 `unsupported`、`contradicted`、`no_evidence` 都不可用。

## 新鲜度窗口按声明类型分

```python
FRESHNESS_DAYS: dict[ClaimKind, int | None] = {
    ClaimKind.HOURS:        180,
    ClaimKind.PRICE:        180,
    ClaimKind.AVAILABILITY:  90,
    ClaimKind.TRANSIT:      365,
    ClaimKind.SAFETY:        90,
    ClaimKind.LOCATION:    None,   # ← 永不过期
    ClaimKind.DESCRIPTION: None,   # ← 永不过期
    ClaimKind.OTHER:        365,
}
```

**「歌剧院在环形码头」这句话不会因为页面是三年前的就失效，但「门票四十五澳元」超过 180 天就必须降级。**

那个枚举的文档字符串一句话讲透了为什么要分类：**它决定一条声明有多易变，因此它的证据腐坏得多快。**

## 为什么提示词里写「务必引用真实来源」不够

**提示词是请求，不是约束。**模型可以照做，也可以不照做，**而且你没有任何机制知道它这次做没做到**。

**更麻烦的是它会失败得很自然**：编出来的引用**读起来和真的一模一样**，格式对、语气对、连网址都像模像样。

**所以我们不请求它，我们在它给出答案之后用代码校验**：它引用的证据编号必须真的在这条声明的证据组里——**这是集合成员检查，不是判断题。**

**最后半句是这一节的题眼，也是整篇最该说出口的一句。**

## 应用代码具体校验了什么

**两件事，都是确定性的。**

**① 引用归属**：模型引用的证据编号必须在这条声明的证据组里，**一次集合查找就完了**。

**② 新鲜度窗口**：`当前日期 − 证据的发布日期`，和这类声明的窗口比。**判断过期的是一个纯函数**，它的文档字符串写明了取日期的优先级——**优先用页面自己声明的发布日期，没有的话退回抓取时间**，因为那是系统实际观察到这段文字的**最后日期，是最保守的确定性兜底**。

## 证据互相矛盾或者过期怎么办

**矛盾**的时候模型返回 `partial`。提示词里明确定义了这一种：**证据只确立了一个更弱或不完整的部分，或者提供的来源之间互相冲突。**

**过期**的时候代码判 `stale`，**仍然可用但带时效标注**。

## `unsupported` 和 `no_evidence` 差在哪

**这是高频题，也容易混。**

- **`unsupported` 是有证据，但它没回应这条声明**——**模型判的**：它读了证据，说这些跟声明无关。
- **`no_evidence` 是压根没有证据**——**代码判的**：证据组是空的，**根本不用问模型**。

**两者的成本也不同：`no_evidence` 这一种一次模型调用都不花。**这一句顺手展示了你想过成本，值得带上。

## 为什么连「今天是几号」都要注入

核实模块的文档字符串写着：**这个 `as_of` 参数让重放和新鲜度测试保持稳定；它默认取当前的 UTC 日期，绝不取模型推断出来的日期。**

**注入的意思是这个函数不自己去问系统现在几点，而是由调用方把日期传进来。**

**两个好处**：**测试稳定**——不注入的话，一个测「三十天内的价格应该判有效」的用例过几个月会自己变红，**这叫时间炸弹测试**；**重放可复现**——同一次运行重跑一遍，判决结果完全一样。

**时间在这里是业务输入，不是环境噪音**——新鲜度判定直接吃它。这和[注入时钟](/docs?section=periplus&item=scripted-seams)那一条是同一个道理。

## 日期抽取只认发布者声明的

抽取模块的文档字符串**是这一篇最好的一句引用**：

> 只有发布者自己声明的日期才算数；**从正文里猜一个日期，等于给新鲜度规则递了一个没人担保的数字**，而那里错一个日期就意味着**过期的价格被当成已核实的排进行程**。

**宁可没有日期——退回抓取时间这个保守值——也不要一个猜出来的日期，因为整条新鲜度规则都建立在它上面。**

**能引这句注释，说明你理解「确定性是要一路守到底的，不是只在最后一步做个检查」。**这和 [pgvector 那条里「正确但慢的索引」](/docs?section=periplus&item=pgvector-embeddings)是同一个价值观，**两处放在一起讲更有力。**

## 英文怎么说

**三句最容易说错的。**这条 bullet 的核心句**直接逐字背简历原句**：**application code — not prompts — enforces citation membership and freshness windows**。「提示词是请求不是约束」说 **a prompt is a request, not a constraint**——**一句话解释为什么不靠提示词**。「宁可没有日期也不要猜一个」说 **a guessed date would hand the freshness rule a number nobody stands behind**。

**术语对照**：编造来源 fabricated citation（也叫 hallucination）／ 声明 claim ／ 证据 evidence ／ 逐字引用 verbatim quote、exact source quote ／ 判决 verdict（动词 rule on a claim）／ 六种判决 supported、partial、contradicted、unsupported、stale、no evidence ／ 引用归属 citation membership ／ 溯源 provenance ／ 新鲜度窗口 freshness window ／ 腐坏 rot ／ 注入 inject ／ 确定性计算 deterministic computation ／ 集合成员检查 set-membership check ／ 纯函数 pure function ／ 保守兜底 conservative fallback。

## 30 秒回答

> 大模型系统最常见的失败是编造来源：它说「根据官网门票四十五澳元」，但那句话原文里根本没有。常规做法是在提示词里写「务必引用真实来源」——但提示词是请求，不是约束。所以我们把这件事拆成两半：检索阶段只负责产出声明加上它绑定的原文片段，一个独立的核实阶段负责裁决，而且裁决里最关键的两类判断根本不交给模型。具体说，判决一共六种，模型只被允许返回其中四种；stale 和 no_evidence 这两种是应用代码算的，提示词里有一行明确禁止模型返回它们。因为过期与否是「当前日期减去页面发布日期」这种确定性计算，交给模型只会得到一个听起来合理的猜测。结果是没有支持性原文的声明永远进不了下一阶段。

## 自检

1. 能否说清声明、证据、判决三个对象各由谁产出？
2. 能否说出六种判决，并分清哪四种归模型、哪两种归代码？
3. 能否说出 `USABLE_VERDICTS` 是哪三种，并解释 `stale` 为什么算可用？
4. 能否说出新鲜度窗口按类型分，并举出永不过期的那两类？
5. 能否解释为什么提示词是请求不是约束，并说出代码校验的两件事？
6. 能否分清 `unsupported` 和 `no_evidence`，包括谁判的和成本差别？
7. 能否讲出「日期只认发布者声明的」这条，以及它守的是什么？
