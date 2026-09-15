---
title: BBQ 前两轮：题目与答卷
section: Fetch
icon: paw-print
---

# Third Wave BBQ 前两轮：题目与答卷

> 三面在 **9 月 17 日（周四）14:40**，30 分钟。预约确认信里写着会聊 **assessment responses**，也就是这两轮答卷，每道题都可能被追问。
>
> 每题三块：**原题**是 Greg 邮件原文，**中文**是题目翻译，**我交的答案**是实际发出去的英文原文，后面附中文。
> 标 ⚠ 的地方是答卷写得跟实际不一致，面试时要按实际讲。

---

## 第一轮：技术测试（9 月 4 日交）

**背景**：Third Wave BBQ 有一套总部和各门店共用的 Web 应用，技术栈是 Next.js + NestJS + PostgreSQL + Docker Compose + Ubuntu VPS。要新增一个「维修与运营问题」功能。店长可以建问题、写描述、传照片、选优先级、指派给别人、定截止日期、改状态、加评论。门店员工只能看自己门店的问题，总部员工能看所有门店的。逾期的问题每天发一封邮件提醒。

限时 45 分钟，1,200 词左右。**实际交了 1,445 词，超了约 20%，被问到就直接认。**

### 1. 需求

**原题**

> List up to eight questions you would ask before starting development. Where information is missing, state the assumptions you would make so that you could continue working.

**中文**：开工前你会问的问题，最多八个。信息缺失的地方，说明你会先按什么假设继续做。

**我交的答案**

1. One venue per user, or do area managers cover several?
2. Is Head Office a role, or a venue type?
3. Can issues be assigned across venues, and does that grant the assignee access?
4. Photos: how many per issue, what size cap, stored where, kept how long?
5. Are priority and status fixed lists, and who may close or reopen an issue?
6. Who receives the overdue email, and at what local time?
7. Are venues in more than one timezone?
8. Is there a staging environment and a restorable database backup?

Assumptions if unanswered: one venue per user; roles staff / venue manager / head office; fixed enums; ten photos at 10 MB; one digest per recipient at 08:00 venue time; UTC timestamps; an audit table from day one — stated in the PR description so they get corrected, not inherited silently.

**答案中文**

1. 一个用户只属于一家门店，还是区域经理会管好几家？
2. 总部是一种角色，还是一种门店类型？
3. 问题能不能跨门店指派？被指派的人会不会因此拿到那家门店的权限？
4. 照片：每个问题最多几张，大小上限多少，存在哪，保留多久？
5. 优先级和状态是固定选项吗？谁有权关闭或重新打开问题？
6. 逾期提醒发给谁，按当地时间几点发？
7. 门店分布在不止一个时区吗？
8. 有没有预发布环境，数据库备份能不能真的恢复出来？

没有答复时的假设：一人一店；角色分员工、店长、总部三种；状态和优先级用固定枚举；每题最多十张照片、每张 10 MB；每个收件人每天当地 08:00 收一封汇总；时间戳一律存 UTC；第一天就建审计表。这些假设写进 PR 描述，好让人纠正，而不是被默默沿用下去。

### 2. 开发计划

**原题**

> Explain how you would break the feature into manageable stages. Briefly cover database structure, backend and API, frontend, user permissions, photograph storage, email reminders, testing and deployment. We are more interested in your reasoning than in detailed code.

**中文**：说明你会怎么把这个功能拆成可管理的几个阶段。简要覆盖数据库结构、后端和 API、前端、用户权限、照片存储、邮件提醒、测试和部署。我们更看重思路，不看重代码细节。

**我交的答案**

**Schema.** `issues`, `issue_comments`, `issue_photos`, `issue_events` for audit. Index `(venue_id, status)`, plus a partial index on `due_date` where not closed, since the reminder job hits it daily.

**Permissions.** The venue filter derives from the session in one guard, never from the request: Head Office unfiltered, everyone else pinned to their own venue. Cross-venue tests come before the endpoints — the requirement most likely to be quietly broken later.

**Photos and UI.** Validate MIME and size server-side, generate our own filenames, serve through an authorised route so photos can't be fetched by guessing a path. List with filters, detail with comments, mobile first.

**Reminders and deployment.** A scheduled job groups overdue issues per recipient into one digest and records `reminder_sent_at`, so a re-run can't double-send. The migration is rehearsed against a restored production dump first.

**答案中文**

