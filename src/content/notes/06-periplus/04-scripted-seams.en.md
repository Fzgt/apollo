---
title: "④ Scripted seams and 461 tests"
section: Periplus
---

# ④ Scripted seams and 461 tests

> **Resume line**
>
> **Put a scripted seam behind every external dependency** — the model provider, search, **httpx** page fetch and the clock — so the whole system runs with **no API keys and no network**: **461 pytest tests, 1.5 seconds end to end**.

Re-verified locally on 2026-08-27: the run reports **461 passed, 3 skipped, 1.37s**, and collection-only reports **464**. The resume's 461 is the **passed** count, excluding the 3 skips; 1.5 seconds is **wall-clock for the round including collection, serial and single-process.**

## Terms, in one line each

**Seam** — from *Working Effectively with Legacy Code*: **a place where you can change the program's behaviour without editing the code at that place.**

**Stub / fake / mock** — a **stub** returns canned values; a **fake** is a working simplified implementation (the fake clock is one); a **mock** additionally asserts how many times it was called. **Being able to separate them scores.**

**Flaky test** — the same code goes red sometimes and green others. **The default state of an AI system.**

**Dependency injection** — dependencies are passed in rather than constructed inside.

**ABC (abstract base class)** — a Python interface you must explicitly inherit, **and it can carry shared implementation.**

**Protocol (structural typing)** — Python's duck-typed interface: **no inheritance required, looking right is enough.**

**Transport layer** — the layer in an HTTP client that **actually puts bytes on the network.**

**Process boundary** — where bytes leave this process. **The whole criterion in this line lands on that phrase.**

## What this line has to show

**This is the best-evidenced line in Periplus: the code is on the laptop and the interviewer can run it there and then.**

But **the number is only the surface.** What it is really about is **how an AI system can be fully tested with no API keys and no network** — and the core of that answer is **putting the seam as close to the process boundary as possible.**

## The problem

**Testing an AI system has a fundamental difficulty: everything it depends on is non-deterministic.**

The same prompt can return different results twice, and the provider silently changes model versions. Search differs day to day. Pages get redesigned and disappear. **And time is different every run — while this system's staleness check consumes time directly.**

Testing against the real dependencies gives you **randomly red tests**, runs of tens of seconds to minutes, **money spent per run**, and total failure in a CI box without network.

So most AI projects **simply skip tests, or keep a couple of smoke tests for appearances.** **This line describes the other road: confine all the non-determinism to four replaceable holes.**

## Where the seam sits decides how much reality survives

**This section is the technical core; getting it right wins the exchange.**

The scripted model client **overrides exactly one method**: record the request, return the queued reply. **Nothing else changes.**

**What is still really running in the base class**: prompt assembly, extracting JSON from the model's reply, validating it with Pydantic, **the repair-retry loop after a validation failure**, and recording each call as an audit entry with token cost.

**All of that still executes. The only thing replaced is the act of sending the request.**

**Compare the common mistake**: swapping the whole object at the agent layer so it returns a canned result. **That tests that "my fake returned what I put in it", covering not one line of real logic.**

**The criterion, in one line: the seam goes as close to the process boundary as possible — the further out it is, the more real code the test still exercises.**

This is also why the evals module's comment says: **only the two things that leave the process are replaced, so a case exercises the real orchestrator, agents, gates and budget accounting.**

## Four seams, three different injection techniques

**Explaining why three different techniques were used is where the depth shows.**

**① ABC plus overriding one method** — for **the model and search.** Right when **there is a lot of real shared logic to preserve**: the base class implements every shared behaviour and the subclass fills in "how the bytes leave".

**② Protocol (structural typing)** — for **the clock**:

```python
class Clock(Protocol):
    def now(self) -> datetime: ...
    def monotonic(self) -> float: ...

class SystemClock:      # ← note: does not inherit Clock
    def now(self): return datetime.now(UTC)
    def monotonic(self): return time.monotonic()

class FakeClock:        # ← also no inheritance, it just looks right
    def advance(self, seconds: float) -> None:
        if seconds < 0:
            raise ValueError("a clock cannot go backwards")   # ← an invariant in behaviour
        self._now += timedelta(seconds=seconds)
        self._monotonic += seconds
```

**Why not an ABC here**: the interface is **two methods with no shared implementation**, so forcing inheritance only adds coupling. **The criterion: narrow interface with no shared logic → Protocol; wide interface with shared logic → ABC.**

**③ Replace the transport** — for **page fetching**, and **this is the elegant one**. What is replaced is **not the "fetch a page" function**, it is **httpx's transport layer**.

So the whole fetch module runs for real: **parsing and obeying robots rules, one in-flight request per host, the delay between consecutive requests to a host, streaming reads with a byte ceiling, redirect following, cache-before-network.** Only the final act of opening a socket does not happen.

**That is the payoff of putting the seam far enough out: replace the "fetch a page" function instead, and none of those six is tested.**

There is a fifth seam as well: **deterministic embeddings built from a hashing trick.**

## Why even the clock is injected

The clock module's header says it plainly:

```python
"""An injectable clock.

Nothing in the orchestrator calls ``datetime.now`` or ``time.monotonic`` directly.
Everything — wall-clock budgets, run/stage timestamps, and Auditor's freshness
``as_of`` date — goes through a Clock, so a test can move time forward by hand
instead of sleeping for real, and a replay stays deterministic.
"""
```

Time has three uses here: **the wall-clock budget, timestamps, and the "today" used to judge whether evidence is fresh.**

**The third is the point.** One of the system's core business rules is whether a piece of evidence is stale, computed as **today minus the page's published date, compared against the freshness window for that kind of claim.** **So time is a business input, not environmental noise.**

