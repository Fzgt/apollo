---
title: "④ The NestJS service and the delivery pipeline"
---

# ④ The NestJS service and the delivery pipeline

> **Resume line**
>
> **Sole author of a NestJS service** for subscription emails and scheduled payment reminders, **Dockerized and deployed to EC2 through GitHub Actions**, and of the repo's **first CI gate on every push**.

> ℹ️ **These are not in the resume line but have to be answerable when someone digs in**: Fastify, the cron trigger, PM2 and the three CI steps (lint / typecheck / build). The body below covers them.

## Don't unpack the technology names yet: this bullet proves two things

The first three bullets mostly prove "I can build a complex product feature". This one proves:

1. **I can take a standalone backend service from nothing to production and keep it running.**
2. **I set up the repository's first automated quality check for the team.**

```text
A. the email service
   write the service → cron runs it on a schedule → containerise with Docker
       → GitHub Actions deploys to EC2 → it keeps running

B. CI
   every push → lint → typecheck → build
```

Get this main line first, then look at cron idempotency, PM2, the Dockerfile and the deployment gaps.

---

# Layer one: the six questions you must answer cleanly

## 1. Why build a separate email service at all?

The service was responsible for:

- Sending subscription-related email;
- Periodically scanning for users who needed a payment reminder;
- Sending scheduled payment reminders.

An ordinary request in the main application is short-lived and request-driven:

```text
user sends a request → the function runs → a response goes back → this execution ends
```

A scheduled job is not triggered by a user; it needs the system to act on its own at a given time:

```text
long-running process → cron fires → scan the database → send email
```

So at the time it was split out into a standalone, always-on service. That also let it be deployed, restarted and scaled independently of front-end releases.

⚠️ Do not say "scheduled jobs absolutely cannot live in Next.js". A managed cron can trigger a Next.js route perfectly well. The accurate phrasing is: **at the time we chose a standalone long-running service to carry the scheduled work, because the execution model was obvious and the control simple.**

**One-sentence answer:**

> The email work needed an independently deployable, long-running execution model for scheduled jobs, so I separated it from the request-driven Next.js application. That also let us deploy and restart it without affecting the web app.

---

## 2. What do NestJS and Fastify each do?

### NestJS

NestJS is the application framework. It organises:

- Modules, controllers and services;
- Dependency injection;
- The database and the mail service;
- `@nestjs/schedule` scheduled jobs.

### Fastify

Fastify is the adapter NestJS uses underneath to handle HTTP:

```text
NestJS:  application structure
Fastify: HTTP server implementation
```

NestJS adapters are swappable, so using Fastify changes nothing about controllers, services or dependency injection.

Fastify usually has better throughput, schema validation and Swagger integration, but this service's main job was scanning the database on a schedule and sending mail — HTTP throughput was never the bottleneck.

**One-sentence answer:**

> NestJS provided the application structure, dependency injection and scheduling, while Fastify was the HTTP adapter. It was a reasonable low-cost choice, but HTTP throughput was not the bottleneck for this service.

---

## 3. How does this service get deployed?

The real deployment path:

```text
push to main
  → the GitHub Actions workflow starts
  → Actions SSHes into EC2
  → git pull origin main
  → docker-compose up -d --build
  → the container is rebuilt and started on EC2
```

The upside is that it is simple and easy to understand, and adequate for a small service.

Its downsides are equally clear:

- The image is built on the production machine;
- No zero-downtime replacement;
- No health check;
- No automatic rollback;
- A single instance;
- A failed build can take down the live service.

**One-sentence answer:**

> A push to main triggered GitHub Actions, which SSHed into EC2, pulled the latest commit and ran `docker-compose up -d --build`. It was deliberately simple, but it had no zero-downtime deployment, health check or automated rollback.

---

## 4. In production, is it Docker or PM2?

The accurate answer: **it runs in a Docker container, and inside the container `pm2-runtime` starts NestJS.**

```text
EC2
└── Docker container
    └── pm2-runtime (PID 1)
        └── NestJS process
```

It is not Docker or PM2 — PM2 sits inside the container.

### Why `pm2-runtime`?

A container's lifetime is bound to its main process. `pm2-runtime` runs in the foreground and can be PID 1; a plain `pm2 start` daemonises and returns, which can make the container think the main process has finished.

### Was PM2 necessary here?

Basically not. Compose was already configured with:

```yaml
restart: unless-stopped
```

If the app crashes and the container exits, Compose already restarts it. The service also never used PM2's cluster mode. So a redo would go straight to:

```dockerfile
CMD ["node", "dist/src/main.js"]
```

Restarts go to the orchestration layer, logs go to standard output.

⚠️ **PM2 can restart processes and manage logs, but that does not make it a monitoring and alerting system.**

**One-sentence answer:**

> It ran in a Docker container, with `pm2-runtime` as PID 1 inside it. In hindsight PM2 was redundant because the Compose restart policy already covered crashes, so today I would run Node directly.

---

## 5. How do you avoid sending the same reminder email twice?

Understand what was done at the time first, then why it is not enough.

### What was done at the time

A separate `upgradeReminders` table recorded which users had already been reminded. The query used a left join to find the people with no row on the right side:

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

"Find rows in the left table with no match in the right table" is an anti-join. After the mail is sent, a reminder record is inserted.

A persisted record beats an in-memory flag: after a restart or a move to another machine, the database still knows who has been handled.

### Three gaps in the current implementation

**First, the order is send-then-record.**

```text
email sent successfully → the process crashes → the record is never written
                        → the next round selects them again → duplicate send
```

**Second, there is no unique constraint.** Two cron runs querying at the same time can both see "no record" and each send a mail. Read-then-write in the application layer does not survive concurrency.

**Third, the cron is still on `EVERY_MINUTE`, with no overlap protection by default.** The previous round may not have finished when the next one starts.

### How would you change it now?

1. Insert a `pending` record first; only the worker that claims the slot sends;
2. Add a unique constraint on `(userId, reminderType, period)`;
3. Update the status to `sent` after a successful send;
4. Have a separate job retry failed `pending` records;
5. Pass an idempotency key to the email provider if it supports one.

⭐ **The query is an optimisation; the database unique constraint is the guarantee under concurrency.**

**One-sentence answer:**

> I persisted reminder records and selected only users without one. Looking back, that was incomplete: the record should be claimed before sending, and a unique constraint should enforce one reminder per user, type and period because read-then-write is not safe under concurrency.

---

## 6. What did the first CI gate do, and why were there no tests?

CI ran on every push:

```text
lint → typecheck → build
```

What each one catches:

| Check | What it mainly finds |
|---|---|
| `lint` | Code rules, suspicious patterns, Hooks problems and so on |
| `typecheck` | TypeScript type errors, without emitting output |
| `build` | Whether a real production build completes, and whether module and bundler configuration are correct |

The repository had no automated tests at the time, so CI had no test job. Do not claim a test suite existed.

Its value was creating automated checking from nothing: before it, the rule was "it seemed to run locally, so push"; after it, every push passed at least a code, type and production-build check.

But it is not yet a complete quality system. The next step is tests, plus branch protection requiring CI to pass before a merge.

**One-sentence answer:**

> It was the repository's first automated gate: lint, TypeScript checking and a production build on every push. The repository had no test suite at the time, so it did not include tests; adding them and enforcing the gate through branch protection would be the next step.

---

# Layer two: one level deeper on cron and idempotency

## Why does it run every minute?

The code actually uses `EVERY_MINUTE`; the daily and ten-minute expressions are commented out. That looks like leftover debugging configuration rather than a production parameter derived from careful capacity analysis.

The target is "registered at least 24 hours ago", so scanning every minute is far more precision than needed, and the cost of the database scan grows with the user base.

At larger scale the sensible design is event-driven:

```text
a user registers
  → enqueue a delayed job for 24 hours later
  → when it fires, check whether the user is still Free
  → send the reminder
```

A job queue gives you retries, backoff, a dead-letter archive and observability — and it never scans the whole table every minute.

## Why is "exactly once" so hard for email?

The email provider and the database are two systems, and an ordinary database transaction cannot wrap both:

```text
send the email + write the database record
```

- Send then record: a crash in between can duplicate the send;
- Record then send: a crash in between can lose it.

So the engineering focus is not on promising exactly-once out loud, but on using unique constraints, a state machine, retries and provider idempotency keys to keep the failure modes inside an acceptable range.

---

# Layer three: do not conflate CI and CD

| | CI | CD |
|---|---|---|
| Goal | Automatically verify a change | Deploy a new version to production |
| Touches production | No | Yes |
| In this project | lint / typecheck / build | SSH EC2 → pull → rebuild container |

