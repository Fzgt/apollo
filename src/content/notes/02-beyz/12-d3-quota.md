---
title: "② 用量与配额"
tier: must
section: Beyz
icon: key-round
day: 3
level: S
status: done
---

# token 用量与提问配额

> 🔴 **必看**。⚠️ **有个必须自己先知道的发现**：简历这半句的实际实现，和字面读起来的不太一样。**别等面试官查出来。**

## 对应简历原句

> ...**logged per-request token usage that backs per-plan quotas**...

**拆成两件事：**

1. `logged per-request token usage` —— **每次请求的 token 用量落库**
2. `that backs per-plan quotas` —— **这些用量支撑按套餐的配额**

**第 1 件代码里确实做了。第 2 件要打个问号，见第四节。**

## 一、先说清什么是 token 和为什么要记

**token 是大模型计费和计算的单位** —— 大致对应一个词或一个词的一部分（中文里常常一两个字一个 token）。**你发给模型的内容叫 input token，它吐回来的叫 output token，两者分开计价，output 通常贵好几倍。**

```js
// copilot.ts:103-117
const { textStream } = await streamText({
  model: openai("gpt-4o"),
  ...
  onFinish: async ({ usage }) => {          // 生成全部结束后触发这个回调
    const { promptTokens, completionTokens } = usage;
    await db.insert(copilotUsageLogs).values({
      copilotId, userId,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
    });
  },
});
```

**三个设计点：**

| 点 | 为什么 |
|---|---|
| **用回调里给的 `usage`，不自己数** | 模型服务商会在响应里告诉你这次用了多少 token。**自己按字符数估算是错的** —— 分词规则和字符数没有稳定比例（中文尤其），**而计费是按服务商报的数走的** |
| **input 和 output 分开记** | **两者单价不同**。合并成一个数就算不出成本，也看不出「是提示词太长还是答案太长」 |
| **在流结束后才记** | `onFinish` 是生成全部完成后触发的 —— **记账不阻塞用户看到答案**。先让用户看到内容，再落账 |

## 二、配额是怎么算的

```js
// CopilotSection.tsx:173-176
const checkQuestionLimit = () => {
  const { questionsPerCopilot } = subscriptionPlans[subscribedPlan].limits;
  return recruiterMessages.length > questionsPerCopilot;
  //     ↑ 已经问过的问题数            ↑ 这个套餐允许的上限
};
```

各档的额度（`constants/subscription.ts`）：

| 套餐 | 每个 copilot 能问几个问题 |
|---|---|
| Free | **0** |
| Standard | **200** |
| God / Lifetime | 无限 |

> ⚠️ **注意配额的单位是「问题条数」，不是 token。** token 是记下来了，但**配额算的是提问次数** —— 这两件事在代码里其实没有连起来。

**两处强制点：**

```js
// ① 点「开始面试」时  :209-212
if (checkQuestionLimit()) { setShowSubscribeDialog(true); return; }

// ② 面试进行中持续检查  :221-226
useEffect(() => {
  if (checkQuestionLimit()) { stopInterview(); setShowSubscribeDialog(true); }
}, [checkQuestionLimit]);
```

> **第二处比第一处重要**：额度是在面试过程中一条条消耗的。**只在开始时查一次的话，用户可以一直问下去。** 放在 `useEffect` 里意味着每次问题数变化都重新判定。

## 三、为什么前端不能是权限的真源

**「权限的真源」（source of truth）指的是「到底谁说了算」。**

**前端不能当真源，三条理由：**

1. **前端代码是用户可控的** —— 打开开发者工具改个变量、直接调接口，`已问数 > 200` 这个判断在**用户自己的机器上**跑，用户想让它返回 false 就能返回 false
2. **前端的数据可能不全** —— `recruiterMessages` 来自当前页面加载的消息列表。**换个设备、开个新标签页，这个计数就重新开始了**
3. **前端拦截只改变行为，不提供保证** —— 它能让守规矩的用户看到「额度用完了」的提示，但拦不住任何一个想绕过的人

> **这和[百度提现](/docs?section=baidu&item=n07-qps)那条是同一句话：前端减少无效负载，正确性必须来自服务端。**

