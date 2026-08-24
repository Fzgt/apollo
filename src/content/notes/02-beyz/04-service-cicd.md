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
> **Sole author of a NestJS and Fastify service** for subscription emails and scheduled payment reminders — **Dockerized, cron-triggered, deployed to EC2 under PM2 through GitHub Actions** — and of the repo's **first CI gate**: lint, typecheck and build on every push.

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
