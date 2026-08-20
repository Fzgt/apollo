---
title: "Day 4 · 必看 · NestJS 服务与 cron"
section: Beyz · Day 2–4
icon: radio
day: 4
level: A
status: done
---

# Day 4 · 必看 · 独立服务与定时任务

> 🔴 **必看**。回答 ④ 的 **Q1**（为什么 Fastify）、**Q2**（怎么保证不重复发）、**Q3**（跑一半挂了）、**Q6**（为什么是每分钟）。
>
> 代码根：`~/Desktop/Beyz/beyz-server`。**这半条是 Day 4 的全新内容**——③ Stripe 你在 Day 1 已经学了大半。

## 对应简历原句

> **Sole author of a NestJS and Fastify service for subscription emails and scheduled payment reminders** — Dockerized, cron-triggered, deployed to EC2 under PM2 through GitHub Actions — and of the repo's first CI gate: lint, typecheck and build on every push.

---

## 一、为什么要单独一个服务

**先回答这个，后面所有技术选型才有依据。**

Next.js 那个主应用部署在无状态平台上。**定时任务需要一个常驻进程**——一个每分钟醒一次、自己决定该给谁发邮件的东西。无状态平台上没有这个语义（serverless 函数是被请求唤醒的，不会自己醒）。

**拆出来还顺带买到三样：**

| 收益 | 说明 |
|---|---|
| **独立发版** | 改邮件模板不用重新部署整个前端 |
| **独立重启** | 邮件服务挂了不影响主站 |
| **独立扩容** | 它的负载曲线和主站完全不同 |

**代价也要能说**：多一套部署、多一套监控、数据库连接多一个来源、**两边的 schema 要保持同步**（`beyz-server` 自己 import 了 `~/shared/database/schema`）。

---

## 二、Q1：为什么 Fastify 不是 Express

```ts
// src/main.ts:3,6
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
```

**NestJS 的设计里，HTTP 层是可替换的适配器**——默认 Express，换 Fastify 只改这一行加一个依赖，controller、service、DI 全都不动。

**这本身就是答案的一半**：*「Nest 把 HTTP 实现抽象成了 adapter，所以这是个低成本的选型，不是一次重构。」*

**Fastify 的实际差异：**

| | 说明 |
|---|---|
| **吞吐更高** | 路由用基数树（radix tree）匹配，序列化走预编译的 JSON schema，而不是通用的 `JSON.stringify` |
| **schema 校验是一等公民** | 请求/响应 schema 内建，顺带能生成 swagger 文档 |
| **插件体系有封装边界** | 插件的作用域是显式的，不像 Express 中间件那样全局叠加 |

> ⚠️ **别硬吹性能。** 这个服务的负载是「每分钟查一次库、发几封邮件」——**吞吐差异在这里根本体现不出来**。
>
> **诚实的答法**：「这是选型题不是性能题。Nest 的 adapter 让切换成本几乎为零，Fastify 在 schema 和 swagger 上的集成更顺手，就选了它。**这个服务的量级完全用不到它的吞吐优势**，说它解决了性能瓶颈是不诚实的。」
>
> **主动否认一个自己本可以吹的点，比多吹一个点更有说服力。**

### 顺带把 NestJS 的三件套讲清楚（复习重点列了）

```ts
@Injectable()
export class EmailJob {
  constructor(
    private mailerService: MailerService,              // 按类型注入
    @Inject('DATABASE_CONNECTION') private db: any     // 按 token 注入
  ) { }
}
```

| 概念 | 是什么 |
|---|---|
| **Module** | 组织单元，声明这一块有哪些 provider、导出什么、依赖哪些别的 module |
| **Controller** | 只管 HTTP：路由、参数解析、返回值。**不放业务逻辑** |
| **Provider** | 可被注入的东西（service、repository、工厂……），`@Injectable()` 标记 |
| **DI 容器** | Nest 启动时按类型或 token 解析依赖，自己构造实例并缓存 |

**两种注入方式都在这段代码里**，值得指出来：`MailerService` 是**按类型**注入（Nest 从 TS 的元数据里读参数类型）；`db` 是**按字符串 token** 注入（`'DATABASE_CONNECTION'`）——因为数据库连接不是一个类，是个由工厂 provider 造出来的对象，没有类型可以匹配。

---

## 三、Q2：怎么保证同一封邮件不会发两遍（重点）

**这是这半条最有技术含量的地方。**

