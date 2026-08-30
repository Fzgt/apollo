---
title: Beyz · the four bullets
section: Beyz
---

# Beyz — where each resume bullet comes from in the code, and how to tell it

> ⚠️ **Beyz is four bullets on the resume, one per section below.** Each quote is the current resume wording.
> Not on the resume but still answerable: the four-state machine, reconciling interim and finalized transcripts, tRPC, typed server actions, the six subscription events, Fastify, the cron trigger, PM2 and the three CI steps.
>
> Written 2026-08-17, checked 2026-08-18, re-checked 2026-08-23, aligned to the current resume on 2026-08-30. This is the only Beyz revision note you should use.
>
> Code: `~/Desktop/Beyz/beyz-web` (Next.js 14 App Router), `~/Desktop/Beyz/beyz-server` (NestJS + Fastify).

---

## Bullet 1 — the whole real-time interview copilot pipeline

> Built the real-time interview copilot end to end: tab and system audio through getDisplayMedia, streamed over a WebSocket to Deepgram and answered by GPT-4o token by token as each utterance ends.
>
> (The first resume line. **Reconciling interim and finalized transcripts is not in it**; this section still has to be memorised.)

### What it is in one line

In an interview the other person's voice is in another browser tab, where the microphone can't reach it — this bullet is how I got that audio out, turned it into text, and turned that into an answer. The audio is sliced every 250 milliseconds and pushed to Deepgram, so words appear while someone is still speaking; "this sentence is finished" isn't decided by silence detection but by Deepgram's end-of-utterance event; and answer tokens go to the screen as they arrive rather than waiting for the full response.

**What it proves: I can carry one real-time pipeline from capture all the way to model output, with nobody else's work in the middle.**

### Where the code is

| Step | File | Key lines |
|---|---|---|
| Capturing tab/system audio | `src/hooks/useAudioStream.ts` | `:28` `getDisplayMedia({video:true, audio:true})`; `:39-43` immediately `stop()` and `removeTrack()` the video track |
| Slicing | `src/hooks/useMicrophone.ts` | `:35` `new MediaRecorder(mediaStream)`; `:55` `microphone.start(250)` — **one chunk every 250 ms** |
| Connecting | `src/hooks/useDeepgram.ts` | `:36` `deepgram.listen.live(options)` (a WebSocket inside the SDK) |
| Recognition parameters | `src/hooks/useAudioToText.ts` | `:84-88` `model: "nova-2"`, `interim_results: true`, `smart_format: true`, `filler_words: false`, `utterance_end_ms: 2000` |
| Sending packets | same file | `:109-114` only sends when `e.data.size > 0` — **Deepgram closes the connection outright if you send a zero-size packet**, a trap written into the comment |
| Reconciling interim and final transcripts | same file | `:116-127` `confirmedTranscriptRef` only advances on `data.is_final`; the UI shows "confirmed + the current interim" |
| Triggering generation | same file `:129-131` → `CopilotSection.tsx:191` | the `UtteranceEnd` event → `submitQuestion()` |
| Streaming the answer | `src/server/actions/copilot.ts` | `:101` `createStreamableValue()`, `:103` `streamText({model: openai("gpt-4o")})`, `:131-135` `stream.update` per delta |
| Consuming it on the client | `CopilotSection.tsx` | `:257-266` `readStreamableValue()` concatenating chunk by chunk, updated inside `startTransition` |

### The order to tell it in (40-second version)

1. **The problem**: in an interview the other person's voice is in another browser tab, and the microphone can't pick it up.
2. **Capture**: so use `getDisplayMedia` down the "share a tab" path — this API **only gives you audio if you also ask for `video: true`** — then immediately stop and remove the video track and keep only the audio.
3. **Transport**: `MediaRecorder` emits a blob every 250 ms, pushed straight into Deepgram's WebSocket; nova-2 with `interim_results` on, so words appear while the person is still talking.
4. **Reconciliation**: Deepgram sends interim results first and then an `is_final` result. I keep the confirmed part in a ref, so the UI is confirmed + the current interim — the text never flickers backwards and never duplicates.
5. **Sentence boundaries**: not silence detection — Deepgram's `UtteranceEnd` (`utterance_end_ms: 2000`, so two seconds with no new words ends the utterance) triggers generation.
6. **Generation**: `streamText` in a server action plus RSC's `createStreamableValue`, pushing tokens down as they arrive, with the client rendering chunk by chunk through `readStreamableValue` — **in an interview, time to first word matters more than total time**.

### Follow-ups to expect