- **表结构**：`issues`、`issue_comments`、`issue_photos`，再加一张做审计的 `issue_events`。建 `(venue_id, status)` 联合索引，另外对未关闭问题的 `due_date` 建部分索引，因为提醒任务每天都要扫它。
- **权限**：门店过滤条件在一个 guard 里从登录会话推出来，绝不取自请求参数。总部不过滤，其他人固定在自己门店。跨门店的测试先于接口写，因为这条需求最容易在以后被悄悄改坏。
- **照片和界面**：服务端校验 MIME 类型和大小，文件名由我们自己生成，照片通过带鉴权的路由返回，猜路径拿不到。列表带筛选，详情带评论，移动端优先。
- **提醒和部署**：定时任务把每个收件人的逾期问题合成一封汇总邮件，并记下 `reminder_sent_at`，任务重跑也不会重复发。数据库迁移先在恢复出来的生产数据副本上演练一遍。

### 3. 给 AI 编程助手的指令

**原题**

> Provide the exact first instruction or prompt you would give an AI coding agent after opening the existing repository. Your instruction should tell the agent what to inspect, what to build, what constraints to follow and what must be true before the work is considered complete. Also provide one follow-up instruction you might give after reviewing the agent's first attempt.

**中文**：打开现有仓库后，你给 AI 编程助手的第一条指令原文是什么？要说清楚让它先查看什么、构建什么、遵守哪些约束、满足什么条件才算完成。另外给一条你看完它第一版之后会发的追加指令。

**我交的答案**

> Read-only first, no code yet. Report back: how users, venues and roles are modelled; where authorisation is enforced today; which migration tool and mailer are configured; whether a file upload path exists.
>
> Then build the backend and database layer: tables `issues`, `issue_comments`, `issue_photos`, `issue_events`, with endpoints for create, list, detail, status update, assignment and comments.
>
> Constraints: follow existing module, DTO and migration conventions — no new ORM, validation or auth library. The venue filter must come from the authenticated user, never from a query or body parameter, and must live in one guard rather than per handler. Migrations additive only, and no new dependency without asking me first.
>
> Done means: lint, typecheck and tests pass; migrations roll back cleanly on a scratch database; and integration tests prove a venue A user gets 403 or an empty list for venue B data, including when passing `venueId=B` explicitly, while Head Office sees both.

Likely follow-up:

> The venue check is duplicated across three controllers, so the fourth endpoint will be the one that forgets it. Move it into one module-level guard, delete the inline checks, and add a test hitting every issues route as a venue A user against venue B data.

**答案中文**

> 先只读，不写代码。汇报：用户、门店和角色是怎么建模的；现在的权限校验在哪一层做；配的是哪个迁移工具和哪个发信组件；有没有现成的文件上传链路。
>
> 然后做后端和数据库层：建 `issues`、`issue_comments`、`issue_photos`、`issue_events` 四张表，接口包括新建、列表、详情、改状态、指派和评论。
>
> 约束：沿用现有的模块、DTO 和迁移写法，不引入新的 ORM、校验库或鉴权库。门店过滤必须取自已登录用户，绝不取自 query 或 body 参数，而且要集中在一个 guard 里，不能每个 handler 各写一份。迁移只允许新增，加任何新依赖之前先问我。
>
> 完成的标准：lint、类型检查、测试全过；迁移在临时库上能干净回滚；集成测试证明门店 A 的用户访问门店 B 的数据时拿到 403 或空列表，显式传 `venueId=B` 也一样，而总部两边都能看到。

追加指令：

> 门店校验在三个 controller 里各写了一份，第四个接口就会是忘了写的那个。把它收进一个模块级 guard，删掉各处内联的校验，再加一个测试：用门店 A 的用户把所有 issues 路由都打一遍门店 B 的数据。

### 4. 审查 AI 生成的代码

**原题**

> Explain how you would check the changes before accepting them. Include what files and code changes you would inspect, what automated checks you would run, what you would test manually, what security and permission issues you would check, and how you would identify unnecessary or suspicious dependencies. Include specific commands or tools where you know them.

**中文**：接受改动之前你怎么检查？包括看哪些文件和改动、跑哪些自动化检查、手动测什么、查哪些安全和权限问题、怎么识别多余或可疑的依赖。知道具体命令或工具的就写出来。

**我交的答案**

`git diff --stat` first, for files it had no business touching, then the migrations, the guard, and any change to existing code. Each new dependency is checked for publish date, repository and typosquat names. Then `npm audit`, lint, typecheck, tests, and the migration up and down on a scratch database.

Manually I log in as a venue A manager and attack my own endpoint — `venueId` changed in the URL, then the body, then a venue B photo requested — and grep for request input used directly in a `where` clause, `any` casts hiding a type mismatch, and any existing check the agent loosened to make its own code pass.

**答案中文**

