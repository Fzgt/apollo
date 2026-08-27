---
title: "③ Stripe 付费链路"
tier: must
section: Beyz
icon: credit-card
day: 4
level: A
status: done
---

# ③ Stripe 付费链路

> **简历原句**
>
> **Owned the paid conversion path** — Stripe Checkout, trials and lifetime purchases on **Next.js and Drizzle** — with **entitlements written only by signature-verified webhooks**: **no event can downgrade a lifetime purchase**.

> ℹ️ **v66 收短了这一条**：tRPC、typed server action 里的套餐校验、以及「六个订阅事件」都已从简历删除。三处仍要会答，正文没动。

## 先别背 API：这条只讲一件事

**钱在 Stripe，权益在我们的数据库。这两个系统之间，谁有资格决定用户最终是什么套餐？**

答案分两半：

- **server action** 只决定「这个用户有没有资格发起购买」；
- **验签通过的 Stripe webhook** 才决定「用户实际买到了什么」，并写入 `subscribedPlan`。

```text
用户点击购买
  → server action 检查购买资格
  → 创建 Stripe Checkout Session
  → 用户去 Stripe 页面付款
  → Stripe 一边把浏览器跳回 success page
  → 另一边独立向 webhook 发送支付事件
  → webhook 验签
  → 更新数据库里的 subscribedPlan
```

⭐ **浏览器跳转是用户体验，webhook 才是支付事实。**

这条 bullet 的后半段是在回答：webhook 可能被伪造、重复投递、乱序到达，怎么保证数据库里的最终权益仍然正确。

---

## 先认识三个对象

| 对象 | 它是什么 | 负责什么 |
|---|---|---|
| **Checkout Session** | 一次 Stripe 收银流程 | 告诉 Stripe 用户要买什么，并把浏览器跳到 Checkout |
| **Subscription** | 持续订阅关系 | 经历创建、更新、暂停、恢复、删除等生命周期 |
| **Entitlement** | 用户实际获得的产品权益 | 本项目里主要就是用户表的 `subscribedPlan` |

**Lifetime 是一次性买断，不是持续订阅。** 因此它没有普通的 subscription 生命周期，主要由 `checkout.session.completed` 处理。

---

# 第一层：必须答明白的五个问题

## 1. 为什么不能在 success page 写权益？

因为「浏览器跳回成功页」和「支付成功」不是同一件事。

### 用户付了钱，但成功页没有打开

```text
付款成功
  → 用户直接关浏览器 / 断网 / 跳转失败
  → success page 没有执行
  → 如果由页面写权益，用户付了钱却仍然是 Free
```

### 成功页打开了，但用户没有付款

Success page 本质上只是一个普通 URL。用户可以手动访问、保存书签，甚至绕过页面直接调用接口。如果访问这个页面就能升级，没付款的人也能拿到权益。

⭐ 所以「访问 success page」既不是付款成功的必要条件，也不是充分条件。页面可以显示结果、刷新资料，但**不能发权益**。

**一句话答法：**

> Returning to the success page is only a browser navigation, not proof of payment. A paid user may never reach it, and an unpaid user can visit the URL directly, so only Stripe's webhook can grant the entitlement.

---

## 2. 为什么 webhook 必须验签，而且必须用 raw body？

Webhook 是一个公网 HTTP 地址，任何人都可以向它 POST。收到一段长得像 Stripe event 的 JSON，不代表它真的来自 Stripe。

Stripe 会用 webhook secret 对**原始请求正文**和时间信息计算签名，并把签名放在 `Stripe-Signature` 请求头中。服务端用同一 secret 验证；验证成功后，才允许处理事件和修改权益。

```ts
const rawBody = await request.text();
const signature = request.headers.get("stripe-signature");

const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  webhookSecret,
);
```

### 为什么一定是 raw body？

签名针对的是**精确的原始字节**，不是 JSON 表达的语义。先 `JSON.parse` 再 `JSON.stringify`，可能改变字段顺序、空格或数字格式；内容看起来一样，字节已经不同，签名就对不上。

正确顺序：

```text
读取原始正文 → 验签 → 得到可信 event → 执行业务逻辑
```

**一句话答法：**

> The endpoint is public, so the payload is untrusted until its Stripe signature is verified. Verification must use the raw body because the signature covers the exact bytes, not the parsed JSON value.

---

## 3. Server action 和 webhook 各负责什么？

### Server action：资格检查

用户点击购买时，服务端检查：

- 用户是否登录；
- 选择的套餐是否合法；
- Lifetime 用户是否重复购买；
- 用户是否已经使用过 trial。

检查通过后只创建 Checkout Session。**创建 Checkout Session 不等于付款完成**，因此 server action 不能直接写付费权益。

### Webhook：确认事实并写权益