The two flows were not genuinely joined up at the time: the web repository's CI cannot protect another service repository's deployment. The email service's deploy workflow has no complete check gate.

The ideal flow:

```text
checks pass
  → build the Docker image in CI
  → tag it with the commit SHA and push it to a registry
  → EC2 only pulls an image that has already been verified
  → health check
  → replace the old version on success, roll back on failure
```

This is **build once, deploy anywhere**. It stops the production machine from fighting for build resources, and turns a rollback into pulling an older image rather than checking out and rebuilding old code.

---

# Layer four: Docker details and the real infrastructure gaps

## One thing the Dockerfile gets right: dependency layer caching

```dockerfile
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN pnpm run build
```

Copy the dependency manifest and install first, then copy the source. When only the source changes, the dependency layer stays cached; dependencies are reinstalled only when the lockfile or package manifest changes.

Further improvements available:

- Use a multi-stage build;
- Keep dev dependencies and source out of the final image;
- Run as a non-root user;
- Add a health check;
- Use a smaller base image.

## The volume mount problem in the production configuration

The configuration mounts a host directory over the container's application directory:

```yaml
volumes:
  - .:/usr/src/app
  - /usr/src/app/node_modules
```

This is the usual pattern for development hot reload, but in production it lets the host directory shadow the image contents — including the `dist/` the image build produced. A deployment can accidentally depend on compiled output left over on the server.

The right approach is to drop the source mount from the production configuration and put development hot reload in a separate Compose override.

## An unauthenticated debug endpoint

The project still has a GET endpoint named something like `trigger-cron`, which in reality just sends a test email to a hard-coded address:

- It does not actually run the full cron;
- It has no authentication;
- A GET with side effects can be triggered accidentally by prefetching or a crawler.

It should be deleted before production; if manual triggering is genuinely needed, it should become an authenticated POST admin endpoint.

---

# The 30-second answer

> I built a separate NestJS service for subscription emails and scheduled payment reminders because that work needed an independently deployable, long-running process. NestJS handled the application structure and cron scheduling, with Fastify as its HTTP adapter. On every push to main, GitHub Actions SSHed into EC2, pulled the latest code and rebuilt the Docker Compose service. The app ran in a container with `pm2-runtime` inside, although in hindsight PM2 was redundant because Compose already had a restart policy. I also added the web repository's first CI gate, running lint, typecheck and a production build on every push. It did not include tests because that repository had no test suite at the time.

---

# Six gaps to admit up front about the current implementation

1. **Reminders send first and record afterwards, with no unique constraint.** Concurrency or a crash midway can duplicate a send.
2. **Cron is still on every minute, with no overlap protection.** That is leftover debugging configuration.
3. **PM2 is essentially redundant in a single-process container.** The Compose restart policy already handles crash restarts.
4. **The build happens on the production machine.** No immutable image, health check, zero downtime or automatic rollback.
5. **CI and deployment are not one gate.** The web repository's CI cannot protect the service repository's CD.
6. **The repository had no tests at the time.** CI is only lint, typecheck and build.

---

# Self-check: answer these six first

1. Why split email and scheduled reminders into a separate service?
2. What do NestJS and Fastify each do?
3. After a push to main, how does this service reach EC2, step by step?
4. In production, is it Docker or PM2, and was PM2 necessary?
5. How were duplicate reminders reduced at the time, and why can they strictly still happen?
6. What does the first CI gate run, and why are there no tests?

Once you can answer those six in your own words, move on to delayed jobs, Docker build optimisation and exactly-once.

---

## Glossary

| 中文 | English |
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

# Appendix: the follow-up questions to expect (layer two)

> A restructuring pass on 2026-08-24 deleted this material. **It was cut because it was tiring to read, not because nobody will ask about it.**

## ⭐ At-least-once vs at-most-once (this question has to reach this level)

Sending email involves **two systems** (the email provider and your database). ⭐ **A cross-system operation has no atomicity** — you cannot make "send the email" and "write the record" both succeed or both fail. So **there are only two orderings**:

| Ordering | What a crash in the middle does | Term |
|---|---|---|
| **Send then record** (what was done) | The mail went out, the record did not → **it goes out again next minute** | **at-least-once** |
| **Record then send** | "Sent" is recorded but the mail failed → **this user never receives it** | **at-most-once** |

**There is no third option**, short of distributed transactions — and that price is usually not worth paying.