先跑 `git diff --stat`，看它有没有动不该动的文件；再看迁移、guard，以及所有对已有代码的修改。每个新依赖都查发布时间、源码仓库，以及是不是仿冒的相似包名。然后跑 `npm audit`、lint、类型检查、测试，并在临时库上把迁移升一遍再回滚一遍。

手动测试时，我用门店 A 店长的账号登录，攻击自己写的接口：先改 URL 里的 `venueId`，再改 body 里的，再去请求门店 B 的照片。另外 grep 三类问题：请求参数被直接塞进 `where` 条件；用 `any` 强转掩盖类型不匹配；AI 为了让自己的代码通过而放宽了原有的校验。

### 5. 代码审查

**原题**

> Consider the following simplified endpoint:
>
> ```js
> app.get('/api/issues', requireLogin, async (req, res) => {
>   const venueId = req.query.venueId;
>   const issues = await db.issue.findMany({
>     where: venueId ? { venueId } : {}
>   });
>   res.json(issues);
> });
> ```
>
> Explain what could be wrong or unsafe about this approach, which issue is the most serious, how you would correct it, and how you would test that the correction works. You do not need to rewrite the complete endpoint.

**中文**：看上面这个简化接口。说明这种写法可能有什么问题或不安全的地方，哪个最严重，怎么改，以及怎么测试改对了。不需要重写整个接口。

**我交的答案**

`venueId` comes from the query string and is never checked against the logged-in user's venue, so any authenticated user reads another restaurant's issues by editing one URL parameter. When it's omitted, the falsy branch becomes `{}` — every issue in the company. `requireLogin` proves who you are, not what you may see. Secondary: no pagination or validation.

Tenant isolation is the serious one, and the fix is to stop trusting the parameter. Scope derives from `req.user` — Head Office unfiltered, everyone else forced to their own venue — and a `venueId` outside that scope returns 403 rather than silently narrowing, so misuse shows up in the logs. It belongs in one shared helper.

Tests: seed two venues and three users, then assert venue A staff get 403 for B's issue by id, an empty list for `venueId=B`, and only A's issues with no parameter — that last case catches the `{}` regression.

**答案中文**

`venueId` 来自 query 参数，而且从来没跟登录用户所属的门店比对过，所以任何登录用户改一个 URL 参数就能读别家餐厅的问题。不传这个参数时，走的是假值分支 `{}`，直接返回全公司所有问题。`requireLogin` 只证明你是谁，不证明你能看什么。次要问题：没有分页，没有参数校验。

最严重的是租户隔离，改法是不再信任这个参数。可见范围从 `req.user` 推出来：总部不过滤，其他人强制限定在自己门店。传了超出范围的 `venueId` 就返回 403，而不是悄悄缩小结果，这样滥用会留在日志里。这段逻辑应该放在一个共用的 helper 里。

测试：造两家门店、三个用户，然后断言：门店 A 员工按 id 取 B 的问题拿到 403；传 `venueId=B` 拿到空列表；不传参数时只拿到 A 的问题。最后这条专门抓 `{}` 那个回归。

### 6. 部署

**原题**

> Explain how you would deploy the feature to the VPS without unnecessarily risking the existing production application or database. Cover Git branches and code review, database backups, database migrations, environment variables and secrets, Docker deployment, application logs, health checks, and rollback if the release fails.

**中文**：说明你怎么把这个功能部署到 VPS 上，同时不给现有生产应用和数据库带来不必要的风险。覆盖 Git 分支与代码审查、数据库备份、数据库迁移、环境变量与密钥、Docker 部署、应用日志、健康检查，以及发布失败时怎么回滚。

**我交的答案**

Feature branch, PR, review, merge; image built and tagged in CI, not on the VPS. `pg_dump` before any migration, restored into a scratch database to prove the backup works. Migrations run as their own step and are additive — expand-then-contract, destructive changes held back until nothing reads the old shape.

Secrets live in a `.env` on the VPS with restricted permissions, referenced by name in `docker-compose.yml`, never in the image or in git. Deploy is `docker compose pull` then `up -d` with a healthcheck, the previous tag kept so rollback is one command; I watch the logs and hit `/health` before calling it done. Code rolls back easily, data doesn't — hence additive migrations.

**答案中文**

功能分支 → PR → 审查 → 合并；镜像在 CI 里构建并打标签，不在 VPS 上构建。任何迁移之前先 `pg_dump`，并把备份恢复到临时库里，证明备份真的能用。迁移单独作为一步执行，而且只做新增：先扩展再收缩，破坏性变更要等到没有代码再读旧结构之后才做。

