---
title: "⑤ Separating evidence from judgement"
section: Periplus
---

# ⑤ Separating evidence from judgement

> **Resume line**
>
> **Split evidence from judgment**: the research stage emits **claims bound to exact source quotes**, a separate verification stage rules on them, and **application code — not prompts — enforces citation membership and freshness windows**. **A claim with no supporting quote never advances.**

> ⚠️ **v66 removed this bullet from the resume** (Periplus went from five lines to three then; v72 has four, and this one is still not among them). The line quoted above is v40's, kept for reference. **The note stays**: "how do you stop the model inventing sources" is a guaranteed question for an LLM role, and the answer is all here.

## What this bullet is about

⭐ **The most common failure in an LLM system is inventing sources** — it says "according to the official site, admission is AUD 45", **and that sentence appears nowhere in the source.**

**The usual approach is to write "always cite real sources" into the prompt. This entire bullet says: that does not work, because a prompt is a request, not a constraint.**

## 1. First, three objects

**In this system every sentence is split into three layers:**

| Object | What it is | Produced by |
|---|---|---|
| **Claim** | A sentence to tell the user, e.g. "admission to the Opera House is AUD 45" | The research stage |
| **Evidence** | **A passage taken verbatim from a web page**, plus its URL and publication date | The research stage |
| **Verdict** | Whether the claim **actually holds up** | ⭐ **The verification stage, never written by research** |

**"Claims bound to exact source quotes" means**: the research stage may not merely say "admission is AUD 45", **it must supply the source passage that sentence came from.**

## 2. The 30-second version (usable with light editing)

> The most common failure in an LLM system is **inventing sources**: it says "according to the official site, admission is AUD 45", **and that sentence appears nowhere in the source.**
>
> The usual approach is writing "always cite real sources" into the prompt — **but a prompt is a request, not a constraint.** So we split the job in half: **research only produces "a claim plus the source passage bound to it", and a separate verification stage rules on it**, with **the two most important judgements in that ruling never handed to the model at all.**
>
> Concretely there are six verdicts, and **the model is allowed to return only four of them**; **"the evidence is stale" and "there is no evidence at all" are computed by application code**, and the prompt explicitly forbids the model from returning them. Because staleness is a deterministic computation — today's date minus the page's publication date — **and handing it to a model only buys a plausible-sounding guess.** **The result is that a claim with no supporting passage never advances to the next stage.**

## 3. ⭐ The most valuable table: six verdicts and who decides

| Verdict | Meaning | Who decides |
|---|---|---|
| `supported` | The evidence **directly supports the whole claim** | **The model** |
| `partial` | It supports only part of it, **or the sources conflict with each other** | **The model** |
| `contradicted` | The evidence **directly disproves** the claim | **The model** |
| `unsupported` | **There is evidence, but it does not address this claim** | **The model** |
| `stale` | The evidence supports it, **but predates this claim's freshness window** | ⭐ **Application code** |
| `no_evidence` | **There is no evidence at all** | ⭐ **Application code** |

**The line in the prompt is verbatim, and quoting it beats paraphrasing tenfold** (`verification.py:369`):

> *"Never decide freshness and never return stale or no_evidence; **application code owns those**."*

> ⭐ **That is the literal source of the resume's `application code — not prompts — enforces ...`.**
>
> **Quote that English line directly in an interview** — it proves this is not a story assembled after the fact, **it was written into the prompt as a design boundary at the time.**

### ⚠️ Another key constant, easy to get wrong

```python
# models.py:180
USABLE_VERDICTS = frozenset({SUPPORTED, PARTIAL, STALE})
```

> ⭐ **`stale` is usable** — it means "**usable, but carry a currency warning**", **not "must not be shown to the user".**
>
> Whereas `unsupported` / `contradicted` / `no_evidence` are **all unusable.**

## 4. Freshness windows are per claim type

**A "freshness window" is how old this class of claim's evidence may be before it counts as stale.**

```python
# models.py:156-165
FRESHNESS_DAYS = {
    HOURS: 180,        # opening hours
    PRICE: 180,        # prices
    AVAILABILITY: 90,  # open or closed, booking required
    TRANSIT: 365,      # transport
    SAFETY: 90,        # safety advice
    LOCATION: None,    # ⭐ location — never goes stale
    DESCRIPTION: None, # ⭐ description — never goes stale
    OTHER: 365,
}
```

**`None` means it never goes stale.**

> **"The Opera House is at Circular Quay" does not stop being true because the page is three years old; but "admission is AUD 45" must be downgraded past 180 days.**
>
> **The enum's docstring explains the classification in one line**: *"Determines how volatile a claim is, and therefore **how fast its evidence rots**."*