**正确的位置是服务端**：在生成的那个函数里查一次「这个 copilot 已经有多少条问题了」，超了直接拒绝。

## 四、⚠️ 实际怎样：服务端只拦了套餐，没拦条数

```js
// copilot.ts:94-97  —— 服务端唯一的门禁
const { id: userId, subscribedPlan } = await getAuthUser();
if (subscribedPlan === SubscriptionPlan.Free) {
  throw new Error("Unauthorized");
}
```

**搜一遍全仓库可以证实**：那个「每个 copilot 能问几个」的配置只出现在三个地方 —— **客户端的判定、配置文件本身、定价页的展示**。**没有任何服务端代码读它。**

**所以实际的强制边界是这样的：**

| 谁 | 被什么拦住 | 拦在哪 |
|---|---|---|
| **免费用户** | 服务端直接抛错 | ✅ **服务端，绕不过** |
| **付费用户超过 200 条** | 只有前端那个持续检查 | ⚠️ **客户端，可以绕过** |

**一个 Standard 用户绕过界面直接调那个接口，能一直生成下去。**

## 五、`backs per-plan quotas` 这半句怎么讲

**那张记 token 用量的表是「只写不读」的** —— 全仓库只有一次写入，**零次查询**。

**所以它现在是一张审计/分析用的记录表，不是配额的执行依据。**

**`backs`（支撑）这个词，比实现走得远了一点：**

- ✅ 用量确实**记下来了**，而且 input/output 分开、数据来自服务商的真实报数
- ⚠️ 但配额**不是靠这些日志执行的** —— 执行的是客户端那个提问条数判断
- ⚠️ 而且配额的单位是**提问条数**，不是 token

### 两条出路，选一条

**① 改措辞**（推荐，成本最低）

> ...and **recorded per-request prompt/completion token usage against each copilot**

**把「支撑配额」换成只声称「记录」。** 丢掉一个撑不住的因果，留下一个能指着行号讲的事实。

**② 不改，但主动拆开讲**

> 「token 用量是每次生成结束在回调里落库的，input 和 output 分开记，用的是服务商返回的真实数据不是自己估的。**配额本身现在算的是提问条数不是 token，而且这个判定在客户端** —— 服务端只拦了免费档。**这是我知道要补的地方**：正确做法是在服务端查一次已用条数，客户端那层只用来提前给用户反馈。」

> ⭐ **主动说这一句收益很大**：它同时证明三件事 —— 你知道权限该放服务端、你知道自己代码的边界在哪、你不会为了简历好看而含糊。
>
> **而且这正是这条 bullet 想证明的东西最好的注脚**：这条讲的是「我知道怎么把 AI demo 变成能上生产的系统」，**而知道哪里还不够 production，本身就是 production 意识。**

## 六、并发下会重复扣减吗

**先解释这个问题**：如果两个请求同时到达，各自读到「还剩 5 次」，各自扣一次写回「还剩 4 次」—— **扣了两次，只少了一次**。这是经典的并发问题。

**现在不会发生** —— 因为配额判定是**读当前消息条数**（一个绝对值），不是「余额减一」这种增量操作。**读绝对值天然幂等**：同一条消息不会因为判定跑了两次就被算成两条。

**什么时候会变成问题**：如果改成「预付费额度」模型（买 500 次提问，用一次扣一次），那就变成了增量写，**两个并发请求就可能各读到同一个余额、各减一次、最后只扣掉一次**。

**那时候的正确做法**（和[百度提现](/docs?section=baidu&item=n07-qps)完全同一套）：

```sql
UPDATE quota SET remaining = remaining - 1
WHERE user_id = ? AND remaining > 0;
```

**把「余额必须大于 0」这个条件写进 SQL 的 WHERE 里，靠「这条语句影响了几行」判断成功与否** —— 而不是先查再写。**因为数据库执行单条 UPDATE 是原子的，两个并发请求只有一个能让条件成立。**

> **能把这条和 [Stripe 的终身档保护](/docs?section=beyz&item=n02b-convergence)、[百度提现的余额约束](/docs?section=baidu&item=n07-qps) 串起来讲，就是[跨项目追问](/docs?section=cheatsheet&item=crosscut)那道题的现成答案。**