密钥放在 VPS 上一个权限收紧的 `.env` 里，`docker-compose.yml` 只按变量名引用，绝不进镜像，也绝不进 git。部署就是 `docker compose pull` 再 `up -d`，带健康检查；保留上一个镜像标签，回滚只要一条命令。我会盯着日志并请求 `/health`，确认没问题才算完成。代码回滚容易，数据回滚难，所以迁移只做新增。

> ⚠ 他们部署用的是 Linux VPS + Docker Compose，这块你的实际经验少。被追问细节就老实说，然后讲你懂的部分。

### 7. 生产事故

**原题**

> After deployment, a venue manager reports that they can see an issue belonging to another restaurant. At approximately the same time, some users begin receiving HTTP 500 errors.
>
> Explain what you would do immediately, which problem you would prioritise, what information and logs you would inspect, how you would reproduce the problem, how you would determine whether the issue was caused by the application, database, permissions or deployment, and what you would do before releasing a correction.

**中文**：上线后，一位店长反映能看到另一家餐厅的问题。差不多同一时间，部分用户开始收到 HTTP 500 错误。说明你第一时间做什么、先处理哪个问题、查哪些信息和日志、怎么复现、怎么判断根因在应用、数据库、权限还是部署，以及发布修复之前要做什么。

**我交的答案**

The leak comes first: the 500s are loud, the leak is silent and permanent. I roll back to the previous image — that stops both while the evidence is intact — and note the time so I can bound what was exposed. Then I assume one bug until proven otherwise: a scope resolving wrongly for one user can throw when it resolves to null for another.

Evidence: logs filtered to that user and issue id, whether the 500s share an endpoint, the migration output, and the row's actual `venue_id`, since a backfill leaving it null explains both. I reproduce on staging against a restored production copy: filter wrong is application code, row wrong is the migration or data, production-only is environment configuration.

Before the fix ships: a failing test reproducing the cross-venue read, full suite, verified on staging. I'd also work out from the logs what was exposed and tell Head Office — their call, not mine.

**答案中文**

先处理数据泄露：500 错误动静大，泄露是无声的，而且泄露出去就收不回。我先回滚到上一个镜像，两个问题一起止住，证据也还在；同时记下时间，好圈定暴露了哪些数据。然后在被证伪之前，先假设这是同一个 bug：可见范围对某个用户算错了，对另一个用户算成 null 时就会抛异常。

要查的证据：按这个用户和问题 id 筛出来的日志；500 是不是集中在同一个接口；迁移的输出；那行数据实际的 `venue_id`。如果数据回填把它留成了 null，两个现象都能解释。在预发布环境里用恢复出来的生产数据副本复现：过滤逻辑错了是应用代码的问题，数据行错了是迁移或数据的问题，只在生产环境出现的是环境配置的问题。

发布修复之前：先写一个能复现跨门店读取的失败测试，跑完整测试套件，在预发布环境验证通过。另外从日志里查清楚暴露了哪些内容，报告给总部。怎么处理由他们决定，不由我决定。

### 8. 过往项目

**原题**

> Provide an example of one software project or automation you have built using AI. Explain what the project did, which parts you were personally responsible for, which AI tools you used, how it was hosted or deployed, something the AI initially got wrong, and how you identified and corrected the problem. Provide a link to the project or GitHub repository where available.

**中文**：举一个你用 AI 做过的软件项目或自动化。说明它做什么、你本人负责哪些部分、用了哪些 AI 工具、怎么托管或部署的、AI 一开始哪里做错了，以及你怎么发现并改正的。有项目链接或 GitHub 仓库的话附上。

**我交的答案**

**Argus** — a job and visa listing pipeline for my own search. It scrapes several Australian job boards, deduplicates listings into Postgres, and runs each through an LLM that scores fit against my résumé and flags whether a role requires permanent residency; around 800 listings so far. I wrote all of it — scrapers, schema, migrations, scoring pipeline, UI — with Claude Code doing most of the implementation, and run it on my own machine, Postgres in Docker behind a CLI.

The AI wrote the score write-back as one `INSERT ... VALUES` batch in a single transaction. Partway through a 463-listing run it died on `job_scores_job_id_fkey`: a listing read at the start of the batch had been removed by deduplication before the write, so the foreign key rejected everything and 113 scores were lost. The traceback, plus confirming the id was gone from `jobs`, ruled out a connection fault — the generated code had assumed rows are immutable between read and write. I rewrote it as `INSERT ... SELECT ... FROM jobs WHERE id = ?`, so a vanished listing writes nothing instead of failing the batch, and committed per item rather than per run.

The repository is private — it holds my own application history — but I'm happy to walk through the code.

