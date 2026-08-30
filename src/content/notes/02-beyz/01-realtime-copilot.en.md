---
title: "① Real-time interview copilot"
---

# ① Real-time interview copilot

> **Resume line**
>
> Built the real-time interview copilot end to end: tab and system audio through **getDisplayMedia**, streamed over a **WebSocket** to Deepgram and answered by **GPT-4o token by token as each utterance ends**.

> ℹ️ **This is the first line on the resume.** (v66 had merged the old bullets 1 and 2 into one sentence; v72 split them back apart.) This page covers the pipeline itself: capture → transcribe → detect the end of a turn → stream the answer. Credentials, quota and the state machine live in [② Credentials, quota and the four-state machine](/docs?section=beyz&item=credential-quota).

## Understand the product before you look at the APIs

What it does: it captures **the interviewer's voice** from the meeting software, turns it into text in real time, decides when the interviewer has finished a question, hands that question to GPT-4o, and reveals the answer progressively.

```text
interviewer's tab / system audio
  → browser getDisplayMedia
  → MediaRecorder emits an audio chunk every 250ms
  → WebSocket to Deepgram
  → client reconciles interim and final transcripts
  → UtteranceEnd marks the end of one spoken turn
  → server action calls GPT-4o
  → answer streams back token by token
```

The point of this bullet is not "I called two APIs". It is that **capture, transcription, turn detection and generation are all streaming, and the streaming state is handled correctly.**

---

# Layer one: the six questions you must answer cleanly

## 1. Why `getDisplayMedia` instead of the microphone?

The browser offers two different capture paths:

| API | What it captures |
|---|---|
| `getUserMedia` | The user's microphone — mostly the candidate's own voice |
| `getDisplayMedia` | Audio from a shared tab or from the system — that is, the interviewer's voice |

The product needs to hear the remote voice coming out of the meeting software, so the microphone is simply the wrong source.

```ts
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true,
});
```

The permission model of `getDisplayMedia` is built around sharing something visible, and audio rides along as an extra track — so you have to ask for video. Once the project has the stream, it immediately stops and removes the video track and keeps only the audio:

```ts
for (const track of stream.getVideoTracks()) {
  track.stop();
  stream.removeTrack(track);
}
```

`stop()` ends the actual capture; `removeTrack()` takes the track off the stream. This cuts resource use and follows the principle of least privilege.

**One-sentence answer:**

> The interviewer's voice was playing from another tab, so the microphone was the wrong source. I used `getDisplayMedia` to capture the shared tab audio, then immediately stopped and removed the video track because the product needed no screen frames.

---

## 2. How does the audio reach Deepgram in real time, and why a WebSocket?

`MediaRecorder.start(250)` makes the browser emit an audio chunk roughly every 250ms:

```ts
const recorder = new MediaRecorder(stream);
recorder.start(250);

recorder.ondataavailable = ({ data }) => {
  if (data.size > 0) connection.send(data);
};
```

Why 250ms? It is a trade-off found by tuning, between latency and packet count:

- Smaller: more packets, more fixed overhead;
- Larger: a chunk has to fill up first, so the first transcribed word arrives noticeably later;
- 250ms produces text steadily while keeping the connection under very little pressure.

Do not present it as the result of a theoretical calculation.

A WebSocket fits here because:

- The browser uploads audio continuously;
- Deepgram sends recognition results back continuously;
- After one handshake either side can send at any time;
- Ordered, reliable delivery is what speech transcription needs.

SSE is essentially one-way server push and cannot on its own carry the continuous audio upload; polling would add heavy request overhead and extra latency.

**One-sentence answer:**

> `MediaRecorder` emitted a non-empty audio chunk every 250 milliseconds, and the browser sent those chunks over one long-lived WebSocket because both audio upload and transcript delivery were continuous.

---

## 3. What is the difference between an interim and a final transcript?

Deepgram sends two kinds of result:

| Kind | Flag | Update rule |
|---|---|---|
| Interim | `is_final: false` | The latest guess at the current segment; later results rewrite it |
| Final | `is_final: true` | The current segment is settled and can be appended to the confirmed text |

The easiest mistake is appending every message directly:

```ts
transcript += incomingText; // wrong
```

Suppose the interim results arrive in this order:

```text
"what"
"what is"
"what is your"
```

These are not new words. Each one is a complete rewrite of the current segment. Appending them gives you:

```text
what what is what is your
```

The correct approach is to split the state:

- `confirmedTranscript`: everything that has gone final, accumulated;
- The current interim: replaced, never accumulated;
- What the screen shows: `confirmed + current`.

```ts
const displayed = [confirmedRef.current, incoming]
  .filter(Boolean)
  .join(' ');

setTranscript(displayed);

if (data.is_final) {
  confirmedRef.current = displayed;
}
```

A ref is used because the WebSocket callback can fire several times before React's next render; this code needs to read and write the latest accumulated value synchronously, and that internal value does not itself need to trigger a render.

**One-sentence answer:**

> Interim results are rewrites, not appends. I kept committed final text separately and rendered it together with only the latest interim segment, so revisions never duplicated words on screen.

---

## 4. Why can't you call GPT the moment you receive `is_final`?

`is_final` only means **this short piece of audio has settled**. It does not mean the interviewer has finished the whole question.

One long question can produce several finals, simply because the speaker breathes:

```text
final: "Tell me about a time"
final: "you handled a difficult stakeholder"
final: "and what you learned"
```

If every final triggered generation, you would get several GPT requests, duplicated cost, and answers overwriting each other.

The project uses Deepgram's `UtteranceEnd` message, configured with:

```text
utterance_end_ms: 2000
```

Roughly two seconds with no new words is what counts as the end of a spoken turn.

- Too short: an ordinary breath submits half a question;
- Too long: the user waits longer than necessary;
- Two seconds is an empirical compromise between absorbing natural pauses and staying responsive.

⚠️ Get the names right: `is_final`, `speech_final`, `UtteranceEnd`. There is no `Silent event`, and there is no `utterance_end: true` field.

**One-sentence answer:**

> `is_final` closes an acoustic segment, not a conversational turn. I waited for Deepgram's `UtteranceEnd` event so normal pauses inside one question did not trigger several GPT generations.

---

## 5. How does the GPT answer stream back to the front end?

The actual implementation is neither hand-written SSE nor a custom `ReadableStream` exposed directly.

The server uses a Next.js server action together with AI SDK RSC:

```text
streamText()
  → createStreamableValue()
  → RSC flight stream
  → readStreamableValue()
  → the front end updates the answer chunk by chunk
```

The answer is not held back until it is complete; each token is displayed as it arrives. In an interview, what matters is time to first token, not when the whole answer finishes.

Without RSC, `fetch + ReadableStream` would be the alternative. The native `EventSource` only supports GET, and the question has to be sent by POST, so a plain EventSource cannot carry this request.

**One-sentence answer:**

> The answer came back through a Next.js server action using the AI SDK's streamable value. The client consumed it with `readStreamableValue`, so tokens appeared immediately instead of waiting for the full answer.

---

## 6. What is the end-to-end latency?

There is no reliable measured number for this project, and you must not invent one.

Split the latency into two parts:

```text
A. Turn-detection wait: the deliberately configured 2-second UtteranceEnd threshold
B. Processing latency: from UtteranceEnd to the first answer token
```

The right way to measure it: record a timestamp when UtteranceEnd arrives and another when the first token arrives, repeat it many times, then report a range or a median.

**The honest answer:**

> The two-second silence threshold was a product decision, not processing time. I did not record a reliable post-trigger time-to-first-token measurement, so I would instrument the UtteranceEnd timestamp and the first streamed token rather than inventing a number.

---

# Layer two: where the responsibilities are drawn

```text
browser → Deepgram: audio and transcripts
browser → our server → GPT-4o: questions and answers
```

The audio never passes through our own server. That removes one hop of latency and spares our service from proxying a long-lived audio stream for every user.

The price is that the browser has to connect to Deepgram directly, which means it needs a credential good enough to open that connection. A browser cannot hold a long-lived secret — and that is exactly the problem [② Credentials, quota and the four-state machine](/docs?section=beyz&item=credential-quota) solves.

---

# Layer three: what happens under concurrency?

While the previous answer is still being generated, a new `UtteranceEnd` — or a manual request from the user — can trigger generation again. The state machine from bullet 2 returns immediately while in the `Generating` state.

