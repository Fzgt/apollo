---
title: "⑥ Splitting evidence from judgment"
section: Periplus
---

# ⑥ Splitting evidence from judgment

> **Resume line (historical)**
>
> **Split evidence from judgment**: the research stage emits **claims bound to exact source quotes**, a separate verification stage rules on them, and **application code — not prompts — enforces citation membership and freshness windows**. **A claim with no supporting quote never advances.**

This one is not on the resume. Periplus has four lines and this is not among them; the wording above is what it said when it was on there, kept for reference. The note stays, because "how do you stop the model fabricating sources" is a mandatory question for any LLM role, and the answer is all here.

## What this line has to show

The most common failure in an LLM system is a fabricated source: it says "according to the official site, admission is 45 dollars" when that sentence does not exist anywhere in the source.

The usual approach is a prompt saying "always cite real sources". The entire content of this line is that this does not work, because a prompt is a request, not a constraint.

## Three objects, defined first

In this system every sentence is split across three layers.

A claim is a sentence to tell the user, such as "admission to the opera house is 45 dollars". It comes from the research stage. Evidence is a passage taken verbatim from a page, along with its URL and publication date; it also comes from the research stage. A verdict is whether the claim holds up, and it comes from the verification stage — never from the research stage.

"Claims bound to exact source quotes" means the research stage cannot merely say admission is 45 dollars; it must produce the source sentence that says so.

## Six verdicts, and who decides each

This is the most valuable list in the note, and it is worth memorising.

The model may return four. Supported: the evidence directly supports the whole claim. Partial: it establishes a weaker or incomplete part, or the supplied sources conflict. Contradicted: the evidence directly disproves the claim. Unsupported: there is evidence, but it does not address the claim.

Application code decides the other two. Stale: the evidence supports the claim, but predates that claim's freshness window. No evidence: there is none at all.

The line in the prompt is quotable directly, and quoting it beats paraphrasing tenfold: never decide freshness and never return stale or no_evidence; application code owns those.

That is the literal source of "application code — not prompts — enforces" on the resume. Quote the English in an interview: it proves this is not a story assembled after the fact, it is a design boundary that was written into the prompt at the time.

There is another constant that is easy to get wrong: the usable verdicts are supported, partial and stale. Stale is usable — it means usable with a currency caveat, not unshowable. Unsupported, contradicted and no evidence are all unusable.

## Freshness windows are per claim type

A freshness window is how old this kind of claim's evidence can be before it counts as expired.

Opening hours and prices are 180 days. Availability — whether something is open, whether it needs booking — is 90 days. Transit is 365 days. Safety is 90 days. Other is 365. Location and description never expire.

"The opera house is at Circular Quay" does not stop being true because the page is three years old, but "admission is 45 dollars" must be downgraded past 180 days.

The enum's docstring explains the classification in one line: it determines how volatile a claim is, and therefore how fast its evidence rots.

## Why "always cite real sources" in the prompt is not enough

A prompt is a request, not a constraint. The model may comply or may not, and you have no mechanism to know whether it did this time.

Worse, it fails plausibly: a fabricated citation reads exactly like a real one — right format, right tone, even a convincing-looking URL.

So we do not ask. We validate in code after the answer comes back: the evidence ids it cited must genuinely be in that claim's evidence pack — a set-membership check, not a judgement call.

That last clause is the crux of this section and the single sentence most worth saying out loud from this note.

## What the application code validates

Two things, both deterministic.

Citation membership: the evidence ids the model cited must be in that claim's evidence pack. One set lookup.

Freshness windows: today's date minus the evidence's publication date, compared against that claim type's window. The staleness check is a pure function, and its docstring states the date precedence — prefer the date the publisher declared, and fall back to the fetch time when there is none, because that is the last date the system actually observed the text and it is the most conservative deterministic fallback.

## What happens when evidence conflicts or expires

When sources conflict, the model returns partial. The prompt defines that case explicitly: the evidence establishes a weaker or incomplete part, or the supplied sources conflict.

When evidence has expired, code returns stale, and the claim stays usable with a currency note attached.

## The difference between "no evidence" and "unsupported"

This comes up often and gets confused.

Unsupported means there is evidence but it does not address the claim. No evidence means there is none at all.

The first is the model's judgement: it read the evidence and said it is unrelated to the claim. The second is the code's: the evidence pack is empty, so the model is never asked.

Their costs differ too — no evidence spends no model call at all. That sentence incidentally shows you thought about cost, and it is worth including.

## Why even "today's date" is injected

The verification module's docstring says: the as-of date makes replay and freshness tests stable; it defaults to the current UTC date, never to a date inferred by the model.

Injecting means the function does not ask the system for the time itself — the caller passes the date in.

Two benefits. Test stability: without it, a case asserting that a price within thirty days is valid goes red on its own a few months later, which is a time-bomb test. And reproducible replay: rerunning the same run gives exactly the same verdicts.

Time here is a business input, not environmental noise — the freshness judgement consumes it directly. That is the same reasoning as [injecting the clock](/docs?section=periplus&item=scripted-seams).

## Only a publisher-declared date counts

The extraction module's docstring is the best quotation in this note: only a date the publisher declared counts; guessing one from the text would hand the freshness rules a number nobody stands behind, and a wrong date there means stale prices are scheduled as verified.

Better no date at all — falling back to the conservative fetch time — than a guessed one, because the entire freshness rule is built on top of it.

Quoting that comment shows you understand that determinism has to be held all the way through, not checked once at the end. It is the same value as [the correct-if-slow index](/docs?section=periplus&item=pgvector-embeddings) in the pgvector note, and the two are stronger told together.

## Wording to get right

Three things. The core sentence is the resume's own, word for word: application code — not prompts — enforces citation membership and freshness windows. "A prompt is a request, not a constraint" explains in one line why prompts are not relied on. And "a guessed date would hand the freshness rule a number nobody stands behind" carries the date-extraction argument.

## The 30-second answer

> The most common failure in an LLM system is a fabricated source: it says "according to the official site, admission is 45 dollars" and that sentence does not exist in the source at all. The usual approach is a prompt saying "always cite real sources" — but a prompt is a request, not a constraint. So we split the work in two: the research stage only produces claims bound to the source passages they came from, and a separate verification stage rules on them — and the two most important judgements in that ruling are not given to the model at all. There are six verdicts, and the model is only allowed to return four of them. "Stale evidence" and "no evidence at all" are computed by application code, and the prompt explicitly forbids the model from returning them, because whether something has expired is today's date minus the page's publication date — a deterministic computation, and handing it to a model only produces a plausible-sounding guess. The result is that a claim with no supporting quote never advances.

## Self-check

1. Can you say what a claim, evidence and a verdict are, and which stage produces each?
2. Can you name the six verdicts and separate the four the model owns from the two code owns?
3. Can you name the three usable verdicts and explain why stale counts as usable?
4. Can you explain that freshness windows are per claim type and name the two that never expire?
5. Can you explain why a prompt is a request rather than a constraint, and name the two things code validates?
6. Can you separate unsupported from no evidence, including who decides and the cost difference?
7. Can you explain the publisher-declared-date rule and what it protects?
