---
title: "④ The withdrawal client"
section: Baidu
---

# ④ The withdrawal client

> **Resume line**
>
> Built the **withdrawal client** on a path **peaking above 2,000 QPS**: **request locking** drops in-flight duplicates, **client-generated idempotency keys survive reloads**, and **uncertain outcomes surface as failures, never successes**.

## What this line has to show

In one sentence: what a client can and cannot guarantee on a money path.

The way to ruin this line is to tell it as "my client-side lock held up two thousand QPS". That does not survive one follow-up — open the devtools and call the endpoint directly and you are past it.

Its real value is that you draw the boundary yourself: the client reduces useless load, the backend provides correctness. Without that sentence, this line is a liability.

## Define idempotent first

Idempotent means running the same operation once and running it N times leave the system in the same final state. "Set the balance to one hundred" is idempotent — do it any number of times and it is one hundred. "Subtract fifty from the balance" is not — do it twice and a hundred is gone.

A withdrawal is naturally the second kind. So it needs a layer around it that turns "execute again" into "recognise this as a repeat and do not execute".

## Debounce, throttle and a request lock are three different things

Debounce fires once, some milliseconds after the triggering stops — right for a search box or a resize. Throttle fires at most once per interval, evenly — right for scroll and mouse move. A request lock fires immediately on the first call and blocks everything until the response returns — right for submissions.

Why the withdrawal button cannot use debounce: "only after you stop" means a user who clicks a hundred times gets one request, a few hundred milliseconds after the last click. On the first click nothing happens at all, so it feels unresponsive and they click more. The behaviour is the exact opposite of the intent.

A submission wants leading-edge execution plus a lock, not debounce's trailing edge.

## Two versions of the request lock

The naive version is a boolean: if a request is in flight, return and do nothing; otherwise set the flag, send the request, and clear the flag in a `finally`.

The `finally` is the point. If you only clear the flag on the success path, one failure locks the button forever and the user can never withdraw again. That is the most common bug in this pattern.

The parameter-keyed version uses a map from the order id to the promise currently in flight. A second call does not get rejected; it gets handed the same promise. The caller awaits it and receives the result exactly as usual, without knowing it was deduplicated — so no caller needs a special case. When the request settles, the entry is deleted, and the next click is a genuinely new request.

Using a map instead of a boolean moves the lock's granularity from the whole button down to one order, so two different withdrawals no longer block each other.

This pattern is called request deduplication, and it is what React Query and SWR do internally. Naming that shows you know you are reproducing a general pattern rather than improvising.

## Idempotency keys: the most valuable thing the client does

The client-side lock cannot cover three cases, because the map only lives in this page's memory: automatic retries after a network timeout, the user acting from another device or another tab, and clicking again after a reload — a reload wipes that memory and the lock with it.

So the real guarantee has to come from backend idempotency: each withdrawal request carries a random string unique to that operation, the backend stores the strings it has processed, and a repeat of the same string returns the previous result without debiting again.

The client's half of that is essential, in three parts. Generate the key on page entry, not on click — generated on click, two clicks are two different keys and the backend sees two different withdrawals. Store it in `sessionStorage`, so a reload keeps the same key; otherwise a retry after a reload looks like a brand new withdrawal to the backend. That is what "survive reloads" means on the resume. And send it with every call.

## When the outcome is uncertain, always say failure

Default to failure and only show success on explicit success. The name for this is defensive fallback.

On explicit failure — a business error code, or a 4xx or 5xx — show the error and allow a retry. On explicit success, show success. When the outcome is uncertain — a timeout, a dropped connection, a request that went out with no response — treat it as a failure, but word it carefully: say "network problem, please check your withdrawal history shortly" rather than "it failed", because the backend may well have processed it.

Why uncertainty tips toward failure: the two ways of being wrong have asymmetric costs. Wrongly showing failure sends the user to retry, and the retry is covered by the idempotency key so nothing is debited twice — the cost is one wasted round trip. Wrongly showing success when the money never moved means the user believes they withdrew and the money never arrives — that is a complaint, an escalation and an incident.

Asymmetric cost is the crux of this section, and it is the general principle behind error handling on any money path.

## What 2,000 QPS is, and who measured it

**Attribution: this number is not the client's.** QPS is a backend metric. The client does not absorb QPS, it contributes to it — every user click contributes one. The client cannot see site-wide requests per second; that lives in the gateway and in backend monitoring.

Knowing the figure from a backend colleague is entirely normal information flow on a team. But you have to be able to separate what you know from what you did.

The current resume wording is safe: it describes the scale of the path, while the lock and the idempotency key are each written as their own action. The scale is still there without claiming your lock absorbed it.

**QPS is computed, not measured.** What the monitoring system actually stores is a monotonically increasing counter, and QPS is that counter's slope over a window: the count at the end minus the count at the start, divided by the window length.

So the window size decides the number you see. The same traffic can come out as two thousand over a one-second window, six hundred over a minute, three hundred over five minutes. The wider the window, the flatter the peak — so "peak 2,000 QPS" without a window says nothing.

Peak and sustained are also far apart: two thousand for three seconds and two thousand for half an hour are entirely different loads on a database. The resume now says peak explicitly.

**Monitoring or load testing — the meanings differ completely.** Monitoring means it really happened: the gateway logs, collection, a time-series store, a dashboard curve. The correct phrasing is "monitoring showed two thousand-plus at the campaign peak". Load testing means it was verified to withstand: a tool generates traffic and ramps it up. The correct phrasing is "load testing verified it holds two thousand-plus".

Never blur those. Claiming monitoring when it was a load test inflates the business scale; the reverse understates your own work.

