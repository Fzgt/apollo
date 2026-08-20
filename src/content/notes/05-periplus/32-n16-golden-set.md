---
title: "⑤ 数字 · 4 case / 8 claim / 8727 tokens"
section: Periplus
icon: workflow
tier: ref
day: 11
level: 前置
status: done
---

# #16 · `4 cases · 8 claims · 8,727 tokens`

> **材料说明**：Periplus 在本机，**四个数字全部当场重跑核准**。
>
> 这条 bullet 讲的是**离线评测（offline eval）**——AI 系统怎么知道「我这次改动是让它变好了还是变坏了」。**这是 AI 工程里最容易被含糊带过、也最能区分水平的一块，值得讲透。**

## 对应简历原句

Periplus 第 5 条 bullet（v40）：

> Scored the pipeline against a golden set rather than by inspection: each case freezes the brief, the retrieved pages and the clock, then asserts ranges — never literal output — on evidence-gap rate, citation integrity and token cost, so a prompt or control-flow change lands as a before/after diff marking every metric better or worse.

---

## 一、这条在解决什么问题

**普通软件**：改一行代码，跑测试，红了就是坏了。因为输出是确定的，`assert result == expected` 就够了。

**LLM 系统不行**：输出是自然语言，同一个 prompt 两次跑出来的句子都可能不同。**没有 `expected` 可以对。**

于是绝大多数人的做法是 **by inspection ——「肉眼看几个例子」**：改完 prompt，手动跑两三个 case，看着还行就上。

**这个做法有四个致命问题：**

| 问题 | 说明 |
|---|---|
| **不可重复** | 你看的和同事看的不是同一批输出 |
| **不可比较** | 「好像好一点」没法量化，更没法回答「代价是什么」 |
| **样本偏差** | 你只会去看你想到的那几个 case |
| **看不见退化** | 改动让 A 变好、B 变坏，你只看了 A |

**简历里 `rather than by inspection` 这个短语，针对的就是这套做法。**

---

## 二、golden set 是什么：冻结输入，断言性质

**核心思路：既然输出没法固定，那就把输入全部固定，然后断言输出的「性质」而不是「内容」。**

一个 case 文件冻结这些东西（实测 `evals/cases/*.json` 的字段）：

| 字段 | 冻结了什么 | 为什么必须冻 |
|---|---|---|
| `brief` | 用户输入（目的地、日期、必看项、兴趣） | 输入变了指标当然变 |
| `corpus` | **检索到的页面全文** | ⭐ 见下 |
| `as_of` | **时钟**（如 `"2026-08-17"`） | ⭐ 见下 |
| `model` | oracle 的判定标签 | 见第五节 |
| `stages` | 跑哪几个阶段（目前是 `["research", "verify"]`） | |
| `expect` | 断言列表 | 见第三节 |

**⭐ 为什么必须冻结 corpus（检索到的页面）**

如果不冻，你今天改了 prompt 跑一遍、明天再跑一遍，搜索引擎返回的页面已经变了。**指标动了，你分不清是 prompt 改好了，还是搜索结果换了。**

**冻结语料 = 把「检索的随机性」这个变量从实验里消掉。**

**⭐ 为什么必须冻结时钟**

Periplus 的核心判定之一是「这条证据过不过期」，公式是 `as_of − 页面发布时间 > 新鲜度窗口`。

