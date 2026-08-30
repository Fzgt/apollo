---
title: "② Credentials, quota and the four-state machine"
---

# ② Credentials, quota and the four-state machine

> **Resume line**
>
> Minted **60-second usage-scoped Deepgram keys** per session **behind a plan gate**, socket alive across pauses.

> ℹ️ **v72 split this back into its own bullet** (in v66 it shared one sentence with [① Real-time interview copilot](/docs?section=beyz&item=realtime-copilot)). The ephemeral key, the plan gate and keeping the socket alive are all in that sentence; **the four-state machine has been off the resume since v66**, but the note stays — "what happens when two paths trigger generation at once" still gets asked.

## First understand this: it puts production edges on a real-time demo

Bullet 1 answers "how does the pipeline work". Bullet 2 answers the four problems that show up once it works:

```text
a long-lived key must not leak    → a 60-second, minimally scoped ephemeral key
pausing the audio must not drop   → keepAlive
model cost must be recordable     → log input / output tokens per generation
async triggers must not collide   → a four-state machine drops overlapping generations
```

The value of this bullet is: **wiring up the SDK is not the end — credentials, connection lifetime, cost and concurrency all still need answers.**

---

# Layer one: the six questions you must answer cleanly

## 1. The browser talks to Deepgram directly — what happens to the API key?

Bullet 1 has the browser connect straight to Deepgram to avoid relaying the audio. But code, requests and memory in a browser are all inspectable by the user, so a browser cannot safely hold a long-lived key.

The correct boundary:

```text
long-lived Deepgram key: server only
  ↓
the server mints an ephemeral key for the current session
  ↓
TTL 60 seconds + scope limited to usage:write
  ↓
the browser opens the WebSocket with the ephemeral key
```

This key is not a "one-time key": within those 60 seconds it can in principle open several connections. The accurate description is a **short-lived, scoped credential**.

The security goal is not to guarantee the ephemeral key never leaks — it is to make a leak worth very little:

- The time window is short;
- The permission surface is small;
- It cannot read projects, or list or create other keys.

That is least privilege and a reduced blast radius.

**One-sentence answer:**

> The long-lived Deepgram key never left the server. For each session, the backend minted a 60-second key scoped only to `usage:write`, so a leaked browser credential had a very small lifetime and permission surface.

---

## 2. Who is allowed to call the mint endpoint?

The mint endpoint itself needs a plan gate, or any anonymous user could call it in a loop and burn the transcription allowance.

The current logic:

- Free users are rejected outright;
- Only the development environment has a branch that uses the long-lived key directly;
- Both the response and the client fetch use `no-store`, so the credential is never cached and reused;
- The server action that generates answers checks the plan again on its own.

So there are two server-side gates:

```text
Deepgram key mint endpoint: checks the plan
GPT generation action:      checks the plan again
```

⚠️ Today the mint endpoint has no per-user rate limiting. A paying user could still mint a large number of ephemeral keys in a short window. A 60-second TTL only reduces the impact; it is not a substitute for rate limiting.

**One-sentence answer:**

> The mint endpoint was behind a server-side plan gate, and generation had its own independent plan check. The missing control was per-user rate limiting on the mint endpoint; the short TTL reduced the damage but did not prevent abuse.

---

## 3. The key expires after 60 seconds — does a half-hour interview drop?

No. The TTL mainly limits **the authentication window for opening a new connection**:

```text
ephemeral key valid → WebSocket handshake succeeds
connection established
key expires later   → the established socket keeps working
```

60 seconds does not mean the interview can only run for 60 seconds, and nothing is renewed every minute.

If the socket really does drop later, you have to mint a fresh key and reconnect. The current implementation has no complete automatic reconnection flow — that is the known gap from bullet 1.

**One-sentence answer:**

> The TTL controlled the connection handshake, not the lifetime of an already authenticated WebSocket. Once connected, the interview could continue; a later reconnect would require a freshly minted key.

---

## 4. Why doesn't the connection drop when the user pauses the microphone?

A Deepgram live socket can be judged idle and closed if no data arrives for long enough.

- Audio on: an audio chunk every 250ms keeps the connection alive by itself;
- Audio paused: the client sends a periodic `keepAlive()` signal;
- Audio resumed: the keepalive timer is cleared and the audio takes over again.

KeepAlive governs **the connection**, not the ephemeral key:

```text
60-second TTL: whether a new connection can still be opened
keepAlive:     whether an open connection gets closed for being idle
```

The heartbeat is not silent audio, and it does not renew the key.