A few load-testing concepts show you have really seen one. Ramping means increasing QPS in steps rather than opening at full load. The knee, or saturation point, is where QPS is still climbing but p99 latency spikes and the error rate rises — that is the real capacity, because capacity is not how much you can push in, it is the maximum you can push in without it breaking. A complete load-test conclusion is not "it holds 2,000 QPS", it is "at 2,000, p99 was 120 ms with a zero error rate; pushing to 2,600, p99 rose to 800 ms". And load tests in production must write to shadow tables, especially on a money path where real financial data cannot be polluted.

If you cannot remember, use the safe form: that is the backend's figure, I remember it as the campaign peak, and I would need to confirm whether it came from monitoring or from a load-test report. "I would need to confirm" is always safer than inventing an answer.

## What the backend did to hold it

This section is what upgrades "I heard" into "I understand".

At the edge: rate limiting with a token bucket or leaky bucket — better to reject some traffic than to fall over entirely; queues or a captcha to shave the peak at campaign start; circuit breaking and degradation when things go bad.

At the application layer: stay stateless so capacity scales linearly with machines. One easily missed point here — QPS is a cluster metric, not a per-machine one. Twenty machines sharing 2,000 QPS is a hundred each.

The data layer is the real bottleneck. A withdrawal is a write, and caching does not help writes. The usual tools are sharding by a hash of the user id and splitting reads from writes. There is also the hot-account problem: if every withdrawal debits the same pooled account, every transaction contends for the same row lock and sharding does not save you — the account itself has to be split into buckets.

Consistency comes from two things written at the data layer: a unique index on the idempotency key, so a duplicate request simply violates a constraint; and the balance invariant written into the `WHERE` clause of the update, with success decided by how many rows were affected.

Why you cannot read-then-write: there is a window between the read and the write, and at 2,000 QPS two concurrent requests can both read "not present" and both insert. A unique index and a single update statement are atomic — that window does not exist.

Mention the asynchrony too: a withdrawal is usually not completed synchronously. It validates, writes a pending order and returns, and the actual payout goes through a queue. So the 2,000 QPS is the rate of submissions, not the rate of payouts, and those two numbers can be far apart.

Putting invariants in the data layer instead of an application-level `if` is the same pattern as the Stripe lifetime-grant protection, the unique index on the Beyz email path, and the type constraints in BioMap. Four examples from three projects — strung together, that is a ready-made answer to the cross-project follow-up.

## What to say if "zero financial loss" comes up

The resume once said "without a single dollar of financial loss". It has been removed, and the reason is worth knowing: it is a negative claim, requiring proof that no financial loss ever occurred, and you cannot enumerate everything that did not happen.

The only thing that could support it is reconciliation, and reconciliation lives in finance, not on any engineering dashboard: the withdrawal ledger is compared line by line against the payment channel's file delivered the next day, keyed by the channel's transaction id, and discrepancies enter an exception process to be re-submitted, refunded or recovered. So the accurate meaning of "zero loss" is that every reconciliation discrepancy was cleared and there was no net loss.

The defence is layered, and saying so earns credit. Layer one is the client — request lock, idempotency key, error fallback — which reduces useless repeats. Layer two is the gateway and application — rate limiting, validation, risk control — which blocks abnormal traffic. Layer three is the database — the unique index, the balance invariant, transactions — and that is where correctness actually comes from. Layer four is the asynchronous state machine, where an order only accepts legal transitions, blocking reordering and replay. Layer five is reconciliation, which finds and repairs.

The key insight: the first four layers try to stop it happening, and the fifth catches and repairs what happened anyway. Real "zero loss" rests on layer five, not on the first four being perfect — anyone who has worked on payments knows they cannot be perfect, because networks flap, channels time out, and people write bugs.

Admitting you were only layer one is more credible than claiming you delivered layer five.

## The split, for follow-ups

Can a user bypass the client lock? Yes, easily — open the devtools and call the endpoint. So the client lock only reduces useless requests; correctness comes from the backend idempotency key, the unique index, database transactions and the balance invariant.

Did you measure the 2,000 QPS? No — that is the scale of the whole path from backend monitoring. The client does not absorb QPS, it contributes to it.

How was zero financial loss guaranteed? That is a reconciliation result, not something I measured. The defence has five layers and the client is only the first.

What else can the client do? Disable the button when there is no quota, and queue or gate with a captcha at campaign start — but those are experience improvements, not correctness guarantees.

Close with one sentence: the client reduces useless load, the backend provides correctness.

## The 30-second answer

> This was a withdrawal entry point during a campaign, and at peak the whole path was above two thousand QPS. The client's job there is narrow but clear: keep useless duplicates from being sent at all, and always err toward failure when the outcome is uncertain. Three things concretely. The same withdrawal is locked for the window between sending the request and receiving the response, so hammering the button cannot produce a second request. The idempotency key is generated on the client and stored in sessionStorage, so if the user reloads and retries, the backend still recognises it as the same withdrawal. And timeouts and dropped connections are always surfaced as failures pointing the user at their withdrawal history — never as success. But I am clear that the client lock does not cover other devices, other tabs or reload retries. The real correctness comes from the backend's idempotency key and the database constraints; the client reduces useless load, it does not provide the guarantee.

## Self-check

1. Can you define idempotent and explain why a withdrawal is not?
2. Can you separate debounce, throttle and a request lock, and say why debounce is wrong here?
3. Can you say what the `finally` unlock and the map-based deduplication each solve?
4. Can you explain why the idempotency key is generated on entry and stored in `sessionStorage`?
5. Can you state the asymmetric cost and why uncertainty tips toward failure?
6. Can you explain QPS as a slope over a window, and distinguish monitoring from load testing?
7. Can you name the five layers of loss prevention and explain why the real backstop is the fifth?
