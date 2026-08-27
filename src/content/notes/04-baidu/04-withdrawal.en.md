---
title: "④ The withdrawal client"
section: Baidu
---

# ④ The withdrawal client

> **Resume line**
>
> Built the **withdrawal client** on a path **peaking above 2,000 QPS**: **request locking** drops in-flight duplicates, **client-generated idempotency keys survive reloads**, and **uncertain outcomes surface as failures, never successes**.

## What this bullet is about

⭐ **In one line: what a front end can and cannot guarantee on a money path.**

**The easiest way to wreck this bullet is to tell it as "my client-side lock held up 2,000 QPS".** That sentence does not survive one follow-up — hit F12, call the endpoint directly, and you are past it.

⭐ **Its real value is that you draw the line yourself: the client reduces useless load, the backend provides correctness.** Without that sentence this bullet is a liability.

## The 30-second version

> This is the withdrawal entry point during a promotion, and at peak the whole path reached a couple of thousand QPS. **The front end's job here is narrow but well defined: stop invalid duplicate requests before they are sent, and always err towards "failed" when the outcome is uncertain.**
>
> Three things concretely: **lock a given withdrawal for the window between sending the request and receiving the response**, so hammering the button produces no second request; **generate the idempotency key on the client and store it in sessionStorage**, so that if the user reloads and retries the backend still recognises it as the same withdrawal; and **treat timeouts and dropped connections as failures**, pointing the user at their withdrawal history, never showing success.
>
> ⭐ **But I am clear that a client-side lock does not survive a second device, a second tab or a reload — real correctness comes from the backend's idempotency key and database constraints. The client reduces useless load; it does not provide a guarantee.**

## 1. Define "idempotent" first; the word is used throughout

⭐ **Idempotent = performing the same operation once and N times leaves the system in the same final state.**

- `set the balance to 100` → **idempotent** (any number of times gives 100)
- `subtract 50 from the balance` → ⚠️ **not idempotent** (twice takes 100)

**A withdrawal is inherently the second kind.** So a layer has to be wrapped around it that ⭐ **turns "execute again" into "recognise the repeat and do not execute".**

## 2. Debounce vs throttle vs a request lock (commonly confused; keep them apart)

| | Behaviour | Where it fits |
|---|---|---|
| **Debounce** | Many triggers, **executes once n ms after they stop** | Search-box typing, resize |
| **Throttle** | **At most once every n ms**, evenly | scroll, mousemove |
| ⭐ **Request lock** | **Executes immediately the first time, then blocks everything until the response returns** | Submit-style actions |

⭐ **Why a withdrawal button must not be debounced**: "takes effect after you stop" means the user clicks 100 times and only the last one fires a request 300 ms later. **Nothing happens on the first click, the user concludes it is unresponsive, and clicks more** — the exact opposite of the intent.

> **A submit action wants "run immediately, then lock" (leading edge + lock), not debounce's "run only the last one" (trailing edge).**

## 3. Two versions of the request lock, read line by line

**The naive version:**

```js
let inFlight = false;                    // is a request currently in flight
async function withdraw() {
  if (inFlight) return;                  // in flight -> do nothing
  inFlight = true;                       // take the lock
  try { ... } finally { inFlight = false; }   // ⭐ finally: release on success and on failure
}
```

⭐ **That `finally` is the important line**: releasing only in the success branch means **the button is permanently locked after a single failure** and the user can never withdraw again.

**The per-argument version** (locks one withdrawal, allows different ones concurrently):

```js
const inFlightMap = new Map();           // key = this withdrawal's id, value = the in-flight promise
async function withdraw(orderId) {
  if (inFlightMap.has(orderId))
    return inFlightMap.get(orderId);     // ⭐ not a rejection: hand back the same promise
  const promise = api.withdraw(orderId);
  inFlightMap.set(orderId, promise);
  try { return await promise; }
  finally { inFlightMap.delete(orderId); }
}
```

**Line by line:**

- A `Map` rather than a boolean → ⭐ **lock granularity drops from "the whole button" to "each individual order"**, so two different withdrawals do not block each other
- ⭐ `return inFlightMap.get(orderId)` → the second call **receives the first call's promise**. The caller awaits it and still gets a result; **it never knows it was deduplicated**, so no special-casing is needed in calling code
- `finally { delete }` → the lock is released when the request finishes, so the next click is a fresh request