⚠️ The current code sends one every 10 seconds, while the server's idle threshold is also close to 10 seconds — almost no margin. A delayed browser timer, network jitter or background-tab throttling can all make the heartbeat late. Three to five seconds plus backoff-based reconnection would be the sensible choice.

**One-sentence answer:**

> Audio chunks kept the socket active while recording. During a pause, a separate keep-alive signal preserved the existing connection; it did not renew the key. The original ten-second interval had too little safety margin and should have been shorter.

---

## 5. How are token usage and plan quota actually implemented?

At the end of each GPT generation, the usage reported by the model provider is recorded:

```ts
onFinish: async ({ usage }) => {
  await db.insert(copilotUsageLogs).values({
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
  });
};
```

Why not estimate from character count? There is no stable ratio between a tokenizer's output and character count — especially in Chinese — and only the provider's usage figure matches what you are actually billed.

Input and output are logged separately because they are priced differently, and because it makes it easy to tell whether the cost comes from long prompts or long answers.

### But the resume wording is stronger than the implementation

The quota that exists is counted in **questions**, not tokens:

- Free: the server-side plan gate blocks use entirely;
- Paid plans: the front end checks the question count against `questionsPerCopilot`;
- The token usage table is currently for auditing and cost analysis; quota enforcement never queries it.

So `token usage that backs per-plan quotas` is not fully accurate. The correct reading is: **token usage is reliably logged; plan and question-count limits are implemented separately, and the count ceiling lives mainly in the front end.**

A front-end check gives the user faster feedback, but it cannot be the security boundary. A fuller implementation would check and consume server-side quota atomically inside the generation server action.

**One-sentence answer:**

> I logged the provider-reported prompt and completion tokens after each generation. To be precise, the implemented quota was question-count based and the paid-plan limit was mainly enforced in the client, while the server independently blocked Free users. I would move the count enforcement server-side.

---

## 6. What does the four-state machine solve, and why drop overlapping requests?

The system has four mutually exclusive states:

```ts
enum CopilotStatus {
  Ready,
  Listening,
  Generating,
  Done,
}
```

Roughly:

```text
Ready → Listening → Generating → Done
  ↑                                  |
  └────── user stops / next turn ─────┘
```

Why not several booleans? Four booleans produce 16 combinations, of which only four mean anything; Listening and Generating both true, for instance, is an illegal state. A single enum makes the data structure itself guarantee the exclusivity.

An overlapping generation can come from:

- An automatic submission on `UtteranceEnd`;
- The user clicking to request an answer manually;
- The interviewer adding one more sentence, producing another UtteranceEnd.

In the `Generating` state the guard returns immediately:

```ts
if (statusRef.current === CopilotStatus.Generating) return;
```

Why a ref? This callback may keep the same function identity for a long time; reading the state out of the closure can give a stale value, while a ref gives the state as of right now.

Why drop the new submission rather than something else?

- Queue it: in a live interview the answer to an older question may already be irrelevant;
- Cancel the current one: a meaningless addition could destroy a useful answer already in flight;
- Drop the new trigger: the current generation survives, and the behaviour is the simplest to predict.

It is a deliberate trade-off, not a free one. The new transcript content may stay in the buffer and be merged with the next segment.

**One-sentence answer:**

> A single enum made the four UI states mutually exclusive. If an automatic or manual submission arrived while generation was active, a ref-backed guard dropped the new trigger because queued answers become stale in a live interview.

---

# Layer two: why refs matter here

Across these two pages, refs solve two related problems:

| Situation | What state alone might do | What the ref gives you |
|---|---|---|
| Accumulating final transcripts | WebSocket callbacks land back to back before a render, reading a stale total | Synchronous read/write of the latest confirmed text |
| The generation guard | A stable callback captures the initial status, so the guard reads a stale closure | The latest status on every call |

The common thread: the event handler needs "the value as of right now", and that internal value does not necessarily need to drive a render.

---

# Layer three: a late response after the interview is stopped

When the stream ends, the code only moves to `Done` if the status is still `Generating`:

```ts
setStatus((previous) =>
  previous === CopilotStatus.Generating
    ? CopilotStatus.Done
    : previous,
);
```

That way, once the user has stopped and returned to `Ready`, a late completion callback does not flip the UI back to Done.

⚠️ But it only blocks the final status write; it does not stop the stream loop from continuing to append tokens to the message content. Better implementations:

- Use an `AbortController` to genuinely cancel the underlying generation; or
- Give every request a version, and stop writing as soon as the loop notices it is no longer the latest request.

This would also save the model token cost incurred after the user has stopped.

---

# Five gaps to admit up front about the current implementation