**Not injecting the clock has two consequences.**

**First, time-bomb tests**: a case asserting "a price within thirty days is valid" **goes red on its own a few months later** — the nastiest kind of flakiness.

**Second, the suite cannot be fast**: timeout and budget cases would have to **sleep for real**, so a one-second timeout costs a second. **Four hundred tests in 1.5 seconds depends on the fake clock.**

**The fake clock turns "wait thirty seconds" into an assignment.** Note that `advance` rejects negatives with **"a clock cannot go backwards"** — **an invariant expressed as behaviour.**

## How to verify the 461

Collection-only reports **464**, across **17 test files**. The largest are **the orchestrator and research**, at ninety-odd and sixty-odd, **a third of the suite between them** — and those are exactly the most complex, most error-prone parts of the system. **The distribution is itself information.**

**State the definition unprompted; this is the easiest thing to be caught on**: the resume's **461 is the passed count, not the collected count. Collection is 464, and the 3 missing are skips.** The skips are always the same batch — **database reconnection tests, skipped unless a reachable PostgreSQL exists.**

**The passed count is the better definition to use**: 461 actually ran and went green, **with no "collected but not executed" gap.** But still volunteer that the suite is 464 total and **the other 3 are conditionally skipped database reconnection tests, not failures.** **Being unable to say that makes the number look invented.**

**One more thing about the suite's shape**: it is not a strict unit/integration split, **it is behaviour tests per module**, each exercising real classes and real control flow with only the process exit scripted. **Asked "how are your tests layered", this is a more honest answer than forcing the test pyramid onto it.**

## Settle the ambiguity in "end to end" first

**The correct reading is "the whole suite runs in about 1.5 seconds".** Grammatically it follows "461 pytest tests" and modifies those tests.

**But in engineering usage the phrase normally means an end-to-end flow**, so it is easily heard as "a six-stage pipeline completes in about a second". An interviewer reading it that way will ask **"a second for six stages? What about the model calls?"** — **you have to recognise instantly which one they mean.**

**To remove the ambiguity, change `end to end` to `in`**: 461 pytest tests **in** 1.5 seconds.

## Four definitions behind the timing number

**Which command.** `cd server` and run `pytest`; the project config already sets the defaults, **so no flags are needed.**

**Serial or parallel.** **Serial, single process.** The evidence is that the dev dependencies are pytest, `pytest-asyncio` and a linter — **no `pytest-xdist`.** **This helps rather than hurts**: 1.5 seconds is four hundred cases in one process, **not eight processes stacked up**; **being that fast without parallelism proves the speed comes from having no IO waits, not from concurrency.**

**Does it include collection?** pytest's own 1.5 seconds covers **collection plus execution**, and **excludes** interpreter startup, module import and package-manager overhead. Wrapping the whole command in `time` gives **just over two seconds**, covering everything. **The resume prints pytest's number**, and you should be able to say which one you are quoting. **Prefer pytest's, because it is comparable**: package-manager startup differs by machine, but the suite's execution time does not.

**Which machine.** A 16 GB MacBook Pro. **And volunteer this: the number is insensitive to the machine**, because it is pure CPU with **no IO waits at all** — elsewhere it might be 0.9 seconds or 2 seconds, **but never 30.**

**That insensitivity is itself the argument** — if one real network call still lurked in the suite, **a change of machine or network would move the time by an order of magnitude.** Holding at seconds **is what shows the IO was genuinely removed.**

## Why it is this fast

**Item by item, each mapping to one seam:**

- **No network round trips** — the fake HTTP transport. Without it, hundreds of milliseconds per fetch and **tens of seconds across dozens of pages.**
- **No real waiting** — the fake clock. The fetch module waits a second between requests to a host, **and timeout cases would wait out their full timeout.**
- **No model calls** — the scripted model client. A single call is seconds, **enough on its own to push the suite into minutes.**
- **No embedding model load** — the hashing-trick fake embedder. **Loading real weights is seconds to tens of seconds.**
- **No database round trips** — those 3 skipped cases.

**The fake embedder deserves particular note**: it hashes tokens into fixed buckets and normalises, producing deterministic vectors, **so the heavyweight embedding library is never imported during the test run.** **That is not only faster, it also frees the tests from depending on model weight files existing.**

## What the number actually means

**It does not say "our tests are fast", it says "our dependency isolation is complete".**

The reasoning is simple: **miss any one of those four kinds of IO and the time jumps by an order of magnitude.** One missed network call is seconds to tens of seconds; one missed real wait accumulates by the second; one missed model call is minutes.

**So 1.5 seconds is a proof, not an achievement. What it proves is that no test path sneaks out of the process.**

## The only number that can be verified on the spot

The other numbers live on a company intranet, need a particular environment, or come from someone else's system. **This one does not**: clone the repository, install, run one command, **and in a second the interviewer sees it — no API key, no network.**

**Volunteering that has more effect than the number itself**: the repository is public, `cd server` and run `pytest`, no keys and no network required, **you can verify it right now.**

**A number that can be verified on the spot raises the credibility of every other number you quoted.**

## Self-check

1. Can you define a seam, and name where all four are?
2. Can you explain how seam placement decides how much real code is exercised, and give the wrong version?
3. Can you say when to use an ABC, a Protocol, and a replaced transport?
4. Can you explain why the clock is a business input rather than environmental noise?
5. Can you volunteer that 461 is passed, 464 is collected, and 3 are conditionally skipped?
6. Can you settle the ambiguity in "end to end"?
7. Can you state that the 1.5 seconds is serial single-process, pytest's own figure, and machine-insensitive?
8. Can you make the argument that the second is a proof, not an achievement?
