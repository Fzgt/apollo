---
title: "③ Stripe 与权益"
tier: must
section: Beyz
icon: radio
day: 4
level: A
status: done
---

# 付费之后，谁来改数据库里那一行

> 🔴 **必看**。深挖见 [③ 六个事件](/docs?section=beyz&item=n02-stripe-events) 和 [③ 早到晚到与收敛](/docs?section=beyz&item=n02b-convergence)。

## 对应简历原句

> Owned the paid conversion path — Stripe Checkout, trials and lifetime purchases on Next.js, tRPC and Drizzle — with plan eligibility enforced in typed server actions and **entitlements written only by signature-verified webhooks across six subscription events, none of which can downgrade a lifetime purchase**.

## 一、先把几个词说清楚

| 词 | 意思 |
|---|---|
| **Stripe Checkout** | Stripe 提供的**收银台页面**。你把用户跳过去，他在 Stripe 的页面上填卡号、付款，付完再跳回你的网站。**卡号从头到尾不经过你的服务器** |
| **权益（entitlement）** | 「这个用户现在能用什么功能」。在这个项目里就是用户表里那一列 `subscribedPlan` |
| **Webhook** | **Stripe 主动往你的服务器发的 HTTP 请求**。它不是你去问它，是它发生了什么事就来通知你 |

## 二、核心问题：付完款，谁去改数据库

用户在 Stripe 的收银台付完钱，跳回你的网站。**现在谁把用户表里那一行从「免费」改成「Standard」？**

| | 方案 | 行不行 |
|---|---|---|
| A | **跳回来的那个成功页面里改** | ❌ 见下 |
| B | 服务端定时去问 Stripe「这人付款了吗」 | ⚠️ 能做，但延迟高、API 调用贵，**用户付完钱要等下一轮** |
| C | **等 Stripe 主动通知（webhook）** | ✅ 标准解法 |

### ⭐ 为什么 A 不行 —— 两个方向都不成立

**方向一：用户付了钱，但那个页面没被访问到**

```
付款成功 → Stripe 准备把他跳回你的成功页
        → 用户直接关了浏览器 / 断网 / 手机锁屏
          → 那个页面从来没被打开过
            → 权益没写进去，用户付了钱拿不到东西
```

**方向二：那个页面被访问了，但根本没付钱**

**成功页的网址就是个普通 URL，用户可以直接手敲。** 存成书签每天访问一次 —— 如果这个页面会改数据库，**等于免费领终身版**。

> ⭐ **所以「用户跳回了成功页」这件事，既不是「付款成功」的充分条件，也不是必要条件 —— 它和付款根本不是一回事，它只是一个界面跳转。**

### 唯一可信的事实来源

**只有 Stripe 用签名推给你的 webhook 事件。**

**而且 Stripe 会重试** —— 如果你的服务器当时挂了，它会带着退避重复投递，**直到你返回 2xx 为止**。**这套重试机制正是「webhook 才是事实源」能成立的基础** —— 否则服务器抖一下就丢一笔订单。

### 代码里这条边界是干净的

**全仓库对 `subscribedPlan` 的写入只有三处，全都在 webhook 那个文件里。** 而处理购买请求的那个服务端函数，只写了「这个用户在 Stripe 那边的客户 ID」，**从不碰权益**。

> ⭐ **职责一句话**：**服务端函数管「你有没有资格发起购买」，webhook 管「你实际买到了什么」。前者可以拒绝，但永远不能给予。**

## 三、怎么确认这个请求真的来自 Stripe

**webhook 端点是公网上任何人都能 POST 的地址。** 别人伪造一个「用户升级到终身版」的请求打过来怎么办？

```js
// webhook/route.ts:22-32
const buf = await req.text();                     // ⭐ 拿原始字节，不是解析后的对象
const sig = req.headers.get("stripe-signature");
if (!sig) return new Response("Missing signature", { status: 400 });
event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
```

**验签的原理**：Stripe 和你共享一个密钥。它用这个密钥对**请求正文的原始字节**算出一个签名，放在请求头里。你用同样的密钥重新算一遍，对得上才说明是它发的。

### ⭐ 为什么必须用原始字节

**这是 webhook 验签最经典的坑。**

签名是对**原始字节序列**算的。如果你先把 JSON 解析成对象、再转回字符串，**字节会变** —— 键的顺序可能变、空格可能变、数字格式可能变（`1.0` 变成 `1`）。**内容意思一样，但字节不一样，签名就必然对不上。**

> **能主动说出这一点，说明你真接过 webhook。**

### 顺带：验签失败返回 400 不是 500

**Stripe 不重试 4xx，只重试 5xx。** 签名错的请求重试一万次也还是错的，**返回 400 让它别再来是对的**。

反过来，处理逻辑里抛出异常会变成 500 → Stripe 会重试 → **给了业务逻辑一次自愈的机会**。**这个状态码的选择是有意的。**

## 四、六个事件

