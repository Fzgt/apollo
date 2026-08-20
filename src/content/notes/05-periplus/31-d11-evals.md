---
title: "⑤ golden set 与 evals"
tier: must
section: Periplus
icon: workflow
day: 11
level: S
status: done
---

# 评测这条怎么讲

> 🔴 **必看**。⚠️ **这一天你在 Day 1 已经写透了**：[#16 · golden set 四个数字](/docs?section=periplus&item=n16-golden-set)（冻结什么、断言范围、四个 case 逐个精读、oracle 钉死模型判断、`gap_rate` 返回 1.0、三条局限、什么时候该上 LLM judge）。
>
> **这一篇只补 #16 没覆盖的三块**，外加口播稿。

## 30 秒口播稿（改一改就能用）

> LLM 系统改一个 prompt，怎么知道是变好了还是变坏了？**大多数人是「肉眼看几个例子」——不可重复、不可比较，而且你只会去看你想到的那几个 case。**
>
> 我们的做法是**冻结输入、断言性质**：每个 case 把行程简报、检索到的页面全文、还有时钟全部冻死，然后断言的不是「模型该输出哪句话」，而是**可计数的性质**——产出了几条声明、引用完整性有没有破、判决分布是什么、花了多少 token。
>
> **关键设计是核查阶段用一个读标签的 oracle 代替模型**，所以模型判断是常量。**指标只要动，一定是代码动了**——这是离线评测唯一能把真实回归和模型漂移分开的办法。**代价是它测的是流水线不是 prompt 质量，这一点我会主动说。**

## 一、Q1：怎么知道版本 B 真的比 A 好

**靠 `report.py:194` 的 `compare()`** —— 生成一份 Markdown 的前后差异，docstring 说得很准：*"the sentence a change is defended with"*（**一次改动是拿这句话去辩护的**）。

⭐ **但真正值得讲的是它防了什么**：

> *"Cases present in only one report are listed rather than dropped: **a comparison that quietly ignores a removed case can show an improvement that is really just a missing test.**"*

**删掉一个不通过的 case，指标当然会变好。** 这个设计让「少了一个 case」显式出现在报告里，**而不是伪装成进步**。

> **这和 [`gap_rate` 零 claim 返回 1.0](/docs?section=periplus&item=n16-golden-set) 是同一个思路：写评测的人想过自己的评测会怎么被骗。** 两个例子一起讲很有力。

## 二、⭐ Q4：怎么避免 prompt 对着 golden set 过拟合

**这一问 #16 没答，而且它是评测话题里最见功力的一问。**

**先承认风险**：只有四个 case，反复调 prompt 直到四个都过，那就是在拟合这四个 case 而不是在改进系统。

**这套设计里有三道结构性的防线：**

| 防线 | 怎么起作用 |
|---|---|
| ⭐ **oracle 钉死了模型判断** | 核查阶段读的是 case 标签**不是证据**，所以**改 Auditor 的 prompt 根本不会让指标移动**——想靠调那个 prompt 把 eval 调绿，**结构上就做不到** |
| **断言的是范围不是字面值** | 范围留了余地，**不奖励「刚好卡到某个精确值」**的调法 |
| **`compare()` 会点出消失的 case** | 靠删 case 来刷指标会被看见 |

**还有一条纪律层面的**：**加 case 的动机应该是「发现了一个新的失败模式」，不是「想让某个数字变好看」。**

> ⚠️ **诚实的局限要主动说**：**没有 hold-out set**——四个 case 全部参与调优，没有留一组不看的。**四个 case 是种子集，不是覆盖率主张。** 真要防过拟合，标准做法是留出一部分 case 只在发布前跑一次。

## 三、prompt 版本怎么归因（很细但很能加分）

**`prompts.py` 文件头解释了一个反直觉的取舍：**

> *"The obvious candidate for that attribution — `ModelCall.prompt_hash` — **cannot do the job across runs**... it digests the *whole* assembled prompt, which for research includes the brief\'s generated id and for verification includes **freshly minted claim and evidence UUIDs**. **Two identical runs therefore produce different digests.**"*

**翻译**：`prompt_hash` 摘的是**组装好的完整 prompt**，里面混进了每次都新生成的 UUID。**所以两次完全一样的运行会得到两个不同的哈希**——它能用来在一次 run 内部给重复调用分组（那是它被造出来的用途），**但完全不能当作 prompt 的版本号**。

**解法是改摘 stage 的 system prompt**——真正会随人编辑而变的那段文本。

⭐ **而且这段注释还坦白了实现上的将就：**

> *"It reaches into the agent modules\' private constants on purpose: **that is the stopgap, and the discomfort is the signal.**"*

> **「这个别扭本身就是信号」** —— 承认当前实现是权宜之计、正确做法是把 prompt 提到一个带版本的模块里。**面试里引这一句，能同时证明两件事：你在意归因的严谨性，而且你知道自己的临时方案临时在哪。**

## 四、其余四问直接跳回 #16

| 问题 | 去哪 |
|---|---|
| **为什么断言范围而不是字面输出** | [#16 · 三](/docs?section=periplus&item=n16-golden-set)（断字面 = 每改一次 prompt 就得重写测试） |
| **golden set 冻结了什么** | [#16 · 二](/docs?section=periplus&item=n16-golden-set)（brief / corpus / clock，各有各的理由） |
| **什么时候该上 LLM judge，怎么验证它** | [#16 · 九](/docs?section=periplus&item=n16-golden-set)（**这里没有 LLM judge**，绝不能说成用了；验证 judge 要算和人工标注的一致率，而且 judge 版本也要钉住） |
| **`gap_rate` 零 claim 为什么返回 1.0** | [#16 · 六](/docs?section=periplus&item=n16-golden-set)（返回 0.0 会让空跑通过阈值） |

## 五、必须主动说的三条局限

**别等被问**——在评测这个话题上主动交代局限是纯加分，因为懂行的人知道任何评测都有局限，你不说他就觉得你不知道。

1. **只覆盖 research 和 verify 两个阶段**，后四个阶段没有 case
2. **测的是流水线不是 prompt 质量**（oracle 钉死了模型判断）
3. **四个 case、八条 claim 是种子集，不是覆盖率主张**
