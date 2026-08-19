---
title: "#2 · six subscription events"
section: Day 1 · 数字口径
icon: calculator
day: 1
level: 前置
status: done
---

# #2 · `six subscription events`

> 以下全部是必会内容——被问到这条，答不出就是负资产。

## 对应简历原句

Beyz 第 3 条 bullet（v40）：

> Owned the paid conversion path — Stripe Checkout, trials and lifetime purchases on Next.js, tRPC and Drizzle — with plan eligibility enforced in typed server actions and **entitlements written only by signature-verified webhooks across six subscription events, none of which can downgrade a lifetime purchase**.

三个关键词各有精确的代码落点：`signature-verified`（验签）、`six subscription events`（六个 case）、`none of which can downgrade a lifetime purchase`（两处 SQL 守卫）。

---

## 一、这个数字长在哪个功能里

属于**付费转化路径**里最关键的一环：**entitlement（权限）的真源在哪**。

先想清楚问题。用户在 Stripe Checkout 付完钱，跳回你的站点。**现在谁来把数据库里那一行 `subscribedPlan` 从 Free 改成 Standard？**

| | 方案 | 为什么不行 / 行 |
|---|---|---|
| A | 前端 success 回调里改 | ❌ 用户付完款直接关浏览器就丢了；而且那个回调 URL 谁都能手动访问，等于白送权限 |
| B | 服务端定时轮询 Stripe | ⚠️ 能做，但延迟高、API 调用贵，用户付完钱要等下一轮 |
| C | **Stripe webhook 主动推给你** | ✅ 标准解法：状态一变 Stripe 就 POST 到你的端点 |

Beyz 走 C。**但 C 有个代价：webhook 端点是公网上任何人都能 POST 的 URL。** 你怎么知道这个「用户升级到 God 了」的请求真是 Stripe 发的，不是别人伪造的？

→ 所以必须**验签**。简历里 `signature-verified webhooks` 这个词就是从这儿来的。

**这条 bullet 的整个逻辑链是**：钱在 Stripe 那边 → 权限在你数据库这边 → 中间靠 webhook 同步 → webhook 可伪造 → 所以验签 → 验签过的事件才有资格写 entitlement。

**`six subscription events` 就是「哪些事件有资格触发这次写入」的清单。**

---

## 二、哪六个

`route.ts:42-69` 的 `switch (event.type)`，六个 case：

| # | 事件 | 管什么 |
|---|---|---|
| 1 | `checkout.session.completed` | 结账完成 —— **lifetime 一次性购买的唯一入口** |
| 2 | `customer.subscription.created` | 订阅创建（含 trial 开始） |
| 3 | `customer.subscription.updated` | 订阅变更 —— **信息量最大的一个**，见下 |
| 4 | `customer.subscription.deleted` | 订阅真正结束 → 回收权限 |
| 5 | `customer.subscription.paused` | 暂停扣款 → 回收权限 |
| 6 | `customer.subscription.resumed` | 恢复扣款 → 恢复权限 |

> ⚠️ **口径问题，必须自己先知道**：简历写的是 `six subscription events`，但**只有 5 个是 `customer.subscription.*`**。第 1 个 `checkout.session.completed` 是 **Checkout 事件，不是 subscription 事件**——而且恰恰是它管 lifetime，因为**一次性买断根本不产生 subscription 对象**。
>
> 被抠字眼的话答法：*「准确说是五个订阅事件加一个 Checkout 完成事件；后者管一次性买断，那条路径上没有 subscription 对象。」* **主动说比被纠正强。**
>
> 想改措辞的话：`across six subscription events` → `across six Stripe webhook events`，一个词的改动就把「5+1」的口径问题消掉，且不损失任何分量。

**记忆锚点（当场报名字用）**：`checkout` 一个 + `subscription` 五个，五个按生命周期背 —— **建 → 改 → 删**，再加**暂停 / 恢复**这对。

---

## 三、真正的工程内容：两层事件模型

这是这条 bullet 最值钱的地方，也是「六个」这个数字最容易被问穿的地方。