```ts
// src/modules/tasks/jobs/email.job.ts:24-37
const usersToRemind = await this.db
  .select({ user: users, reminder: upgradeReminders })
  .from(users)
  .leftJoin(upgradeReminders, eq(users.id, upgradeReminders.userId))
  .where(
    and(
      eq(users.subscribedPlan, 'Free'),              // ① 还没付费
      lt(users.createdAt, twentyFourHoursAgo),       // ② 注册超过 24 小时
      isNull(upgradeReminders.id)                    // ③ ⭐ 还没发过提醒
    )
  );
```

### 幂等靠的是一张表，不是靠调度频率

**第 ③ 个条件是全部关键**：`leftJoin` + `isNull(reminder.id)` 是 SQL 里的 **anti-join** 写法——**「左表里那些在右表中没有对应行的记录」**。

翻译过来就是：**只挑「还没有提醒记录」的用户。**

发完之后写一条记录（`:47-52`）：

```ts
await this.db.insert(upgradeReminders).values({
  userId: user.id,
  reminderSent: true,
  sentAt: new Date(),
});
```

> **所以「已发过」这个状态是数据库里的一行，不是内存里的标志位、也不是「上次跑到哪儿了」的游标。**
>
> **这个设计的好处**：服务重启、换机器、跑几次，都不影响正确性——**因为判据是持久化的事实，不是进程状态。**

**这和 [Stripe webhook 的幂等](/docs?section=numbers&item=n02-stripe-events) 是同一个思路的两种实现**：那边靠「写绝对值」天然幂等 + `emailTracking` 表挡住发邮件；这边直接把「发过没有」建成一张表。**共同点是：有外部副作用的操作（发邮件）必须显式去重，因为它没法靠重写变成幂等。**

---

## 四、Q3：任务跑到一半挂了怎么办

**这里有个真实的窗口，必须能自己说出来。**

```ts
for (const { user } of usersToRemind) {
  await this.mailerService.sendEmail(...)      // ① 先发邮件
  await this.db.insert(upgradeReminders)...    // ② 再记录
}
```

**顺序是「先发后记」。如果进程在 ① 和 ② 之间死掉：**

```
邮件已经发出去了  ✓
数据库里没有记录  ✗
  → 下一分钟这个用户又满足 isNull 条件
    → 再发一遍
```

**用户收到两封一样的邮件。**

### 那反过来「先记后发」行不行

**也不行，而且更糟：**

```
数据库记了「已发送」  ✓
发邮件失败了         ✗
  → 这个用户永远收不到提醒，而且系统认为发过了
```

> **这是分布式系统里的经典两难**：跨两个系统（邮件服务商 + 数据库）的操作**没有原子性**，你只能选择**「宁可重复」还是「宁可丢失」**。
>
> **当前实现选的是「宁可重复」——对营销邮件来说这是对的**：多收一封升级提醒是骚扰，收不到就是一次转化机会没了。**换成密码重置或者付款通知就得反过来。**

### 还有一个并发问题

**如果这个服务跑了两个实例**（或者一次任务执行超过一分钟、和下一次重叠），**两边可能同时 select 到同一个用户，各发一封。**

**因为 `select` 和 `insert` 之间有时间窗口，没有任何锁。**

### 正确做法（能说出来就把缺口变成加分项）

| 做法 | 说明 |
|---|---|
| **`userId` 上建唯一索引** | 第二次 `insert` 直接违反唯一约束——**数据库层面挡住并发重复**，和[百度提现的幂等键](/docs?section=numbers&item=n07-qps)完全同一招 |
| **先插「处理中」再发** | 插入成功才拿到发送权（相当于抢锁），发完更新状态。**把二选一变成三态** |
| **交给邮件服务商去重** | 多数服务商支持幂等 key（如 `Idempotency-Key` 头），把去重推到那一层 |
| **`@Cron` 加并发保护** | 保证同一时刻只有一个实例在跑这个任务 |

> **面试答法**：「幂等是靠 `upgradeReminders` 这张表做的，查询用 leftJoin + isNull 挑出没发过的人。**但要说清楚它有个窗口**：先发邮件后写记录，进程在两步之间挂掉会重发；两个实例并发也会各发一封，因为 select 和 insert 之间没有锁。**正确做法是在 userId 上加唯一索引让数据库兜底**——这和 Stripe webhook 那边用唯一约束做幂等是同一招。当时选的是『宁可重复』，对营销邮件是合理的取舍，换成付款通知就得反过来。」

