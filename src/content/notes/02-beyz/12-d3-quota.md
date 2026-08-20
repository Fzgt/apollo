---
title: "② 用量与配额"
tier: must
section: Beyz
icon: key-round
day: 3
level: S
status: done
---

# token 用量与套餐配额

> 🔴 **必看**。⚠️ **有个必须自己先知道的发现**：简历这半句的实际实现和字面读起来的不一样。**别等面试官查出来。**

## 简历原句拆成两件事

> ...**logged per-request token usage** that **backs per-plan quotas**...

**第 1 件代码确实做了，第 2 件要打问号。**

## token 用量怎么采集

```js
// copilot.ts:107-117
onFinish: async ({ usage }) => {
  const { promptTokens, completionTokens } = usage;
  await db.insert(copilotUsageLogs).values({ copilotId, userId,
    inputTokens: promptTokens, outputTokens: completionTokens });
}
```

| 点 | 为什么 |
|---|---|
| **用 `onFinish` 给的 usage，不自己数** | tokenizer 的切分和字符数没有稳定比例（中文尤其），**而计费按 provider 报的数走** |
| **input / output 分开记** | **两者单价不同**（output 通常贵几倍）。合并就算不出成本、看不出是 prompt 长还是答案长 |
| **在流结束后触发** | **记账不阻塞用户看到答案**——先让用户看到内容，再落账 |

## 配额怎么算

```js
// CopilotSection.tsx:173-176
return recruiterMessages.length > subscriptionPlans[subscribedPlan].limits.questionsPerCopilot;
```

| 套餐 | 额度 |
|---|---|
| Free | **0** |
| Standard | **200** |
| God / Lifetime | `Infinity` |

**注意单位是「问题条数」不是 token。** 两处强制：开始面试前（`:209-212`）、**面试进行中 `useEffect` 持续检查**（`:221-226`）——后者更重要，**只在开始查一次的话用户可以一直问下去**。

## ⚠️ Q：quota 在哪一层强制

**应该怎样**：前端不能是 entitlement 的真源。三条理由——①**前端代码用户可控**（F12 改个变量就行）②**前端数据可能不全**（换设备/新标签页计数重新开始）③**前端拦截只改变行为，不提供保证**。

> 这和 [百度提现](/docs?section=baidu&item=n07-qps) 是同一句话：**前端减少无效负载，正确性必须来自服务端。**

**实际怎样**：服务端只拦了套餐，**没拦条数**。

```js
// copilot.ts:94-97  —— 服务端唯一的门禁
if (subscribedPlan === SubscriptionPlan.Free) throw new Error("Unauthorized");
```

**grep 可以证实**：`questionsPerCopilot` 只出现在 `CopilotSection.tsx`（客户端判定）、`constants`（配置）、`PlanCards`（定价页展示）——**没有任何服务端代码读它**。

| 谁 | 被什么拦住 |
|---|---|
| **Free 用户** | ✅ 服务端 `throw`，绕不过 |
| **Standard 超过 200 条** | ⚠️ **只有前端那个 useEffect，绕过界面直接调 Server Action 能一直生成** |

## `backs per-plan quotas` 这半句要怎么讲

**`copilotUsageLogs` 是只写不读的**——一次 `insert`，零次 `select`。**这张表现在是审计/分析记录，不是配额的执行依据。**

**两条出路：**

**① 改措辞**（推荐）：`backs per-plan quotas` → **`recorded per-request prompt/completion token usage against each copilot`**，只声称「记录」。丢掉一个撑不住的因果，留下一个能指行号的事实。

**② 不改但主动拆开讲**：

> 「token 用量是每次生成结束在 `onFinish` 里落库的，input/output 分开记，用的是 provider 返回的真实 usage 不是自己估的。**配额本身现在算的是提问条数不是 token，而且这个判定在客户端**——服务端只拦了 Free 档。**这是我知道要补的地方**：正确做法是在 Server Action 里查一次已用条数，客户端那层只用来提前给用户反馈。」

> **主动说这一句收益很大**：同时证明你知道 entitlement 该放服务端、知道自己代码的边界、不会为了简历好看含糊。**而且这正是 Day 3「把 AI demo 变成 production system」最好的注脚——知道哪里还不够 production，本身就是 production 意识。**

## 并发重复扣减

**现在不会**——配额判定是**读当前消息条数**（绝对值），不是「余额减一」的增量操作，**读绝对值天然幂等**。

**改成预付费额度就会**，那时的正确做法和[百度提现](/docs?section=baidu&item=n07-qps)完全同一套：

```sql
UPDATE quota SET remaining = remaining - 1 WHERE user_id = ? AND remaining > 0;
```

**把不变量写在 WHERE 里，靠受影响行数判断成败**，而不是先查再写。

> 能把这条和 Stripe 的 `ne(Lifetime)`、百度的 `balance >= ?` 串起来，**就是 Day 14 Round 3 跨项目题的现成答案。**
