---
title: "⑥ Splitting evidence from judgment"
section: Periplus
---

# ⑥ Splitting evidence from judgment

> **Resume line**
>
> **Split evidence from judgment**: the research stage emits **claims bound to exact source quotes**, a separate verification stage rules on them, and **application code — not prompts — enforces citation membership and freshness windows**. **A claim with no supporting quote never advances.**

**This note is not on the resume.** Periplus has four bullets and this is not one of them; the line above is quoted from when it was, for reference. **The note stays, because "how do you stop the model fabricating sources" is a certainty in any LLM interview, and the answer is entirely here.**

## Terms, in one line each

**Hallucination / fabricated citation** — the model says "according to the official site, tickets are $45" **when that sentence does not exist in the source.**

**Claim** — one statement to be shown to the traveller.

**Evidence** — a passage lifted **verbatim** from a page, with its URL and published date.

**Verbatim quote / exact source quote** — **not one character changed.** Tidying it to `$30.00` makes it no longer verbatim.

**Verdict** — whether the claim stands up.

**Citation membership** — whether the evidence id the model cited **is actually in that claim's evidence bundle.** **A set lookup, not a judgement.**

**Freshness window** — how old evidence for this kind of claim may be **before it counts as stale.**

**Provenance** — the chain from a final sentence back to its original source.

**Pure function** — same input, same output, no side effects.

## What this line has to show

The most common failure of an LLM system is **fabricating sources.**

The usual response is a prompt line saying "always cite real sources". **The entire content of this bullet is that this does not work, because a prompt is a request, not a constraint.**

## Who produces each of the three objects

Every sentence is split into three layers:

- **The claim** ("Opera House tickets are $45") — **produced by the research stage.**
- **The evidence** (the source passage, its URL, its published date) — **also produced by the research stage.**
- **The verdict** — **produced by the verification stage, never written by research.**

**"Claims bound to exact source quotes" means research may not merely say "tickets are $45"; it must supply where that sentence came from.**

## Six verdicts, and who gets to decide

**This is the most valuable list in the note. Memorise it.**

**The model may return four:**

- **`supported`** — the evidence directly supports the whole claim.
- **`partial`** — it supports only part of it, or the sources conflict.
- **`contradicted`** — the evidence directly refutes the claim.
- **`unsupported`** — **there is evidence and it does not address the claim.**

**Application code decides the other two:**

- **`stale`** — the evidence supports it **but predates the claim's freshness window.**
- **`no_evidence`** — **there is no evidence at all.**

The prompt line is quotable as it stands, **and quoting it beats paraphrasing it tenfold**:

```
- Never decide freshness and never return stale or no_evidence; application code owns those.
```

**That is the literal source of "application code — not prompts — enforces" on the resume.** Quote it in the interview — **it proves this is not a story constructed afterwards, but a design boundary written into the prompt at the time.**

**One constant is easy to get wrong:**

```python
USABLE_VERDICTS: frozenset[Verdict] = frozenset({
    Verdict.SUPPORTED, Verdict.PARTIAL, Verdict.STALE
})
```

**Stale is usable.** Its meaning is **usable with a currency caveat**, not withheld from the traveller. `unsupported`, `contradicted` and `no_evidence` are not usable.

## Freshness windows differ by claim kind

```python
FRESHNESS_DAYS: dict[ClaimKind, int | None] = {
    ClaimKind.HOURS:        180,
    ClaimKind.PRICE:        180,
    ClaimKind.AVAILABILITY:  90,
    ClaimKind.TRANSIT:      365,
    ClaimKind.SAFETY:        90,
    ClaimKind.LOCATION:    None,   # ← never goes stale
    ClaimKind.DESCRIPTION: None,   # ← never goes stale
    ClaimKind.OTHER:        365,
}
```

**"The Opera House is at Circular Quay" does not expire because the page is three years old, while "tickets are $45" must be downgraded past 180 days.**

The enum's docstring says why the classification exists in one line: **it decides how volatile a claim is, and therefore how fast its evidence rots.**

## Why "always cite real sources" in the prompt is not enough