**答案中文**

**Argus**：给我自己找工作用的岗位和签证信息管道。它抓取几个澳洲招聘网站，去重后存进 Postgres，再让 LLM 按我的简历逐条打匹配分，并标出岗位是否要求 PR；目前大约 800 条。全部是我写的，包括爬虫、表结构、迁移、打分管道和界面，大部分实现由 Claude Code 完成。跑在我自己的电脑上，Postgres 跑在 Docker 里，前面套一个 CLI。

AI 把分数写回写成了一个事务里的一整批 `INSERT ... VALUES`。一轮 463 条跑到一半，报 `job_scores_job_id_fkey` 外键错误挂掉：批次开始时读到的一条岗位，在写入前被去重删掉了，外键把整批拒掉，丢了 113 个分数。看 traceback，再确认那个 id 确实已经不在 `jobs` 表里，就排除了连接故障。生成的代码默认数据行从读到写之间不会变。我把它改成 `INSERT ... SELECT ... FROM jobs WHERE id = ?`，岗位不在了就什么都不写，不会让整批失败；并且改成逐条提交，不再整轮提交。

仓库是私有的，里面有我自己的投递记录，但我很乐意现场带着看代码。

> ⚠ **这题有三处跟实际不一致，面试照实际讲。他拿原文对质，就直接认是写的时候记错了。**
>
> 1. 写的是「Postgres in Docker」。**实际**：从 8 月 7 日起用的就是 Neon 云数据库。
> 2. 写的是「岗位被去重删掉，丢了 113 个分数」。**实际**：没查出是谁删的；那一轮停在 463 条里的第 350 条，后面的是还没打分，不是丢了。
> 3. 写的是「改成逐条提交」。**实际**：只把 `VALUES` 改成了 `SELECT`，提交还是整批一次。

### AI 使用说明

**原题**

> Please include the AI tool or tools you used for this exercise, the relevant prompts you gave them, any important AI recommendations you rejected or changed, and a brief explanation of why you made those changes.

**中文**：写明这次作答用了哪些 AI 工具、给了什么关键提示词、否掉或改掉了 AI 的哪些重要建议，并简要说明原因。

**我交的答案**

**Tool:** Claude Code (Claude Opus), for drafting and a second opinion on the question 5 endpoint. Prompts: the exercise text, with an instruction to answer in my own words using my own project; then "list every problem with this endpoint by severity, and say which are real versus stylistic".

**Rejected:** *Postgres row-level security* — stronger in the right codebase, but this app connects as one database user with no session-variable plumbing, and RLS gives false confidence the moment a query path forgets to set it. *One email per overdue issue* — thirty overdue issues means thirty emails and a flagged sending domain, so it became a digest. *"Follow security best practices" in the agent prompt* — an agent can't act on it; replaced with the specific constraint and a testable definition of done. I also cut a suggested `casl` dependency: a permissions library for one rule is more code to review, not less.

**答案中文**

**工具**：Claude Code（Claude Opus），用来起草，以及对第 5 题的接口要第二意见。提示词：把题目原文给它，要求用我自己的话、拿我自己的项目作答；然后是「按严重程度列出这个接口的所有问题，并区分哪些是真问题、哪些只是风格问题」。

**否掉的建议**：

- **Postgres 行级安全（RLS）**：放在合适的代码库里更强，但这个应用只用一个数据库用户连接，也没有设置会话变量的链路。只要有一条查询路径忘了设置，RLS 就会给人虚假的安全感。
- **每个逾期问题发一封邮件**：三十个逾期问题就是三十封邮件，发信域名会被标成垃圾邮件，所以改成了汇总邮件。
- **在 agent 提示词里写「遵循安全最佳实践」**：agent 没法照着这句话做事，换成了具体约束加上可测试的完成标准。
- 另外砍掉了它建议引入的 `casl` 依赖：为一条规则引入一个权限库，要审的代码只会更多，不会更少。

> 「负责任地用 AI」大概率落在这一段：你否掉了哪几条建议、为什么否。四条都要能脱稿讲。

---

## 第二轮：书面追问（9 月 5 日交）

**背景**：员工用一个应用在交接班之间上报运营问题。上报量下降了 40%，但反复出现的问题并没有减少。管理层想用 AI 生成的提醒，鼓励员工多上报。

限时 15 到 20 分钟，500 词以内（不含代码和测试）。**实际交了 646 词，超了约 30%。**

> **题眼：四道题其实是同一道。** `acknowledge()` 里写了 `status = "resolved"`，「我看到了」被存成了「修好了」，问题因此从所有人的列表里消失。上报量下降是这个 bug 造成的，不是情况好转了。