只有 Stripe 知道卡是否真正扣款成功、订阅是否生效、暂停、恢复或结束。因此只有验签 webhook 能更新 `subscribedPlan`。

| 组件 | 回答的问题 |
|---|---|
| Server action | 允许你发起这次购买吗？ |
| Stripe Checkout | 你是否完成了付款？ |
| Webhook | Stripe 确认发生了什么？ |
| Entitlement update | 你现在能使用什么？ |

### `typed server action` 到底证明什么？

参数类型可以在编译期排除 Free：

```ts
type PurchasablePlan = Exclude<SubscriptionPlan, SubscriptionPlan.Free>;
```

但 TypeScript 类型在运行时会消失。攻击者仍然可以绕过前端构造请求，所以还必须有服务端运行时检查。

⭐ **类型防开发错误，服务端校验才是安全边界。**

**一句话答法：**

> The server action decides whether the user may start a purchase, but it never grants access. The signature-verified webhook is the only component allowed to turn the confirmed Stripe result into an entitlement.

---

## 4. 为什么重复 webhook 不一定造成重复升级？

Webhook 可能重复投递。例如服务端已经处理成功，但响应在网络中丢失，Stripe 不知道结果，就可能再次发送同一个事件。

所以 handler 必须考虑**幂等性**：同一个操作执行一次和执行多次，最终结果相同。

### 写绝对状态通常是幂等的

```ts
set({ subscribedPlan: SubscriptionPlan.Standard });
```

执行一次或十次，最终都是 Standard。

### 增量和外部副作用通常不幂等

```ts
set({ credits: credits + 100 }); // 重复执行会多加
sendEmail();                     // 重复执行会发多封
issueCoupon();                   // 重复执行会发多个
```

本项目的权益处理大多写的是目标状态，因此重复事件通常会收敛到同一个结果。

⚠️ **但项目没有单独的 Stripe event ID 去重表。** 更严格的方案是把 `event.id` 写进带唯一约束的表；如果唯一键冲突，就说明这个事件已经处理过。

**一句话答法：**

> Most entitlement handlers write an absolute target state rather than applying an increment, so replaying the same event converges to the same result. We did not have a dedicated event-ID deduplication table, which I would add for stronger guarantees and non-idempotent side effects.

---

## 5. 为什么任何订阅事件都不能降级 Lifetime？

风险来自买断时取消旧订阅。

```text
用户原来有月度订阅
  → 用户购买 Lifetime
  → 系统取消旧订阅，避免继续扣款
  → Stripe 发送 subscription.deleted
  → 普通逻辑想把用户降为 Free
```

如果不特殊保护，用户刚买完 Lifetime 就会被旧订阅的删除事件降成 Free。

### 保护为什么写在 SQL WHERE 中？

所有可能降级用户的更新都带类似条件：

```ts
await db
  .update(users)
  .set({ subscribedPlan: SubscriptionPlan.Free })
  .where(
    and(
      eq(users.stripeCustomerId, customerId),
      ne(users.subscribedPlan, SubscriptionPlan.Lifetime),
    ),
  );
```

数据库在执行更新的那一刻检查当前套餐。如果已经是 Lifetime，就匹配 0 行。

这比应用层先查询、再写一个 `if` 更强。后者的读取和更新是两步，中间可能有另一个请求把用户升级成 Lifetime；第一个请求仍拿着旧结果执行降级，形成 check-then-act race。

### 两种事件顺序为什么都正确？

有两个写入在赛跑：

- A：Lifetime Checkout 完成，无条件写入 Lifetime；
- B：旧订阅删除，尝试写入 Free，但带 `plan != Lifetime` 条件。

**A 先、B 后：** B 发现当前是 Lifetime，更新 0 行。

**B 先、A 后：** B 可能暂时写成 Free，随后 A 无条件覆盖为 Lifetime。

两种顺序最终都是 Lifetime。这里保证的不是事件顺序，而是**最终状态收敛**。

**一句话答法：**

> Buying lifetime cancels the old subscription, which can trigger a deletion webhook that tries to downgrade the user. If the lifetime write wins first, the downgrade is blocked by the SQL predicate; if the deletion arrives first, the later unconditional lifetime write overwrites it. Both orderings converge to Lifetime.

---

# 第二层：理解事件，但先别死背

简历写的是 `six subscription events`，准确说是：

- **5 个 subscription lifecycle events**；
- **1 个 checkout event**，负责一次性买断。

| Stripe event | 主要用途 |
|---|---|
| `checkout.session.completed` | Lifetime 一次性买断的入口 |
| `customer.subscription.created` | 订阅创建，包括试用开始 |
| `customer.subscription.updated` | 订阅状态或套餐发生变化 |
| `customer.subscription.deleted` | 订阅结束，回收普通订阅权益 |
| `customer.subscription.paused` | 暂停时回收普通权益 |
| `customer.subscription.resumed` | 恢复时重新授予权益 |