⭐ **This pattern is called request deduplication, and it is what React Query and SWR do internally.** Saying so shows you know you are reproducing a general pattern rather than improvising.

## 4. The idempotency key: the most valuable thing the front end can do

**A client-side lock cannot cover three things** (because that `Map` lives only in this page's memory):

1. **Automatic retries** after a network timeout
2. The user acting **on another device or in another tab**
3. ⭐ **Clicking again after a reload** — a reload zeroes that memory and the lock is gone

**So the real guarantee has to come from backend idempotency**: every withdrawal request carries an **idempotency key** (a random string unique to this operation), the backend stores the keys it has processed, and **the same key arriving again returns the previous result instead of debiting again.**

**The front end's half of that is essential:**

| Practice | Why |
|---|---|
| **Generate the key early** (on page entry, not on click) | Generating it on click means **two clicks are two different keys, and the backend sees two different withdrawals** |
| ⭐ **Store it in sessionStorage** | **It is still the same key after a reload** — otherwise a retry after a reload looks like a new withdrawal to the backend. **This is what `survive reloads` on the resume means** |
| Send it with every call | |

## 5. Defensive fallback: the error-handling principle for money

⭐ **Default to failure; show success only on an explicit success** (the practice is called **defensive fallback**).

| Outcome | How it is handled |
|---|---|
| **Explicit failure** (4xx/5xx, a business error code) | Show the error and allow a retry |
| ⭐ **Uncertain** (timeout, dropped connection, sent with no response) | **Treat as failure**, but word it as "network problem, please check your withdrawal history shortly" — ⚠️ **do not say "it failed" outright** (the backend may already have processed it) |
| **Explicit success** (2xx plus a business success code) | Show success |

⭐ **Why "uncertain" leans towards failure — because the two ways of being wrong do not cost the same:**

- **Wrongly showing failure** → the user retries → **the retry is covered by the idempotency key, so nothing is debited twice** → the cost is one wasted round trip
- **Wrongly showing success** → the money never arrives → **the user believes they withdrew and no money comes** → complaints, escalations, an incident

⭐ **"Asymmetric cost" is the point of this section, and it is the general principle behind all front-end error handling on money paths.**

## 6. ⭐ What 2,000 QPS is and who measured it (settle this with yourself first)

### Attribution: this number does not belong to the front end

⭐ **QPS is a backend metric. The front end does not "absorb" QPS, it contributes to it** — each user click contributes 1. **The front end cannot see the site's requests per second; that lives in gateway and backend monitoring.**

**Learning the number from a backend colleague is entirely legitimate**; that is normal information flow on a team. ⭐ **But you must be able to separate what you know from what you did.**

> **The current resume phrasing is safe**: `on a path peaking above 2,000 QPS` states only **the scale of the path**, with the lock and the idempotency key each written as their own action — **the scale is still there without claiming your lock is what held it.** (The original read `sustained 2,000+ peak QPS through request locking and defensive fallbacks`, which grammatically attributed "held up" to two front-end mechanisms; that has been changed.)

### QPS is computed, not measured

⭐ **What a monitoring system actually stores is a monotonically increasing counter, and QPS is the slope of that counter over a time window:**

```
QPS = (counter at window end - counter at window start) / window length
```

⭐ **So the window size directly determines the number you see:**

| Window | "Peak QPS" computed from the same traffic |
|---|---|
| 1 second | Perhaps 2000 |
| 1 minute | Perhaps only 600 |
| 5 minutes | Perhaps only 300 |

⭐ **The larger the window, the flatter the peak is smoothed. So "peak of 2,000 QPS" without a window says nothing.**

**`peak` and `sustained` are very different**: 2,000 for three seconds and 2,000 held for thirty minutes **are not remotely the same load on a database**. ⭐ **You have to know which one you are claiming** — the resume now says peak explicitly.

### Monitoring or load testing: two sources, wildly different meanings

| | **Monitoring** | **Load testing** |
|---|---|---|
| Meaning | ⭐ **It really happened** | ⭐ **It was verified as survivable** |
| Where it comes from | The gateway logs → collection → a time-series database → a dashboard curve | A tool generates traffic against the system, ramping up |
| Correct phrasing | "Monitoring showed 2,000+ at the promotion's peak" | "Load testing verified it holds 2,000+" |

⚠️ **Never blur the two** — saying monitoring when it was a load test inflates the business volume; the reverse undersells your own work.

**A few load-testing concepts; being able to name them proves you have seen one:**

- **Ramping up**: raise QPS in steps rather than opening at full rate
- ⭐ **The knee, or capacity / saturation point**: the point where QPS is still climbing but **P99 latency starts spiking and the error rate starts rising** is the real capacity. **Capacity is not "how much you can push in", it is "the most you can push in without it breaking"**
- ⭐ **What a complete load-test conclusion sounds like**: not "it holds 2,000 QPS", but "at 2,000, P99 latency was 120 ms with a 0 error rate; pushing on to 2600, P99 rose to 800 ms"
- **Shadow tables / traffic tagging**: load testing in production must write test traffic to shadow tables. ⭐ **On a money path especially, real financial data must not be polluted**

> ⚠️ **If you cannot remember, use the safe phrasing**: "That figure came from the backend team; I remember it as the peak during the promotion, but I would need to check whether it was monitoring or a load-test report." — ⭐ **"I would need to check" is always safer than inventing an answer.**

## 7. What the backend did to hold it (telling this upgrades you from hearsay to understanding)

| Layer | What it does |
|---|---|
| **Edge** | **Rate limiting** (token bucket / leaky bucket — better to reject some than to collapse entirely), **queueing or a captcha to shave the peak**, **circuit breaking and graceful degradation** |
| **Application** | Stateless → **adding machines scales it linearly**. ⭐ **QPS is a cluster metric, not a per-machine one** — 20 machines sharing 2,000 QPS is 100 each |
| ⭐ **Data (the real bottleneck)** | **A withdrawal is a write, and caching does not save writes.** Shard by a hash of the user id, split reads from writes; ⭐ **the hot-account problem** — if every withdrawal debits the same pooled account, **every transaction contends for the same row lock and sharding does not help**, so the account has to be split into buckets |
| **Consistency** | The idempotency key gets a **unique index**; the balance invariant goes **into the SQL WHERE clause** |
| ⭐ **Made asynchronous** | A withdrawal usually is not completed synchronously — validate, write a "processing" order, return, and **do the actual payout through an async queue**. **So that 2,000 QPS is the rate of submitted requests, not of completed payouts, and the two can differ enormously** |

### Two data-layer patterns worth memorising on their own

```sql
-- ① the idempotency key gets a unique index, so a duplicate violates the constraint outright
INSERT INTO withdraw_order (idempotency_key, user_id, amount, ...) VALUES (...);

-- ② the balance invariant lives in the WHERE clause; success is decided by rows affected
UPDATE account SET balance = balance - ?
WHERE user_id = ? AND balance >= ?;
```

⭐ **Why you cannot "read then write"**: there is a window between the read and the write, and **at 2,000 QPS two concurrent requests can both read "does not exist" and both insert.** A database unique index and a single UPDATE are atomic; **there is no such window.**

> ⭐ **The same pattern as [the lifetime-purchase protection in Stripe](/docs?section=beyz&item=stripe-billing), [the unique index on the Beyz mailer](/docs?section=beyz&item=service-cicd) and [the type constraint in BioMap](/docs?section=biomap&item=tanstack-query): put the invariant in the data layer, not in an `if` in application code.** Four examples across three projects — **strung together they are a ready-made answer to [the cross-project follow-ups](/docs?section=cheatsheet&item=crosscut).**

## 8. How to answer about "zero financial loss" (cut from the resume, but the topic finds you anyway)

**The original line contained `without a single dollar of financial loss`; it has been removed.** The reason is worth knowing:

⭐ **It is a negative claim — proving "no instance of financial loss ever occurred". You cannot enumerate everything that did not happen.**

⭐ **The only thing that can support it is reconciliation, and reconciliation lives on the finance side, not on any engineering dashboard:**

```
withdrawal records in the business database  ↕ matched line by line on the channel's transaction id  ↕  the payment channel's reconciliation file (delivered T+1)
                → discrepancies enter the exceptions process: re-issue, refund, claw back
```

**So the accurate meaning of "zero financial loss" is: every reconciliation discrepancy was resolved and there was no net loss.**

### ⭐ The defences against loss are layered (saying this earns a lot)

| Layer | What it does | Its nature |
|---|---|---|
| 1. **Front end** | Request lock, idempotency key, error fallbacks | Reduces useless repeats |
| 2. Gateway / application | Rate limiting, parameter validation, risk control | Blocks abnormal traffic |
| 3. **Database** | Unique index on the idempotency key, balance invariant, transactions | ⭐ **The real source of correctness** |
| 4. Async state machine | Orders only permit legal state transitions | Prevents reordering and replay |
| 5. ⭐ **Reconciliation** | Line-by-line matching T+1, discrepancies into the exceptions process | **Detects and repairs** |

⭐ **The key insight: the first four layers make it not happen; the fifth catches and repairs what happens anyway. Real zero-loss rests on that fifth layer, not on the first four being perfect** — anyone who works on payments knows the first four cannot be perfect: networks jitter, channels time out, people write bugs.

> ⭐ **Admitting you were only the first layer is more credible than claiming you delivered the fifth.**

## 9. The division-of-labour table for follow-ups (say it all in one breath)

| Question | How to answer |
|---|---|
| **What if a user bypasses the client lock?** | ⭐ **They can, and it is easy** — call the endpoint straight from F12. So the client lock only reduces useless requests; **correctness rests on the backend idempotency key, unique index, database transaction and balance invariant** |
| **Did you measure the 2,000 QPS?** | No, that is the whole path's volume from backend monitoring. **The front end does not absorb QPS, it contributes to it** |
| **How was zero loss guaranteed?** | **That is a reconciliation result, not something I measured.** The defences are five layers deep and the front end is only the first |
| **What else can the front end do?** | Rate limiting (disable the button when there is no quota), queueing or a captcha to shave the peak at the moment a promotion opens — ⚠️ **but these are experience improvements, not correctness guarantees** |

⭐ **The closing sentence: the client reduces useless load; the backend provides correctness.**

## Glossary

| 中文 | English |
|---|---|
| 提现 | **withdrawal** |
| 在途请求 | **in-flight request** (*drops in-flight duplicates*) |
| 请求锁 | **request locking** |
| 请求去重 | **request deduplication** |
| 首次立即执行 | **leading edge** ↔ trailing edge |
| 幂等 / 幂等键 | **idempotent · idempotency key** |
| 刷新后仍有效 | **survive reloads** (the resume's own phrase) |
| 兜底 / 防御式处理 | **defensive fallback** |
| 结果不确定 | **uncertain outcome** |
| 代价不对称 | **asymmetric cost** |
| 唯一索引 | **unique index** |
| 业务不变量 | **business invariant** |
| 事务 | **transaction** |
| 限流 | **rate limiting** (**token bucket**, **leaky bucket**) |
| 削峰 | **shed / smooth the peak** |
| 熔断 | **circuit breaker** |
| 降级 | **degrade gracefully** |
| 水平扩容 | **scale horizontally** |
| 分库分表 | **sharding** |
| 读写分离 | **read/write splitting** |
| 热点账户 | **hot row / hot account** (**row-lock contention**) |
| 异步化 | **move it off the request path** |
| 峰值 ↔ 持续 | **peak ↔ sustained** |
| 统计窗口 | **the window** (*rate over a 1-minute window*) |
| 压测 | **load testing** |
| 梯度加压 | **ramp up** |
| 影子库 | **shadow table / shadow traffic** |
| 对账 | **reconciliation** (*reconciliation found no discrepancies*) |
| 差错 / 差异 | **discrepancy** |
| 单边账 | **unmatched record** |
| 资损 | **financial loss** |

> ⭐ **The three easiest to get wrong**:
>
> 1. The closing sentence for the whole bullet: **"The client reduces useless load; correctness comes from the backend."** Memorise it
> 2. "The front end does not absorb QPS, it contributes to it" — **the client doesn't absorb QPS, it contributes to it**
> 3. "Zero loss is a reconciliation result" — **that's a reconciliation result, not something I measured**