### 1. 理解问题（约 3 分钟）

**原题**

> Before agreeing to build reminders:
> - What are the two most important questions you would ask, and who would you ask?
> - What evidence would help you distinguish a software defect from a workflow or trust problem?

**中文**：在同意做提醒功能之前：你最想问的两个问题是什么，问谁？什么证据能帮你区分这是软件缺陷，还是流程或信任问题？

**我交的答案**

To staff who used to report, at handover: "After you submit a report, what do you see happen to it?" That separates "the app is broken" from "reporting feels pointless". To whoever owns the app, with the release log: "What changed in the weeks before the count started falling?"

Evidence separating a defect from workflow or trust: a server-side funnel of forms opened, submitted and failed by app version, since reports that never land are a defect; the shape of the drop, sudden and aligned with a release being code, gradual or confined to one venue being people; and whether reports close with any record of a fix, because if they do not, the loss is trust, not transport.

**答案中文**

在交接班时问以前经常上报的员工：「你提交报告以后，看到它后来怎么样了？」这能区分「应用坏了」和「上报感觉没用」。拿着发布记录问应用负责人：「上报量开始下降之前的几周里，改了什么？」

区分缺陷和流程、信任问题的证据有三类：

- **服务端漏斗**：按应用版本统计表单打开、提交、失败的数量。报告根本没提交成功，那就是缺陷。
- **下降的形态**：突然下降且时间点对得上某次发布，是代码问题；缓慢下降或只发生在某一家门店，是人的问题。
- **关闭记录**：看问题关闭时有没有任何修复记录。如果没有，丢掉的是员工的信任，不是数据传输。

### 2. 审查代码（约 8 分钟）

**原题**

> You now learn that staff say problems disappear from their list when the next shift acknowledges them—even when nothing has been fixed. Managers interpret the falling report count as an improvement.
>
> An AI coding assistant proposes the following implementation and passing test. For this exercise, assume authentication and permissions are already correctly handled, and openIssue is an unresolved issue.
>
> ```js
> function acknowledge(issue, staffId) {
>   issue.acknowledgedBy = staffId;
>   issue.status = "resolved";
>   return issue;
> }
>
> function visibleIssues(issues) {
>   return issues.filter(issue => issue.status !== "resolved");
> }
>
> // AI-generated test:
> expect(acknowledge(openIssue, "staff-7").status).toBe("resolved");
> ```
>
> - Explain what the code actually does and whether the passing test demonstrates that it meets staff needs.
> - Show the smallest useful correction, using code or pseudocode. State any assumption about how an issue should become resolved.
> - Give one regression test with its setup, action and expected result. Explain why it fails against the original code and passes against your correction.

**中文**：现在你了解到，员工说下一班的人一「确认已阅」，问题就从列表里消失了，即使什么都没修。管理层把上报量下降理解成情况好转。AI 编程助手给出了上面的实现和一个能通过的测试（假设认证和权限已经正确处理，`openIssue` 是一个未解决的问题）。

- 说明这段代码实际做了什么，以及通过的测试能否证明它满足员工的需求。
- 用代码或伪代码给出最小的有效修正，并说明你对「问题怎样才算解决」的假设。
- 给一个回归测试，写明准备数据、执行动作和预期结果，并解释它为什么在原代码上失败、在你的修正上通过。

**我交的答案**

acknowledge writes two facts and is entitled to one. Storing "someone read this" as status = "resolved" lets visibleIssues filter the issue off every list — exactly what staff describe, and it explains both symptoms. Problems recur because nothing was fixed; reports fall because people stop feeding a system that swallows them. The falling count is the defect's output, not an improvement.

The test asserts that a function which sets status to "resolved" sets status to "resolved". It restates the implementation, so it cannot fail while the implementation is wrong, and it never asks what staff care about: is my issue still on the list?

Smallest correction — separate the two facts:

```js
function acknowledge(issue, staffId) {
  issue.acknowledgedBy = staffId;
  issue.acknowledgedAt = Date.now();
  return issue;                    // status untouched
}

function resolve(issue, staffId, note) {
  issue.status = "resolved";
  issue.resolvedBy = staffId;
  issue.resolutionNote = note;     // required
  return issue;
}
```

Assumption: an issue becomes resolved only through an explicit resolve naming who fixed it and what they did, never as a side effect of being read. Acknowledged issues stay visible, marked.

Regression test.
- Setup: `openIssue = { id: 1, status: "open" }`, `list = [openIssue]`.
- Action: `acknowledge(openIssue, "staff-7")`, then `visibleIssues(list)`.
- Expected: one issue back, acknowledgedBy "staff-7", status "open".

