---
title: "④ NestJS 服务与交付流水线"
tier: must
section: Beyz
icon: server
day: 4
level: A
status: done
---

# ④ NestJS 服务与交付流水线

> **简历原句**
>
> **Sole author of a NestJS service** for subscription emails and scheduled payment reminders, **Dockerized and deployed to EC2 through GitHub Actions**, and of the repo's **first CI gate on every push**.
>
> ---
>
> 独立编写了一个 NestJS 服务，负责订阅邮件与定时催款提醒，用 Docker 打包、经 GitHub Actions 部署到 EC2；也是这个仓库第一道每次推送都跑的 CI 关卡。

> ℹ️ **这几处不在简历这句里，但被追问就要答得出**：Fastify、cron 触发、PM2，以及 CI 那三步（lint / typecheck / build）。正文照旧覆盖。

## 先别拆技术名词：这条证明两件事

前三条主要证明「我能把复杂产品功能做出来」，这一条证明：

1. **我能把一个独立后端服务从零带到线上，并让它持续运行。**
2. **我给团队建立了仓库的第一道自动质量检查。**

```text
A. 邮件服务
   写服务 → cron 定时执行 → Docker 容器化
       → GitHub Actions 部署到 EC2 → 持续运行

B. CI
   每次 push → lint → typecheck → build
```

先掌握这条主线，再看 cron 幂等、PM2、Dockerfile 和部署缺口。

---

# 第一层：必须答明白的六个问题

## 1. 为什么要单独做一个邮件服务？

这个服务负责：

- 发送订阅相关邮件；
- 定时扫描需要付款提醒的用户；
- 发送 scheduled payment reminders。

主应用的普通请求是短生命周期、请求驱动的：

```text
用户发请求 → 函数执行 → 返回响应 → 本次执行结束
```

定时任务不是用户触发的，它需要系统在指定时间主动执行：

```text
常驻进程 → cron 到时间 → 扫描数据库 → 发送邮件
```

因此当时把它拆成独立的常驻服务。这样还可以独立部署、重启和扩容，不受前端发版影响。

⚠️ 不要说「定时任务绝对不能放在 Next.js」。托管 cron 也可以触发 Next.js route。准确说法是：**当时选择独立常驻服务来承载定时任务，运行模型直观、控制简单。**

**一句话答法：**

> The email work needed an independently deployable, long-running execution model for scheduled jobs, so I separated it from the request-driven Next.js application. That also let us deploy and restart it without affecting the web app.

---

## 2. NestJS 和 Fastify 分别负责什么？

### NestJS

NestJS 是应用框架，负责组织：

- module、controller 和 service；
- 依赖注入；
- 数据库和邮件服务；
- `@nestjs/schedule` 定时任务。

### Fastify

Fastify 是 NestJS 底层处理 HTTP 请求的 adapter：

```text
NestJS：应用结构
Fastify：HTTP server 实现
```

NestJS 的 adapter 可替换，因此使用 Fastify 不会改变 controller、service 和依赖注入结构。

Fastify 通常有较好的吞吐、schema 校验和 Swagger 集成，但这个服务的主要工作是定时扫库和发邮件，HTTP 吞吐并不是瓶颈。

**一句话答法：**

> NestJS provided the application structure, dependency injection and scheduling, while Fastify was the HTTP adapter. It was a reasonable low-cost choice, but HTTP throughput was not the bottleneck for this service.

---

## 3. 这个服务怎么部署上线？

真实部署链路：

```text
push 到 main
  → GitHub Actions workflow 启动
  → Actions 通过 SSH 登录 EC2
  → git pull origin main
  → docker-compose up -d --build
  → 在 EC2 上重新构建并启动容器
```

这套方式的优点是简单、容易理解，对小服务够用。

它也有明确缺点：

- 在生产机上构建镜像；
- 没有零停机替换；
- 没有 health check；
- 没有自动回滚；
- 单实例；
- 构建失败可能影响线上服务。

**一句话答法：**