- **"Why not the Web Speech API?"** The browser's own recognition only listens to microphone input, its accuracy and language support are out of your control, and Safari is basically unusable; and what we needed was the audio in someone else's tab, which Web Speech can't reach.
- **"How did you land on 250 ms?"** It's a trade-off between latency and packet count: too small and connection pressure and per-packet overhead go up, too large and the delay to the first word becomes visible. It was found by trying values, not calculated — say so plainly.
- **"What if the interim and final results conflict?"** An interim result is always a rewrite of the current segment, never an addition; only `is_final` results are appended to the confirmed string. So there is no conflict — conflicts only exist in the version where you accumulate interim results too.
- **"What is `filler_words: false`?"** It filters out uh/um, which makes the transcript cleaner and the prompt fed to the model less noisy.
- **"How do you keep the streamed answer in order?"** `streamText`'s `textStream` is an async iterable and is ordered by construction; an RSC streamable value is append-only, and the client just concatenates strings.

---

## Bullet 2 — credentials, keep-alive, quota and concurrency on the real-time pipeline

> Minted 60-second usage-scoped Deepgram keys per session behind a plan gate, socket alive across pauses.
>
> (The second resume line. **The four-state machine and the per-request token logging are not in it**; this section still has to be memorised.)

**This is the most valuable part of the whole section**, because it isn't "I integrated an SDK", it's "I knew what would go wrong after I integrated it".

### What it is in one line

The previous bullet is "I got it connected"; this one is "I closed off the four things that go wrong once it's connected": the API key can't sit exposed in the browser (so each session mints a fresh 60-second key that can do nothing but report usage); a user pausing halfway through can't be allowed to drop the connection; every generation's token spend has to be accountable; and two requests colliding need someone to rule between them.

**What it proves: I'm not the kind of person who calls the job done when the SDK responds.**

### Where the code is

| Point | File | Key lines |
|---|---|---|
| Minting the temporary key | `src/app/api/deepgram/route.ts` | `:44-49` `createProjectKey(..., {scopes: ["usage:write"], time_to_live_in_seconds: 60})` |
| The plan gate | same file | `:10-13` Free is rejected outright; `:16-20` only development hands out a long-lived key |
| No caching | same file | `:56-61` `Surrogate-Control: no-store` + `Cache-Control: no-store, must-revalidate`, `export const revalidate = 0` |
| Fetching the key on the client | `src/hooks/useDeepgram.ts` | `:12` `fetch("/api/deepgram", {cache: "no-store"})` |
| Keep-alive | `src/hooks/useAudioToText.ts` | `:156-175` when the microphone isn't Open but the socket still is, send `connection.keepAlive()` every 10 s |
| Token metering | `src/server/actions/copilot.ts` | `:107-117` `onFinish({usage})` → writes `copilotUsageLogs(inputTokens, outputTokens)` |
| The plan gate on the generation side | same file | `:94-97` Free gets a straight `Unauthorized` |
| The question quota | `CopilotSection.tsx` | `:173-176` `questionsPerCopilot` exceeded → `:221-226` stop the interview and open the subscription dialog |
| The four-state machine | `CopilotSection.tsx` | `:42-47` `Ready/Listening/Generating/Done`; `:229-232` return immediately while `statusRef.current === Generating` |

### The order to tell it in

1. **Credentials**: real-time recognition is a direct browser-to-Deepgram connection, so a key has to reach the frontend. **A long-lived key must not go down there** — so the server mints a fresh key per session with only the `usage:write` scope and a **60-second TTL**, and the endpoint itself is gated by plan; then a full set of no-store headers so no CDN or browser can cache and reuse it.
2. **Keep-alive**: Deepgram closes a connection it considers idle when no audio packets arrive. When the user pauses the microphone mid-way (switching tabs, having a drink) I send keepAlive every 10 seconds, so resuming doesn't need a reconnect — **a reconnect means minting a key again and handshaking again, and the user hears a dead patch**.
3. **Metering**: at the end of each generation, `onFinish` writes the input/output tokens to the database, so per-user usage is queryable; the quota itself is defined by plan (how many questions per copilot), and going over stops the interview and opens the subscription dialog.
4. **Concurrency**: speech arrives asynchronously and the user can also click "answer this" manually, so the two paths collide. The state machine drops any new submission while it is `Generating` — **dropping beats queuing**: in an interview there is no point generating an answer to a question that has already gone stale.

### Follow-ups to expect

