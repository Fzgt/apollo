---
title: "How to run the five rounds"
section: Mock interview
---

# How to spend mock-interview day

> 🔴 **Must read.** **No new material today**, just one job: **turn what is on paper into what comes out of your mouth.**
>
> ⚠️ All the material is in place: [Cross-project follow-ups](/docs?section=cheatsheet&item=crosscut) (Round 3's four questions already filled in) · [Four implementations of idempotency](/docs?section=cheatsheet&item=idempotency) · [The numbers table](/docs?section=cheatsheet&item=numbers) · [The one-pager](/docs?section=cheatsheet&item=onepager) (**the parts only you can fill are left blank**) · [The behavioural note in the Library](/library?section=interview&item=behavioral).

## ⚠️ One thing that matters more than all five rounds

**All your material is written in Chinese, and you are applying in Sydney — the interview is in English.**

"exactly-once does not exist across systems" flows easily in Chinese; translating it live into *"exactly-once doesn't exist across system boundaries — what you can have is at-least-once plus idempotent consumption"* is another matter.

> ⭐ **Practise rounds 1 and 2 in English directly.** Being fluent in Chinese does not mean you can say it in English — **terminology you have never said aloud in English will stall you on the day.**

## Round 0 · Behavioural (practise first, do not skip)

**Material**: [the behavioural note in the Library](/library?section=interview&item=behavioral) (258 lines). Everywhere marked `【只有你能填】` **must be filled in by you.**

Practise three things out loud:

1. **The 30-second introduction** (once in Chinese, once in English)
2. **The four holes in the timeline**: the 2022–2024 gap, two roles both under a year, Beyz overlapping with the start of term, graduation to now
3. **The three steps of "why the move into AI"**

> ⭐ **Your own study plan says it: "however thick the technical prep, if the first ten minutes collapse there is no rest of it."** There is a reason this round goes first.

## Round 1 · 22 bullets, 30 seconds each

**Goal**: a **non-technical recruiter** has to follow it. **Lead with the user's problem and the result, do not pile up API names.**

**22 bullets = Beyz 4 + BioMap 4 + Baidu 5 + WinterFell 5 + Periplus 4** (the v72 count). There are 24 notes: one per bullet, plus Periplus ② (which shares the first bullet with ①) and Periplus ⑥ evidence and ruling (off the resume since v66). Both still have to be answerable.

**Where each 30-second draft lives:**

| Project | Where to take the draft from |
|---|---|
| Beyz ① | The top of [① The full data flow](/docs?section=beyz&item=realtime-copilot) |
| Baidu ③ ④ | The tops of [④ Withdrawals](/docs?section=baidu&item=withdrawal)) and [② Webpack](/docs?section=baidu&item=webpack-migration)) |
| Baidu ② ⑤ | The top of [①③ The virtualized feed and the production white screen](/docs?section=baidu&item=virtual-list) (two paragraphs) |
| Periplus ① ② ③ ④ | The top of each must-read page (notes ②③④⑤) |
| WinterFell ① ② ③ ④ ⑤ | The "30-second answer" in each of the five notes, starting with [① The procedural world](/docs?section=winterfell&item=procedural-world) |
| BioMap | The "30-second answer" in each of the four notes, starting with [① Architectural boundaries](/docs?section=biomap&item=architecture-boundaries) |

> **Write the drafts for the ones that have none** — if you cannot produce a 30-second version, you have not really thought that one through.

## Round 2 · 8 bullets drawn at random, 3 minutes each

**One structure throughout**: `Problem → Why → Solution → Decision → Result → Reflection`

⭐ **The Reflection cell is the point of this round**, and the easiest to skip. **Every item needs one sentence of "here is what I would change now"** — they are already written into the must-read pages:

| Item | Reflection |
|---|---|
| Beyz ① | **No automatic reconnection**; `Close` changes state without any backoff retry |
| Beyz ② | A late-arriving response **is blocked at the state level but not at the content level**; it should use an AbortController |
| Beyz ③ | Out-of-order events are unhandled; it should store the event timestamp and compare versions |
| Beyz ④ | **CI and CD are not joined up**; there is no gate before deploy |
| Baidu ③ | The quota decision belongs on the server; the client layer should only give early feedback |
| Baidu ④ | The **mismatched causation** in the resume sentence is still there (splitting does not reduce size) |
| Periplus ⑤ | Only two stages are covered, and **there is no hold-out set** |
| WinterFell ② | When the GPU becomes the bottleneck it should switch to **chunked instancing** |

> **Volunteering your weak points does not cost you, it is these bullets' biggest single plus** — it proves your current standard is higher than what you shipped then, **and the interviewer is hiring the current you.**

## Round 3 · Cross-project follow-ups

**All four questions are filled in** → [Cross-project follow-ups](/docs?section=cheatsheet&item=crosscut), plus [Four implementations of idempotency](/docs?section=cheatsheet&item=idempotency).

**What this round is worth**: **answering the same abstract question with examples from two different projects.** Done well it proves in one move that "what I understand is not a library, it is the problem itself".

**The two generalisations from the five questions most worth memorising:**

> **Idempotency has three layers**: the client is the weakest and only reduces useless requests; the application layer writes absolute values so results converge; **a data-layer constraint is the strongest and is entirely independent of concurrency and ordering.**
>
> **On a trade-off, ask "how expensive is being wrong here" first**: in finance and factual content, being wrong costs more than being slow or expensive; in real-time interaction, being stale costs more than being missing. **The same person making opposite trade-offs is not inconsistent, the costs are different.**

## Round 4 · Recording playback

**Record rounds 1 and 2 and play them back.** Mark three things:

- **Anywhere you stalled for more than 3 seconds** → that one is not internalised yet
- **Over-explaining** (three minutes in and still not at Result) → the structure is not solid
- **Thin evidence** (you gave a number but cannot say how it was measured) → go back to that bullet's numbers section

## The day's output

**Fill in [The one-pager](/docs?section=cheatsheet&item=onepager)** — the introduction and "why the move into AI" cells **only you can fill**; the rest (the S-tier hooks, the numbers to have ready, the limitations to volunteer, the questions to ask) already have their skeletons.

> **The rule for that page is "only what you wrote yourself, do not copy the notes"** — you have to be able to scan it in the 30 minutes before an interview.
