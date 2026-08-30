---
title: "③ The Stripe payment path"
---

# ③ The Stripe payment path

> **Resume line**
>
> **Owned the paid conversion path** — Stripe Checkout, trials and lifetime purchases on **Next.js and Drizzle** — with **entitlements written only by signature-verified webhooks**: **no event can downgrade a lifetime purchase**.

> ℹ️ **Three things are not in this resume line but still have to be answerable**: tRPC, the plan check inside the typed server action, and the "six subscription events". The body below covers all three.

## Don't memorise the API yet: this bullet is about one thing

**The money lives in Stripe, the entitlement lives in our database. Between those two systems, who is qualified to decide what plan the user finally has?**

The answer has two halves:

- The **server action** only decides "is this user eligible to start a purchase";
- Only a **signature-verified Stripe webhook** decides "what the user actually bought", and writes `subscribedPlan`.

```text
user clicks buy
  → server action checks purchase eligibility
  → creates a Stripe Checkout Session
  → user pays on Stripe's page
  → Stripe redirects the browser back to the success page
  → and separately sends a payment event to the webhook
  → the webhook verifies the signature
  → subscribedPlan is updated in the database
```

⭐ **The browser redirect is user experience; the webhook is the payment fact.**

The second half of this bullet answers: webhooks can be forged, delivered twice, or arrive out of order — how do you keep the final entitlement in the database correct anyway?

---

## First, meet the three objects

| Object | What it is | What it is responsible for |
|---|---|---|
| **Checkout Session** | One Stripe checkout flow | Tells Stripe what the user wants to buy and sends the browser to Checkout |
| **Subscription** | An ongoing subscription relationship | Goes through create, update, pause, resume, delete and so on |
| **Entitlement** | What the user actually gets | In this project, essentially the `subscribedPlan` column on the user table |

**Lifetime is a one-off purchase, not an ongoing subscription.** So it has no normal subscription lifecycle and is handled mainly by `checkout.session.completed`.

---

# Layer one: the five questions you must answer cleanly

## 1. Why can't the success page write the entitlement?

Because "the browser came back to the success page" and "the payment succeeded" are not the same event.

### The user paid, but the success page never opened

```text
payment succeeds
  → the user closes the browser / loses network / the redirect fails
  → the success page never runs
  → if the page granted the entitlement, a paying user stays on Free
```

### The success page opened, but the user never paid

A success page is fundamentally just a URL. Users can visit it by hand, bookmark it, or skip the page and call the endpoint directly. If visiting that page upgrades you, people who never paid get the entitlement too.

⭐ So "visiting the success page" is neither necessary nor sufficient for a successful payment. The page can display the result and refresh the profile, but it **must not grant anything**.

**One-sentence answer:**

> Returning to the success page is only a browser navigation, not proof of payment. A paid user may never reach it, and an unpaid user can visit the URL directly, so only Stripe's webhook can grant the entitlement.

---

## 2. Why must the webhook verify the signature, and why against the raw body?

A webhook is a public HTTP address; anyone can POST to it. Receiving some JSON that looks like a Stripe event does not mean it came from Stripe.

Stripe uses the webhook secret to compute a signature over **the raw request body** plus timing information, and puts it in the `Stripe-Signature` header. The server verifies it with the same secret; only after verification may it process the event and change entitlements.

```ts
const rawBody = await request.text();
const signature = request.headers.get("stripe-signature");

const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  webhookSecret,
);
```

### Why does it have to be the raw body?

The signature covers **the exact original bytes**, not the meaning the JSON expresses. A `JSON.parse` followed by a `JSON.stringify` can change field order, whitespace or number formatting; the content looks identical, but the bytes are different and the signature no longer matches.

The correct order:

```text
read the raw body → verify → obtain a trusted event → run the business logic
```

**One-sentence answer:**

> The endpoint is public, so the payload is untrusted until its Stripe signature is verified. Verification must use the raw body because the signature covers the exact bytes, not the parsed JSON value.

---

## 3. What is the server action responsible for, and what is the webhook responsible for?

### Server action: the eligibility check

When the user clicks buy, the server checks:

- Is the user logged in;
- Is the chosen plan valid;
- Is a lifetime user buying again;
- Has the user already used a trial.

If those pass, it only creates a Checkout Session. **Creating a Checkout Session is not a completed payment**, so a server action must never write a paid entitlement.

### Webhook: confirm the fact and write the entitlement

Only Stripe knows whether the card was actually charged, and whether the subscription started, paused, resumed or ended. So only a signature-verified webhook may update `subscribedPlan`.