代码里其实有**两层**事件：

**第一层 —— Stripe 事件（6 个）**，就是上面那张表。

**第二层 —— 业务语义事件（8 个）**，`webhook/util.ts:8-17` 的枚举：

```ts
export enum SubscriptionEvent {
  CREATE, CANCEL, RENEW, EXPIRE, PAUSE, RESUME, UPGRADE, DOWNGRADE
}
```

**为什么会多出一层？** 因为 `customer.subscription.updated` 是个**大杂烩**——升级、降级、暂停、恢复、取消、续费，Stripe 全用这一个事件类型推给你。你得自己拆。

拆的办法是 **diff `previous_attributes`**（`route.ts:145-187`）—— Stripe 在事件里附带「变更前的字段值」，代码拿它和当前值比：

| 判定条件（`route.ts`） | 拆出的业务事件 |
|---|---|
| `prev.status === "incomplete"` 且现在 active/trialing | CREATE（补 3DS 验证后才生效的卡） |
| `prevProductId !== newProductId` 且 `prevTier < newTier` | UPGRADE |
| 同上，`prevTier > newTier` | DOWNGRADE |
| `prev.pause_collection === null` 且现在非 null | PAUSE |
| `prev.pause_collection` 有值 且现在 null | RESUME |
| `cancel_at_period_end` 从 false 变 true | CANCEL |
| `cancel_at_period_end` 从 true 变 false，或 trialing → active | RENEW |

**这是「哪六个」之外必然会追的一层**：面试官问 *「你怎么区分升级和降级？」* —— 答案不在那六个事件里，在这张表里。`findPlanByProductId()` 返回的 `tier`（`util.ts:38-61`）做数值比较，大的是升级。

---

## 四、漏一个会怎样

**按后果分成两类，讲出这个二分法比逐条背强得多**：

**A 类 —— 漏了会白送钱（权限该收没收）**

| 漏掉 | 后果 |
|---|---|
| `customer.subscription.deleted` | 订阅到期了权限不回收，用户白嫖到底 |
| `customer.subscription.paused` | 暂停扣款的用户照样能用 |
| `customer.subscription.updated` | 降级不生效，用户付 Standard 的钱用 God 的功能 |

**B 类 —— 漏了会误伤付费用户（权限该给没给）**

| 漏掉 | 后果 |
|---|---|
| `checkout.session.completed` | **最严重**：lifetime 用户付了一大笔钱，权限永远不到账——因为这是唯一入口 |
| `customer.subscription.created` | 新订阅不生效（不过 `updated` 的 `incomplete → active` 分支能兜住一部分） |
| `customer.subscription.resumed` | 恢复扣款的用户用不了，直接变客服工单 |

**一句话答法**

> 漏事件分两种后果：漏 deleted / paused / updated 是漏收权限，等于白送钱；漏 checkout.session.completed / created / resumed 是漏发权限，直接误伤付费用户。最致命的是 checkout.session.completed——lifetime 买断只有这一条路，漏了就是用户付了钱拿不到东西。

---

## 五、`none of which can downgrade a lifetime purchase` 怎么实现的

**简历里这半句是整条 bullet 最硬的部分**，因为它是个**不变量（invariant）**，而实现位置选得很对。

守卫写在 **SQL 的 WHERE 子句里**，不是 if 判断：

```ts
// route.ts:375-388  deleteUserSubscription
.where(and(
  eq(users.stripeCustomerId, customerId),
  ne(users.subscribedPlan, SubscriptionPlan.Lifetime),   // ← :384
))

// route.ts:393-411  updateUserSubscription
.where(and(
  eq(users.stripeCustomerId, customerId),
  ne(users.subscribedPlan, SubscriptionPlan.Lifetime),   // ← :407
))
```

**为什么放在 WHERE 里是关键？** 因为它跟「谁调用的、并发几次、事件什么顺序到」**完全无关**。只要那一行是 Lifetime，这两个函数就物理上改不动它。守卫在**数据层**，不在**逻辑层**。