⭐ **So the real question is not "how do I get exactly once", it is "would this business rather duplicate or rather lose":**

- **Marketing / reminder email → rather duplicate**: a second upgrade reminder is an annoyance, **never receiving one is a lost conversion** ✅ this is what was chosen;
- **Payment notices / password resets → rather lose**: sending "payment successful" twice makes the user think they were charged twice.

> ⭐ **"Exactly-once does not exist across systems; what you can build is at-least-once plus idempotent consumption" — say that sentence and this question is a full mark.**

## The two holes that were known at the time, and four layers of fix

1. **There is no lock between the query and the write** — with two instances of this service running, **both can see the same user and each send a mail**;
2. **A crash between sending and recording causes a resend.**

| Measure | What it solves |
|---|---|
| ⭐ **A unique index on userId** | The second insert violates the constraint and fails. **Concurrent duplicates are blocked at the database level** — the cheapest and most reliable layer |
| **Insert "in progress" before sending** | Only a successful insert grants the right to send (effectively taking a lock); update the status afterwards. **Two states become three**, so you can retry and reconcile |
| **Pass an idempotency key to the provider** | Most providers support that header, **pushing deduplication to the final layer** |
| **Ensure only one instance runs at a time** | A distributed lock, or a scheduler that supports singleton jobs |

> ⭐ **The "unique index as backstop" move is exactly the same pattern as [③ Stripe's duplicate delivery](/docs?section=beyz&item=stripe-billing) and [the idempotency key in Baidu withdrawals](/docs?section=baidu&item=withdrawal): put the invariant in the data layer, not in an application-layer if. Telling all three projects as one story is a ready-made answer for [cross-project follow-ups](/docs?section=cheatsheet&item=crosscut).**

## Two ways to inject a dependency

```ts
constructor(
  private mailerService: MailerService,              // injected by type
  @Inject('DATABASE_CONNECTION') private db: any     // injected by name
) { }
```

**Dependency injection (DI) means**: a class declares what it needs in its constructor, and **the framework builds those things and hands them over** — instead of the class calling `new` itself. **The benefit is that a test can hand it a fake.**

**The difference between the two forms**: `MailerService` is a class, so the framework can recognise it from the type information; a **database connection is not a class but an object produced by a factory function**, so there is no type to match against and **it has to be identified by a string name.**

## Why you should not build on the production machine

The downside list in the body mentions this, but an interviewer reading "SSH into the server and then build" will almost certainly dig in. Four problems:

| Problem | Detail |
|---|---|
| **Competing for production resources** | The build saturates the CPU, **so requests being served get slower** |
| **A failed build = a broken deployment** | The old container may already be stopped while the new one cannot start |
| **Not reproducible** | Build cache, Node version and disk state on the production machine are all uncontrolled. ⭐ **"It builds on my machine" becomes "it builds on the production machine"** |
| **Rollback is hard** | With no immutable artifact, rolling back means checking out old code and building it again |

⭐ **The standard practice is called build once, deploy anywhere:**

```text
build the image in CI
  → tag it with this commit's SHA
    → push it to a registry
      → the production machine only pulls and swaps containers
```

**You buy three things:**

- **The production machine never builds**, it only pulls and starts — done in seconds;
- ⭐ **The artifact is immutable** — the image `app:a1b2c3` corresponds to that code forever, **so a rollback is pulling an older tag**;
- **The same image can be verified in staging and then promoted to production** — **what you verified and what you shipped are the same binary.**

## Why that debug endpoint hits all three problems

```ts
@Get('trigger-cron')
async triggerCronManually() {
  await this.mailerService.sendEmail('...', ...);   // hard-coded address
}
```

1. **It does not really trigger the scheduled job** — the name says "manually trigger cron", but it just sends one test email to a **hard-coded address**;
2. **There is no authentication at all** — anyone who hits that URL makes it send mail;
3. ⭐ **It performs a side effect over GET** — by HTTP convention, GET should be "safe" (it changes nothing). **Browser prefetching, crawlers and chat-app link previews can all trigger it by accident.**

> **How to answer**: "That was a debug hatch I left in, and the name promises more than it does. **It should have been deleted before production, or at least authenticated and turned into a POST.**"
>
> ⭐ **Pointing at the scars in your own code pays better than it looks — it shows your standard today is above what you shipped then, and the interviewer is hiring today's you.**