Say this precisely: **what gets dropped is that one submit action, not necessarily the transcript content.** The guard runs before `resetTranscript()`, so new transcription can stay in the buffer and later be submitted together with the next segment.

That may be useful when the interviewer is adding to a question, but it can wrongly merge two unrelated questions. The better direction is to queue a new conversational turn separately during generation, or ask the user to confirm it, rather than continuing to append into the same buffer.

---

# Three gaps to admit up front about the current implementation

1. **No reliable measured time to first token.** The 2-second turn-detection threshold must not be described as processing time.
2. **No automatic reconnection after the Deepgram connection closes.** A fuller implementation would have backoff, a retry ceiling and state recovery.
3. **New transcription during generation can be merged into the next submission.** A follow-up question merges fine; an unrelated one needs its own turn buffer.

---

# The 30-second answer

> The interviewer's audio lived in another tab, so I captured it with `getDisplayMedia`, removed the unused video track and emitted an audio chunk every 250 milliseconds. The browser streamed those chunks directly to Deepgram over WebSocket. Interim transcripts were rewrites, so I kept committed final text separately and rendered it with only the latest interim segment. I did not trigger GPT on every final segment; I waited for Deepgram's `UtteranceEnd` event to identify the conversational turn. Then a Next.js server action streamed the GPT-4o answer back through the AI SDK's streamable value so the first tokens appeared immediately.

---

# Self-check: answer these six first

1. Why `getDisplayMedia` rather than the microphone?
2. What problem does the 250ms chunk solve, and what problem does the WebSocket solve?
3. Why must an interim be replaced while a final can be accumulated?
4. Why can't `is_final` trigger GPT directly?
5. How does the answer stream from the server action back to the browser?
6. What is the difference between the two seconds of silence and the actual processing latency?

---

## Glossary

| 中文 | English |
|---|---|
| 标签页 / 系统音频 | tab / system audio |
| 屏幕共享采集 | display capture |
| 音频块 | audio chunk |
| 临时结果 | interim result |
| 定稿结果 | final result |
| 调和 / 合并 | reconcile |
| 对话轮次 | conversational turn |
| 断句 | utterance segmentation |
| 首字延迟 | time to first token |
| 退避重连 | reconnect with backoff |

---

# Appendix: the follow-up questions to expect (layer two)

> A restructuring pass on 2026-08-24 deleted this material. **It was cut because it was tiring to read, not because nobody will ask about it.** The body above answers "what is it and how did you build it"; this section answers "why not the other approach, and where is it still weak" — which is what a second-layer follow-up needs.

## Why a WebSocket and not WebRTC

The textbook answer for real-time audio is usually WebRTC, so this question will almost certainly come.

| | Why it exists |
|---|---|
| **WebRTC** | Optimised for **human-to-human calls**: runs on UDP, **tolerates packet loss** in exchange for very low latency, has built-in echo cancellation and a jitter buffer |
| **WebSocket** | Delivers data to the other side **reliably**: runs on TCP, loses nothing, preserves order |

⭐ **WebSocket is the right choice here: the goal is transcription, not a phone call — a lost audio packet is a stretch of speech nobody hears, which means a stretch of wrong transcript. Reliability outranks the last millisecond of latency.** Within a 250-millisecond latency budget, the cost of an occasional TCP retransmission is entirely acceptable.

> **There is also a deliberate ordering**: the code **confirms the socket is open before it starts the recorder**. The other way round, the recorder starts emitting chunks before the connection exists, and **those chunks have nowhere to go and are simply dropped — the first few hundred milliseconds of speech disappear.**

## Why that `size > 0` check is mandatory

```ts
if (data.size > 0) connection.send(data);
```

The recorder can emit an empty chunk the instant it starts, and ⭐ **a zero-byte packet tells Deepgram that the client is done, so it closes the connection**. That line is not defensive padding; it stops the pipeline from tearing itself down in the first second.

## The second layer of reasoning behind 250 milliseconds

The body says it is a trade-off between latency and packet count. Under follow-up there are three more things to say:

- ⭐ **It is the only latency term in the whole pipeline you get to choose freely** — recognition time and model generation time are not yours to control;
- **It is 8× smaller than the 2-second window used to decide someone has finished speaking**, so the slicing granularity sits far below the silence-detection granularity and the two do not interfere;
- **The honest baseline**: 250 is also the default in Deepgram's own example. **"It is the default" and "it is reasonable" do not conflict** — what the interviewer wants to hear is whether you can explain why it is reasonable.

## What reconnection would need (the body only says "with backoff")

| Measure | Detail |
|---|---|
| **Exponential backoff** | 1 → 2 → 4 → 8 seconds, capped at 30, **plus random jitter**, so a crowd of clients does not reconnect in lockstep and flatten the server |
| **Reconnecting must mint a fresh credential** | That temporary key is valid for only 60 seconds and **cannot be reused** |
| **Audio during the outage** | Three options: drop it (a hole in the transcript) / buffer locally and resend after reconnecting (needs a cap) / **pause recording and say plainly "connection lost"**. **In an interview the third is the most honest** — better to say the link dropped than to hand back a transcript with a hole in it and let the user think the interviewer said nothing |
| **Tell a deliberate stop from an accidental drop** | Today both take the same close event. Reconnection requires telling them apart, **or the user hits stop and the code keeps diligently reconnecting** |

> **A real trap**: confirmed transcript survives a reconnection (it lives in a ref). **But if the drop lands mid-sentence, that half sentence stays and gets glued to the second half from after the reconnection, producing one semantically broken line.**

## There is no backpressure

**Backpressure = production outrunning consumption, so data piles up in between.** Here the producer is the recorder (4 chunks a second) and the consumer is the WebSocket send. The code calls `send` directly and never looks at `bufferedAmount` (bytes handed to send but not yet actually on the wire).

On a healthy network this is fine, **but a badly degraded network turns it into a vicious circle**: the buffer grows → the audio falls further behind → recognition results arrive later and later → **the text on screen trails the speaker by several seconds and the user assumes the system has frozen.**

⭐ **The right behaviour is to drop the oldest chunk once you pass a threshold, rather than queue it — audio from five seconds ago is worthless by the time it is transcribed. "In a real-time system, stale data is worse than no data."**

## The nine failure branches

| # | Situation | Handling |
|---|---|---|
| 1 | **The user cancels** | Throws `NotAllowedError` → takes the "user declined" branch, **kept separate from a real error** (declining is a normal choice and should not raise "something went wrong") |
| 2 | **A screen is picked but "share audio" is left unchecked** | The stream has no audio track → **check explicitly and report it**. ⭐ This is **the most common user mistake** with this API — the checkbox is off by default |
| 3 | **An empty audio packet** | Only send when `size > 0` |
| 4 | **The Deepgram connection drops** | ⚠️ State changes only; **no automatic reconnection** |
| 5 | **A paused microphone leaves the connection idle** | A heartbeat every 10 seconds (see [②](/docs?section=beyz&item=credential-quota)) |
| 6 | **Someone speaks during generation** | No second generation is started, **but the words accumulate** and go out with the next submission |
| 7 | **The question allowance runs out** | **Checked continuously**; over the limit stops the interview and opens the subscription dialog — not a single check at the start |
| 8 | **A free user bypasses the UI and calls the API directly** | The server throws `Unauthorized` — **a front-end guard does not count** |
| 9 | **Nothing was recognised at all** | Empty text is never submitted |

## Why not the other approaches

| Alternative | Why it was not used |
|---|---|
| **Relay the audio through our server** | One extra hop doubles the latency, and the server has to carry a long-lived audio stream per user |
| **SSE / polling** | Audio must go up continuously; SSE only pushes down, and polling cannot stream at all |
| **Transcribe only after the speaker finishes** | Latency = full utterance length + recognition time; **the product simply does not work** |
| **Trigger generation on every final** | One sentence yields several finals — several times the cost, plus a pile of half answers |
| **Return the whole answer at once** | Time to first token goes from a few hundred milliseconds to several seconds |
| **`getUserMedia` on the microphone** | You hear **yourself** speaking — **the direction is backwards** |
| **The browser's own Web Speech API** | ⭐ **It accepts microphone input only, and there is no entry point for feeding it an existing audio stream** — and a tab's audio is exactly what we need to hear, **which settles it on its own**. It is also all but unusable in Safari, and on Chrome it still ships the audio to Google's servers |
