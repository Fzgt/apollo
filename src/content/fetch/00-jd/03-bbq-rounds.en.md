---
title: BBQ rounds 1–2: questions and answers
section: Fetch
---

# Third Wave BBQ rounds 1–2: questions and answers

> Third interview: **Thursday 17 September, 14:40**, 30 minutes. The booking confirmation says they will discuss your **assessment responses**, so any question below can come up.
>
> Questions are Greg's original wording; answers are exactly what was sent. ⚠ marks where the answer does not match the facts. Say the facts in the interview.

---

## Round 1: Technical Exercise (sent 4 September)

**Scenario.** Third Wave BBQ has an existing web application used by Head Office and multiple restaurant locations. Stack: Next.js, NestJS, PostgreSQL, Docker Compose, an Ubuntu VPS. They want to add a maintenance and operational issues feature. A venue manager should be able to create an issue, add a description and photographs, select a priority, assign the issue to another user, set a due date, update its status and add comments. Venue employees must only see issues belonging to their own venue; Head Office employees see issues across all venues. Overdue issues should generate a daily email reminder.

Limit: 45 minutes, approximately 1,200 words. **Sent 1,445 words, about 20% over. If asked, just admit it.**

### 1. Requirements

**Question**

> List up to eight questions you would ask before starting development. Where information is missing, state the assumptions you would make so that you could continue working.

**Answer**

1. One venue per user, or do area managers cover several?
2. Is Head Office a role, or a venue type?
3. Can issues be assigned across venues, and does that grant the assignee access?
4. Photos: how many per issue, what size cap, stored where, kept how long?
5. Are priority and status fixed lists, and who may close or reopen an issue?
6. Who receives the overdue email, and at what local time?
7. Are venues in more than one timezone?
8. Is there a staging environment and a restorable database backup?

Assumptions if unanswered: one venue per user; roles staff / venue manager / head office; fixed enums; ten photos at 10 MB; one digest per recipient at 08:00 venue time; UTC timestamps; an audit table from day one — stated in the PR description so they get corrected, not inherited silently.

### 2. Development plan

**Question**

> Explain how you would break the feature into manageable stages. Briefly cover database structure, backend and API, frontend, user permissions, photograph storage, email reminders, testing and deployment. We are more interested in your reasoning than in detailed code.

**Answer**

**Schema.** `issues`, `issue_comments`, `issue_photos`, `issue_events` for audit. Index `(venue_id, status)`, plus a partial index on `due_date` where not closed, since the reminder job hits it daily.

**Permissions.** The venue filter derives from the session in one guard, never from the request: Head Office unfiltered, everyone else pinned to their own venue. Cross-venue tests come before the endpoints — the requirement most likely to be quietly broken later.

**Photos and UI.** Validate MIME and size server-side, generate our own filenames, serve through an authorised route so photos can't be fetched by guessing a path. List with filters, detail with comments, mobile first.

**Reminders and deployment.** A scheduled job groups overdue issues per recipient into one digest and records `reminder_sent_at`, so a re-run can't double-send. The migration is rehearsed against a restored production dump first.

### 3. Instructions to the AI coding agent

**Question**

> Provide the exact first instruction or prompt you would give an AI coding agent after opening the existing repository. Your instruction should tell the agent what to inspect, what to build, what constraints to follow and what must be true before the work is considered complete. Also provide one follow-up instruction you might give after reviewing the agent's first attempt.

**Answer**

> Read-only first, no code yet. Report back: how users, venues and roles are modelled; where authorisation is enforced today; which migration tool and mailer are configured; whether a file upload path exists.
>
> Then build the backend and database layer: tables `issues`, `issue_comments`, `issue_photos`, `issue_events`, with endpoints for create, list, detail, status update, assignment and comments.
>
> Constraints: follow existing module, DTO and migration conventions — no new ORM, validation or auth library. The venue filter must come from the authenticated user, never from a query or body parameter, and must live in one guard rather than per handler. Migrations additive only, and no new dependency without asking me first.
>
> Done means: lint, typecheck and tests pass; migrations roll back cleanly on a scratch database; and integration tests prove a venue A user gets 403 or an empty list for venue B data, including when passing `venueId=B` explicitly, while Head Office sees both.