```js
// webhook/route.ts:42-69
switch (event.type) {
  case "checkout.session.completed":      // 结账完成 —— 终身买断的唯一入口
  case "customer.subscription.created":   // 订阅创建（含试用开始）
  case "customer.subscription.updated":   // 订阅变更 —— 信息量最大
  case "customer.subscription.deleted":   // 订阅结束 → 回收权限
  case "customer.subscription.paused":    // 暂停扣款 → 回收权限
  case "customer.subscription.resumed":   // 恢复扣款 → 恢复权限
}
```

> ⚠️ **一个口径问题，自己先知道**：简历写的是 `six subscription events`（六个订阅事件），**但只有 5 个是订阅事件** —— 第一个 `checkout.session.completed` 是**结账事件**，而且恰恰是它管终身买断，**因为一次性买断根本不产生订阅对象**。
>
> **被抠字眼时的答法**：「准确说是五个订阅事件加一个结账完成事件；后者管一次性买断，那条路径上没有订阅对象。」**主动说比被纠正强。**
>
> **想改措辞的话**：`six subscription events` → `six Stripe webhook events`，一个词就把这个问题消掉了。

**每个事件漏了会怎样、以及那个「信息量最大」的事件内部还要再拆一层** —— 见 [③ 六个事件](/docs?section=beyz&item=n02-stripe-events)。

## 五、重复投递怎么处理

**先说清问题**：Stripe 保证「至少投递一次」，意味着**同一个事件可能来两次**（网络重试、它那边的重投）。

**代码里没有「记下处理过哪些事件 ID」的去重表。** 但大部分处理天然不怕重复 —— **因为它们写的是绝对值，不是增量**：

```js
db.update(users).set({ subscribedPlan: plan })    // ✅ 写死成某个值
// 而不是
db.update(users).set({ credits: credits + 1 })    // ❌ 增量，重复就多加了
```

**同一个事件投十次，结果和投一次完全一样。**

**唯一显式做了去重的是发邮件**（`:303-337`）—— 因为**发邮件不是幂等的**，重复投递会让用户收到两封 20% 折扣码邮件。所以用一张表按「邮箱 + 活动 ID」查一下，发过就不再发。配套还给优惠码设了「只能用一次」，**双保险**。

> ⭐ **一句话答法**：**幂等不是一个全局开关，是逐个操作判断的。** 能写成绝对值的数据库更新天然幂等，不用管；**有外部副作用的（发邮件、发券）必须显式去重。**

## 六、⚠️ 事件乱序 —— 这是真弱点，主动交代

**问题**：Stripe 不保证事件按发生顺序到达。

**会翻车的例子**：用户先升到 God、紧接着降回 Standard。两个「订阅变更」事件**乱序到达** → 最终数据库里写成了 God，**用户白拿高档位**。

**代码没有处理这个** —— 没有用事件自带的时间戳做版本比较。

**诚实答法**：

> 「乱序没处理。**正解是存一份事件时间戳或者订阅的版本号，只接受比当前记录更新的事件** —— 这是我会补的第一个洞。」

## 七、终身版为什么降不了级

**简历那半句 `none of which can downgrade a lifetime purchase` 是整条 bullet 最硬的部分。**

**守卫写在 SQL 的 WHERE 条件里，不是写在 if 判断里**：

```js
// :375-388 和 :393-411，两个会降级的函数都带了这个条件
.where(and(
  eq(users.stripeCustomerId, customerId),
  ne(users.subscribedPlan, SubscriptionPlan.Lifetime),   // ← 「不是终身版」才更新
))
```

**为什么放在 WHERE 里是关键**：因为它**跟「谁调用的、并发几次、事件什么顺序到」完全无关**。只要数据库里那一行是终身版，这两个函数就**物理上改不动它** —— 数据库在执行 UPDATE 时会跳过不满足条件的行。

> ⭐ **守卫在数据层，不在逻辑层。** if 判断可以被绕过、可以有竞态；WHERE 条件不会。

**而唯一能把人升成终身版的那次写入，故意没有这个条件** —— 它是入口，不能挡自己。

**这两者配合起来会产生一个漂亮的性质**（两种到达顺序都收敛到正确结果）—— 见 [③ 早到晚到与收敛](/docs?section=beyz&item=n02b-convergence)。

## 八、试用期是怎么做的

| 设计 | 说明 |
|---|---|
| **试用是一个独立的商品，不是折扣** | 结账时同时放了正式套餐和试用两个条目 |
| ⭐ **收 1.99 而不是 0 元** | **零元订单验证不了支付方式是否有效。** 收一笔小额说明这张卡真的能扣款，**试用期结束转正式订阅时不会因为卡无效而失败** |
| **资格判定在服务端** | 「这个人以前买过没有」是一个存在用户表里的字段，**由 webhook 写入**，不是前端状态 |
| **免费档在类型层面就传不进来** | 函数参数的类型直接排除了免费档 —— **写错了编译就报错** |

**试用结束时**：扣款成功 → 订阅状态从「试用中」变成「生效」→ 代码判定为「续费」；**试用期取消**则会发一封**专门的试用取消挽留邮件**，而不是普通的取消邮件。

> **「试用期取消」和「付费后取消」走不同的挽留邮件 —— 说明产品侧真的分了场景，不是一套模板打天下。**
