---
title: Four ways to be idempotent
section: Cheat sheet
---

# Idempotency, four situations, four implementations

> Added on Day 7. **Certain to come up in Day 14, Round 3.** The four situations come from four different projects — answering this well proves in one go that **what I understand is the problem, not one library**.

## Start by fixing one sentence

> ⭐ **Exactly-once does not exist across systems. What you can have is at-least-once plus idempotent consumption.**
>
> So the real question is never "how do I make it happen exactly once". It is "**where does the duplicate come from, and would this business rather duplicate or rather lose the message**".

## The four side by side

| Situation | Where the duplicate comes from | How it becomes idempotent | Which layer | Limit |
|---|---|---|---|---|
| **Beyz overlapping generation** | UtteranceEnd fires automatically and the user also clicks — **neither path knows about the other** | Four-state machine plus `statusRef.current === Generating`, then **drop it** | **Client state machine** | Only guards this tab; a refresh or a second tab gets through |
| **Stripe webhook** | Stripe's **at-least-once delivery** plus network retries | **Write the absolute value, not a delta** (`set({subscribedPlan: plan})`), so a redelivery lands on the same result; the email uses a separate `emailTracking` table for explicit dedup | **Application logic plus one dedup table** | ⚠️ **There is no event-id dedup table.** A redelivery does run again — the result just converges. **Say so plainly** |
| **Baidu withdrawal** | Double clicks, network timeouts and retries, **clicking again after a refresh** | Frontend: a request lock plus an **idempotency key generated up front and kept in sessionStorage**. Backend: a **unique index on the idempotency key** | **Database constraint** | The frontend layer can be bypassed; **the only real guarantee is the unique index** |
| **Beyz email cron** | Runs every minute, and **a crash between sending and recording causes a resend** | An **anti-join** with `leftJoin` + `isNull`: pick only the users with no reminder record yet | **One state table** | ⚠️ Nothing locks between the `select` and the `insert`, so **two instances running at once each send one** |
| **Periplus resume** | After a crash it re-runs from the last gate | The replay boundary is **an artifact that passed a gate**; artifacts that did not pass are kept for inspection but **are never a legal boundary** | **Artifacts plus the stage contract** | A run that died before passing any gate cannot be recovered |

## Boiled down to three layers (this is the skeleton of the answer)

**When asked, do not recite the situations one by one. Give these three layers first, then the examples.**

| Layer | Method | Strength | Example |
|---|---|---|---|
| **1. Client** | State machine drops it, request lock, promise dedup | Weakest — **cuts useless requests, guarantees nothing** | The Beyz four-state machine, the withdrawal request lock |
| **2. Application logic** | **Write the absolute value instead of a delta**, anti-join for unprocessed rows | Middle — **runs again, but the result converges** | Stripe webhook, email cron |
| **3. Data-layer constraint** | **Unique index**, business invariants inside the `WHERE` | Strongest — **survives concurrency and out-of-order delivery** | The withdrawal idempotency key, `ne(Lifetime)`, `balance >= ?` |

> ⭐ **One pattern runs through all three projects: put the invariant in the data layer, not in an `if` in the application.**
>
> ```sql
> ne(users.subscribedPlan, Lifetime)      -- Stripe: a lifetime plan can never be downgraded
> WHERE balance >= ?                       -- Baidu withdrawal: the balance can never go negative
> UNIQUE(idempotency_key)                  -- idempotency key: only one concurrent insert wins
> ```
> **None of them care who called, how many calls ran at once, or what order the events arrived in** — which is exactly what an application-layer `if` can never do.

## "Rather duplicate" or "rather lose"

**Cross-system operations have no atomicity, so you pick one. The business decides which:**

| Business | Choice | Why |
|---|---|---|
| Marketing and reminder emails | **Rather duplicate** | An extra email is annoying; a missing one is a lost conversion |
| Payment notices, password resets | **Rather lose** | A duplicate "payment successful" makes the user think they were charged twice |
| Moving money | **Neither** | Which is why layer 3 is mandatory — a database constraint plus reconciliation afterwards |

## The last layer: reconciliation

**The first three layers stop it from happening. Reconciliation is how you find it and fix it when it happens anyway.**

> **Zero financial loss really comes from reconciliation as a safety net, not from the first three layers being perfect** — networks stutter, payment channels time out, people write bugs. See [#8 · Zero financial loss](/docs?section=baidu&item=withdrawal).

## The one-paragraph answer

> I have handled idempotency in four places, but the methods fall into three layers. **The client state machine and request lock are the weakest — they only cut useless requests. The application layer writes an absolute value or uses an anti-join, so it may run again but the result converges. The strongest is a data-layer constraint — a unique index, `WHERE balance >= ?`, `ne(Lifetime)`, invariants written into the SQL itself, which do not care who called, how many ran at once, or in what order the events arrived.** Exactly-once across systems does not exist; what you get is at-least-once plus idempotent consumption, **so the real call is whether this business would rather duplicate or rather lose** — marketing email would rather duplicate, a payment notice is the other way round, and anything touching money can accept neither, which forces a database constraint plus reconciliation after the fact.