| Component | The question it answers |
|---|---|
| Server action | May you start this purchase? |
| Stripe Checkout | Did you complete the payment? |
| Webhook | What does Stripe confirm happened? |
| Entitlement update | What can you use now? |

### What does a `typed server action` actually prove?

The parameter type can rule out Free at compile time:

```ts
type PurchasablePlan = Exclude<SubscriptionPlan, SubscriptionPlan.Free>;
```

But TypeScript types disappear at runtime. An attacker can still bypass the front end and craft the request, so a server-side runtime check is still required.

⭐ **Types prevent developer mistakes; server-side validation is the security boundary.**

**One-sentence answer:**

> The server action decides whether the user may start a purchase, but it never grants access. The signature-verified webhook is the only component allowed to turn the confirmed Stripe result into an entitlement.

---

## 4. Why doesn't a duplicate webhook necessarily cause a duplicate upgrade?

Webhooks can be delivered more than once. If the server processed one successfully but the response was lost in transit, Stripe does not know the outcome and may send the same event again.

So the handler has to think about **idempotency**: performing the same operation once or many times ends in the same result.

### Writing an absolute state is usually idempotent

```ts
set({ subscribedPlan: SubscriptionPlan.Standard });
```

Run it once or ten times, the end state is Standard.

### Increments and external side effects usually are not

```ts
set({ credits: credits + 100 }); // repeats add extra
sendEmail();                     // repeats send more mail
issueCoupon();                   // repeats issue more coupons
```

Entitlement handling in this project mostly writes a target state, so a repeated event generally converges to the same result.

⚠️ **But the project has no dedicated Stripe event-ID deduplication table.** The stricter approach is to write `event.id` into a table with a unique constraint; a unique-key conflict then means the event has already been handled.

**One-sentence answer:**

> Most entitlement handlers write an absolute target state rather than applying an increment, so replaying the same event converges to the same result. We did not have a dedicated event-ID deduplication table, which I would add for stronger guarantees and non-idempotent side effects.

---

## 5. Why can no subscription event downgrade Lifetime?

The risk comes from cancelling the old subscription when someone buys outright.

```text
the user had a monthly subscription
  → the user buys Lifetime
  → the system cancels the old subscription to stop further charges
  → Stripe sends subscription.deleted
  → the ordinary logic wants to drop the user to Free
```

Without special protection, a user who just bought Lifetime is downgraded to Free by the deletion event from their old subscription.

### Why is the protection written into the SQL WHERE clause?

Every update that could downgrade a user carries a condition like this:

```ts
await db
  .update(users)
  .set({ subscribedPlan: SubscriptionPlan.Free })
  .where(
    and(
      eq(users.stripeCustomerId, customerId),
      ne(users.subscribedPlan, SubscriptionPlan.Lifetime),
    ),
  );
```

The database checks the current plan at the moment the update runs. If it is already Lifetime, zero rows match.

This is stronger than querying in the application layer and then writing an `if`. That version reads and updates in two steps, and in between another request may upgrade the user to Lifetime; the first request still holds the old result and performs the downgrade — a check-then-act race.

### Why are both event orderings correct?

Two writes are racing:

- A: the Lifetime Checkout completes and writes Lifetime unconditionally;
- B: the old subscription is deleted and tries to write Free, but carries the `plan != Lifetime` condition.

**A first, then B:** B sees the current plan is Lifetime and updates 0 rows.

**B first, then A:** B may briefly write Free, and then A unconditionally overwrites it with Lifetime.

Both orderings end at Lifetime. What is guaranteed here is not event ordering but **final-state convergence**.

**One-sentence answer:**

> Buying lifetime cancels the old subscription, which can trigger a deletion webhook that tries to downgrade the user. If the lifetime write wins first, the downgrade is blocked by the SQL predicate; if the deletion arrives first, the later unconditional lifetime write overwrites it. Both orderings converge to Lifetime.

---

# Layer two: understand the events, but don't memorise them yet

The resume says `six subscription events`. Precisely, it is:

- **5 subscription lifecycle events**;
- **1 checkout event**, which handles the one-off purchase.

| Stripe event | Main purpose |
|---|---|
| `checkout.session.completed` | The entry point for the one-off Lifetime purchase |
| `customer.subscription.created` | A subscription is created, including a trial starting |
| `customer.subscription.updated` | The subscription's status or plan changed |
| `customer.subscription.deleted` | The subscription ended; reclaim ordinary subscription entitlements |
| `customer.subscription.paused` | Reclaim ordinary entitlements while paused |
| `customer.subscription.resumed` | Grant them again on resume |

In an interview it is best to correct the wording yourself:

