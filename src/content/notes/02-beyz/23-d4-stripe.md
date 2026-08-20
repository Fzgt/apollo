---
title: "Day 4 · 参考 · Stripe"
section: Beyz · Day 2–4
icon: radio
day: 4
level: A
status: done
---

# Day 4 · 参考 · 付费转化路径

> ⚪ **速查**。**这条 bullet 你在 Day 1 已经学了大半**，不用重看：
> - [#2 · six subscription events](/docs?section=numbers&item=n02-stripe-events) —— 哪六个、两层事件模型、漏一个的后果、验签、幂等与乱序、`only` 怎么自证
> - [#2 补充 · 早到晚到与收敛](/docs?section=numbers&item=n02b-convergence) —— lifetime 不可降级的收敛性论证
>
> 这一篇只补那两篇没覆盖的 **Q1**（付款成功但浏览器关了）和 **Q6**（为什么只能 webhook 写），外加 trial 生命周期。

## 对应简历原句

> Owned the paid conversion path — Stripe Checkout, **trials and lifetime purchases** on Next.js, tRPC and Drizzle — with plan eligibility enforced in typed server actions and entitlements written only by signature-verified webhooks across six subscription events, none of which can downgrade a lifetime purchase.

---

## 一、Q1 + Q6：付款成功但浏览器关了会怎样

**这两问其实是同一个问题的正反面，一起答最有力。**

### 场景

```
用户在 Stripe Checkout 页面付款成功
  → Stripe 准备把他重定向回 success_url
    → 用户直接关了浏览器 / 网断了 / 手机锁屏了
      → success_url 从来没被访问过
```

**如果 entitlement 是在 success 页面写的：用户付了钱，权限没到账。**

### 反过来还有更糟的

**`success_url` 是个普通的 URL，用户可以直接手敲。**

```
把 /checkout/success?plan=lifetime 存成书签，每天访问一次
  → 如果这个页面会写 entitlement，等于免费领终身版
```

> **所以「用户跳回 success_url」这件事，既不是「付款成功」的充分条件，也不是必要条件——它和付款根本不是一回事。**
>
> **它只是一个 UI 跳转。**

### 唯一可信的事实源

**只有 Stripe 用签名推给你的 webhook 事件**。

| | 可信吗 | 为什么 |
|---|---|---|
| 前端 success 回调 | ❌ | 用户可伪造、可跳过 |
| 前端轮询「我付款了吗」 | ⚠️ | 得问服务端，而服务端还是得从 Stripe 拿事实 |
| **签名验证过的 webhook** | ✅ | **Stripe 主动推，带 HMAC 签名，伪造不了** |

**代码里这条边界是干净的**（[#2 第六节](/docs?section=numbers&item=n02-stripe-events)有 grep 证据）：全仓库对 `subscribedPlan` 的写入**只有三处，全在 `webhook/route.ts`**；`server/actions/subscription.ts` 那次 `update(users)` 只写 `stripeCustomerId`，不碰 entitlement。

**职责划分一句话**：

> **server action 管「你有没有资格发起购买」，webhook 管「你实际买到了什么」。前者可以拒，但永远不能给。**

### 那用户关了浏览器，他什么时候能看到权限

**webhook 到达时数据库就已经改了**，用户下次打开页面就是新状态。**`success_url` 只负责给他一个「买好了」的界面，不承担任何数据职责。**

**这也是为什么 Stripe 会重试 webhook**：如果你的服务端当时挂了，Stripe 会带退避地重投，直到你返回 2xx。**这套重试机制正是「webhook 才是事实源」能成立的基础。**

---

## 二、trial 生命周期（那两篇没覆盖）

```js
// server/actions/subscription.ts
:53-58   if (hasPurchasedPlan && addTrial) → 拒绝    // 只给首次用户
:139-140 const trialProductId = process.env.STRIPE_TRAIL_PRODUCT_ID
:141-147 lineItems 里额外加一条 trial 的 price
:163     trial_period_days: addTrial ? TRIAL_DAYS : undefined    // TRIAL_DAYS = 7
```

**三个设计点：**

**① trial 是一个独立的 product，不是一个折扣。**
`lineItems` 里同时放了正式 plan 的 price 和 trial 的 price（`:141-147`）。**这样试用期那笔小额费用（`trialPrice: 1.99`）是一次真实的收款**——不是零元订单。

> **为什么不用零元试用**：零元订单验证不了支付方式的有效性。**收 1.99 意味着卡是真的能扣款的**，试用期结束转正式订阅时不会因为卡无效而失败。**这是支付产品里的常见手法**，能说出来很加分。

**② 资格判定在服务端，而且用的是持久化字段。**
`hasPurchasedPlan` 存在用户表里（webhook 写入时一并置位，见 `webhook/route.ts:106`、`:402`）。**「有没有买过」是数据库里的事实，不是前端状态。**

**③ 类型层面就挡掉了非法输入。**
```ts
selectedPlan: Exclude<SubscriptionPlan, SubscriptionPlan.Free>   // :13
```
**Free 档在类型上就传不进来**——这是 `plan eligibility enforced in typed server actions` 那半句的字面出处。

### trial 结束时发生什么

`trial_period_days` 到期后，Stripe 自动发起首次正式扣款：

- 扣款成功 → `customer.subscription.updated`，`status` 从 `trialing` 变 `active` → 代码判定为 **RENEW**（`webhook/route.ts:183`）
- 用户在试用期取消 → `cancel_at_period_end` 置真 → 判定为 **CANCEL**，且因为 `status === "trialing"`，发的是**专门的 `TrialCanceledEmail`**（`:217-218`）而不是普通挽留邮件

> **「试用期取消」和「付费后取消」走不同的挽留邮件——这个细节说明产品侧真的分了场景**，不是一套模板打天下。

---

## 三、其余四问去哪看

| 问题 | 去哪 |
|---|---|
| **Q2** 怎么确认 webhook 来自 Stripe？为什么必须原始 body？ | [#2 · 七](/docs?section=numbers&item=n02-stripe-events) —— 签名是对**字节流**算的 HMAC，`JSON.parse` 再 `stringify` 键序和空白就变了 |
| **Q3** 重复投递怎么处理？ | [#2 · 八](/docs?section=numbers&item=n02-stripe-events) —— **没有 event id 去重表**，靠「写绝对值」天然幂等；发邮件那条用 `emailTracking` 显式去重。**照实说** |
| **Q4** 事件乱序怎么处理？ | [#2 · 八](/docs?section=numbers&item=n02-stripe-events) —— **没处理**，主动交代；正解是存 event 时间戳做版本比较 |
| **Q5** 六个事件各改了 entitlement 的哪一位？ | [#2 · 二、三、四](/docs?section=numbers&item=n02-stripe-events) —— 六个 case + 两层事件模型 + 漏一个的后果二分法 |
| lifetime 为什么不可降级？ | [#2 补充](/docs?section=numbers&item=n02b-convergence) —— WHERE 里的 `ne(Lifetime)` + 两种到达顺序都收敛 |

---

## 四、预期追问速查

| 问题 | 要点 |
|---|---|
| 付款成功但浏览器关了？ | success_url 只是 UI 跳转，**和付款不是一回事**；entitlement 由 webhook 写，用户下次打开就是新状态 |
| 为什么不能信 success 页面？ | 用户可以**手敲这个 URL**；也可能付完就关页面。两个方向都不成立 |
| Stripe 会重试 webhook 吗？ | 会，带退避重投直到 2xx。**这套重试正是「webhook 是事实源」能成立的基础** |
| trial 怎么实现的？ | **独立的 trial product** + `trial_period_days: 7`；收 1.99 而不是 0 元，**是为了验证支付方式真的可扣款** |
| 谁能领 trial？ | `hasPurchasedPlan && addTrial` 直接拒；这个字段是 **webhook 写进数据库的持久事实** |
| trial 结束后？ | 扣款成功 → `updated` 事件里 `trialing → active` 判为 RENEW；试用期取消走**专门的 TrialCanceledEmail** |