注意 `route.ts:102-108`（唯一把人升成 Lifetime 的那次写入）**故意没有**这个 guard —— 它是入口，不能挡自己。

**一句话答法**

> 那半句不是靠事件顺序保证的，是靠数据层不变量保证的：所有可能降级的写入路径都在 SQL 的 WHERE 里带了 `ne(subscribedPlan, Lifetime)`，所以不管事件怎么乱序、并发多少次，lifetime 那行都改不动。唯一能升成 lifetime 的那条路径故意不带这个条件，因为它是入口。

---

## 六、`entitlements written only by ...` 的 `only` 怎么自证

这个 `only` 是可以当场 grep 证明的，**别只是嘴上说**：

```bash
grep -rn "subscribedPlan:" src/ | grep "update"
```

全仓库对 `subscribedPlan` 的写入**只有三处，全在 `webhook/route.ts`**：`:105`（Lifetime）、`:379`（Free）、`:401`（具体 plan）。

`server/actions/subscription.ts:126` 那次 `update(users)` 只写 `stripeCustomerId`，**不碰 entitlement**。

配套的另半句 `plan eligibility enforced in typed server actions`：

- `subscription.ts:13` —— `selectedPlan: Exclude<SubscriptionPlan, SubscriptionPlan.Free>`，**Free 在类型层面就传不进来**
- `subscription.ts:45-51` —— 已是 Lifetime 再买直接拒
- `subscription.ts:53-58` —— 已购买过的用户不能再领 trial

> **合起来是个干净的职责划分**：server action 管「你有没有资格发起购买」，webhook 管「你实际买到了什么」。**前者可以拒，但永远不能给。**

---

## 七、验签

```ts
const buf = await req.text()          // :22  ← 原始字节，不是 req.json()
const sig = req.headers.get("stripe-signature")
if (!sig) return new Response("Missing Stripe signature", { status: 400 })  // :25-27
event = stripe.webhooks.constructEvent(buf, sig, webhookSecret)             // :32
```

**为什么必须用 `req.text()` 而不是 `req.json()`**

签名是对**原始字节**算的 HMAC。`JSON.parse` 再 `stringify` 会改变字节——键顺序、空格、数字格式都可能变——签名必然对不上。**这是 webhook 验签最经典的坑**，能主动说出来说明你真接过。

---

## 八、重复投递与乱序

**重复投递**：代码里**没有 `event.id` 去重表**，没有显式幂等键。**但大部分 handler 天然幂等**——写的是**绝对值**（`set({ subscribedPlan: plan })`）而不是增量。同一个事件投十次，结果和投一次一样。

**唯一显式做了幂等的地方是发邮件**（`route.ts:303-337`）：用 `emailTracking` 表按 `email + campaignId` 查，发过就 return false。因为**发邮件不是幂等操作**——重复投递会让用户收到两封 20% 折扣码邮件。配套 `createPromotionCode` 还加了 `max_redemptions: 1`（`:356`），券本身也只能用一次，双保险。

**一句话答法**

> 幂等不是全局开关，是逐个操作判断的。能写成绝对值的数据库更新天然幂等，不用管；有外部副作用的（发邮件、发券）必须显式去重，代码里就是 `emailTracking` 那张表。

**乱序 —— 这是真弱点，主动交代**

代码**没有**用 `event.created` 做版本比较。举个会翻车的例子：用户先升到 God、紧接着降回 Standard，两个 `customer.subscription.updated` 乱序到达 → 最终状态被写成 God，用户白拿高档位。

诚实答法：*「乱序没处理。正解是存一份 event 时间戳或 subscription 版本号，只接受比当前记录更新的事件——这是我会补的第一个洞。」*

---

## ⚠️ 归属待处理

和 [#1](/docs?section=numbers&item=n01-ephemeral-keys) 同样的问题：`api/stripe/webhook/route.ts` 全文 411 行，`Fzgt` 的行数是 **0**（Teresa Tian 341 / Ziming Zhu 38 / Shann Timothy 12 / Miranda 12 / 其他 8）。`server/actions/subscription.ts` 同样是 **0**。