> More precisely, it was five subscription lifecycle events plus one checkout-completed event for the lifetime purchase, because a one-time purchase has no subscription object.

## Why is `subscription.updated` the most complicated one?

It can represent an upgrade, a downgrade, a cancellation, a renewal, a pause or a resume. The code compares `previous_attributes` against the current values to translate Stripe's technical event into a business event.

For example: if the product changed, compare the old and new plan tiers; `cancel_at_period_end` going from false to true is a CANCEL, and from true back to false is a RENEW. Understanding it to this depth is enough on a first pass — you do not need to memorise every cell.

---

# Layer three: duplication and reordering are separate problems

## Duplicate delivery

```text
A → A
```

The same event arrives several times. Remedies include writing absolute state, storing event IDs for deduplication, and database unique constraints.

## Out-of-order arrival

The real order was `A → B`, but processing order becomes `B → A`.

For example, the user upgrades to God and then downgrades to Standard, but the older upgrade event arrives last — and the database may wrongly settle on God.

⚠️ **The current code does not fully handle out-of-order events for ordinary plans.** The proper fix is to store an event timestamp or a subscription version and accept only events newer than the current record.

The dedicated SQL protection for Lifetime solves the problem of Lifetime never being downgraded; it does not mean the whole payment system has solved reordering.

---

# Layer four: leave trials, tRPC and Drizzle until last

## Trial

Two points to start with: eligibility for a trial is decided on the server, never from front-end state; and whether the trial ultimately takes effect, is cancelled, or converts into a paid subscription is still decided by Stripe events. Specific product configuration and email policy belong to a second round of follow-ups.

## tRPC: do not mix it up with server actions

The resume puts Next.js, tRPC and Drizzle in one sentence, but the real responsibilities are:

- Starting Checkout and checking eligibility: **a Next.js server action**;
- Receiving Stripe's notification: **a route handler / webhook**;
- Database queries and updates: **Drizzle**;
- tRPC: the typed interface layer used by other internal APIs in the project — **not the core transport of the payment path**.

The accurate phrasing:

> The project used tRPC generally, but the checkout path itself used typed server actions, while the Stripe webhook had to be a route handler.

## Drizzle

Drizzle lets SQL conditions be expressed through a typed TypeScript API. Lifetime's `ne(users.subscribedPlan, SubscriptionPlan.Lifetime)` is still fundamentally the database's `WHERE subscribed_plan != 'Lifetime'` — not ORM magic.

---

# The 30-second answer

> I owned the purchase flow for subscriptions, trials and lifetime purchases. The key design boundary was that the server action could decide whether a user was eligible to start a checkout, but it could never grant access. Entitlements were written only from Stripe webhooks after verifying the signature against the raw request body, because returning to a success page is not proof of payment. The handlers mostly wrote absolute target states so duplicate delivery was safe, and every downgrade query excluded Lifetime at the SQL level. That mattered because buying Lifetime cancels the old subscription and can trigger a deletion webhook; whichever event arrives first, both paths converge to the Lifetime entitlement.

---

# Three gaps to admit up front about the current implementation

1. **There is no event-ID deduplication table.** Absolute-state updates are mostly idempotent, but external side effects still need explicit deduplication.
2. **Event reordering for ordinary plans is not fully solved.** Store an event timestamp or a subscription version and accept only newer events.
3. **The resume's `six subscription events` is imprecise.** It is really five subscription events plus one Checkout-completed event.

Raising these yourself does not cost you points. It shows you can tell "it worked at the time" apart from "here is how I would make it more reliable now".

---

# Self-check: these five first

1. Why can't the success page write the entitlement?
2. Why must the webhook verify the signature, and why against the raw body?
3. What is the server action responsible for, and what is the webhook responsible for?
4. Why doesn't a duplicate webhook usually cause a duplicate upgrade, and what is still missing?
5. Cancelling the old subscription on an outright purchase — why does it still always end at Lifetime?

Only once you can answer those five in your own words should you move on to the six events, `previous_attributes`, trials and tRPC.

---

## Glossary

| 中文 | English |
|---|---|
| 权益 | entitlement |
| 事实来源 | source of truth |
| 验签 | signature verification |
| 原始请求体 | raw body |
| 重复投递 | duplicate delivery |
| 至少一次投递 | at-least-once delivery |
| 幂等 | idempotency / idempotent |
| 乱序到达 | out-of-order delivery |
| 收敛 | convergence / converge |
| 竞态 | race condition |
| 资格检查 | eligibility check |
| 买断 | lifetime purchase |
| 降级 / 升级 | downgrade / upgrade |