---

## 五、Q6：为什么最后定成每分钟

```ts
// email.job.ts:17-19
// @Cron(CronExpression.EVERY_DAY_AT_9AM)
// @Cron(CronExpression.EVERY_10_MINUTES)
@Cron(CronExpression.EVERY_MINUTE)
```

**两个被注释掉的版本还留在代码里，这本身就是答案的线索。**

### 能站得住的理由

**因为幂等靠的是表，不是调度频率。**

既然「发过没有」是数据库里的事实，那**跑多频繁都不会重复发**。频率决定的只有一件事：**用户注册满 24 小时之后，多久会收到提醒。**

- 每天 9 点 → 最坏要等将近 24 小时
- 每 10 分钟 → 最坏等 10 分钟
- **每分钟 → 最坏等 1 分钟**

**代价是每分钟一次数据库查询**——而这个查询有索引的话极其廉价，用户量不大时完全可以忽略。

### 但要诚实交代另一半

**对一个「注册满 24 小时才发」的提醒来说，每分钟的精度是过剩的。** 用户不会在意提醒是 24 小时后一分钟到还是二十分钟后到。

**而且注释里从 `EVERY_DAY_AT_9AM` 一路降到 `EVERY_MINUTE` 的痕迹，更像是调试时为了快速看到效果调下来的，然后留在了那里。**

> **诚实答法**：「幂等是表保证的，所以频率不影响正确性，只影响触达延迟——每分钟意味着用户注册满 24 小时后最多一分钟就收到。**但说实话，对一个 24 小时延迟的提醒来说每分钟是过剩的**，注释里那两个版本说明这是调试时调下来的。要我重做会放回每 10 分钟，或者直接改成事件驱动——注册时就排一个 24 小时后执行的延时任务，根本不用轮询。」
>
> **最后那句「改成事件驱动」是这一问的加分项**：它说明你知道**轮询是这类需求的下策**。

---

## 六、手动触发那个口子（值得主动提的一个小疤）

```ts
// src/app.controller.ts:17-28
@Get('trigger-cron')
async triggerCronManually() {
  const emailContent = paymentReminderTemplate('Fzgt', 'fzgt320@gmail.com');
  await this.mailerService.sendEmail('fzgt320@gmail.com', 'Upgrade Your Plan', emailContent);
  return { message: 'Cron job triggered manually' };
}
```

**三个问题，能主动说出来比被问出来强：**

1. **它其实没有触发 cron。** 名字叫 `triggerCronManually`，实际做的是给一个**写死的邮箱**发一封测试邮件——它是个调试端点，不是手动触发
2. **没有任何鉴权。** 谁都能访问 `/trigger-cron` 让它发邮件
3. **用 `GET` 做有副作用的操作。** HTTP 语义里 GET 应该是安全且幂等的；浏览器预取、爬虫、链接预览都可能意外触发它

**答法**：「这是当时留的调试口子，名字起得比它做的事大——它只是给固定邮箱发一封测试邮件。**上生产前应该删掉，或者至少加鉴权并改成 POST**。」

---

## 七、预期追问速查

| 问题 | 要点 |
|---|---|
| 为什么单独一个服务？ | 定时任务需要**常驻进程**，无状态平台没有这个语义；顺带独立发版/重启/扩容 |
| 为什么 Fastify？ | Nest 的 adapter 让切换成本近零；schema 和 swagger 集成更顺手。**别吹吞吐——这个量级用不到** |
| Module / Controller / Provider？ | 组织单元 / 只管 HTTP / 可注入的东西；两种注入：按类型 和 按 token |
| 怎么保证不重发？ | `leftJoin` + `isNull` 的 anti-join，「发过没有」是**表里的一行**，不是进程状态 |
| 跑一半挂了？ | 先发后记 → **会重发**；先记后发 → **会漏发**。跨系统无原子性，只能选「宁可重复」还是「宁可丢失」 |
| 两个实例并发？ | select 和 insert 之间没锁，会各发一封。**`userId` 唯一索引兜底** |
| 为什么每分钟？ | 幂等靠表不靠频率，频率只影响触达延迟。**但对 24 小时的提醒是过剩的**，事件驱动的延时任务更合适 |
| `/trigger-cron` 是什么？ | 调试口子，没鉴权、GET 有副作用、而且并不真的触发 cron。**该删或该加固** |
