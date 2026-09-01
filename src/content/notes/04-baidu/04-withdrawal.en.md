---
title: "④ The withdrawal client"
section: Baidu
---

# ④ The withdrawal client

> **Resume line**
>
> Built the **withdrawal client** on a path **peaking above 2,000 QPS**: **request locking** drops in-flight duplicates, **client-generated idempotency keys survive reloads**, and **uncertain outcomes surface as failures, never successes**.

## Terms, in one line each

**Idempotent** — running the operation once or N times leaves **the system in the same final state**. "Set the balance to 100" is idempotent; **"subtract 50" is not** — twice takes 100. **A withdrawal is inherently the second kind.**

**Idempotency key** — a random string standing for **this one operation**. The backend records keys it has processed, so **the same key returns the previous result instead of debiting again.**

**In-flight request** — sent, response not yet received.

**QPS (queries per second)** — a **backend** metric. **The client does not absorb QPS, it contributes to it.**

**P99 latency** — sort all request durations; **99% are faster than this.** Far more useful than the mean.

**Unique index** — a database constraint forbidding the same value twice. **It is atomic**, with none of the window that "check, then write" has.

**Reconciliation** — matching your own ledger against the payment channel's settlement file **line by line**, with discrepancies going into an exceptions process. **"Zero financial loss" is a conclusion from here, and appears on no engineering dashboard.**

## What this line has to show

In one sentence: **what a client can and cannot guarantee on a financial path.**

**The way this line fails is telling it as "my client-side lock absorbed 2,000 QPS".** That does not survive one follow-up — **open DevTools and call the API directly and you have gone around it.**

Its real value is that you draw the boundary yourself: **the client reduces useless load; correctness comes from the backend.** Without that sentence, **this line is a liability.**

## Debounce, throttle and request lock are not the same

- **Debounce** — after repeated triggers, run once **after things go quiet** for N ms. Good for search inputs and window resize.
- **Throttle** — run **at most once per N ms**, evenly. Good for scroll and pointer move.
- **Request lock** — **run immediately on the first call**, and **reject everything** until the response arrives. Good for submissions.

**Why a withdrawal button cannot be debounced**: firing only after things go quiet means a hundred clicks send **one request, hundreds of milliseconds after the last one.** Nothing happens on the first click, **so the user thinks it is unresponsive and clicks more** — the opposite of the intent.

**Submissions want the leading edge plus a lock, not the trailing edge.**

## Two versions of the request lock

**The naive one: a boolean.**

```ts
let locked = false;

async function submit() {
  if (locked) return;          // something is in flight — do nothing
  locked = true;
  try {
    return await api.withdraw(payload);
  } finally {
    locked = false;            // ← critical: unlock in finally
  }
}
```

**That `finally` is the point. Unlocking only on the success path leaves the button permanently locked after one failure, and the user can never withdraw again** — the most common bug in this pattern.

**The per-key version: a Map.**

```ts
const inFlight = new Map<string, Promise<Result>>();

function submit(orderId: string, payload: Payload) {
  const existing = inFlight.get(orderId);
  if (existing) return existing;        // ← not a rejection: hand back the same promise

  const p = api.withdraw(payload).finally(() => inFlight.delete(orderId));
  inFlight.set(orderId, p);
  return p;
}
```

The second call **is not rejected — it receives the first call's promise.** The caller awaits and gets the result as usual, **never knowing it was deduplicated, so no caller needs a single special case.**

**A Map instead of a boolean moves the lock's granularity from the whole button to each order**, so two different withdrawals do not block each other.

**This pattern is request deduplication, and it is what React Query and SWR do internally.** Saying so shows you know you are reproducing a general pattern rather than improvising.

## Idempotency keys: the most valuable thing the client does

**The client-side lock cannot stop three things**, because that Map lives only in this page's memory:

1. **automatic retries** after a network timeout;
2. the user acting **on another device or another tab**;
3. **clicking again after a reload** — a reload wipes the memory and the lock with it.

So **the real guarantee has to come from backend idempotency.** The client's half is three points:

```ts
// ① generated on page entry, not on click
const key = sessionStorage.getItem('withdrawKey') ?? crypto.randomUUID();
// ② stored in sessionStorage — the same key survives a reload
sessionStorage.setItem('withdrawKey', key);

// ③ sent on every call
api.withdraw(payload, { headers: { 'Idempotency-Key': key } });
```

**① Why generation must be early**: generating on click means **two clicks are two different keys, and the backend sees two different withdrawals.**