- **"Is 60 seconds enough? Does the connection drop after 60 seconds?"** The key's TTL governs **authentication at connection time**; once connected, the socket isn't kicked when the key expires. That's exactly why the TTL can be this short.
- **"What if someone gets hold of that temporary key?"** It has one scope, `usage:write` (it can't read the project, list keys, or create keys), and it dies after 60 seconds — the worst case is someone transcribing a minute of audio on your account.
- **"Why not proxy through your server (browser → your server → Deepgram)?"** You could, at the cost of an extra hop of latency and a server that has to hold long-lived connections. In a real-time product, latency *is* the experience. The temporary key is the vendor's own answer to this.
- **"The quota is enforced in the frontend — can't that be bypassed?"** The question count is enforced in the frontend, but **generation itself is gated on `subscribedPlan` inside the server action**, and `/api/deepgram` is gated too — bypassing the frontend gets you one fewer dialog, not recognition and not generation. Volunteer this; don't wait to be poked.
- **"Doesn't dropping overlapping requests lose what the user actually wanted to ask?"** It does, and the cost is well defined: what gets lost is the question that arrived while the previous one was still generating. The trade at the time was: better to lose one than to have two answers cross-fading in the same panel.

---

## Bullet 3 — the paid conversion path

> Owned the paid conversion path — Stripe Checkout, trials and lifetime purchases on Next.js and Drizzle — with entitlements written only by signature-verified webhooks: no event can downgrade a lifetime purchase.
>
> (The third resume line. **Dropping tRPC was deliberate**: there is not one line of tRPC anywhere in the payment path, and leaving it in would fall apart on the spot. Typed server actions and "the six subscription events" also came off; you still have to be able to answer both.)

### What it is in one line

The whole path the money takes is mine: trials, subscriptions, lifetime purchases. The core idea is **two separate locks** — "who is allowed to buy" is decided on the server; "what you now own" can only be written by Stripe itself calling back with a verified signature. The frontend can't change it, the user can't change it, and my own application code isn't allowed to route around that gate to grant an entitlement: the ledger has exactly one write path. On top of that, all six subscription events (activation, upgrade/downgrade, expiry, pause, resume, lifetime purchase) were each checked so that none of them can quietly cancel a lifetime purchase along the way — a user paying real money for the permanent tier and getting downgraded because one charge failed is the classic way this kind of system costs a company money.

**What it proves isn't "I can integrate a payment provider", it's "money is safe in my hands".**

### Where the code is

- The argument type is the gate: `src/server/actions/subscription.ts:13` `selectedPlan: Exclude<SubscriptionPlan, SubscriptionPlan.Free>` — **the free tier can't even be passed in at the type level**.
- Buying lifetime when you already own it: `:45-49` rejected outright.
- Trials: `:139-144` a separate trial product, `:163` `trial_period_days` only when `addTrial`; the user row records whether a trial was already taken.
- Signature verification: `src/app/api/stripe/webhook/route.ts:23-32` returns 400 without a `stripe-signature`, and `constructEvent(buf, sig, secret)` verifies against the **raw body**.
- The six event types: `:42-67` `customer.subscription.created / updated / deleted / paused / resumed` plus `checkout.session.completed`.
- Lifetime can't be downgraded: `:384` and `:407` — every plan-changing path carries `ne(users.subscribedPlan, SubscriptionPlan.Lifetime)` in its where clause.

### Follow-ups to expect

- **"Why does payment go through tRPC?"** The resume line puts Stripe and tRPC side by side, so this gets asked. Answer honestly: **the project has tRPC, but the payment path doesn't use it.** The root router only mounts `resume` and `copilot` — three procedures in total, all CRUD. Checkout goes through a `"use server"` server action, because that action is one-shot, needs a redirect, and needs neither caching nor invalidation, so it saves a layer of router registration; and the webhook has to be its own route handler. **Don't invent a "design principle" on the spot — say the choice was for convenience.**
- **"Why can only the webhook write entitlements?"** Because "the user landed back on success_url" is not "the money arrived" — a user can type success_url by hand, or close the page right after paying. The only trustworthy source of truth is Stripe's signed event.
- **"Why must signature verification use the raw body?"** The signature is an HMAC over **the byte stream**; the moment a framework does `JSON.parse` and then `stringify`, key order and whitespace change and the signature can't match.
- **"What about idempotency?"** What I built is a **convergent write**: every handler sets the user to the state the event describes (rather than applying a delta), so redelivering the same event produces the same result; lifetime has the extra `ne(Lifetime)` guard. **There is no separate event-id dedupe table — say that plainly; it's a place this could be stricter.**
- **"Why handle all six events?"** created/updated cover activation and plan changes, deleted covers expiry, paused/resumed cover pausing, and checkout.session.completed covers the lifetime purchase (a one-off payment produces no subscription event).

---

## Bullet 4 — a standalone email service and the repo's first CI

> Sole author of a NestJS service for subscription emails and scheduled payment reminders, Dockerized and deployed to EC2 through GitHub Actions, and of the repo's first CI gate on every push.
>
> (The fourth resume line. Fastify, cron triggering, PM2 and the three CI steps are not on the resume; this section still has to be memorised — especially the "if it's containerised, why is PM2 there at all" part.)

### What it is in one line

One person wrote a whole standalone backend service from scratch (subscription emails, payment reminders on a schedule) and got it onto a server alive: built into a Docker image, triggered by cron, deployed to EC2, kept up by PM2 when it crashes, released by GitHub Actions on every push. The last clause hides a bonus: I added this repository's **first** CI gate — "first" meaning nobody had done it before me, and after that the whole team wrote code behind that line.

**It's the one bullet of the four that proves he isn't only a frontend engineer: written, containerised, put on a server, kept alive, released automatically — the full loop.**

### Where the code is

- `~/Desktop/Beyz/beyz-server`: NestJS 10 + `@nestjs/platform-fastify` + Drizzle + `@nestjs/schedule` (cron) + `@fastify/swagger`.
- `beyz-web`'s `ci.yml`: triggered by `push: ["**"]`, running lint / typecheck / build.

### How it actually runs in production (verified against the repo on 2026-08-23 — stop telling this from memory)

**It's containerised, not a bare process.** Three files agree:

| Step | Source | Fact |
|---|---|---|
| Release trigger | `.github/workflows/deploy.yml` | push to main → ssh into EC2 → `git pull origin main` → `docker-compose up -d --build` |
| Manual release | `syncEC2.sh` | the same actions as a local script |
| Restart policy | `docker-compose.yml` | `restart: unless-stopped` |
| Process inside the container | `Dockerfile` | `CMD ["pm2-runtime", "start", "dist/src/main.js"]` |

So the accurate sentence is: **it runs in a container, with `pm2-runtime` as PID 1 inside it.**
The `start:pm2` script in `package.json` (with `--watch`) **is not in the deployment path** — don't mention it.

Three things to be clear on before you say them out loud:

- **PM2 is essentially redundant here.** Crash restarts are already covered by compose's `restart: unless-stopped`;
  what `pm2-runtime` really adds is cluster mode and log formatting, and this service uses neither.
  Volunteering "this is something I'd remove" actually scores points.
- **PM2 does not alert.** It restarts and it logs; alerting means PM2 Plus or wiring your own. Don't say "PM2 triggers an alert".
- **This deployment is crude**: no zero-downtime, no rollback, no health check, and the build happens on the production machine.
  Owning that is better than having it drawn out of you.

### The idempotency gap in the reminder job (verified the same day)

What `src/modules/tasks/jobs/email.job.ts` actually does: left-join users against `upgradeReminders`,
use `isNull(upgradeReminders.id)` to pick up "people with no send record", **then send the email and insert the record afterwards**.
The intent to deduplicate is there, but it falls short in three places, and you should volunteer them in an interview:

1. **The order is backwards** — send first, record after, so a failure in between means the next run sends again. The correct shape is INSERT a `pending` row to claim the slot, then UPDATE it to `sent` once the email is away.
2. **There is no unique constraint** — `upgradeReminders.userId` has no unique index, so deduplication rests entirely on that `isNull` in the query.
   "Check then write" doesn't hold under concurrency; it needs a unique key on `(userId, type, period)` so the database enforces it.
3. **The cron is `EVERY_MINUTE`** — the 9am line is commented out, and what's left is the every-minute version used for debugging.
   `@nestjs/schedule` does not guard against re-entry by default.

Also, `upgradeReminders.id` is a varchar primary key with no default and the insert doesn't supply an `id` —
**that insert may well throw outright**. Run it once and confirm before using this as talking material.

### Follow-ups to expect

- **"Why a separate service for email rather than inside Next.js?"** Scheduled work needs **a long-running process**; Next.js is deployed on a stateless platform, so cron semantics have to come from an external trigger. Splitting it out also lets it scale and restart on its own, unaffected by frontend releases.
- **"Fastify rather than Express?"** NestJS's adapter is swappable, Fastify has better throughput, and schema validation and swagger integration are more natural on it. **This is a selection question, not a bottleneck question — don't oversell it.**
- **"What does PM2 solve?"** See the table above — lead with "it runs in a container with `pm2-runtime` as PID 1", then say it's actually redundant here.
- **"CI is only lint/typecheck/build — no tests?"** Say it plainly: **that repo had no tests at the time.** The value of the CI was turning "it runs on my machine so ship it" into "every push goes through types and a build". Strengthening it means adding a test job — think it through before answering, don't improvise.

---

## Hard rules

- **The testing bullet is off the resume and never goes back on**: there is no test or spec file anywhere in the full git history of either repo, and `beyz-web` doesn't even have jest/playwright installed.
- `Jest, Vitest` in the skills row now have **zero support anywhere** (Playwright is carried by WinterFell's bench harness). He knows; it's his call.
- There are only a handful of numbers: the **250 ms** slice, the **60-second** key TTL, `utterance_end_ms` at **2000**, and a **4-message** history window (`copilot.ts:86` `MaxHistoryLength`). Don't quote any other Beyz number in an interview — nothing else has a benchmark behind it.