**A prompt is a request, not a constraint.** The model may comply or not, **and you have no mechanism to know which happened this time.**

**Worse, it fails plausibly**: a fabricated citation **reads exactly like a real one** — right format, right register, even a convincing URL.

**So we do not ask it. We validate in code after it answers**: the evidence id it cited must actually be in that claim's evidence bundle — **a set-membership check, not a judgement.**

**That last clause is the crux of this section and the single most important thing to say out loud.**

## What application code actually validates

**Two things, both deterministic.**

**① Citation membership** — the cited evidence id must be in the claim's bundle. **One set lookup.**

**② The freshness window** — `today − the evidence's published date`, compared against the window for that claim kind. **The staleness check is a pure function**, and its docstring states the date precedence: **prefer the publisher's own declared date, and fall back to the fetch time**, because that is the **latest date at which the system actually observed the text — the most conservative deterministic fallback.**

## What happens when evidence conflicts or is old

**Conflict** returns `partial`. The prompt defines it explicitly: **the evidence establishes only a weaker or incomplete part, or the supplied sources conflict with each other.**

**Age** is judged `stale` by code, **still usable but annotated with its currency.**

## The difference between `unsupported` and `no_evidence`

**A frequent question, and easily confused.**

- **`unsupported` means there is evidence and it does not address the claim** — **decided by the model**: it read the evidence and found it irrelevant.
- **`no_evidence` means there is none at all** — **decided by code**: the bundle is empty, **so the model is never asked.**

**The costs differ too: `no_evidence` spends zero model calls.** Mentioning that shows you thought about cost, and it is worth including.

## Why even "today's date" is injected

The verification module's docstring says: **`as_of` makes replay and freshness tests stable; it defaults to the current UTC date and never to a date the model inferred.**

**Injected means the function does not ask the system what time it is; the caller passes the date in.**

**Two benefits**: **stable tests** — without it, a case asserting "a price within thirty days is valid" **goes red on its own a few months later**, a time-bomb test; and **reproducible replays** — re-running the same run gives identical verdicts.

**Time here is a business input, not environmental noise** — the staleness rule consumes it directly. The same reasoning as [injecting the clock](/docs?section=periplus&item=scripted-seams).

## Date extraction only accepts publisher-declared dates

The extraction module's docstring is **the best quote in this note**:

> Only a date the publisher declared counts; **guessing one out of the body text hands the freshness rule a number nobody stands behind**, and one wrong date there means **a stale price scheduled into an itinerary as if it had been verified.**

**Rather no date — falling back to the conservative fetch time — than a guessed one, because the entire freshness rule is built on top of it.**

**Being able to quote that shows you understand that determinism has to be defended all the way down, not checked once at the end.** The same value ordering as ["a correct, if slow, index"](/docs?section=periplus&item=pgvector-embeddings), **and the two are stronger told together.**

## The 30-second answer

> The most common failure of an LLM system is fabricating sources: it says "according to the official site, tickets are $45", and that sentence does not exist. The usual response is a prompt line saying "always cite real sources" — but a prompt is a request, not a constraint. So we split the work in two: the research stage only produces claims bound to their source passages, a separate verification stage rules on them, and the two most important judgements in that ruling are not given to the model at all. Concretely there are six verdicts and the model may return only four; stale and no_evidence are computed by application code, and there is a prompt line explicitly forbidding the model from returning them. Because staleness is "today minus the page's published date", a deterministic computation, and handing that to a model only buys a plausible-sounding guess. The result is that a claim with no supporting quote never advances.

## Self-check

1. Can you say who produces each of claim, evidence and verdict?
2. Can you name all six verdicts, and separate the model's four from the code's two?
3. Can you name the three in `USABLE_VERDICTS`, and explain why `stale` is usable?
4. Can you explain that freshness windows are per claim kind, and name the two that never expire?
5. Can you explain why a prompt is a request and not a constraint, and name the two things code validates?
6. Can you distinguish `unsupported` from `no_evidence`, including who decides and the cost difference?
7. Can you state the publisher-declared-dates-only rule, and what it protects?