---

# Appendix: the follow-up questions to expect (layer two)

> A restructuring pass on 2026-08-24 deleted this material. **It was cut because it was tiring to read, not because nobody will ask about it.**

## Returning 400 versus 500 is a deliberate choice

⭐ **Stripe does not retry 4xx; it retries 5xx.**

- **Bad signature → return 400**: it will still be wrong on the ten-thousandth retry, so **telling it not to come back is correct**;
- **The handler throws → becomes a 500 → Stripe retries** → **which gives the business logic a chance to heal itself.**

## What happens if you miss an event (grouping by consequence beats memorising the list)

| Class | Missed event | Consequence |
|---|---|---|
| **Class A: failing to reclaim = giving money away** | `subscription.deleted` | Access is never reclaimed after expiry, **so the user keeps everything for free** |
| | `subscription.paused` | A user who paused billing keeps using the product |
| | `subscription.updated` | **The downgrade never lands** — paying Standard money for God features |
| **Class B: failing to grant = hurting a paying customer** | `checkout.session.completed` | ⭐ **The worst one**: a lifetime buyer pays a large sum and **their access never arrives** (this is the only entry point) |
| | `subscription.created` | A new subscription does not take effect (the "incomplete → active" branch of the update event catches some cases) |
| | `subscription.resumed` | A user who resumed billing cannot use the product — **straight to a support ticket** |

## Four tRPC concepts you will be asked about

| Concept | In one line |
|---|---|
| **procedure** | One API method. Split into `query` (read) and `mutation` (write) — **that split exists for client caching**, it is not enforced at the protocol level |
| **router** | A collection of procedures, nestable. **What you export is its type** |
| **input validation** | Every procedure declares a Zod schema, and **the validated type automatically becomes the handler's parameter type** |
| **context** | Whatever every request gets — the logged-in user, the database connection. **The `getAuthUser()` layer lives here** |
| **middleware** | An interceptor placed in front of a procedure. ⭐ **Write "must be logged in" and "must be a paying user" as middleware once, instead of repeating them in every endpoint** |

## Zod and tRPC are two different lines of defence

**TypeScript's type checking only exists at compile time** — once the program is actually running, the type information **is simply not there**. And the correctness of external data (form input, third-party requests) **has to be genuinely verified at runtime.**

⭐ **Zod's neat trick is that one schema yields both a runtime validator (`.parse`) and a TypeScript type (`z.infer`)** — you never maintain "one interface plus a separate validation function", two definitions that drift apart.

⭐ **Even with tRPC sharing types across front end and back end, the server still has to run Zod validation before it really handles the request** — the server **can never trust what the client sends**: someone may bypass the front end and call the endpoint directly, the front-end build may be out of date, or the network may mangle something.

> ⭐ **In one line: tRPC is about collaboration efficiency during development; Zod is about data safety at runtime. They are not redundant, they are layered.**
>
> **This is the same idea as this bullet's main thread** — a success-page redirect is not proof of payment, and [the quota note](/docs?section=beyz&item=credential-quota) says a front-end block does not count. **Whatever the client says is input, not fact.**

## tRPC vs REST vs GraphQL

| | What it suits | The cost |
|---|---|---|
| **tRPC** | ⭐ **One repository, one language (TS), one team** | **Useless across languages**; also a poor fit for a public API |
| **REST** | Public APIs, multi-language clients, anything relying on HTTP caching | Types have to be regenerated through something like OpenAPI ([which is what Periplus does](/docs?section=periplus&item=typed-contract)) |
| **GraphQL** | Many client shapes, each wanting different fields, avoiding over-fetching | **High server-side complexity** (N+1, DataLoader, per-field authorisation); often a net loss for a small team |

> ⭐ **How to answer**: "We were one repository, one language, consuming our own endpoints — **exactly tRPC's sweet spot**. If I had to expose a public API, or support non-TypeScript clients, I would pick REST with OpenAPI-generated types — **which is what I did in Periplus**."
>
> ⚠️ **A wording reminder**: **there is not one line of tRPC in the whole payment path**; what is on paper is Next.js and Drizzle. tRPC is genuinely in the repository, just not on this path — keep the two apart when asked.

## The three provable landing points of this bullet

`plan eligibility enforced in typed server actions` shows up in three places:

- The function's parameter type **rules out the free tier outright** — passing it in is a compile error;
- A lifetime user trying to buy again is rejected;
- A user who already used a trial cannot claim another.

⭐ **Together it is still the same division of labour: the server function governs "may you start a purchase", the webhook governs "what you actually bought". The former can refuse, but it can never grant.**