Likely follow-up:

> The venue check is duplicated across three controllers, so the fourth endpoint will be the one that forgets it. Move it into one module-level guard, delete the inline checks, and add a test hitting every issues route as a venue A user against venue B data.

### 4. Reviewing AI-generated work

**Question**

> Explain how you would check the changes before accepting them. Include what files and code changes you would inspect, what automated checks you would run, what you would test manually, what security and permission issues you would check, and how you would identify unnecessary or suspicious dependencies. Include specific commands or tools where you know them.

**Answer**

`git diff --stat` first, for files it had no business touching, then the migrations, the guard, and any change to existing code. Each new dependency is checked for publish date, repository and typosquat names. Then `npm audit`, lint, typecheck, tests, and the migration up and down on a scratch database.

Manually I log in as a venue A manager and attack my own endpoint — `venueId` changed in the URL, then the body, then a venue B photo requested — and grep for request input used directly in a `where` clause, `any` casts hiding a type mismatch, and any existing check the agent loosened to make its own code pass.

### 5. Code review

**Question**

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

**Answer**

`venueId` comes from the query string and is never checked against the logged-in user's venue, so any authenticated user reads another restaurant's issues by editing one URL parameter. When it's omitted, the falsy branch becomes `{}` — every issue in the company. `requireLogin` proves who you are, not what you may see. Secondary: no pagination or validation.

Tenant isolation is the serious one, and the fix is to stop trusting the parameter. Scope derives from `req.user` — Head Office unfiltered, everyone else forced to their own venue — and a `venueId` outside that scope returns 403 rather than silently narrowing, so misuse shows up in the logs. It belongs in one shared helper.

Tests: seed two venues and three users, then assert venue A staff get 403 for B's issue by id, an empty list for `venueId=B`, and only A's issues with no parameter — that last case catches the `{}` regression.

### 6. Deployment

**Question**

> Explain how you would deploy the feature to the VPS without unnecessarily risking the existing production application or database. Cover Git branches and code review, database backups, database migrations, environment variables and secrets, Docker deployment, application logs, health checks, and rollback if the release fails.

**Answer**

Feature branch, PR, review, merge; image built and tagged in CI, not on the VPS. `pg_dump` before any migration, restored into a scratch database to prove the backup works. Migrations run as their own step and are additive — expand-then-contract, destructive changes held back until nothing reads the old shape.

Secrets live in a `.env` on the VPS with restricted permissions, referenced by name in `docker-compose.yml`, never in the image or in git. Deploy is `docker compose pull` then `up -d` with a healthcheck, the previous tag kept so rollback is one command; I watch the logs and hit `/health` before calling it done. Code rolls back easily, data doesn't — hence additive migrations.

> ⚠ They deploy on a Linux VPS with Docker Compose, and you have little hands-on experience there. If pushed on details, say so honestly, then explain what you do know.

### 7. Production problem

**Question**

> After deployment, a venue manager reports that they can see an issue belonging to another restaurant. At approximately the same time, some users begin receiving HTTP 500 errors.
>
> Explain what you would do immediately, which problem you would prioritise, what information and logs you would inspect, how you would reproduce the problem, how you would determine whether the issue was caused by the application, database, permissions or deployment, and what you would do before releasing a correction.

**Answer**

The leak comes first: the 500s are loud, the leak is silent and permanent. I roll back to the previous image — that stops both while the evidence is intact — and note the time so I can bound what was exposed. Then I assume one bug until proven otherwise: a scope resolving wrongly for one user can throw when it resolves to null for another.

Evidence: logs filtered to that user and issue id, whether the 500s share an endpoint, the migration output, and the row's actual `venue_id`, since a backfill leaving it null explains both. I reproduce on staging against a restored production copy: filter wrong is application code, row wrong is the migration or data, production-only is environment configuration.