1. **The mint endpoint has no per-user rate limiting.** A TTL is not a substitute for rate limiting.
2. **The 10-second keepAlive interval leaves almost no safety margin.** It should be shorter and paired with automatic reconnection.
3. **Token usage does not actually drive plan quota.** The real quota counts questions, and the paid-plan count limit lives mainly in the front end.
4. **What is dropped is the submit trigger, not necessarily the transcript content.** New content can merge into the next segment.
5. **After the user stops, a late stream can keep writing content.** Use an AbortController or a request version.

---

# The 30-second answer

> Because the browser connected directly to Deepgram, I never exposed the long-lived credential. The backend minted a 60-second key scoped only to `usage:write`, behind a server-side plan gate, and the browser used it only for the handshake. While audio was paused, keep-alive messages preserved the existing socket. After each GPT generation, I logged provider-reported input and output tokens separately. Automatic utterance events and manual requests could overlap, so a ref-backed four-state machine dropped a new trigger while generation was active. The main limitations were missing mint-endpoint rate limiting, an overly tight keep-alive interval, and question-count quota enforcement that should have lived fully on the server.

---

# Self-check: answer these six first

1. Why can't the browser hold a long-lived Deepgram key?
2. How does a 60-second key limit the risk, and who is allowed to call the mint endpoint?
3. Why doesn't key expiry drop an existing socket?
4. Does keepAlive preserve the key or the connection?
5. What do token usage and real quota enforcement each actually achieve?
6. Why does the four-state machine choose to drop the overlapping generation?

---

## Glossary

| 中文 | English |
|---|---|
| 长期凭据 | long-lived credential |
| 临时凭据 | ephemeral / short-lived credential |
| 签发 | mint |
| 有效期 | TTL / time to live |
| 权限范围 | scope |
| 最小权限 | principle of least privilege |
| 影响范围 | blast radius |
| 套餐门禁 | plan gate |
| 限流 | rate limiting |
| 空闲超时 | idle timeout |
| 心跳 / 保活 | heartbeat / keep-alive |
| 用量 / 配额 | usage / quota |
| 状态机 | state machine |
| 守卫 | guard |
| 陈旧闭包 | stale closure |
| 迟到的响应 | late-arriving response |

---

# Appendix: the follow-up questions to expect (layer two)

> A restructuring pass on 2026-08-24 deleted this material. **It was cut because it was tiring to read, not because nobody will ask about it.**

## Authentication and authorisation are not the same thing

| | The question it answers | What it maps to here |
|---|---|---|
| **Authentication** | **Who are you?** | `getAuthUser()` — identify the user from the login session; if it cannot, it errors out |
| **Authorisation** | **What may you do?** | `plan === Free → reject` — we know who you are, but this identity lacks the right to this feature |

**The order cannot be reversed — until you know who someone is, "what may they do" has no meaning.** The ephemeral key handed down is a third layer: to Deepgram it is an authorisation credential, and `usage:write` states exactly what its holder may do. **Three layers, each covering its own stretch.**

⭐ **One more ordering worth calling out on its own: the plan gate runs before the mint, that is, before any money is spent.** The front end does not even hold the decision of "should you get this feature" — it only holds the right to ask. The `behind a plan gate` in the resume refers to exactly those few lines.

## TTL, scope and revocation are three knobs on one design

| Knob | What it controls | Value here | Cost of turning it |
|---|---|---|---|
| **Lifetime (TTL)** | How long a leak stays usable | **60 seconds** | Too short and you break legitimate connections on slow networks |
| **Scope** | What a leak can do | **A single "submit transcription"** | Too narrow and the feature stops working |
| **Revocation** | How you contain an incident afterwards | ⭐ **Not needed — it expires by itself** | Only long-lived keys need it, and the cost is a full outage |

⭐ **Lifetime and scope shrink the loss surface beforehand; revocation limits the damage afterwards. The value of an ephemeral credential is that it moves the problem from "after" to "before" — you need no revocation machinery, because nothing that would need revoking exists for long.**

> ⚠️ **A known gap, worth raising yourself**: the mint endpoint **has no rate limiting at all**, so any paying user can call it endlessly for new keys. **The 60-second lifetime only mitigates this** (each key vanishes a minute later, so they cannot pile up); **it is not a defence.** The right fix is per-user rate limiting on that endpoint.

## Only one scope, so the worst case is quantifiable

The code says `scopes: ["usage:write"]` — **exactly one**. This is the textbook use of **least privilege**: not "give it enough permission", but "give it **only just enough**".

- ⭐ **No `keys:write`** → an attacker holding this key **cannot use it to mint more keys**. **This is the important one: it cuts off both escalation and persistence** — otherwise the attacker's first move is to use the 60-second key to mint a permanent one, and the TTL is instantly meaningless;
- **No read permission of any kind** → no project list, no usage statistics, no billing.