> A push to main triggered GitHub Actions, which SSHed into EC2, pulled the latest commit and ran `docker-compose up -d --build`. It was deliberately simple, but it had no zero-downtime deployment, health check or automated rollback.

---

## 4. 线上到底是 Docker 还是 PM2？

准确答案：**运行在 Docker 容器里，容器内部使用 `pm2-runtime` 启动 NestJS。**

```text
EC2
└── Docker container
    └── pm2-runtime（PID 1）
        └── NestJS process
```

不是 Docker 和 PM2 二选一，而是 PM2 在容器内部。

### 为什么是 `pm2-runtime`？

容器的生命周期绑定主进程。`pm2-runtime` 在前台运行，可以作为 PID 1；普通 `pm2 start` 会 daemonize 后返回，可能导致容器认为主进程已经结束。

### PM2 在这里必要吗？

基本不必要。Compose 已配置：

```yaml
restart: unless-stopped
```

应用崩溃导致容器退出后，Compose 已经能重新启动容器。该服务也没有利用 PM2 cluster。因此现在重做会直接：

```dockerfile
CMD ["node", "dist/src/main.js"]
```

重启交给容器编排层，日志走标准输出。

⚠️ **PM2 能重启和管理日志，但不等于监控告警系统。**

**一句话答法：**

> It ran in a Docker container, with `pm2-runtime` as PID 1 inside it. In hindsight PM2 was redundant because the Compose restart policy already covered crashes, so today I would run Node directly.

---

## 5. 怎么避免同一封 reminder email 重复发送？

先理解当时的做法，再理解它为什么不够。

### 当时的做法

单独使用 `upgradeReminders` 表记录已经提醒过的用户。查询通过 left join 找出右表中没有记录的人：

```ts
const usersToRemind = await db
  .select({ user: users, reminder: upgradeReminders })
  .from(users)
  .leftJoin(upgradeReminders, eq(users.id, upgradeReminders.userId))
  .where(and(
    eq(users.subscribedPlan, 'Free'),
    lt(users.createdAt, twentyFourHoursAgo),
    isNull(upgradeReminders.id),
  ));
```

这种「找出左表里不存在于右表的记录」叫 anti-join。邮件发送后，再插入 reminder record。

持久化记录比内存标志好：服务重启或换机器后，数据库仍然知道谁已经处理过。

### 当前实现的三个缺口

**第一，顺序是先发邮件、后写记录。**

```text
邮件发送成功 → 进程崩溃 → 记录没写入
              → 下一轮再次选中 → 重复发送
```

**第二，没有唯一约束。** 两个 cron 同时查询，都可能看到「没有记录」，然后各发一封。应用层的 read-then-write 不能抵抗并发。

**第三，cron 留在 `EVERY_MINUTE`，且默认不防重入。** 上一轮没跑完，下一轮可能已经开始。

### 现在会怎么改？

1. 先插入 `pending` 记录，成功占坑的 worker 才发送；
2. 给 `(userId, reminderType, period)` 加唯一约束；
3. 发送成功后把状态更新为 `sent`；
4. 失败的 `pending` 记录由独立任务重试；
5. 如果邮件供应商支持，发送时携带 idempotency key。

⭐ **查询是优化，数据库唯一约束才是并发下的保证。**

**一句话答法：**

> I persisted reminder records and selected only users without one. Looking back, that was incomplete: the record should be claimed before sending, and a unique constraint should enforce one reminder per user, type and period because read-then-write is not safe under concurrency.

---

## 6. 第一条 CI gate 做了什么？为什么没有测试？

CI 在每次 push 时执行：

```text
lint → typecheck → build
```

三者分别检查：

| 检查 | 主要发现什么 |
|---|---|
| `lint` | 代码规则、可疑写法、Hooks 等问题 |
| `typecheck` | TypeScript 类型错误，不生成产物 |
| `build` | 真实生产构建能否完成、模块和打包配置是否正确 |

当时仓库没有自动化测试，因此 CI 没有 test job。不要声称存在测试套件。