Before the fix ships: a failing test reproducing the cross-venue read, full suite, verified on staging. I'd also work out from the logs what was exposed and tell Head Office — their call, not mine.

### 8. Previous project

**Question**

> Provide an example of one software project or automation you have built using AI. Explain what the project did, which parts you were personally responsible for, which AI tools you used, how it was hosted or deployed, something the AI initially got wrong, and how you identified and corrected the problem. Provide a link to the project or GitHub repository where available.

**Answer**

**Argus** — a job and visa listing pipeline for my own search. It scrapes several Australian job boards, deduplicates listings into Postgres, and runs each through an LLM that scores fit against my résumé and flags whether a role requires permanent residency; around 800 listings so far. I wrote all of it — scrapers, schema, migrations, scoring pipeline, UI — with Claude Code doing most of the implementation, and run it on my own machine, Postgres in Docker behind a CLI.

The AI wrote the score write-back as one `INSERT ... VALUES` batch in a single transaction. Partway through a 463-listing run it died on `job_scores_job_id_fkey`: a listing read at the start of the batch had been removed by deduplication before the write, so the foreign key rejected everything and 113 scores were lost. The traceback, plus confirming the id was gone from `jobs`, ruled out a connection fault — the generated code had assumed rows are immutable between read and write. I rewrote it as `INSERT ... SELECT ... FROM jobs WHERE id = ?`, so a vanished listing writes nothing instead of failing the batch, and committed per item rather than per run.

The repository is private — it holds my own application history — but I'm happy to walk through the code.

> ⚠ **Three things here don't match the facts. Tell the real version. If he quotes the written answer, say you misremembered when writing it.**
>
> 1. Written: "Postgres in Docker". **Fact:** it has run on Neon (cloud Postgres) since 7 August.
> 2. Written: "removed by deduplication … 113 scores were lost". **Fact:** it was never found out what deleted the row; the run stopped at 350 of 463, so the rest were never scored, not lost.
> 3. Written: "committed per item rather than per run". **Fact:** only `VALUES` was changed to `SELECT`; the commit is still once per batch.

### AI usage disclosure

**Question**

> Please include the AI tool or tools you used for this exercise, the relevant prompts you gave them, any important AI recommendations you rejected or changed, and a brief explanation of why you made those changes.

**Answer**

**Tool:** Claude Code (Claude Opus), for drafting and a second opinion on the question 5 endpoint. Prompts: the exercise text, with an instruction to answer in my own words using my own project; then "list every problem with this endpoint by severity, and say which are real versus stylistic".

**Rejected:** *Postgres row-level security* — stronger in the right codebase, but this app connects as one database user with no session-variable plumbing, and RLS gives false confidence the moment a query path forgets to set it. *One email per overdue issue* — thirty overdue issues means thirty emails and a flagged sending domain, so it became a digest. *"Follow security best practices" in the agent prompt* — an agent can't act on it; replaced with the specific constraint and a testable definition of done. I also cut a suggested `casl` dependency: a permissions library for one rule is more code to review, not less.

> "Using AI responsibly" will most likely land here: which suggestions you rejected and why. Be able to explain all four without notes.

---

## Round 2: Written Follow-Up (sent 5 September)

**Scenario.** Staff use an application to report operational problems between shifts. Reports have fallen by 40%, but recurring problems have not decreased. Management wants AI-generated reminders encouraging staff to submit more reports.

Limit: 15–20 minutes, no more than 500 words excluding code and tests. **Sent 646 words, about 30% over.**

> **The core: all four questions are one question.** `acknowledge()` sets `status = "resolved"`, so "I've seen it" is stored as "it's fixed" and the issue vanishes from every list. The falling report count is the bug's output, not an improvement.

### 1. Understand the problem (about 3 minutes)

**Question**

> Before agreeing to build reminders:
> - What are the two most important questions you would ask, and who would you ask?
> - What evidence would help you distinguish a software defect from a workflow or trust problem?

**Answer**