## 5. Four must-answer questions

### Q: Why is "always cite real sources" in the prompt not enough?

> "**A prompt is a request, not a constraint.** The model may comply or may not, **and you have no mechanism at all for knowing whether it did this time.**
>
> **Worse, it fails plausibly** — an invented citation reads exactly like a real one: right format, right tone, even a convincing-looking URL.
>
> So we do not request it, we **validate in code after it answers**: the evidence id it cited must genuinely be in that claim's evidence set — **which is a set-membership check, not a judgement call.**"

### Q: What exactly does application code validate?

**Two things, both deterministic:**

| Check | How it is computed |
|---|---|
| **Citation membership** | The evidence id the model cited **must be in that claim's evidence set** — one set lookup |
| **Freshness window** | **The current date minus the evidence's publication date**, compared against that claim type's window |

**Staleness is decided by a pure function** (`verification.py:374`), whose docstring states the date's order of preference:

> **Prefer the page's own declared publication date; fall back to the fetch time otherwise** — because that is "the last date the system actually observed this text", **the most conservative deterministic fallback.**

### Q: What happens when evidence conflicts or is out of date?

- **Conflict** → the model returns `partial`. **The prompt defines it explicitly**: *"evidence establishes a weaker or incomplete part, **or supplied sources conflict**"*
- **Out of date** → **code rules `stale`, still usable but flagged for currency**

### Q: What is the difference between `no_evidence` and `unsupported` (frequent, easily blurred)?

> **`unsupported` is "there is evidence but it does not address this claim"; `no_evidence` is "there is no evidence at all".**
>
> **The first is judged by the model** — it read the evidence and said none of it bears on the claim.
> **The second is judged by code** — the evidence set is empty, **so the model is never asked.**
>
> ⭐ **They also cost differently: `no_evidence` spends not one model call.**

## 6. Two details that show depth

### ① Why even "what day is it" is injected

The docstring at `verification.py:167-171`:

> *"`as_of` makes replay and freshness tests stable. It defaults to the current UTC date, **never to a date inferred by the model**."*

**"Injection" means**: the function does not ask the system what time it is, **the caller passes the date in.**

**Why:**

| Benefit | Note |
|---|---|
| **Stable tests** | Without it, a case asserting "a price within 30 days should be valid" **goes red on its own a few months later** — a "time-bomb test" |
| **Reproducible replay** | Re-running the same run gives identical verdicts |

> ⭐ **Time is a business input here, not environmental noise** — the freshness decision consumes it directly. **The same reasoning as [③ injecting the clock](/docs?section=periplus&item=scripted-seams)).**

### ② Date extraction accepts only what the publisher declared

The docstring at `extract.py:259-265`:

> *"Only a date the publisher declared counts. **Guessing one from the text would hand the freshness rules a number nobody stands behind**, and a wrong date there means stale prices are scheduled as verified."*

> ⭐ **Rather no date at all (falling back to the conservative fetch time) than a guessed one** — because **the entire freshness rule is built on top of it.**
>
> **Being able to quote that comment shows you understand that determinism has to be maintained all the way through, not checked once at the end.**

## Glossary

| 中文 | English |
|---|---|
| 编造来源 / 幻觉 | **fabricated citation · hallucination** |
| 声明 / 主张 | **claim** |
| 证据 | **evidence** |
| 逐字引用 | **verbatim quote / exact source quote** |
| 判决 / 裁定 | **verdict** (verb: *rule on a claim*) |
| 有支撑 ↔ 无支撑 | **supported ↔ unsupported** |
| 部分支撑 | **partial** |
| 被反证 | **contradicted** |
| 过期 | **stale** |
| 没有证据 | **no evidence** |
| 引用归属 | **citation membership** |
| 溯源 | **provenance** |
| 新鲜度窗口 | **freshness window** |
| 腐坏 / 失效 | **rot** (*how fast its evidence rots*) |
| 注入（时钟） | **inject** (*the clock is injected, never read directly*) |
| 确定性计算 | **deterministic computation** |
| 提示词是请求不是约束 | ⭐ *a prompt is a request, not a constraint* |
| 集合成员检查 | **set-membership check** |
| 纯函数 | **pure function** |
| 保守兜底 | **conservative fallback** |

> ⭐ **The three easiest to get wrong**:
>
> 1. The core sentence of this bullet: **"Application code — not prompts — enforces citation membership and freshness windows."** The resume's own words; memorise them verbatim
> 2. "A prompt is a request, not a constraint" — one sentence explaining why prompts are not relied on
> 3. "Rather no date than a guessed one" is **a guessed date would hand the freshness rule a number nobody stands behind**