The original fails it — acknowledge resolves the issue, visibleIssues returns nothing. The correction leaves status alone, so the issue is still there: the behaviour the AI's test never checked.

**答案中文**

`acknowledge` 写了两个事实，但它只有资格写其中一个。把「有人看过了」存成 `status = "resolved"`，`visibleIssues` 就会把这个问题从所有列表里过滤掉。这正是员工描述的现象，也同时解释了两个症状：问题反复出现，是因为什么都没修；上报量下降，是因为员工不愿再往一个会把报告吞掉的系统里填东西。上报量下降是这个缺陷造成的结果，不是情况好转。

那个测试断言的是：「一个把 status 设成 resolved 的函数，把 status 设成了 resolved」。它只是把实现复述了一遍，所以实现错着的时候它也不会失败；它也从来没问过员工真正关心的事：我的问题还在不在列表上？

最小修正是把两个事实拆开（代码见上）：`acknowledge` 只记谁看过、什么时候看的，不碰 status；新增 `resolve`，由它设置 resolved，并且必须记下是谁修的、附上修复说明。

假设：问题只能通过显式调用 `resolve` 变成已解决，并写明是谁修的、做了什么；绝不能因为被看过就顺带变成已解决。已确认的问题继续显示，只是加上标记。

回归测试：

- 准备：`openIssue = { id: 1, status: "open" }`，`list = [openIssue]`。
- 动作：先 `acknowledge(openIssue, "staff-7")`，再 `visibleIssues(list)`。
- 预期：返回一个问题，`acknowledgedBy` 是 `"staff-7"`，status 是 `"open"`。

原代码会失败：`acknowledge` 把问题设成已解决，`visibleIssues` 什么都不返回。修正后 status 不变，问题还在列表上。这正是 AI 的测试从来没检查过的行为。

### 3. 指挥并验证 AI（约 5 分钟）

**原题**

> Write the exact prompt you would give an AI coding assistant to make your correction in an existing codebase. Include what it should inspect, the boundaries of the change and how it should demonstrate correctness.
>
> Name one plausible but unsuitable AI suggestion you would reject, explain why, and describe one verification step you would perform independently rather than relying on the AI's assurance.

**中文**：写出你会让 AI 编程助手在现有代码库里做这个修正的提示词原文，包括它要检查什么、改动边界在哪、怎么证明改对了。再举一个看似合理但不合适、你会否掉的 AI 建议，说明原因，并描述一个你会自己独立做、而不是相信 AI 保证的验证步骤。

**我交的答案**

> In this repository, acknowledging an issue marks it resolved, which hides unfixed issues from staff. Before changing anything, inspect and report back: every read and write of issue.status, every caller of acknowledge, the migration and persistence storing status, and every dashboard query counting resolved issues. Then make only this change: acknowledge records acknowledgedBy and acknowledgedAt and must not modify status; add resolve(issue, staffId, note) as the only path to status = "resolved". Do not touch authentication, permissions, unrelated schema, or the UI beyond an acknowledged marker. Add the regression test above. List every call site that relied on acknowledge to resolve, with a one-line reason for each change. Show the test failing against current code and passing after.

I would reject filtering acknowledged issues out of the default view, or auto-resolving them after a set time: tidy, passing, short lists — and unfixed problems hidden through a different door, with the same false improvement.

Verification, not "all tests pass": query the data for issues acknowledged and resolved with no resolvedBy — the rows the old behaviour corrupted. That set must stop growing after deploy, and I would reopen them rather than leave real problems buried.

**答案中文**

> 在这个仓库里，确认已阅会把问题标记为已解决，导致没修好的问题从员工视野里消失。改任何东西之前，先检查并汇报：所有读写 `issue.status` 的地方、所有调用 `acknowledge` 的地方、存储 status 的迁移和持久化代码、所有统计已解决问题的看板查询。然后只做这一处改动：`acknowledge` 记录 `acknowledgedBy` 和 `acknowledgedAt`，不得修改 status；新增 `resolve(issue, staffId, note)`，作为变成 `status = "resolved"` 的唯一途径。不要碰认证、权限、无关的表结构，界面上除了加一个「已确认」标记之外也不要动。加上上面那个回归测试。列出所有原本依赖 `acknowledge` 来解决问题的调用点，每处改动附一句理由。展示这个测试在现有代码上失败、改完之后通过。

**否掉的建议**：把已确认的问题从默认视图里过滤掉，或者超过一定时间自动设为已解决。这样列表整洁、测试通过、列表也短了，但没修好的问题只是换了一扇门被藏起来，照样是虚假的改善。

