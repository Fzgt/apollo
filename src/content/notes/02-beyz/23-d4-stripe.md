---
title: "Day 4 · Stripe"
tier: ref
section: Beyz · Day 2–4
icon: radio
day: 4
level: A
status: done
---

# Day 4 · Stripe（速查）

> ⚪ **这条 Day 1 已经学了大半**：[#2 · six subscription events](/docs?section=beyz&item=n02-stripe-events)（哪六个 / 两层事件模型 / 漏一个的后果 / 验签 / 幂等与乱序）· [#2 补充 · 早到晚到与收敛](/docs?section=beyz&item=n02b-convergence)（lifetime 不可降级）。
>
> 这里只补那两篇没有的两块。

## 一、付款成功但浏览器关了 / 为什么只能 webhook 写

**这两问是同一件事的正反面。**

```
付款成功 → Stripe 准备重定向回 success_url
        → 用户关了浏览器 / 断网 / 锁屏
          → success_url 从没被访问过
```

**反过来更糟**：`success_url` 是个普通 URL，**用户可以直接手敲**——存成书签每天访问一次就免费领终身版。

> **所以「跳回 success_url」既不是付款成功的充分条件，也不是必要条件。它只是一个 UI 跳转。**

| 来源 | 可信吗 |
|---|---|
| 前端 success 回调 | ❌ 可伪造、可跳过 |
| **签名验证过的 webhook** | ✅ **Stripe 主动推，带 HMAC，伪造不了** |

**代码边界是干净的**：全仓库对 `subscribedPlan` 的写入只有三处，**全在 `webhook/route.ts`**；`subscription.ts:126` 那次 `update(users)` 只写 `stripeCustomerId`。

> **职责一句话**：**server action 管「你有没有资格发起购买」，webhook 管「你实际买到了什么」。前者可以拒，但永远不能给。**

**为什么这套成立**：Stripe 会**带退避重投 webhook 直到你返回 2xx**——这套重试机制正是「webhook 才是事实源」的基础。

## 二、trial 生命周期

| 设计点 | 代码 | 要点 |
|---|---|---|
| **trial 是独立 product 不是折扣** | `subscription.ts:139-147` | lineItems 里同时放正式 price 和 trial price |
| **收 1.99 而不是 0 元** | `trialPrice: 1.99` | ⭐ **零元订单验证不了支付方式有效性**；收一笔小额说明卡真的能扣款，转正式订阅时不会失败 |
| **资格判定在服务端** | `:53-58` `hasPurchasedPlan && addTrial → 拒` | 这个字段是 **webhook 写进数据库的持久事实**，不是前端状态 |
| **类型层面挡掉 Free** | `:13` `Exclude<SubscriptionPlan, Free>` | `plan eligibility enforced in typed server actions` 的字面出处 |

**trial 结束时**：

- 扣款成功 → `customer.subscription.updated`，`trialing → active` → 代码判为 **RENEW**（`webhook/route.ts:183`）
- 试用期取消 → 判为 **CANCEL**，且因 `status === "trialing"` 发的是**专门的 `TrialCanceledEmail`**（`:217-218`）而不是普通挽留邮件

> **「试用期取消」和「付费后取消」走不同挽留邮件——说明产品侧真的分了场景。**

## 其余四问直接跳回 Day 1

| 问题 | 去哪 |
|---|---|
| 验签为什么必须原始 body | [#2 · 七](/docs?section=beyz&item=n02-stripe-events) |
| 重复投递怎么处理 | [#2 · 八](/docs?section=beyz&item=n02-stripe-events)（**没有 event id 去重表**，靠写绝对值天然幂等） |
| 事件乱序怎么处理 | [#2 · 八](/docs?section=beyz&item=n02-stripe-events)（**没处理**，主动交代） |
| 六个事件各改哪一位 | [#2 · 二/三/四](/docs?section=beyz&item=n02-stripe-events) |
