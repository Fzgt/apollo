/**
 * 题库答案的英文版（Beyz）。
 *
 * 和 `content/notes` 那套 `.md` / `.en.md` 是同一个规矩：**英文另存一份，不去改中文原文**。
 * 站上默认读英文，中文按需展开——顺序就是他准备面试的顺序：先能说出口，再回去对意思。
 *
 * 键是题目 id，值是 markdown 正文，`index.ts` 里挂回题库。
 * 加题时中英各写一份；漏了英文这一份，站上会自动落回中文，不会空着。
 */
export const beyzAnswersEn: Record<string, string> = {
  'b1-main': `Start with the six-step main path. Identity, the plan gate and the 60-second temporary key belong to Bullet 2 — mention them in one line up front, but do not let the security detail drown this question.

1. **Capture** — the interviewer's audio lives in another browser tab, so the microphone cannot reach it. That means \`getDisplayMedia({ video: true, audio: true })\` and the "share a tab" path. **This API only hands over audio if you also ask for video**, so the moment the stream arrives I \`stop()\` and \`removeTrack()\` the video track and keep audio only.
2. **Chunking** — \`MediaRecorder\` emits an audio \`Blob\` every 250 ms. Only chunks with \`size > 0\` are sent; an empty packet makes Deepgram close the connection.
3. **Transport** — a WebSocket to Deepgram live, nova-2, with \`interim_results\` and \`smart_format\` on and \`filler_words\` off.
4. **Reconciliation** — with \`interim_results\` enabled, every transcript message carries \`is_final\`. A \`false\` message replaces the current provisional text on screen; only a \`true\` message is appended to the confirmed string held in a ref. The UI always renders "confirmed + current provisional", so nothing accumulates twice.
5. **Segmentation** — I do not write my own silence detection. Deepgram sends an \`UtteranceEnd\` event **over the same WebSocket** (configured with \`utterance_end_ms: 2000\`), and that is what says the question is finished and generation should start. **It is not a webhook.**
6. **Generation** — a Next.js server action calls \`streamText({ model: openai('gpt-4o') })\` and pushes the text deltas to the client through the RSC helper \`createStreamableValue()\`. The front end consumes them with \`readStreamableValue()\` and applies each chunk inside React's \`startTransition\` — wrapping it marks these very frequent updates as low priority, so however fast the answer streams, clicking a button or scrolling never gets blocked. A chunk here is **a text delta, not guaranteed to be exactly one token**. **In an interview, time to first character matters more than total duration**, which is why nothing waits for the full answer.

Close with one line: there is no third-party middle layer anywhere on this path — capture, reconciliation, segmentation and generation are all wired by me.

> ⚠️ Five places this answer goes wrong. The first three are concept mistakes, the last two are name mistakes:
>
> 1. \`UtteranceEnd\` is an event Deepgram sends back over the same WebSocket. It is not a webhook.
> 2. The GPT answer comes down as an RSC streamable value, not a \`ReadableStream\` I wrote by hand.
> 3. A chunk is a text delta; it is not guaranteed to equal one token.
> 4. The field that says a transcript is committed is \`is_final\`. There is a separate field called \`speech_final\`, and the end-of-sentence event is \`UtteranceEnd\`.
> 5. **There is no such thing as a "Silent event", and no \`utterance_end: true\` field.** Those two names are the ones most likely to fall out of my mouth, so they are listed here on their own to stop them.`,

  'b1-webspeech': `The Web Speech API has three problems. The first two are "it is not good enough"; the third is "it cannot run in my case at all" — so in an interview the third one goes first.

- **Accuracy and language support are decided by the browser vendor.** The same audio gets recognised differently in different browsers, and I have no control over it and no option to pick a model. With Deepgram I can name nova-2.
- **It is effectively unusable in Safari.** Implementations vary a lot between browsers, and Safari is the worst of them.
- **It only takes microphone input.** The audio I need to transcribe is the interviewer's voice, and that stream lives in another browser tab — only \`getDisplayMedia\` can reach it. The Web Speech API has exactly one input source, the local microphone, so it can never be connected to that stream.

The first two could be tolerated in another product. The third has no workaround. So the real answer is "it cannot reach the audio I need", and the other two are supporting detail.`,

  'b1-numbers': `**Both numbers came out of testing, not out of a formula — say exactly that in the interview.** Claiming they were derived from some theory falls apart the moment anyone asks one level deeper.

- **250 ms is the \`MediaRecorder\` timeslice, so it decides how often audio is uploaded.** Drop it to 100 ms and the same audio is split into far more packets, each carrying its own header, which raises both the number of sends and the overhead on the connection. Push it past 500 ms and the earliest possible time to first word is held back by the interval itself, visibly so. 250 ms is where I found text appearing reliably without loading up the connection.
- **2 seconds is \`utterance_end_ms\`, which decides how long a silence means "that sentence is over".** Under a second, an interviewer's normal thinking pause gets read as the end of a question, and half a question is sent off for an answer. At 5 seconds the interviewer has finished asking and the user still waits five seconds before anything appears. 2 seconds is where pauses survive and the lag is not obvious.`,

  'b1-interim-conflict': `**That conflict cannot happen in my implementation, because interim and final results do not write to the same place.**

With \`interim_results\` enabled, Deepgram sends several \`is_final: false\` messages for one sentence and then a single \`is_final: true\` commit. I keep the confirmed text in a ref, and only the \`is_final: true\` message is appended to it. The provisional text lives in separate state and is entirely replaced each time a new one arrives. The screen renders "confirmed text + current provisional text". So at the moment the commit lands, the provisional is cleared and the commit is appended — the same span of text is swapped out, and there are never two versions to reconcile.

The version that really does conflict is the one that **appends interim results into the confirmed string**: one sentence sends five interim messages, all five get appended, and the screen shows the same half-sentence five times.

This question is worth answering well because of what it separates: having read the contract of the API, versus having found a shape of code that happens to run.`,

  'b1-stream-transport': `**Because the two paths have different shapes.**

- **Browser ↔ Deepgram** is a long-lived, two-way session: the browser keeps uploading audio while Deepgram keeps sending back transcripts, metadata and events such as \`UtteranceEnd\`. Both sides need to send at any moment, and the connection has to last the whole interview. That is what WebSocket is for.
- **Server → browser** is one question, one answer: a request and its response. Once the question is submitted, all I need is to push GPT text deltas back in one direction, and the stream ends when the answer does. Running a second WebSocket for that means owning connection correlation, cleanup and error states, and buys no two-way communication in return.

What it actually is: a Next.js server action plus the AI SDK's RSC helper \`createStreamableValue()\`, consumed on the client with \`readStreamableValue()\`. Underneath it rides the RSC Flight stream. It is not a hand-written \`ReadableStream\` and it is not SSE.

**Say that plainly rather than blurring it into "async streaming" — vagueness costs more than being wrong.**

If they follow up with "how would you do it without RSC", that is when the other two come out:

- **fetch + ReadableStream**: the server does \`return new Response(stream)\` and the client loops over \`res.body.getReader()\`.
- **SSE**: the browser's native \`EventSource\` **is GET-only**, and the question payload has to be POSTed — so that route is closed unless you parse SSE by hand over fetch.

Being able to explain why SSE does not work here is worth more than naming it correctly.`,

  'b1-latency': `**I have not measured this, so I cannot quote a number in an interview. Do not invent one.**

**How to measure it**: take a timestamp on the line where the \`UtteranceEnd\` event fires in the client, take a second one on the line where the first GPT text chunk arrives, and the difference is what this path actually costs. Run the same passage five times and quote a range rather than a single value.

**When answering, the two intervals must be separated.** If they are not, my own 2-second segmentation threshold gets counted as processing time, and what the interviewer hears is "this system takes three seconds to show anything" — when those 2 seconds are spent waiting for the other person to genuinely finish, not computing. It can be put like this:

> "The 2 seconds is a segmentation threshold I chose. That is not processing time — it is waiting for the other person to actually stop. The real path runs from that decision to the first character, and measured it is about ___ ms, mostly the model's time to first token."

Say that and the next question is certain to be "how did you measure it". So the method and the number have to be ready together; without the method, the number is worth nothing.`,

  'b2-main': `There are four things I defended against up front on this real-time path, and credentials are only the first. What makes this bullet worth anything is not "I integrated an SDK" — it is "I thought about what breaks after you integrate it".

1. **Credentials: when the browser talks to a third party directly, a key will exist in the client, so the key that exists there must not be a long-lived one.** The server mints a short-lived key at the start of each session, scoped to \`usage:write\` only, with a 60-second TTL. The minting endpoint itself is gated by plan — Free is refused outright. The response carries a full set of no-store headers so the key is never cached by a CDN or the browser and reused by someone else.
2. **Keep-alive: if Deepgram receives no audio packets for a while, it treats the connection as idle and closes it.** When the user mutes mid-session, the client calls \`keepAlive()\` every 10 seconds to hold the connection open, so speech resumes on the same socket. Without it you have to reconnect, and reconnecting means minting a new key and a new handshake — the user hears dead air.
3. **Metering: at the end of every generation, the AI SDK's \`onFinish\` callback writes that run's input and output token counts to the database.** Quota is per plan — how many questions each copilot session may ask — and going over ends the session and opens the subscription page.
4. **Concurrency: speech-triggered generation arrives asynchronously, and the user can also press "answer me" by hand, so the two collide.** A four-state machine (Ready / Listening / Generating / Done) holds that down: while in \`Generating\`, a new submission is dropped rather than queued.

> ⚠️ Wording: that short-lived key **is not a "one-time key"**. It is a key with a TTL and a scope. Within those 60 seconds it can open more than one connection, and calling it one-time gets caught immediately by anyone who has used Deepgram.`,

  'b2-mint-endpoint': `**No, not anyone — the endpoint gates on plan. Volunteer this rather than waiting to be poked**: "did you think about people farming this endpoint" is exactly what the question is testing.

When the minting endpoint receives a request it first reads the current user's \`subscribedPlan\`. Free is refused and no key is minted at all. The branch that hands out a long-lived key directly exists only in development; production never reaches it.

The fuller answer is that there are **two independent gates**: transcription is gated at the minting endpoint, generation is gated again inside the server action, and each looks up the user's plan on its own without depending on the other. So bypassing the front end at most earns you one more subscription modal — neither transcription nor generation is reachable.

> ⚠️ One layer of quota really is only enforced client-side, and I should say so first: the cap on how many questions a copilot session may ask is counted in the front end, with no independent server check. What actually backstops it is the plan gate above. The same goes for limits like "200 messages per connection" — when mentioning them, be explicit about which layer they sit in. **A client-side counter is a UX constraint, not a defence.** Being caught hiding it is far worse than saying it.`,

  'b2-ttl': `**It does not drop. That TTL governs authentication at the moment the connection is established, not how long the connection lives.** Deepgram checks the key once during the WebSocket handshake, and once the handshake passes the connection stays valid — the key expiring at second 61 does not kick off an already-open socket. Three hours into the interview, it is still running on the result of that one handshake.

**It is precisely because expiry does not break live connections that the TTL can be this short.** If expiry did drop connections, 60 seconds would be an absurd value.

As for why 60: it only has to cover the gap between receiving the key and completing the handshake. Longer buys nothing and simply widens the window in which the key could be picked up and used. Shorter puts pressure on the user — a misclick, a network hiccup, a handshake a few hundred milliseconds slow, and the key is dead before the connection exists. A minute is enough for any normal user to connect.`,

  'b2-leaked-key': `**Exactly one thing: use it to transcribe a minute of audio on my account.**

The key is scoped to \`usage:write\`, which is the single permission to spend quota on transcription. They cannot read my project details, cannot list my other keys, and cannot create new ones — so there is no path from this key to a long-lived one. Add the 60-second expiry and the most they can take is a minute of audio.

That is what least privilege means here: **the goal is not that a credential never leaks, it is that the one that leaks is not worth anything.** That sentence is the answer to this question, and it carries more weight than listing defences.`,

  'b2-proxy': `**That design works. I did not choose it because it costs two things: an extra hop of latency, and a server that has to hold long-lived connections.**

Proxying means audio goes to my server first and is forwarded to Deepgram, with the transcript taking the same detour back. In a real-time product that hop lands directly on how long the user waits for text — **latency here is the experience**, not a metric to optimise later. It also means my server maintains one continuously open WebSocket per user, and scaling and operating that kind of connection is a different problem from stateless requests.

Meanwhile the short-lived key is Deepgram's own answer for the browser-direct case. It buys security equivalent to proxying — what leaks is a 60-second, usage-only key — and the cost is one extra mint request per session.`,

  'b2-race': `**Name it first: this is a race condition, specifically an out-of-order response.** Saying "I added a check to prevent conflicts" and saying "this is a race, and I converge it with a state machine" are worth twice as much apart.

**I drop, I do not queue.** While the state machine is in \`Generating\`, a new submission is discarded rather than entering a queue. Two reasons for that trade-off: questions in an interview have a shelf life, so generating an answer thirty seconds later to a question that has passed is useless; and two answers cross-updating in one panel cannot be read at all. The cost is explicit — a question interjected while the previous answer was still generating is lost.

**If you need neither loss nor out-of-order rendering, the standard fix is tagging each request with an id.** The client remembers the currently valid id and updates it on every new request; when a response arrives, ids that do not match are discarded and only the matching one renders. New questions can then start immediately and old answers expire on their own, satisfying both goals.

Adding that last paragraph turns this from "I added a check" into "I know the full solution and I know why I shipped the simple one".`,

  'b3-main': `**Open by framing it: there are two paths here and they never touch.** What the browser does only carries the user to Stripe's payment page — it writes no entitlement field at all. What actually flips \`subscribedPlan\` to God is the webhook Stripe's servers send back after payment. Say that first and every detail afterwards has somewhere to sit.

**Path one · placing the order (browser → server action → Stripe)**

1. The user clicks and the client calls the server action \`createStripeSession\`. The front end never talks to Stripe directly and never holds a Stripe key.
2. On the server, the action reads the current user itself and passes **four gates**: already Lifetime, refused; \`hasPurchasedPlan\` true but asking for a trial, refused (the 7-day trial is first purchase only); already on the plan being requested, refused; **already on a paid subscription and switching to a different subscription tier, redirected to \`createUpdateSession\` instead of a new checkout** — that last one exists so no second subscription is created, and the detail belongs to the plan-change question.
3. Only after all four does it call \`stripe.checkout.sessions.create\`. Subscription tiers use \`mode: "subscription"\`, the one-off purchase uses \`mode: "payment"\`, and the current user id rides in the session metadata under \`payingUserId\`. The call returns session.url.
4. The client redirects to that URL, the user pays on Stripe's hosted page, and Stripe sends them back to my success page. **This path ends here, and it has written zero database fields.**

**Path two · granting it (Stripe → my webhook)**

5. Stripe POSTs to \`/api/stripe/webhook\`. The first thing the handler does is verify the signature; a failure returns 400 and nothing else runs.
6. Once verified it dispatches by event type: subscriptions land on \`customer.subscription.created\`, the one-off purchase on \`checkout.session.completed\`.
7. \`users.subscribedPlan\` **is written here and nowhere else.** The user is resolved from \`stripeCustomerId\`, and every write statement carries \`ne(subscribedPlan, Lifetime)\` in its WHERE clause so a subscription event can never overwrite a lifetime user.
8. The webhook pushes nothing to the front end. After Stripe returns the user to the success page, the client refetches their state and sees the plan that was already written.

> ✅ **This landmine has been removed**: the resume used to say "on Next.js, tRPC and Drizzle", but **there is not one line of tRPC anywhere on the payment path** (tRPC appears in this repo only on the copilot and resume routers; payments run on server actions, a webhook route and Drizzle). the resume now says "Next.js and Drizzle", so following the resume down no longer walks into it.`,

  'b3-success-page': `**Because that page is both untrusted and unreliable — two faults pointing in opposite directions, either one enough to disqualify it.**

**Untrusted: the success URL is in the user's hands.** The return address is an ordinary client route; anyone can type it into the address bar and the page loads without a cent being paid. Putting the upgrade logic there is publishing a "make me God" button on the open web.

**Unreliable: a successful payment does not mean that page ever loads.** The user closes the browser right after paying, the network drops during the redirect, Stripe's return fails for any reason — in all of those the money is taken and that write never gets a chance to run. The user has paid and has nothing.

So the only source of truth for entitlements is the other path: Stripe's servers POST to my webhook, signed, never passing through the user's machine, where they can neither modify it nor block it. In this design the success page is a thank-you sign; the entitlement was written elsewhere long before.

> ⚠️ The usual way to miss this question is to answer "because user data would leak in the front end". That is a different question, and going there shows the actual one was not heard: this asks **who is allowed to write an entitlement**, not what is exposed.`,

  'b3-webhook-verify': `**Signature verification. This is the pivot of the whole bullet** — however smoothly the rest of the path is told, missing this collapses it.

Concretely: take \`stripe-signature\` from the headers, combine it with \`STRIPE_WEBHOOK_SECRET\` from the environment, and hand both to \`stripe.webhooks.constructEvent\`. No signature header returns 400; a signature that does not verify returns 400. Both end before anything touches the database.

**Verification has to run on the raw request body — this is the most-asked and most-broken part.** In a Next.js route handler that means \`await req.text()\` for the unparsed string, never \`req.json()\` followed by re-serialising the object. Stripe signs the raw bytes, and parsing then re-serialising can change whitespace, key order or number formatting, at which point the signature no longer matches.

**What skipping it costs**: \`/api/stripe/webhook\` is reachable from the public internet, requires no login, and has no other authentication. Anyone can POST hand-written JSON claiming some customer completed a lifetime payment, and the server writes it. The paywall is gone.

> ⚠️ Volunteer a weakness: **I do not keep an event-id dedup table.** Stripe redelivers an event when it does not receive a 200, so strictly a webhook should be idempotent. My idempotency comes from the writes converging — each one overwrites the plan to the same value keyed on \`stripeCustomerId\`, so replaying an event ten times leaves the database exactly as one delivery would. But that only holds for overwriting writes; the moment something additive appears, like "add 100 credits", it stops being safe. The standard fix is a table with a unique index on \`event.id\`: insert on entry, and if the insert conflicts you have seen it, so return 200. Say it that way — do not round it up into "it is already idempotent".`,

  'b3-lifetime-guard': `**They do not drop. There are two mechanisms here pointing in opposite directions, and giving only one is an incomplete answer.**

**The first is defensive, on the database side.** Every statement that can change \`users.subscribedPlan\` carries \`ne(subscribedPlan, Lifetime)\` in its WHERE clause: \`updateUserSubscription\` for plan changes has it, and so does \`deleteUserSubscription\`, which drops a user back to Free when a subscription is paused or deleted. So when a subscription update event hits a Lifetime user, the UPDATE matches 0 rows, nothing happens, and nothing errors. **That condition lives in the SQL WHERE clause, not in an if statement at some call site** — worth stressing on its own, because it means any future write path is protected automatically as long as it reuses those two functions, without depending on whoever writes it remembering the check.

**The second is offensive, on the payment side.** In the \`checkout.session.completed\` handler, as soon as the session is found to contain the Lifetime product, it calls \`stripe.subscriptions.list\` for every still-running subscription on that customer, cancels each one with \`stripe.subscriptions.cancel\`, and only then writes \`subscribedPlan\` to Lifetime and sets \`hasPurchasedPlan\` true.

**The two solve different problems: the guard stops data being overwritten, the cancellation stops money continuing to be taken.** With only the guard, the plan survives but the monthly subscription keeps billing. With only the cancellation, one subscription that failed to cancel is enough for an event to knock them back to Standard.`,

  'b3-upgrade-session': `**Because a second checkout creates a second subscription.** Every successful Stripe checkout adds a new subscription to that customer; it never touches the existing one. The result is Standard and God running in parallel on one user and two charges per cycle. **That is a money bug, not a UX bug** — lead with that sentence, then describe what I did.

So when \`createStripeSession\` sees all three of "this user already has a \`stripeCustomerId\`", "they are not on Free", and "the target is a different subscription tier", it skips checkout and goes to \`createUpdateSession\`. There it fetches the customer's current subscription and opens a **Billing Portal session** with \`flow_data.type\` set to \`subscription_update_confirm\`, naming the new tier's price for the item already on that subscription. The user lands on Stripe's confirmation page, confirms once, and is returned to my success page. **What changes is the price on the existing item; there is only ever one subscription.**

Proration is settled by Stripe according to the Billing Portal configuration — I do not compute it in code. Say exactly that if asked; describing it as proration logic I implemented falls apart one question later.

> ⚠️ A known weak spot, to be admitted if pushed: I read the current subscription with \`subscriptions.list\` and take the first result at \`limit: 1\`, which assumes one subscription per customer and throws if there is none. That assumption holds in this product because the lifetime path clears every subscription on the account, but it is not a general implementation — in a product that allows several subscriptions it is a bug.`,

  'b4-main': `Three parts: why it is a separate service, how it ships, and how it stays alive.

**Why it is separate — name the actual constraints, not "configuration would be annoying"**

- Scheduled work needs **a process that stays alive** to count time. The Next.js app is deployed on a stateless platform where functions are woken by a request and destroyed when it finishes, so no process survives between requests and cron semantics can only come from the platform triggering it from outside.
- Vercel's cron on the Hobby tier **fires once a day**, and the function itself has an execution time limit. Payment reminders need a finer sweep over the user table and then a send per user, and each of those limits alone rules it out.
- As its own service it scales and restarts independently, and shipping the front end does not restart it.

**How it ships**

A push to main triggers GitHub Actions, which SSHes into EC2, runs \`git pull origin main\` on the box, then \`docker-compose up -d --build\` to rebuild and start the container. **What runs in production is a container**, not a bare node process.

**How it stays alive**

Two layers: the compose file gives the service \`restart: unless-stopped\`, so a crashed container is brought back up, and inside the container \`pm2-runtime\` is the command that runs the Node process.

**Then own the trade-offs — that lands better than dressing it up as enterprise-grade:** this ssh-pull-rebuild flow is crude. No zero-downtime, so the service is down while it rebuilds. No rollback, because the previous artefact was never kept. No health check, so a live process with broken behaviour goes unnoticed. Single instance, so the box going down takes everything. And the build happens on the production machine, meaning one failed build can take the service offline. On a personal project I took the cheapest path; the next step would be moving the image build into CI, pushing to a registry, adding a health check, and doing rolling replacement.`,

  'b4-container-or-process': `**A container. Precisely: the service runs in Docker, and PID 1 inside the container is \`pm2-runtime\`.**

First, a wording problem. I used to list the Dockerfile, \`git pull\` and PM2 side by side, which sounds like three competing approaches and guarantees a follow-up. They are not parallel: the container is the runtime form, \`git pull\` is the deployment action, and PM2 is the start command inside the container.

If they then ask "why PM2 at all if you are already in a container" — good question, answer it straight:

- \`pm2-runtime\` is PM2's container mode: **it runs in the foreground and does not daemonise.** That part is required, because an ordinary \`pm2 start\` moves the process to the background and exits immediately, and a container whose PID 1 exits shuts down with it.
- But for a single-process service like this one, PM2 is basically redundant. Restart-on-crash is already handled by compose's \`restart: unless-stopped\`. What PM2 uniquely offers is cluster mode and log formatting, and this service uses neither.
- So it is **something I would remove**: \`CMD ["node", "dist/src/main.js"]\` is enough.

Being able to explain the difference between \`pm2 start\` and \`pm2-runtime\` turns this from a mark against into a mark for.

> ⚠️ One line that has to be corrected: **PM2 does not send alerts by itself.** It supervises processes, restarts them and collects logs; notifications mean PM2 Plus or wiring it up yourself. The old claim that "PM2 triggers the corresponding alert" gets caught on the spot by anyone who has actually run it.`,

  'b4-idempotency': `**This question is about idempotency: repeating the same action has to leave the same result as doing it once.** Describe what I built, then where it falls short — **the marks are all in the second half**, because what the interviewer wants to hear is that I know what failures in this kind of system actually look like.

**What I built**: a separate \`upgradeReminders\` table, with a row inserted for everyone who has been emailed. Each sweep left-joins users against upgradeReminders with \`isNull(upgradeReminders.id)\` in the condition, so it selects only users with no send record, and a record is inserted after the email goes out.

**Three things wrong with it, and how I would change them now:**

1. **The write and the send are in the wrong order.** I send first and record second. If the process is killed between those two steps, or the insert times out, that user has no record, the next sweep still sees "no record", and they get a second email. The correct order is **claim the slot, then send**: INSERT a row with status \`pending\` first, only call the mail API if that insert succeeded, then UPDATE it to \`sent\`. Rows that fail in between stay \`pending\` for another job to retry. The worst case moves from "sent twice" to "missed one", and for the user a missed email is much cheaper than a duplicate.
2. **There is no unique constraint on the table; deduplication rests entirely on that \`isNull\` in the query.** "Check whether it was sent, then decide whether to send" is a classic read-then-write, and it does not hold under concurrency: two ticks arriving together, or one run overrunning into the next, and both sides read "not sent yet" and both send. The fix is a unique key on \`(userId, reminder type, period identifier)\` so **the database** rejects the second insert, leaving the query as a fast path only. The decision has to belong to the database, because only it can make the read and the write one atomic operation.
3. **The cron expression is \`EVERY_MINUTE\`.** The line that runs at 9am daily is commented out, and what is live is a run every minute — a debugging change I never reverted. Worse, \`@nestjs/schedule\` does not guard against re-entry by default: the previous run is still working through the send loop when the next one starts, and combined with the two points above, duplicate emails are close to guaranteed.

**Two more lines make it a full answer:**

- Mail providers retry too, so calls to the send API should carry an **Idempotency-Key** (both Resend and SendGrid support the header). Resubmitting the same key means the provider only really sends once.
- After a restart, **do not catch up on missed periods.** The correct semantics are "given the current time, who should be emailed now", not iterating every missed tick during downtime. Otherwise a full day of downtime becomes a pile of backlogged reminders hitting users the moment it comes back.

> Answering this way beats overselling it: what it shows is that I know what failures in this kind of system look like, rather than that I once wrote a cron job that ran.`,

  'b4-ci': `**Say it plainly: the repo had no tests at that point, so CI runs three things — lint, typecheck and build**, triggered on every push, on all branches.

Its value is not in what it runs but in turning "it works on my machine so I pushed it" into "every push goes through a type check and a build". Before I added it the repo had no automated checks at all — so this is zero to one, not one to two. The next rung up is adding a test job.

> ⚠️ A hard rule: **the claim about writing tests has been deleted from the resume and must never go back.** The full git history of both repos contains no test or spec file, and \`beyz-web\` does not even have jest or playwright installed. Promising a test suite that does not exist means being asked which cases it covers, with nowhere to go.`,

  'b4-fastify': `**This is a technology-choice question, not a bottleneck question — answering it as "our volume forced us onto Fastify" is the dangerous version.**

The facts: NestJS abstracts the HTTP layer behind an adapter, so Express and Fastify are interchangeable with essentially no change to application code. The reasons for Fastify are better throughput and a more natural fit for schema validation and swagger integration.

But **this service's volume never comes close to an Express bottleneck.** So saying "the adapter is swappable anyway, and I took the faster one" is much safer than inventing a performance argument — if they ask for QPS numbers, the invented version falls apart immediately.`,
};