**② Why sessionStorage**: otherwise a retry after a reload looks like a brand-new withdrawal to the backend. **That is exactly what `survive reloads` means on the resume.**

## Uncertain outcomes always report as failures

This is a **defensive fallback**: **default to failure, and show success only on an explicit success.**

- **Explicit failure** (a business error code, or 4xx / 5xx) → show the error and allow a retry.
- **Explicit success** → show success.
- **Uncertain** (timeout, network drop, request sent with no response) → **treat as failure, but word it carefully**: "**network problem — please check your withdrawal history shortly**", **not "it failed"**, because the backend may well have processed it.

**Why uncertainty leans toward failure: the two errors have asymmetric cost.**

- **Wrongly showing failure** → the user retries, **and the idempotency key means the retry does not debit twice.** The cost is one wasted trip.
- **Wrongly showing success when nothing landed** → the user believes they withdrew and no money arrives. **That is a support ticket, a complaint, and an incident.**

**Asymmetric cost is the crux here, and it is the general principle for error handling on any financial frontend.**

## What 2,000 QPS is, and who measured it

**Attribution: the number is not the frontend's.** QPS is a backend metric. **The client does not absorb QPS, it contributes to it** — each user click contributes one. The frontend has no access to site-wide requests per second; that lives in gateway and backend monitoring.

Knowing it from backend colleagues is entirely normal information flow on a team. **But you must be able to separate what you know from what you did.**

**The resume's current phrasing is safe**: it describes the **path**'s scale, while the lock and the keys are written as their own actions. The scale is there **without claiming your lock absorbed it.**

**QPS is computed, not measured.** Monitoring actually stores a **monotonically increasing counter**, and QPS is **that counter's slope over a window**: end count minus start count, divided by window length.

**So the window size decides the number you see.** The same traffic can be 2,000 over a one-second window, 600 over one minute, and 300 over five. **A larger window flattens the peak, so "peak 2,000 QPS" without a window says nothing.**

**Peak and sustained differ enormously too**: 2,000 for three seconds and 2,000 held for thirty minutes are nothing alike for a database. **The resume says peak, explicitly.**

**Monitoring versus load testing is a world of difference.**

- **Monitoring** = **it really happened**. Source: gateway logs, collection, a time-series store, a dashboard. Correct phrasing: "**monitoring showed above 2,000 during the campaign peak**".
- **Load testing** = **it was verified to survive**. Source: a tool generating traffic with a ramp-up. Correct phrasing: "**load testing verified it holds above 2,000**".

**Never conflate them.** Claiming monitoring when it was load testing **inflates the business scale**; the reverse undersells your work.

**Naming a few load-testing concepts shows you have actually seen one.** **Ramp up** means increasing QPS in steps, not opening at full rate. **The knee, or capacity water line**, is where QPS still rises but **P99 latency spikes and the error rate climbs** — **that is real capacity: not how much you can push in, but the most you can push in without it breaking.** A complete conclusion sounds like **"at 2,000, P99 was 120 ms with a zero error rate; at 2,600, P99 rose to 800 ms"**, not "it handles 2,000 QPS". Production load tests must write test traffic into **shadow tables**, and a financial system especially cannot contaminate real money data.

**If you cannot recall, use the safe phrasing**: this is the backend's figure, I remember it as the campaign peak, **and I would need to confirm whether it came from monitoring or a load-test report.** **"I would need to confirm" is always safer than inventing an answer.**

## What the backend did to survive it

Telling this upgrades "I heard" into "I understand".

**The edge** does **rate limiting**, token bucket or leaky bucket — **better to reject some than to collapse entirely**; queues or captchas to **flatten the spike** at campaign start; **circuit breakers** to degrade under fault.

**The application tier** stays **stateless**, so adding machines scales linearly. **An easily missed point: QPS is a cluster metric, not a per-machine one** — twenty machines sharing 2,000 QPS is 100 each.

**The data tier is the real bottleneck. A withdrawal is a write, and caches do not save writes.** The usual tools are **sharding** by user-id hash and read/write separation. Plus the **hot account** problem: **if every withdrawal debits one pooled account, every transaction contends for the same row lock, and sharding does not help** — the account has to be split into buckets.

**Consistency rests on two things written at the data tier:**

```sql
-- ① unique index on the idempotency key: a duplicate simply violates the constraint
CREATE UNIQUE INDEX uniq_idem ON withdrawals (idempotency_key);

-- ② the balance invariant lives in the WHERE; success is decided by affected rows
UPDATE accounts
   SET balance = balance - :amount
 WHERE user_id = :uid
   AND balance >= :amount;     -- ← the invariant is here, not in an application-level if
-- affected rows = 0 → insufficient balance, roll the transaction back
```

