---
title: "⑤ 证据与判断分离"
tier: must
section: Periplus
icon: workflow
day: 9
level: S
status: done
---

# ⑤ 证据与判断分离

> **简历原句**
>
> **Split evidence from judgment**: the research stage emits **claims bound to exact source quotes**, a separate verification stage rules on them, and **application code — not prompts — enforces citation membership and freshness windows**. **A claim with no supporting quote never advances.**
>
> ---
>
> 把证据和判断拆开：检索阶段产出的每条声明都绑定原文逐字引用，由独立的核实阶段裁决；引用归属和新鲜度窗口由应用代码强制，而不是靠提示词。没有支撑引用的声明永远进不了下一阶段。

## 这条 bullet 在讲什么

⭐ **大模型系统最常见的失败是编造来源** —— 它说「根据官网，门票 45 澳元」，**但那句话原文里根本没有**。

**常规做法是在提示词里写「务必引用真实来源」。这条 bullet 的全部内容就是在说：那不管用，因为提示词是请求，不是约束。**

## 一、先说清三个对象

**这个系统里，每一句话都被拆成了三层：**

| 对象 | 是什么 | 谁产出 |
|---|---|---|
| **Claim（声明 / 主张）** | 一句要告诉用户的话，比如「歌剧院门票 45 澳元」 | 检索阶段 |
| **Evidence（证据）** | **从某个网页上原样摘下来的一段文字**（逐字引用 = **verbatim quote**），加上它的网址和发布日期 | 检索阶段 |
| **Verdict（判决 / 裁定）** | 这条声明**到底立不立得住** | ⭐ **核实阶段，绝不由检索阶段写** |

**「声明绑定到确切的原文引用」的意思是**：检索阶段不能只说「门票 45 澳元」，**它必须同时给出那句话的原文出处**。

## 二、30 秒口播稿（改一改就能用）

> 大模型系统最常见的失败是**编造来源**：它说「根据官网，门票 45 澳元」，**但那句话原文里根本没有**。
>
> 常规做法是在提示词里写「务必引用真实来源」—— **但提示词是请求，不是约束**。所以我们把这件事拆成两半：**检索阶段只负责产出「声明 + 它绑定的原文片段」，一个独立的核实阶段负责裁决**，而且**裁决里最关键的两类判断根本不交给模型**。
>
> 具体说，判决一共六种，**模型只被允许返回其中四种**；**「证据过期」和「压根没有证据」这两种是应用代码算的**，提示词里明确禁止模型返回它们。因为过期与否是「当前日期减去页面发布日期」这种确定性计算，**交给模型只会得到一个听起来合理的猜测**。**结果是没有支持性原文的声明永远进不了下一阶段。**

## 三、⭐ 最值钱的一张表：六种判决，谁说了算

| 判决 | 含义 | 谁决定 |
|---|---|---|
| `supported` | 证据**直接支撑整条**声明 | **模型** |
| `partial` | 只支撑一部分，**或者来源之间互相冲突** | **模型** |
| `contradicted` | 证据**直接反证**了这条声明 | **模型** |
| `unsupported` | **有证据，但它没有回应这条声明** | **模型** |
| `stale` | 证据支撑它，**但早于这条声明的新鲜度窗口** | ⭐ **应用代码** |
| `no_evidence` | **压根没有证据** | ⭐ **应用代码** |

**提示词里那一行是原话，能引用它比复述强十倍**（`verification.py:369`）：

> *"Never decide freshness and never return stale or no_evidence; **application code owns those**."*
>
> （**永远不要判断新鲜度，永远不要返回 stale 或 no_evidence；那两个归应用代码管。**）

> ⭐ **这就是简历 `application code — not prompts — enforces ...` 的字面出处。**
>
> **面试时直接引这句英文** —— 它证明这不是事后包装的说法，**是当时就写进提示词的设计边界。**

### ⚠️ 另一个关键常量，很容易答错

```python
# models.py:180
USABLE_VERDICTS = frozenset({SUPPORTED, PARTIAL, STALE})
```

> ⭐ **`stale` 是「可用」的** —— 它的语义是「**可用，但要带上时效提醒**」，**不是「不能给用户看」**。
>
> 而 `unsupported` / `contradicted` / `no_evidence` **都不可用**。

## 四、新鲜度窗口是按声明类型分的

**「新鲜度窗口」（freshness window）= 这类声明的证据，多老就算过期了。**

```python
# models.py:156-165
FRESHNESS_DAYS = {
    HOURS: 180,        # 营业时间
    PRICE: 180,        # 价格
    AVAILABILITY: 90,  # 是否开放、要不要预约
    TRANSIT: 365,      # 交通
    SAFETY: 90,        # 安全提示
    LOCATION: None,    # ⭐ 位置 —— 永不过期
    DESCRIPTION: None, # ⭐ 描述 —— 永不过期
    OTHER: 365,
}
```

**`None` 的意思是永不过期。**

> **「歌剧院在环形码头」这句话不会因为页面是三年前的就失效；但「门票 45 澳元」超过 180 天就必须降级。**
>
> **枚举的文档字符串一句话讲透了为什么要分类**：*"Determines how volatile a claim is, and therefore **how fast its evidence rots**."*（决定一条声明有多易变，**因此它的证据腐坏得多快**。）

## 五、四个必答

