---
title: "Day 3 · 用量与配额"
tier: must
section: Beyz · Day 2–4
icon: key-round
day: 3
level: S
status: done
---

# Day 3 · 必看 · token 用量与套餐配额

> 🔴 **必看**。回答 **Q5**（quota 在哪一层强制，为什么不能放前端）。
>
> ⚠️ **这一篇有个必须自己先知道的发现**：简历这半句的实际实现和字面读起来的不太一样。**别等面试官查出来。**

## 对应简历原句

> ...**logged per-request token usage that backs per-plan quotas**; a four-state machine drops overlapping generations.

拆成两件事：

1. `logged per-request token usage` —— **每次请求的 token 用量落库**
2. `that backs per-plan quotas` —— **这些用量支撑按套餐的配额**

**第 1 件代码里确实做了。第 2 件要打个问号，见第四节。**

---

## 一、token 用量是怎么采集的

```js
// server/actions/copilot.ts:103-117
const { textStream } = await streamText({
  model: openai("gpt-4o"),
  system: prompt,
  messages: convertToCoreMessages(recentHistory),
  onFinish: async ({ usage, text }) => {
    const { promptTokens, completionTokens } = usage
    await db.insert(copilotUsageLogs).values({
      copilotId,
      userId,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
    })
    ...
  },
})
```

**三个点值得说：**

**① 采集点在 `onFinish`，不是自己数 token。**
Vercel AI SDK 的 `onFinish` 回调里直接给了 provider 返回的真实 `usage`。**自己按字符数估算是错的**——tokenizer 的切分和字符数没有稳定比例（中文尤其），而计费是按 provider 报的数走的。

**② input 和 output 分开记。**
因为**两者单价不同**（output 通常贵好几倍）。合并成一个数就没法算成本，也没法看出「是 prompt 太长还是答案太长」。

**③ 它是流式生成的收尾回调。**
`streamText` 一边往外吐 token 一边跑，`onFinish` 在流结束后触发——**所以记账不阻塞用户看到答案**。这个顺序是对的：先让用户看到内容，再落账。

---

## 二、配额是怎么算的

```js
// CopilotSection.tsx:173-176
const checkQuestionLimit = useCallback(() => {
  const { questionsPerCopilot } = subscriptionPlans[subscribedPlan].limits
  return recruiterMessages.length > questionsPerCopilot
}, [recruiterMessages.length, subscribedPlan])
```

各档的额度（`constants/subscription.ts`）：

| 套餐 | `questionsPerCopilot` |
|---|---|
| Free | **0** |
| Standard | **200** |
| God | `Infinity` |
| Lifetime | `Infinity` |

**注意配额的单位是「问题条数」，不是 token。** token 是记下来了，但**配额算的是提问次数**。

### 两处强制点

```js
// ① 开始面试前  :209-212
if (checkQuestionLimit()) {
  setShowSubscribeDialog(true)
  return
}

// ② 面试进行中持续检查  :221-226
useEffect(() => {
  if (checkQuestionLimit()) {
    stopInterview()
    setShowSubscribeDialog(true)
  }
}, [checkQuestionLimit])
```

**第二处比第一处重要**：额度是在面试过程中一条条消耗的，**只在开始时查一次的话，用户可以一直问下去**。放在 `useEffect` 里意味着每次 `recruiterMessages.length` 变化都重新判定。

---

## 三、Q5：quota 在哪一层强制

**先讲应该怎样，再讲实际怎样。**

### 应该怎样：前端不能是 entitlement 的真源

**三条理由：**

1. **前端代码是用户可控的。** F12 改个变量、拦截请求、直接调接口——`recruiterMessages.length > 200` 这个判断在用户机器上跑，用户想让它返回 false 就能返回 false
2. **前端的数据可能是不全的。** `recruiterMessages` 来自当前页面加载的消息列表。**换个设备、开个新标签页，这个计数就重新开始了**
3. **前端拦截只改变行为，不提供保证。** 这和 [百度提现](/docs?section=numbers&item=n07-qps) 那条是同一句话：**前端减少无效负载，正确性必须来自服务端。**

**正确的位置是服务端**：在 `generateCopilotSuggestion` 里查一次「这个 copilot 已经有多少条 recruiter 消息了」，超了直接拒。

### 实际怎样 ⚠️

**服务端只拦了套餐，没拦条数。**

```js
// copilot.ts:94-97  —— 服务端唯一的门禁
const { id: userId, subscribedPlan } = await getAuthUser()
if (subscribedPlan === SubscriptionPlan.Free) {
  throw new Error("Unauthorized")
}
```

**grep 全仓库可以证实：**

