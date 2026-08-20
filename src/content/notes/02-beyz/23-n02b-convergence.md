---
title: "③ 早到晚到与收敛"
section: Beyz
icon: radio
tier: ref
day: 4
level: 前置
status: done
---

# #2 补充 · 早到晚到与收敛

> [#2](/docs?section=beyz&item=n02-stripe-events) 讲了 `ne(Lifetime)` 这个守卫写在 SQL 的 WHERE 里。这一篇把它推到底：**为什么两个 webhook 不管谁先谁后，最终状态都是对的。** 这是 `none of which can downgrade a lifetime purchase` 最强的答法。

## 对应简历原句

Beyz 第 3 条 bullet 的最后半句：

> ...entitlements written only by signature-verified webhooks across six subscription events, **none of which can downgrade a lifetime purchase**.

---

## 一、先看买断时代码干了什么

`route.ts:92-109`，`handleCheckoutSessionCompleted` 里，买断分支做了**两件事，有先后**：

```ts
if (containsLifetimePlan) {
  // 第一件：取消该用户所有现存订阅
  const subscriptions = await stripe.subscriptions.list({ customer: customerId })
  for (const subscription of subscriptions.data) {
    await stripe.subscriptions.cancel(subscription.id)        // :99
  }
  // 第二件：把 plan 写成 Lifetime
  await db.update(users).set({                                 // :102-108
    subscribedPlan: SubscriptionPlan.Lifetime,
    hasPurchasedPlan: true,
  }).where(eq(users.stripeCustomerId, customerId))
}
```

为什么要先取消订阅？因为用户原来可能正订着 Standard 按月付费。既然买断了，就不该再继续扣款。

**但这一步会捅出一个副作用**：取消订阅会让 Stripe 再发一个 `customer.subscription.deleted` webhook 回来。而那个 webhook 的处理逻辑是 —— **把 plan 写成 Free**。

---

## 二、「早到 / 晚到」比的是什么

比的是这两次 DB 写入的先后：

| | 是什么 | 在哪 |
|---|---|---|
| **甲** | 把 plan 写成 **Lifetime** | `route.ts:102-108`，就在当前这个 handler 里 |
| **乙** | 把 plan 写成 **Free** | `deleteUserSubscription`，由 `customer.subscription.deleted` webhook 触发 |

**关键是要意识到：乙是一个全新的 HTTP 请求，Stripe 从外面重新打进来的**，跟甲不在同一个执行流里，可能落在另一个实例上。两者在赛跑，谁先到不由你决定。

```
handleCheckoutSessionCompleted 里：
  :99   cancel 订阅  ──────► Stripe 那边准备发 deleted webhook
  :102  DB 写 Lifetime  = 甲

Stripe 发回来（时间不确定）：
  customer.subscription.deleted ──► DB 写 Free  = 乙
```

---

## 三、两条时间线

**乙晚于甲**

```
:99  取消订阅
:102 DB → Lifetime                    ← 甲
        乙到达：写 Free，但 WHERE 带 ne(Lifetime)
              当前正是 Lifetime → 匹配 0 行 → 什么都没改
最终：Lifetime ✅
```

**乙早于甲**

```
:99  取消订阅
        乙到达：写 Free，此时 DB 还是 Standard
              ne(Lifetime) 不挡它 → 真的写成了 Free
:102 DB → Lifetime                    ← 甲，无条件写，直接盖掉 Free
最终：Lifetime ✅
```

---

## 四、为什么两种顺序都收敛

靠的是**两个不同的机制各管一边**：

| 顺序 | 靠什么兜住 |
|---|---|
| 乙晚到 | `ne(Lifetime)` 守卫挡住降级 |
| 乙早到 | `:102-108` 那次写入**故意不带守卫**，无条件覆盖 |

所以 [#2](/docs?section=beyz&item=n02-stripe-events) 里说的「`:102-108` 故意没有 guard」不只是「入口不能挡自己」——**它同时还是早到那条路径的兜底**。少了它，乙早到时用户就卡在 Free 了，付了买断的钱拿不到权限。

---

## 五、这说明了什么

**`none of which can downgrade a lifetime purchase` 不是靠事件顺序保证的。**

顺序你根本控制不了——webhook 什么时候到、走哪个实例、会不会重投，全在 Stripe 那边。**能控制的只有「不管什么顺序，最终状态都对」。**

这就是所谓的**收敛（convergence）**：系统从任何中间状态出发，都会落到同一个正确的终态。

**一句话答法**

> 买断时会先取消旧订阅，那个取消又会触发一个 deleted webhook 回来试图降级。这两次写入谁先谁后不确定，但两种顺序都收敛到 Lifetime：晚到的被 WHERE 里的 `ne(Lifetime)` 挡住，早到的被随后那次无条件写入盖掉。所以这半句话保证的不是顺序，是终态。
