---
title: "③ 六个事件"
tier: ref
section: Beyz
icon: radio
day: 4
level: A
status: done
---

# 六个事件，和藏在里面的第二层

> ⚪ **速查**。主线在 [③ Stripe 与权益](/docs?section=beyz&item=d4-stripe)。这里深挖两件事：**这六个各管什么、漏一个会怎样**，以及**那个「信息量最大」的事件内部还要再拆一层**。

## 一、六个事件各管什么

| # | 事件 | 管什么 |
|---|---|---|
| 1 | `checkout.session.completed` | 结账完成 —— ⭐ **终身买断的唯一入口**（一次性付款不产生订阅对象） |
| 2 | `customer.subscription.created` | 订阅创建（含试用开始） |
| 3 | `customer.subscription.updated` | 订阅变更 —— ⭐ **信息量最大的一个**，见下 |
| 4 | `customer.subscription.deleted` | 订阅真正结束 → 回收权限 |
| 5 | `customer.subscription.paused` | 暂停扣款 → 回收权限 |
| 6 | `customer.subscription.resumed` | 恢复扣款 → 恢复权限 |

**记忆锚点**：`checkout` 一个 + `subscription` 五个；五个按生命周期背 —— **建 → 改 → 删**，再加**暂停 / 恢复**这一对。

## 二、⭐ 真正的工程内容：其实有两层事件

**这是这条 bullet 最容易被问穿的地方。**

**第一层是上面那六个 Stripe 事件。第二层是业务语义上的事件**，代码里定义了八个：

```ts
// webhook/util.ts:8-17
enum SubscriptionEvent {
  CREATE, CANCEL, RENEW, EXPIRE, PAUSE, RESUME, UPGRADE, DOWNGRADE
}
```

**为什么会多出一层？因为 `customer.subscription.updated` 是个大杂烩** —— 升级、降级、暂停、恢复、取消、续费，**Stripe 全用这一个事件类型推给你**。你得自己拆。

### 怎么拆：对比「变更前的值」

**Stripe 在这个事件里附带一个 `previous_attributes` 字段** —— 里面是**发生变化的那些字段的旧值**。代码拿它和当前值比对（`route.ts:145-187`）：

| 判定条件 | 拆出的业务事件 |
|---|---|
| 之前状态是「未完成」，现在是「生效/试用中」 | **CREATE**（补完 3DS 验证之后才生效的卡） |
| 商品变了，且**新档位比旧档位高** | **UPGRADE** |
| 商品变了，且新档位更低 | **DOWNGRADE** |
| 之前没有暂停标记，现在有了 | **PAUSE** |
| 之前有暂停标记，现在没了 | **RESUME** |
| 「到期后取消」从 false 变成 true | **CANCEL** |
| 「到期后取消」从 true 变回 false，或试用中 → 生效 | **RENEW** |

> ⭐ **这是「哪六个」之外必然会追的一层**：面试官问「**你怎么区分升级和降级**」—— 答案不在那六个事件里，在这张表里。**靠的是给每个套餐配一个数字档位，比大小。**

> **顺带一个细节**：暂停和恢复**有两条来源** —— 既有独立的事件，也能从「变更」里对比出来。代码注释专门标了 `// pause payment collection, not for subscription.pause event`，**说明作者知道这俩不是一回事：暂停扣款 ≠ 暂停订阅。**

## 三、漏一个会怎样

**按后果分成两类讲，比逐条背强得多。**

### A 类 —— 漏了会白送钱（该收的权限没收）

| 漏掉 | 后果 |
|---|---|
| `subscription.deleted` | 订阅到期了权限不回收，**用户白嫖到底** |
| `subscription.paused` | 暂停扣款的用户照样能用 |
| `subscription.updated` | **降级不生效** —— 用户付 Standard 的钱用 God 的功能 |

### B 类 —— 漏了会误伤付费用户（该给的权限没给）

| 漏掉 | 后果 |
|---|---|
| `checkout.session.completed` | ⭐ **最严重**：终身版用户付了一大笔钱，**权限永远不到账**（这是唯一入口） |
| `subscription.created` | 新订阅不生效（不过「变更」事件里那个「未完成 → 生效」的分支能兜住一部分） |
| `subscription.resumed` | 恢复扣款的用户用不了，**直接变客服工单** |

> ⭐ **一句话答法**：漏事件分两种后果 —— 漏 deleted / paused / updated 是**漏收权限，等于白送钱**；漏 checkout / created / resumed 是**漏发权限，直接误伤付费用户**。**最致命的是 `checkout.session.completed`：终身买断只有这一条路，漏了就是用户付了钱拿不到东西。**

## 四、`only` 这个词怎么自证

简历写的是 `entitlements written **only** by signature-verified webhooks`。**这个 `only` 是可以当场证明的，别只是嘴上说：**

```bash
grep -rn "subscribedPlan:" src/ | grep update
```

**全仓库对权益字段的写入只有三处，全在 webhook 那个文件里**：写成终身版、写成免费、写成某个具体套餐。

**而处理购买请求的那个服务端函数里那次数据库更新，只写了「这个用户在 Stripe 那边的客户 ID」，不碰权益。**

**配套的另半句 `plan eligibility enforced in typed server actions`（资格在带类型的服务端函数里强制）也有三个落点：**

- 函数参数的类型**直接排除了免费档** —— 传进去编译就报错
- 已经是终身版还想再买 → 直接拒绝
- 已经买过的用户不能再领试用

> ⭐ **合起来是个干净的职责划分**：**服务端函数管「你有没有资格发起购买」，webhook 管「你实际买到了什么」。前者可以拒绝，但永远不能给予。**