**独立验证，不信「测试全过」**：去数据库里查「已确认、已解决、但没有 `resolvedBy`」的问题，也就是被旧逻辑污染的那些行。上线后这批数据必须停止增长；而且我会把它们重新打开，而不是让真实问题一直埋着。

> 「负责任地用 AI」的另一个落点：AI 写的测试只是把 bug 当成规格写死了。这段要讲得出细节。

### 4. 适应新约束（约 4 分钟）

**原题**

> Staff sometimes work offline on a shared device. An acknowledgement made while offline could arrive at the server after someone else has resolved or reopened the issue. Management still wants one simple dashboard number.
>
> - Describe one concrete sequence where a naive implementation produces the wrong outcome, and the rule you would use to prevent it. No full offline system implementation is required.
> - Choose one measure of whether your intervention helps staff. Explain one way that number could be misleading and what you would check alongside it.

**中文**：员工有时在共用设备上离线工作。离线时做的「确认已阅」，可能在别人已经解决或重新打开这个问题之后才同步到服务器。管理层仍然想要看板上一个简单的数字。

- 描述一个具体的操作顺序，说明简单实现会在其中得出错误结果，以及你用什么规则防止它。不需要实现完整的离线系统。
- 选一个衡量你的改动是否真正帮到员工的指标，说明这个数字可能怎样误导人，以及你会同时查看什么。

**我交的答案**

07:00, staff A acknowledges issue 12 offline. 07:30, staff B fixes and resolves it. 09:00, staff C finds it again and reopens it. 10:00, the device reconnects and the 07:00 acknowledgement syncs. Last-write-wins treats it as newest and stamps three hours of real work back; if that client still sends the old resolve-on-acknowledge payload, the reopened issue closes silently.

Rule: offline actions sync as timestamped facts, not state overwrites, each carrying the issue version it was based on. The server records that A acknowledged at 07:00, but a write based on a stale version may never move status — those queue for a person to confirm. On a shared device the event carries the staffId captured at action time, not whoever is signed in at sync.

Measure: reports per shift against the pre-drop baseline. It misleads when volume rises for the wrong reason — five people reporting one problem because none can see it is already reported, or a manager ordering more reports — so I would read it beside the repeat-report rate and the share of issues closing with a resolution note.

**答案中文**

**出错的顺序**：07:00，员工 A 离线确认了 12 号问题。07:30，员工 B 修好并把它设为已解决。09:00，员工 C 发现问题又出现了，重新打开。10:00，A 的设备联网，07:00 那条确认才同步上来。「最后写入者胜」会把它当成最新的操作，把三个小时的真实进展覆盖回去；如果这台客户端还在发旧版「确认即解决」的请求，被重新打开的问题就会悄无声息地又被关掉。

**规则**：离线操作同步上来的是带时间戳的事实，而不是覆盖状态；每条都带上它所基于的问题版本号。服务器会记下「A 在 07:00 确认过」，但基于过期版本的写入永远不能改变 status，这类写入排队等人来确认。在共用设备上，事件里带的是操作那一刻记录的 staffId，而不是同步时恰好登录着的那个人。

**指标**：每个班次的上报数，与下降之前的基线对比。它可能因为错误的原因上升而误导人：五个人重复上报同一个问题，因为谁也看不到别人已经报过；或者经理下令多报。所以我会同时看重复上报率，以及关闭时附有修复说明的问题占比。

### 耗时与 AI 使用说明

**原题**

> Please label your answers 1–4 and include your approximate time spent and AI-use note.

**中文**：答案按 1 到 4 标号，并写上大致耗时和 AI 使用说明。

**我交的答案**

About 35 minutes. Tool: Claude Code (Claude Opus), asked to argue against my acknowledge/resolve split and find a case my offline rule misses. It contributed the shared-device detail in 4 — capture staffId at action time, not at sync. I cut its proposal of a full event-sourced sync layer as far past this change, and rewrote its regression test, which asserted the status field rather than what staff see.

**答案中文**

大约 35 分钟。工具：Claude Code（Claude Opus），让它反驳我把 acknowledge 和 resolve 拆开的方案，并找出我的离线规则漏掉的情况。它贡献了第 4 题里共用设备的细节：staffId 在操作时记录，不在同步时取。我砍掉了它提出的完整事件溯源同步层，因为远超这次改动的范围；还重写了它给的回归测试，因为它断言的是 status 字段，而不是员工实际看到的东西。

> ⚠ **「About 35 minutes」不对。** 实际是 Greg 18:06 来信，你 18:18 回信，约 12 分钟。被问到就答实际时间。