它的价值是从零建立自动检查：在此之前是「本地觉得能跑就 push」，之后每个 push 都至少经过代码、类型和生产构建检查。

但它还不是完整的质量体系。下一步应补测试，并通过 branch protection 要求 CI 通过后才能合并。

**一句话答法：**

> It was the repository's first automated gate: lint, TypeScript checking and a production build on every push. The repository had no test suite at the time, so it did not include tests; adding them and enforcing the gate through branch protection would be the next step.

---

# 第二层：Cron 和幂等性再深入一层

## 为什么每分钟跑一次？

代码实际使用 `EVERY_MINUTE`，每天或每十分钟的表达式被注释掉了。这更像调试配置残留，不是经过严谨容量分析得出的生产参数。

提醒目标是「注册满 24 小时」，每分钟扫描精度过剩，而且数据库扫描成本会随用户量增长。

规模扩大后，更合理的设计是事件驱动：

```text
用户注册
  → 投递一个 24 小时后执行的 delayed job
  → 到时检查用户是否仍然 Free
  → 发送提醒
```

任务队列可以提供重试、退避、失败归档和可观测性，也不需要每分钟扫全库。

## 为什么发邮件很难做到“恰好一次”？

邮件供应商和数据库是两个系统，普通数据库事务无法同时包住：

```text
发送邮件 + 写数据库记录
```

- 先发后记：中间崩溃可能重复发送；
- 先记后发：中间崩溃可能漏发。

因此实际工程重点不是口头承诺 exactly-once，而是通过唯一约束、状态机、重试和供应商幂等键，把失败模式控制在可接受范围内。

---

# 第三层：CI 和 CD 不要混在一起

| | CI | CD |
|---|---|---|
| 目标 | 自动验证改动 | 把新版本部署到生产 |
| 是否修改生产 | 否 | 是 |
| 本项目 | lint / typecheck / build | SSH EC2 → pull → rebuild container |

这两个流程当时还没有真正连起来：Web 仓库的 CI 不能保护另一个服务仓库的部署。邮件服务的 deploy workflow 里没有完整的检查 gate。

理想流程：

```text
检查通过
  → 在 CI 中构建 Docker image
  → 用 commit SHA 打标签并推送 registry
  → EC2 只拉取已验证的 image
  → health check
  → 成功后替换旧版本，失败则回滚
```

这叫 **build once, deploy anywhere**。它避免生产机抢资源构建，也让回滚变成拉取旧镜像，而不是重新 checkout 和构建旧代码。

---

# 第四层：Docker 细节与真实基础设施缺口

## Dockerfile 做对的一点：依赖层缓存

```dockerfile
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN pnpm run build
```

先复制依赖清单并安装，再复制源码。只改源码时，依赖层可以复用缓存；只有 lockfile 或 package manifest 改变才重新安装依赖。

可以继续改进：

- 使用 multi-stage build；
- 最终镜像不保留开发依赖和源码；
- 使用非 root 用户；
- 添加 health check；
- 使用更小的基础镜像。

## 生产配置里的 volume mount 问题

配置把宿主机目录挂到容器应用目录：

```yaml
volumes:
  - .:/usr/src/app
  - /usr/src/app/node_modules
```

这是开发热更新常见写法，但用于生产会让宿主机目录覆盖镜像内容，甚至隐藏镜像构建好的 `dist/`。部署可能意外依赖服务器上残留的编译产物。

正确做法是生产配置删除源码挂载；开发热更新使用单独的 Compose override。

## 未鉴权的调试端点

项目还留有一个名字类似 `trigger-cron` 的 GET endpoint，实际只是给写死邮箱发测试邮件：

- 它没有真正触发完整 cron；
- 没有鉴权；
- GET 执行有副作用，可能被预取或爬虫误触发。

生产前应该删除；如果确实需要手动触发，则改成有鉴权的 POST 管理接口。

---

# 30 秒主回答