⭐ **So the worst case is: an attacker who grabs this key within 60 seconds can, at most, burn a little of your transcription allowance. No data leak, no escalation, no persistence.** Quantifying the worst case like that lands far harder than reciting the phrase "principle of least privilege".

## ⚠️ That 10-second heartbeat is a bad choice (raising it yourself scores points)

**Deepgram's timeout is 10 seconds and the official recommendation for the heartbeat is 3–5 seconds. The code says 10 — sitting exactly on the timeout line, with no margin at all.**

The microphone stops at t=0 and one is sent immediately; the next goes at t=10s — while Deepgram's close countdown also starts at t=0. **The second heartbeat has to arrive before that tenth second, exactly.** But:

- `setInterval` **never guarantees punctuality**; it guarantees "not earlier than" 10000 ms, and it slips whenever the event loop is busy;
- Add the network latency to Deepgram (tens to hundreds of milliseconds);
- ⭐ **Browsers throttle timers in background tabs** — and in an interview this tab is **very likely not in the foreground.**

**So this heartbeat is structurally set up to arrive on the line or late. That it has not blown up widely in practice is probably server-side tolerance, not design.**

> ⭐ **The contrast makes a nice line**: the 60-second TTL leaves a **100×** margin; this 10-second heartbeat leaves **0×**. **In the same codebase, one parameter is comfortably conservative and the other walks along the cliff edge.**

## The four-state machine: the most convincing answer is to count the combinations

Suppose you used four booleans instead: `isReady` / `isListening` / `isGenerating` / `isDone`.

⭐ **4 booleans = 2⁴ = 16 combinations, of which only 4 are legal. The other 12 are all bugs, and nothing stops them from happening.**

| Illegal combination | How it happens in reality | Consequence |
|---|---|---|
| `isListening` + `isGenerating` both true | The previous answer is still generating and the user speaks again | **The UI does not know which to show** — two spinners at once |
| `isGenerating` + `isDone` both true | The stream ends and nobody resets the earlier flag to false | **The "get answer" button never appears** and the user is stuck |
| **All four false** | Some error path skips an assignment | **An undefined state** — the UI renders nothing |

⭐ **The root problem: the rule "exactly one of these four may be true" exists only in the developer's head, and nothing in the code enforces it. Every added boolean doubles the invariants you maintain by hand. With an enum, one variable holds one value — the illegal combinations do not exist at the type level. This is not a style question; it turns runtime bugs into compile-time errors.**

> **A trade-off worth mentioning**: `Listening` and `Done` both really mean "waiting for the next question"; the only difference is whether a previous answer is on screen. In principle they could be one state plus a flag. **Keeping them apart lets the render code map one-to-one onto the states, with no extra branch asking whether an answer exists — one more state buys you one fewer conditional.**

## Can concurrency double-deduct?

**The problem itself** (a **race condition**): two requests arrive at once, both read "5 left", both deduct one and write back "4 left" — **deducted twice, decreased by one.**

**It cannot happen today**, because the quota decision **reads the current message count** — an absolute value — rather than performing a "balance minus one" increment. ⭐ **Reading an absolute value is naturally idempotent: one message does not become two because the check ran twice.**

**When it would become a problem**: if this changed to prepaid credits (buy 500, deduct one per use), that is an incremental write. The correct approach then is:

```sql
UPDATE quota SET remaining = remaining - 1
WHERE user_id = ? AND remaining > 0;
```

⭐ **Put the invariant "the balance must be above zero" into the SQL WHERE clause and judge success by how many rows the statement affected — rather than reading first and writing after. A single UPDATE is atomic in the database, so out of two concurrent requests only one can satisfy the condition.**

> **This links up with [③ Stripe's lifetime-plan protection](/docs?section=beyz&item=stripe-billing) and [the balance constraint in Baidu withdrawals](/docs?section=baidu&item=withdrawal) in one sentence: put the invariant in the data layer, not in an application-layer check.** Application-layer checks fail under concurrency, restarts and multiple instances; **a database constraint does not.**

## Why the front end cannot be the source of truth for permission

1. **Front-end code is under the user's control** — that check runs **on their own machine**, and they can make it return false whenever they like;
2. **The front end may not have all the data** — the message list comes from the current page, and **switching device or opening a new tab restarts that count**;
3. **A front-end block changes behaviour; it does not provide a guarantee.**

> **This is the same sentence as [the Baidu withdrawal note](/docs?section=baidu&item=withdrawal): the front end reduces useless load, but correctness has to come from the server.**