```
questionsPerCopilot 的引用只有三处
  CopilotSection.tsx:174-175   ← 客户端判定
  constants/subscription.ts    ← 配置定义
  PlanCards.tsx:222-226        ← 定价页展示
```

**没有任何服务端代码读它。**

**所以实际的强制边界是这样的：**

| 谁 | 被什么拦住 | 拦在哪 |
|---|---|---|
| **Free 用户** | 服务端 `throw Unauthorized` | ✅ 服务端，绕不过 |
| **Standard 用户超过 200 条** | 只有前端那个 `useEffect` | ⚠️ **客户端，可绕过** |

**一个 Standard 用户绕过前端界面直接调 Server Action，能一直生成下去。**

---

## 四、`backs per-plan quotas` 这半句要怎么讲

**`copilotUsageLogs` 是只写不读的。**

```
grep -rn "copilotUsageLogs" src/
  copilot.ts:112        db.insert(...)     ← 唯一一次写
  schema.ts:221,265,292 表定义和关系
```

**全仓库没有一次 `select`。** 这张表现在是**审计/分析用的记录**，不是配额的执行依据。

**所以 `backs per-plan quotas`（支撑按套餐的配额）这个说法，比实现走得远了一点**：

- ✅ 用量确实**记下来了**，而且 input/output 分开、数据来自 provider 的真实 usage
- ⚠️ 但配额**不是靠这些日志执行的**——执行的是客户端那个提问条数判断
- ⚠️ 而且配额的单位是**提问条数**，不是 token

### 两条出路，选一条

**① 改措辞**（推荐，成本最低）

> ...and **recorded per-request prompt/completion token usage against each copilot**; a four-state machine drops overlapping generations.

把 `backs per-plan quotas` 换成一个**只声称「记录」**的说法。**丢掉一个撑不住的因果，留下一个能指着行号讲的事实。**

**② 不改，但主动拆开讲**

> 「token 用量是每次生成结束在 `onFinish` 里落库的，input 和 output 分开记，用的是 provider 返回的真实 usage 不是自己估的。**配额本身现在算的是提问条数不是 token，而且这个判定在客户端**——服务端只拦了 Free 档。**这是我知道要补的地方**：正确做法是在 Server Action 里查一次已用条数，客户端那层只用来提前给用户反馈。」

> **主动说这一句的收益很大**：它同时证明了三件事——你知道 entitlement 该放服务端、你知道自己代码的边界在哪、你不会为了简历好看而含糊。**而且这正是 Day 3 那句「我知道怎么把 AI demo 变成 production system」最好的注脚**：知道哪里还不够 production，本身就是 production 意识。

---

## 五、并发下的重复扣减（复习重点里列了，值得想清楚）

**这个场景在当前实现里其实不成立，但要能说清为什么。**

**为什么现在不会重复扣减**：配额判定是**读当前消息条数**（`recruiterMessages.length`），不是「余额减一」这种增量操作。**读绝对值天然幂等**——同一条消息不会因为判定跑了两次就被算成两条。

**什么时候会变成问题**：如果哪天改成「预付费额度」模型（比如买 500 次提问，用一次扣一次），那就变成了增量写，**两个并发请求可能各读到同一个余额、各减一次、只扣掉一次**。

**那时候的正确做法**（和[百度提现](/docs?section=numbers&item=n07-qps)完全同一套）：

```sql
UPDATE quota SET remaining = remaining - 1
WHERE user_id = ? AND remaining > 0;
```

**把不变量写在 SQL 的 WHERE 里，靠受影响行数判断成功与否**，而不是先查再写。

> **能把这条和 Stripe 的 `ne(Lifetime)`、百度提现的 `balance >= ?` 串起来讲，就是 Day 14 Round 3 那道跨项目题的现成答案。**

---

## 六、预期追问速查

| 问题 | 要点 |
|---|---|
| token 用量怎么采的？ | `streamText` 的 `onFinish({usage})`，provider 返回的真实数，**不是自己按字符估** |
| 为什么 input/output 分开记？ | 单价不同（output 贵几倍），合并就算不出成本、看不出是 prompt 长还是答案长 |
| 配额单位是什么？ | **提问条数**（`questionsPerCopilot`），不是 token |
| 配额在哪一层强制？ | ⚠️ **Free 档在服务端拦得住；200 条这个限制只在客户端**——主动说，并给出正确做法 |
| 前端为什么不能是 entitlement 真源？ | 用户可控、数据可能不全、前端只改变行为不提供保证 |
| 用量日志用来干嘛？ | 现在**只写不读**，是审计/分析记录，不是配额执行依据 |
| 并发重复扣减？ | 现在读绝对值天然幂等；改成预付费额度后要用 `WHERE remaining > 0` 的条件更新 |