> I built a separate NestJS service for subscription emails and scheduled payment reminders because that work needed an independently deployable, long-running process. NestJS handled the application structure and cron scheduling, with Fastify as its HTTP adapter. On every push to main, GitHub Actions SSHed into EC2, pulled the latest code and rebuilt the Docker Compose service. The app ran in a container with `pm2-runtime` inside, although in hindsight PM2 was redundant because Compose already had a restart policy. I also added the web repository's first CI gate, running lint, typecheck and a production build on every push. It did not include tests because that repository had no test suite at the time.

---

# 当前实现要主动承认的六个缺口

1. **Reminder 是先发后记，也没有唯一约束。** 并发或中途崩溃可能重复发送。
2. **Cron 留在每分钟执行，且没有防重入。** 这是调试配置残留。
3. **PM2 在单进程容器里基本冗余。** Compose restart policy 已经负责崩溃重启。
4. **在生产机上重新构建。** 没有不可变镜像、健康检查、零停机和自动回滚。
5. **CI 和部署没有形成同一条 gate。** Web 仓库的 CI 保护不到服务仓库的 CD。
6. **仓库当时没有测试。** CI 只有 lint、typecheck 和 build。

---

# 最后自测：先答这六题

1. 为什么把邮件和定时提醒拆成独立服务？
2. NestJS 和 Fastify 分别负责什么？
3. Push main 之后，这个服务如何一步步部署到 EC2？
4. 线上到底是 Docker 还是 PM2？PM2 是否必要？
5. 当时如何减少重复提醒？为什么严格来说仍然可能重复？
6. 第一条 CI gate 跑什么？为什么没有测试？

能用自己的话答完这六题，再进入 delayed job、Docker 构建优化和 exactly-once 等进阶话题。

---

## 术语速查

| 中文 | 英文 |
|---|---|
| 常驻进程 | long-running process |
| 定时任务 | cron job / scheduled job |
| 轮询 / 事件驱动 | polling / event-driven |
| 延时任务 | delayed job |
| 幂等 | idempotency / idempotent |
| 反连接 | anti-join |
| 唯一约束 | unique constraint |
| 防重入 | prevent overlapping executions |
| 容器化 | containerized / Dockerized |
| 重启策略 | restart policy |
| 健康检查 | health check |
| 回滚 | rollback |
| 持续集成 | continuous integration |
| 持续部署 | continuous deployment |
| 质量门禁 | CI gate |
| 不可变产物 | immutable artifact |
| 构建一次到处部署 | build once, deploy anywhere |

---

# 附：预期追问（第二层）

> 这些内容在 2026-08-24 的一次结构重写里被删掉了，**删的理由是读起来累，不是它不会被问**。

## ⭐ 至少一次 vs 至多一次（这一问必须上到这个层次）

发邮件涉及**两个系统**（邮件服务商 + 你的数据库）。⭐ **跨系统的操作没有原子性**——你没法让「发邮件」和「写记录」要么都成功要么都失败。于是**只有两种排法**：

| 排法 | 崩在中间会怎样 | 术语 |
|---|---|---|
| **先发后记**（当时这样） | 邮件发了、记录没写 → **下一分钟又发一遍** | **至少一次**（at-least-once） |
| **先记后发** | 记了「已发送」但邮件失败 → **这个用户永远收不到** | **至多一次**（at-most-once） |

**没有第三种**，除非引入分布式事务——而那个代价通常不值得。

⭐ **所以真正的问题不是「怎么做到恰好一次」，是「这个业务宁可重复还是宁可丢失」：**

- **营销 / 提醒邮件 → 宁可重复**：多收一封升级提醒是骚扰，**收不到就是一次转化机会没了** ✅ 当时选的这个；
- **付款通知 / 密码重置 → 宁可丢失**：重复发「付款成功」会让用户以为被扣了两次。

> ⭐ **「恰好一次在跨系统场景下不存在，能做到的是至少一次加上幂等消费」——说出这句，这一问就满分了。**

## 当时知道的两个洞，和四层补法