面试中最好主动校正措辞：

> More precisely, it was five subscription lifecycle events plus one checkout-completed event for the lifetime purchase, because a one-time purchase has no subscription object.

## 为什么 `subscription.updated` 最复杂？

它可能代表升级、降级、取消、续费、暂停或恢复。代码需要比较 `previous_attributes` 和当前值，把 Stripe 的技术事件翻译成业务事件。

例如：商品变了就比较新旧套餐等级；`cancel_at_period_end` 从 false 变 true 是 CANCEL，从 true 变回 false 是 RENEW。第一次复习理解到这里即可，不需要逐格背完。

---

# 第三层：重复和乱序必须分开

## 重复投递

```text
A → A
```

同一个事件来了多次。解决手段包括写绝对状态、保存 event ID 去重和数据库唯一约束。

## 乱序到达

本来发生顺序是 `A → B`，但处理顺序变成 `B → A`。

例如用户先升级 God、随后降级 Standard，但旧的升级事件最后才到，数据库可能错误地停在 God。

⚠️ **当前代码没有完整处理普通套餐的事件乱序。** 正解是保存事件时间戳或订阅版本，只接受比当前记录更新的事件。

Lifetime 的专门 SQL 保护解决了 Lifetime 不被降级的问题，不等于整个支付系统已经解决所有乱序。

---

# 第四层：Trial、tRPC 和 Drizzle 放到最后看

## Trial

先掌握两点：是否用过 trial 的资格在服务端判断，不能相信前端状态；trial 最终是否生效、取消或转成正式订阅，仍由 Stripe 事件决定。具体商品配置和邮件策略属于二轮追问。

## tRPC：不要和 server action 混在一起

简历把 Next.js、tRPC 和 Drizzle 放在一句里，但实际职责是：

- 发起 Checkout、检查资格：**Next.js server action**；
- 接受 Stripe 通知：**route handler / webhook**；
- 数据库查询和更新：**Drizzle**；
- tRPC：项目中其他内部 API 使用的类型化接口层，**不是支付路径的核心传输方式**。

准确说法：

> The project used tRPC generally, but the checkout path itself used typed server actions, while the Stripe webhook had to be a route handler.

## Drizzle

Drizzle 让 SQL 条件以带类型的 TypeScript API 表达。Lifetime 的 `ne(users.subscribedPlan, SubscriptionPlan.Lifetime)` 本质仍然是数据库的 `WHERE subscribed_plan != 'Lifetime'`，不是 ORM 魔法。

---

# 30 秒主回答

> I owned the purchase flow for subscriptions, trials and lifetime purchases. The key design boundary was that the server action could decide whether a user was eligible to start a checkout, but it could never grant access. Entitlements were written only from Stripe webhooks after verifying the signature against the raw request body, because returning to a success page is not proof of payment. The handlers mostly wrote absolute target states so duplicate delivery was safe, and every downgrade query excluded Lifetime at the SQL level. That mattered because buying Lifetime cancels the old subscription and can trigger a deletion webhook; whichever event arrives first, both paths converge to the Lifetime entitlement.

---

# 当前实现要主动承认的三个缺口

1. **没有 event ID 去重表。** 绝对状态更新大多幂等，但外部副作用仍需要显式去重。
2. **普通套餐的事件乱序没有完整解决。** 应保存事件时间戳或订阅版本，只接受更新事件。
3. **简历的 `six subscription events` 不够精确。** 实际是五个订阅事件加一个 Checkout 完成事件。

主动说明这些不是减分。它说明你能区分「当时能运行」和「现在会怎样做得更可靠」。

---

# 最后自测：只需先答这五题

1. 为什么不能在 success page 写权益？
2. 为什么 webhook 必须验签，而且必须用 raw body？
3. Server action 和 webhook 各自负责什么？
4. 为什么重复 webhook 通常不会造成重复升级？当前还缺什么？
5. 买断时取消旧订阅，为什么最终仍然一定是 Lifetime？

能用自己的话答完这五题，才进入六个事件、`previous_attributes`、trial 和 tRPC 的细节。

---

## 术语速查

| 中文 | 英文 |
|---|---|
| 权益 | entitlement |
| 事实来源 | source of truth |
| 验签 | signature verification |
| 原始请求体 | raw body |
| 重复投递 | duplicate delivery |
| 至少一次投递 | at-least-once delivery |
| 幂等 | idempotency / idempotent |
| 乱序到达 | out-of-order delivery |
| 收敛 | convergence / converge |
| 竞态 | race condition |
| 资格检查 | eligibility check |
| 买断 | lifetime purchase |
| 降级 / 升级 | downgrade / upgrade |