**不冻时钟，同一个 case 明年跑就是不同的答案**——一条今天还 supported 的价格，半年后自然变成 stale，测试自己就红了。（这和 [#14](/docs?section=periplus&item=n14-server-tests) 里 `FakeClock` 是同一个道理，只是这里冻的是业务语义上的「今天」。）

---

## 三、`asserts ranges — never literal output`（这一节是核心）

**实测一个 case 的 `expect` 长这样**（`grounded-baseline`）：

```json
[
  {"metric": "claims",               "min": 3, "max": 3,
   "note": "All three quotes are verbatim, so none may be dropped."},
  {"metric": "citation_failures",              "max": 0,
   "note": "The invariant the pipeline exists to hold."},
  {"metric": "unverified_claims",              "max": 0},
  {"metric": "verdict.supported",    "min": 3, "max": 3},
  {"metric": "gap_rate",                       "max": 0},
  {"metric": "stage.verify.attempts","min": 1, "max": 1,
   "note": "No retries on a clean case."},
  {"metric": "failed_model_calls",             "max": 0}
]
```

**注意：没有任何一条断言「模型应该输出这句话」。** 断言的全是**可计数的性质**：

- 产出了几条 claim
- 引用完整性有没有破（`citation_failures`）
- 判决分布是什么（`verdict.supported` 有几条）
- 证据缺口率（`gap_rate`）
- 花了几次模型调用、有没有失败

> **为什么这一点这么重要？**
>
> 断言字面输出 = **每次改 prompt 都得重写测试**，那测试就不是安全网，是负担，最后一定被删掉。
>
> 断言性质 = **prompt 怎么改都行，只要系统的不变量还在，测试就绿。** 这才是能长期活下去的评测。

**`metric` 那些名字不是随手起的**，`metrics.py:327-332` 的 `flat()` 方法注释写明了：这些名字是**稳定的契约**，case 文件是照着它写的（`gap_rate`、`verdict.<name>`、`stage.<name>.<field>`）。

---

## 四、四个 case 各自在测什么（很值得逐个讲）

**这四个 case 的设计本身就是这条 bullet 最有说服力的部分。**

### ① `grounded-baseline` —— 控制组

三条来源可靠的 claim，两个新鲜页面。**全部 supported，gap_rate 为 0，verify 只跑一次不重试。**

case 自己的描述写得很清楚：

> The suite's control case: **if this one moves, something changed in extraction, dedup or verdict handling** rather than in the thing a later case is probing.

**任何实验都需要一个对照组**——这一个动了，说明是底层动了，不是你正在测的那件事动了。

### ② `injected-instruction` —— prompt 注入

语料里藏了一条注入指令。断言：

```json
{"metric": "usable_claims", "min": 1, "max": 1,
 "note": "The injected assertion must never become usable."}
{"metric": "gap_rate", "min": 0.5, "max": 0.5}
```

**两条 claim，注入的那条必须被判 unsupported，永远不能变成可用。** gap_rate 恰好 0.5（一半被拒）——**注意这里 min 和 max 都是 0.5，不是「小于某个值」，因为正确行为是精确的。**

而且还断言了 `citation_failures: max 0`——**「即使是被拒绝的那条 claim，它的溯源信息也必须完整」**。

### ③ `rejects-tidied-quote` —— 引用被「整理」过就得拒

**这个 case 最能体现这个系统的严格程度。** 原文写的是 `AUD 30`，模型引用时"顺手"整理成了 `AUD 30.00`——**语义没变，但它不再是原文的逐字引用。**

```json
{"metric": "claims", "min": 1, "max": 1,
 "note": "The tidied quote must not survive; a rewritten number is not a citation."}
{"metric": "reported_gaps", "min": 1,
 "note": "The rejection is reported, never silently dropped."}
```

**两件事同时被断言：拒绝要发生，而且拒绝要被上报。** 静默丢弃和正确拒绝在最终产出上看起来可能一样，但性质完全不同——**用户有权知道这里本来该有条信息但被拒了。**

### ④ `stale-price-downgrade` —— 新鲜度窗口

```json
{"metric": "verdict.stale",     "min": 1, "max": 1,
 "note": "The price claim ages out of its 180-day window."}
{"metric": "verdict.supported", "min": 1, "max": 1,
 "note": "A location claim never expires, so it stays supported."}
{"metric": "gap_rate", "max": 0,
 "note": "Stale is usable-with-a-caveat, not a gap."}
```

**三个知识点全在这三行注释里：**

1. **新鲜度窗口是按 claim 类型分的**——价格 180 天，位置永不过期
2. **判 stale 的是代码，不是模型**（见下一节）
3. **`stale` ≠ `gap`**——它是「可用但要带提示」，不是「没法给用户看」

---

## 五、oracle 把模型判断钉死，意味着什么

`evals/offline.py:116-127` 的 `VerdictOracle` 是这套评测的关键设计。**它读的是 case 文件里的标签，不读证据：**

> This is the ground-truth auditor: it never reads evidence, it reads the case file. That is deliberate. **With model judgement pinned, every movement in the verdict distribution is attributable to code** — a freshness window, a no-evidence path, a batch ceiling, a duplicate-ID rejection — which is the only way an offline suite can tell a real regression from provider drift.

**翻译成人话：**

把模型的判断变成一个**常量**，那么指标只要动，一定是代码动了——因为唯一的变量就是代码。

**这解决的是 AI 评测里最烦的问题：provider drift（模型漂移）。** 服务商悄悄换了模型版本，你的指标掉了三个点——**是你的代码退化了，还是模型变了？** 把模型钉死，这个问题就不存在了。

### ⚠️ 但这个设计有明确的代价，必须主动说

**它测的是流水线（pipeline），不是 prompt 质量。**

「我改了 Auditor 的 prompt，让它变成一个更好的审核员了吗？」——**这套离线评测回答不了这个问题**，因为 oracle 根本不看 prompt。

`offline.py` 自己也写明了：要回答那个问题，需要真实 provider 对着同一批语料跑；指标层和报告层是 provider-agnostic 的，所以那个模式能接进来而不用重写 golden set。

**能主动讲出这个代价，比讲这个设计本身更能体现你理解它。**

---

## 六、一个能体现「写评测的人想过怎么被骗」的细节

`metrics.py:306-315`：

```python
@property
def gap_rate(self) -> float:
    """Share of claims a traveller may not be shown. Zero claims is a full gap, not 0.0."""
    if not self.claims:
        return 1.0        # ← 注意这里
    return round((self.claims - self.usable_claims) / self.claims, 6)
```

**零条 claim 时返回 `1.0`，不是 `0.0`。**

注释解释了原因：

> A run that produced nothing has not achieved a perfect gap rate, and returning 0.0 there would let an empty run satisfy a `gap_rate <= 0.3` threshold — **the exact regression an eval suite must catch.**

**如果返回 0.0**：一个彻底崩掉、什么都没产出的 run，会拿到「完美的 gap rate」，然后**顺利通过阈值**。

**评测套件会替最严重的故障背书。**

> **这个细节很值得在面试里主动讲**——它体现的不是「我会写评测」，而是「我想过我的评测会怎么被骗」。**指标设计里最常见的失败模式，就是分母为零时的默认值给反了。**

同样思路的还有 `CitationFailureKind`（`metrics.py:53-63`），把「溯源断链」拆成四种并保持区分，**这样报告能说清是哪一种断了**：

| 类型 | 含义 |
|---|---|
| `DANGLING_EVIDENCE` | claim 引了一个不在它证据包里的 evidence ID |
| `DANGLING_CLAIM` | 下游产物引了一个它没携带的 claim ID |
| `UNUSABLE_CLAIM` | 下游把一条判决不允许使用的 claim 当事实陈述了 |
| `UNVERIFIED_CLAIM` | 一条 claim 压根没判决就进了验证后的产物 |

---

## 七、数字核准（已实测）

```bash
cd server && uv run python -m periplus.evals --quiet
```

```
PASS: 4/4 cases · 8727 tokens · $0.000000
```

| 数字 | 核准 |
|---|---|
| **4 cases** | ✅ `grounded-baseline` / `injected-instruction` / `rejects-tidied-quote` / `stale-price-downgrade` |
| **8 claims** | ✅ 3 + 2 + 1 + 2 = 8（从四个 case 的 `expect` 里 `claims` 那条求和） |
| **8,727 tokens** | ✅ 与实跑一致 |
| **$0.000000** | ✅ 因为没有真实模型调用 |

**耗时**：`time` 量整条命令 **0.36s**。（计划里记的 0.009s 是 harness 内部的执行计时，不含 Python 启动，报的时候要说清是哪个。）

> **口径提醒**：`4 cases` 和 `8 claims` 是**小数字**，**千万别说大**。四个就是四个——**说成「几十个 case」被追一层就崩，而说四个反而显得诚实**（配合下一节的局限说明）。

---

## 八、必须主动说的三条局限

**不要等被问。主动交代局限，在评测这个话题上是纯加分——因为懂行的人知道任何评测都有局限，你不说他就会觉得你不知道。**

1. **只覆盖两个阶段**——case 里 `stages` 写的是 `["research", "verify"]`，**六个阶段里的后四个（plan / write / edit / illustrate）还没有 case**
2. **测的是流水线不是 prompt 质量**——oracle 把模型判断钉死了（见第五节）
3. **4 个 case、8 条 claim 是种子集，不是覆盖率主张**——它证明的是「这套评测机制能跑通并且能抓到回归」，不是「我们的系统在广泛场景下被验证过」

---

## 九、`什么时候才该上 LLM judge`（预期追问）

**这是 AI 岗的通识题，你必须会答；但同样重要的是——绝不能说成「我项目里用了」。**

**Periplus 里没有 LLM judge。** 它用的是「把模型判断钉死 + 断言指标范围」。

**那什么时候该上 LLM-as-a-judge？**

当你要评价的东西**没法用规则断言**时——比如「这段文案读起来自然吗」「这个行程安排合理吗」。**引用完整性、新鲜度窗口、判决分布这些能用代码算的，就不该交给模型判。**

**怎么验证 judge 本身？**（这是追问的第二层，很多人答不上）

- 人工标注一批样本，算 **judge 和人工标注的一致率**（比如 Cohen's kappa）
- **judge 自己也会漂**：它也是个模型，provider 一升级它的判断就变——所以 judge 的版本也要钉住
- judge 有已知偏好：偏爱长回答、偏爱它自己家族的模型输出

**答法**

> 「我们这套里没有 LLM judge，用的是把模型判断钉死之后断言指标范围。LLM judge 适合评价没法用规则断言的东西，比如行文质量；能用代码算的引用完整性和新鲜度就不该交给模型。而且上 judge 之前得先验证 judge——拿人工标注算一致率，还得把 judge 的模型版本钉住，否则它自己就是个漂移源。」

---

## 十、一句话答法

> 四个 case、八条 claim、8727 tokens，实跑就是这个数，一条命令能复现，不花钱因为没有真实模型调用。每个 case 冻三样东西：用户的 brief、检索到的页面全文、以及时钟——冻语料是为了把检索随机性从实验里消掉，冻时钟是因为新鲜度判定直接吃时间。断言的全是范围和性质，claim 数、引用断链数、判决分布、gap rate、token 成本，**没有一条断言模型该输出什么句子**——否则每改一次 prompt 就得重写测试。判决用的是读 case 标签的 oracle，模型判断被钉成常量，所以指标一动一定是代码动了，能把真实回归和 provider 漂移分开。**代价是它测的是流水线不是 prompt 质量，而且只覆盖 research 和 verify 两个阶段、只有四个 case——是种子集，不是覆盖率主张。**