1. **查询和写入之间没有锁**——如果这个服务跑两个实例，**两边可能同时查到同一个用户，各发一封**；
2. **崩在发信和记账之间会重发。**

| 做法 | 解决什么 |
|---|---|
| ⭐ **在 userId 上建唯一索引** | 第二次插入直接违反唯一约束、失败。**数据库层面挡住并发重复**——最便宜也最可靠的一层 |
| **先插「处理中」再发信** | 插入成功才拿到发送权（相当于抢到锁），发完更新状态。**把二选一变成三态**，可以重试也可以对账 |
| **给邮件服务商传幂等键** | 多数服务商支持这个头，**把去重推到最后一层** |
| **调度层保证只有一个实例在跑** | 分布式锁，或者用支持单例的调度器 |

> ⭐ **「唯一索引兜底」这一招和 [③ Stripe 的重复投递](/docs?section=beyz&item=stripe-billing)、[百度提现的幂等键](/docs?section=baidu&item=withdrawal) 是完全同一个模式：把不变量放在数据层，不放在应用层的 if 判断里。三个项目串起来讲，是[跨项目追问](/docs?section=cheatsheet&item=crosscut)的现成答案。**

## 依赖注入的两种方式

```ts
constructor(
  private mailerService: MailerService,              // 按类型注入
  @Inject('DATABASE_CONNECTION') private db: any     // 按名字注入
) { }
```

**依赖注入（DI）的意思是**：这个类需要什么，就在构造函数里声明，**由框架负责造好了递给它**——而不是自己 `new` 一个。**好处是测试时可以塞一个假的进去。**

**两种方式的区别**：`MailerService` 是个类，框架能从类型信息里认出它；而**数据库连接不是类，是工厂函数造出来的对象**，没有类型可以匹配，**所以要用一个字符串名字来标识**。

## 为什么不该在生产机上构建

正文的缺点清单里有这一条，但面试官读到「登录服务器然后 build」大概率会展开问。四个问题：

| 问题 | 说明 |
|---|---|
| **抢生产资源** | 构建期间生产机 CPU 被吃满，**正在服务的请求跟着变慢** |
| **构建失败 = 部署中断** | 旧容器可能已经停了，而新的起不来 |
| **不可复现** | 生产机上的构建缓存、Node 版本、磁盘状态都不受控。⭐ **「在我机器上能构建」变成了「在生产机上能构建」** |
| **回滚困难** | 没有一个不可变的产物，回滚意味着 checkout 旧代码再构建一遍 |

⭐ **标准做法叫「构建一次，到处部署」（build once, deploy anywhere）：**

```text
在 CI 环境里构建镜像
  → 用这次提交的 commit 号打上标签
    → 推到镜像仓库
      → 生产机只做「拉取 + 换容器」
```

**买到三样：**

- **生产机不构建**，只拉取和启动，秒级完成；
- ⭐ **产物不可变**——`app:a1b2c3` 这个镜像永远对应那份代码，**回滚就是拉一个旧标签**；
- **同一个镜像可以先上测试环境验证，再上生产**——**验证过的和上线的是同一个二进制**。

## 那个调试端点为什么三个问题都占

```ts
@Get('trigger-cron')
async triggerCronManually() {
  await this.mailerService.sendEmail('...', ...);   // 写死的邮箱
}
```

1. **它并不真的触发定时任务**——名字叫「手动触发 cron」，实际只是给一个**写死的邮箱**发一封测试邮件；
2. **没有任何鉴权**——谁都能访问这个地址让它发邮件；
3. ⭐ **用 GET 做有副作用的操作**——HTTP 的约定里 GET 应该是「安全的」（不改变任何东西）。**浏览器预取、爬虫、聊天软件的链接预览都可能意外触发它。**

> **答法**：「这是当时留的调试口子，名字起得比它做的事大。**上生产前应该删掉，或者至少加鉴权并改成 POST。**」
>
> ⭐ **主动指出自己代码里的疤，收益比看起来大——它证明你现在的标准高于当时的产出，而面试官招的是现在的你。**