To staff who used to report, at handover: "After you submit a report, what do you see happen to it?" That separates "the app is broken" from "reporting feels pointless". To whoever owns the app, with the release log: "What changed in the weeks before the count started falling?"

Evidence separating a defect from workflow or trust: a server-side funnel of forms opened, submitted and failed by app version, since reports that never land are a defect; the shape of the drop, sudden and aligned with a release being code, gradual or confined to one venue being people; and whether reports close with any record of a fix, because if they do not, the loss is trust, not transport.

### 2. Review the code (about 8 minutes)

**Question**

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

**Answer**

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

### 3. Direct and verify AI (about 5 minutes)

**Question**

> Write the exact prompt you would give an AI coding assistant to make your correction in an existing codebase. Include what it should inspect, the boundaries of the change and how it should demonstrate correctness.
>
> Name one plausible but unsuitable AI suggestion you would reject, explain why, and describe one verification step you would perform independently rather than relying on the AI's assurance.

**Answer**

> In this repository, acknowledging an issue marks it resolved, which hides unfixed issues from staff. Before changing anything, inspect and report back: every read and write of issue.status, every caller of acknowledge, the migration and persistence storing status, and every dashboard query counting resolved issues. Then make only this change: acknowledge records acknowledgedBy and acknowledgedAt and must not modify status; add resolve(issue, staffId, note) as the only path to status = "resolved". Do not touch authentication, permissions, unrelated schema, or the UI beyond an acknowledged marker. Add the regression test above. List every call site that relied on acknowledge to resolve, with a one-line reason for each change. Show the test failing against current code and passing after.

I would reject filtering acknowledged issues out of the default view, or auto-resolving them after a set time: tidy, passing, short lists — and unfixed problems hidden through a different door, with the same false improvement.

Verification, not "all tests pass": query the data for issues acknowledged and resolved with no resolvedBy — the rows the old behaviour corrupted. That set must stop growing after deploy, and I would reopen them rather than leave real problems buried.

> The other likely "responsible AI" question: the AI's test just locked the bug in as the spec. Be ready to explain it in detail.

### 4. Adapt to a new constraint (about 4 minutes)

**Question**

> Staff sometimes work offline on a shared device. An acknowledgement made while offline could arrive at the server after someone else has resolved or reopened the issue. Management still wants one simple dashboard number.
>
> - Describe one concrete sequence where a naive implementation produces the wrong outcome, and the rule you would use to prevent it. No full offline system implementation is required.
> - Choose one measure of whether your intervention helps staff. Explain one way that number could be misleading and what you would check alongside it.

**Answer**

07:00, staff A acknowledges issue 12 offline. 07:30, staff B fixes and resolves it. 09:00, staff C finds it again and reopens it. 10:00, the device reconnects and the 07:00 acknowledgement syncs. Last-write-wins treats it as newest and stamps three hours of real work back; if that client still sends the old resolve-on-acknowledge payload, the reopened issue closes silently.

Rule: offline actions sync as timestamped facts, not state overwrites, each carrying the issue version it was based on. The server records that A acknowledged at 07:00, but a write based on a stale version may never move status — those queue for a person to confirm. On a shared device the event carries the staffId captured at action time, not whoever is signed in at sync.

Measure: reports per shift against the pre-drop baseline. It misleads when volume rises for the wrong reason — five people reporting one problem because none can see it is already reported, or a manager ordering more reports — so I would read it beside the repeat-report rate and the share of issues closing with a resolution note.

### Time and AI use

**Question**

> Please label your answers 1–4 and include your approximate time spent and AI-use note.

**Answer**

About 35 minutes. Tool: Claude Code (Claude Opus), asked to argue against my acknowledge/resolve split and find a case my offline rule misses. It contributed the shared-device detail in 4 — capture staffId at action time, not at sync. I cut its proposal of a full event-sourced sync layer as far past this change, and rewrote its regression test, which asserted the status field rather than what staff see.

> ⚠ **"About 35 minutes" is wrong.** Greg's email arrived at 18:06 and you replied at 18:18 — about 12 minutes. If asked, give the real number.