**Why not check first and then write**: there is a window between the check and the write, and **at 2,000 QPS two concurrent requests can both read "sufficient" and both debit.** **A unique index and a single UPDATE are atomic — no window.**

**Mention the asynchronous part too**: a withdrawal is usually **not completed synchronously** — validation writes a "processing" order and returns, and **the actual payout goes through a queue.** **So those 2,000 QPS are submissions, not payouts, and the two numbers can differ enormously.**

**Putting the invariant at the data tier rather than in an application `if`** is **the same pattern** as the Stripe lifetime-record protection, the Beyz email unique index and the BioMap type constraint — four examples across three projects, **and together they are a ready-made answer to a cross-project follow-up.**

## How to answer "zero financial loss"

The resume once said "not one cent of financial loss". **It was removed.** The reason is worth knowing: **it is a negative claim**, requiring proof that no loss ever occurred, **and you cannot enumerate everything that did not happen.**

**The only thing that supports it is reconciliation, which lives in finance, not on any engineering dashboard**: the ledger's withdrawal records are matched **line by line against the channel's next-day settlement file** by channel transaction id, and discrepancies go into an exceptions process — reissue, refund or recovery. **So "zero loss" precisely means "all reconciliation discrepancies were cleared and there was no net loss".**

**Loss prevention is layered, and saying so scores well:**

1. **Client** — request lock, idempotency key, error fallback. Purpose: **fewer useless duplicates.**
2. **Gateway and application** — rate limiting, validation, risk control. **Blocks abnormal traffic.**
3. **Database** — unique index on the key, balance invariant, transactions. **This is where correctness actually comes from.**
4. **Async state machine** — orders permit only legal transitions, **guarding against reordering and replay.**
5. **Reconciliation** — line-by-line matching into an exceptions process. Purpose: **detect and repair.**

**The key insight: the first four stop it happening; the fifth catches and repairs it when it happens anyway. Real zero-loss rests on the fifth layer, not on the first four being perfect** — anyone in payments knows the first four cannot be perfect: networks wobble, channels time out, people write bugs.

**Admitting you were only the first layer reads far more credible than claiming the fifth.**

## The division of labour, when probed

**Can a user bypass the client-side lock?** **Yes, trivially** — open DevTools and call the API. So the client lock **only reduces useless requests**; correctness rests on the backend key, the unique index, database transactions and the balance invariant.

**Did you measure the 2,000 QPS?** No — that is the path's scale from backend monitoring. **The client does not absorb QPS, it contributes to it.**

**How was zero loss guaranteed?** **That is a reconciliation result, not something I measured.** Five layers; the client is only the first.

**What else can the client do?** Grey out the button when no quota remains, queue or gate with a captcha at campaign start — **but those are experience improvements, not correctness guarantees.**

**Close with one line: the client reduces useless load; correctness comes from the backend.**

## The 30-second answer

> It was a withdrawal entry point during a campaign, and the whole path peaked above two thousand QPS. The client's job there is narrow but clear: keep useless duplicate requests from being sent, and always lean toward failure when the outcome is uncertain. Three things concretely: a Map keyed by order id locks the same withdrawal for the window between request and response, so hammering the button produces no second request; the idempotency key is generated on page entry and stored in sessionStorage, so a reload and a retry are still recognisably the same withdrawal; and timeouts and network drops always report as a problem directing the user to their withdrawal history, never as success. But I am clear that the client lock cannot stop a second device, a second tab or a reload — the real correctness comes from the backend's unique index on the idempotency key and from putting the balance invariant in the UPDATE's WHERE clause. The client reduces useless load; it does not provide the guarantee.

## Self-check

1. Can you define idempotency and explain why a withdrawal is inherently non-idempotent?
2. Can you distinguish debounce, throttle and request lock, and say why a withdrawal cannot be debounced?
3. Can you say what the `finally` unlock and the Map deduplication each solve?
4. Can you explain why the idempotency key must be generated early and stored in sessionStorage?
5. Can you state the asymmetric cost, and why uncertainty leans toward failure?
6. Can you explain QPS as a slope over a window, and distinguish monitoring from load testing?
7. Can you write the UPDATE that puts the invariant in the WHERE, and explain why check-then-write fails?
8. Can you give the five loss-prevention layers and explain why the real backstop is the fifth?