### Q：为什么提示词里写「务必引用真实来源」不够

> 「**提示词是请求，不是约束。** 模型可以照做，也可以不照做，**而且你没有任何机制知道它这次做没做到**。
>
> **更麻烦的是它会失败得很自然** —— 编出来的引用读起来和真的一模一样，格式对、语气对、连网址都像模像样。
>
> 所以我们不请求它，我们**在它给出答案之后用代码校验**：它引用的证据编号必须真的在这条声明的证据组里 —— **这是集合成员检查，不是判断题。**」

### Q：应用代码具体校验了什么

**两件事，都是确定性的：**

| 校验 | 怎么算 |
|---|---|
| **引用归属**（citation membership） | 模型引用的证据编号**必须在这条声明的证据组里** —— 一次集合查找 |
| **新鲜度窗口** | **当前日期减去证据的发布日期**，和这类声明的窗口比 |

**判断过期的是一个纯函数**（`verification.py:374`），文档字符串写明了取日期的优先级：

> **优先用页面自己声明的发布日期；没有的话退回抓取时间** —— 因为那是「系统实际观察到这段文字的最后日期」，**是最保守的确定性兜底**。

### Q：证据互相矛盾或者过期怎么办

- **矛盾** → 模型返回 `partial`。**提示词里明确定义了**：*"evidence establishes a weaker or incomplete part, **or supplied sources conflict**"*
- **过期** → **代码判 `stale`，仍然可用但带时效标注**

### Q：`no_evidence` 和 `unsupported` 差在哪（高频，容易混）

> **`unsupported` 是「有证据，但它没回应这条声明」；`no_evidence` 是「压根没有证据」。**
>
> **前者是模型判的** —— 它读了证据，说这些跟声明无关。
> **后者是代码判的** —— 证据组是空的，**根本不用问模型**。
>
> ⭐ **两者的成本也不同：`no_evidence` 一次模型调用都不花。**

## 六、两个能体现深度的细节

### ① 为什么连「今天是几号」都要注入

`verification.py:167-171` 的文档字符串：

> *"`as_of` makes replay and freshness tests stable. It defaults to the current UTC date, **never to a date inferred by the model**."*
>
> （`as_of` 让重放和新鲜度测试保持稳定。它默认取当前的世界标准时日期，**绝不取模型推断出来的日期**。）

**「注入」（injection）的意思是**：这个函数不自己去问系统「现在几点」，而是**由调用方把日期传进来**。

**为什么要这样：**

| 好处 | 说明 |
|---|---|
| **测试稳定** | 不注入的话，一个测「30 天内的价格应该判有效」的用例，**过几个月会自己变红** —— 这叫「时间炸弹测试」 |
| **重放可复现** | 同一次运行重跑一遍，判决结果完全一样 |

> ⭐ **时间在这里是业务输入，不是环境噪音** —— 新鲜度判定直接吃它。**这和 [③ 注入时钟](/docs?section=periplus&item=scripted-seams)) 是同一个道理。**

### ② 日期抽取只认发布者声明的

`extract.py:259-265` 的文档字符串：

> *"Only a date the publisher declared counts. **Guessing one from the text would hand the freshness rules a number nobody stands behind**, and a wrong date there means stale prices are scheduled as verified."*
>
> （只有发布者自己声明的日期才算数。**从正文里猜一个日期，等于给新鲜度规则递了一个没人担保的数字**，而那里错一个日期就意味着过期的价格被当成已核实的排进行程。）

> ⭐ **宁可没有日期（退回抓取时间这个保守值），也不要一个猜出来的日期** —— 因为**整条新鲜度规则都建立在它上面**。
>
> **能引这句注释，说明你理解「确定性是要一路守到底的」，不是只在最后一步做个检查。**

## 七、本篇术语英文对照

| 中文 | 英文 |
|---|---|
| 编造来源 / 幻觉 | **fabricated citation · hallucination** |
| 声明 / 主张 | **claim** |
| 证据 | **evidence** |
| 逐字引用 | **verbatim quote / exact source quote** |
| 判决 / 裁定 | **verdict**（动词 *rule on a claim*） |
| 有支撑 ↔ 无支撑 | **supported ↔ unsupported** |
| 部分支撑 | **partial** |
| 被反证 | **contradicted** |
| 过期 | **stale** |
| 没有证据 | **no evidence** |
| 引用归属 | **citation membership** |
| 溯源 | **provenance** |
| 新鲜度窗口 | **freshness window** |
| 腐坏 / 失效 | **rot**（*how fast its evidence rots*） |
| 注入（时钟） | **inject**（*the clock is injected, never read directly*） |
| 确定性计算 | **deterministic computation** |
| 提示词是请求不是约束 | ⭐ *a prompt is a request, not a constraint* |
| 集合成员检查 | **set-membership check** |
| 纯函数 | **pure function** |
| 保守兜底 | **conservative fallback** |

> ⭐ **三个最容易说错的**：
>
> 1. 这条 bullet 的核心句：**"Application code — not prompts — enforces citation membership and freshness windows."** 简历原句，逐字背
> 2. 「提示词是请求不是约束」：**a prompt is a request, not a constraint** —— 一句话解释为什么不靠提示词
> 3. 「宁可没有日期也不要猜一个」说 **a guessed date would hand the freshness rule a number nobody stands behind**
