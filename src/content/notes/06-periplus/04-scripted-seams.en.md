---
title: "④ Scripted seams and 461 tests"
section: Periplus
---

# ④ Scripted seams and 461 tests

> **Resume line**
>
> **Put a scripted seam behind every external dependency** — the model provider, search, **httpx** page fetch and the clock — so the whole system runs with **no API keys and no network**: **461 pytest tests, 1.5 seconds end to end**.

Re-measured locally on 2026-08-27: the run reports 461 passed, 3 skipped, in 1.37 seconds, and collection alone finds 464. The 461 on the resume is the passed count, excluding the 3 skips; the 1.5 seconds is the whole wall-clock round including collection, serial and single-process.

## What this line has to show

This is the best-evidenced of the Periplus lines: the code is on the machine and an interviewer can run it themselves on the spot.

But the numbers are only the surface. What it is really about is how an AI system gets a full test suite that needs no API keys and no network — and the core of that answer is that the seam goes as close to the process boundary as possible.

## The problem

Testing an AI system has a fundamental difficulty: everything it depends on is non-deterministic.

The model can return different results for the same input twice, and the provider can silently change model versions. Search returns something different today and tomorrow. Web pages get redesigned and disappear. And time is different every run — while this system's staleness judgement consumes time directly.

Writing tests against the real dependencies means tests that go red at random — flaky tests — runs taking tens of seconds to minutes, money spent on every run, and everything failing in CI when there is no network.

So most AI projects choose either to write no tests, or to keep a few smoke tests for appearances. This line describes the other route: shut all of the non-determinism behind four replaceable openings.

## What a seam is

The term comes from *Working Effectively with Legacy Code*. A seam is a place where you can change a program's behaviour without editing the code at that place.

The technique is to put a seam at every point where bytes would leave the process: the real thing in production, a script in tests.

The four seams are exactly the four on the resume. The model seam calls the real API in production and a scripted client in tests, using an abstract base class with a single method overridden. The search seam is the same shape. The page-fetch seam replaces the HTTP client's underlying transport. The clock seam uses structural typing. There is also a fifth: deterministic embeddings made with a hashing trick.

## Which layer the seam sits at decides how much of the test is still real

This section is the technical core of the line, and answering it well wins the exchange.

The scripted model client overrides exactly one method: it records the request and returns the next scripted reply. It changes nothing else.

What is still running for real in the base class: prompt assembly, extracting JSON from the model's response, validating it against the data model, the repair-and-retry loop when validation fails, and recording every call as an audit entry with its token cost.

All of that still runs. The only thing replaced is the act of sending the request.

Compare the common mistake: replacing an agent-level object so it returns a fixed result. Then the test verifies that your fake returned what you put into it, and not one line of real logic is covered.

One sentence for the criterion: the seam goes as close to the process boundary as possible — the further out it is, the more real code the test still exercises.

Which is also why the evals module's comment says only the two seams that leave the process are replaced, so a case exercises the real orchestrator, agents, gates and budget accounting.

## The four seams use three different injection techniques

Being able to explain why these three places use different techniques is where the depth shows.

**An abstract base class with one method overridden**, used for the model and for search. This suits cases with a lot of real shared logic to preserve: the base class implements all the shared behaviour and the subclass only fills in how bytes leave.

**Structural typing**, used for the clock. The protocol declares two methods — current time and a monotonic reading. Python's structural typing does not require inheritance: having those two methods makes you a clock. Neither the real clock nor the fake clock inherits from it; they merely have the right shape. Why not an abstract base class here: the interface is two methods with no shared implementation, so forced inheritance would only add coupling. The rule of thumb is narrow interface with no shared logic means structural typing, wide interface with shared logic means an abstract base class.

**Replacing the transport layer**, used for page fetching, and this one is the neatest. What gets replaced is not the fetch function but the HTTP client's transport — the layer that actually puts bytes on the network.

So everything in the fetch module runs for real: parsing and honouring robots rules, allowing only one in-flight request per host, the delay between consecutive requests to the same host, streaming reads with a byte ceiling, redirect following, and preferring the cache over the network. Only the final act of opening a connection does not happen.

That is the value of a seam placed far enough out. If the fetch function itself were replaced, none of those six behaviours would be tested at all.

## Why even the clock is injected

The clock module's file header is blunt: nothing in the orchestrator calls the system clock directly.

Time has three uses here: the wall-clock budget for a run, assorted timestamps, and the "today" used to judge whether evidence is still fresh.

The third is the important one. One of this system's core business rules is whether a piece of evidence has expired, computed as today minus the page's published date compared against that claim type's freshness window. So time is itself a business input, not environmental noise.

Not injecting the clock has two consequences. First, time-bomb tests: write a case asserting that a price within thirty days is valid, and a few months later it goes red on its own — the most unpleasant kind of flaky failure. Second, tests cannot be fast: cases covering timeouts and budgets would have to really sleep, and a one-second timeout case costs a second. Four hundred-odd tests in one and a half seconds depends on the fake clock.

The fake clock turns "wait thirty seconds" into an assignment: the advance method adds that many seconds to both the current time and the monotonic reading. Note that it rejects negative values, with an error saying a clock cannot go backwards — a business invariant written into behaviour.

The one-sentence answer: because time is not environmental noise, it is a business input. This system decides whether evidence is fresh from the current time minus the page's publication date. Without injecting the clock, the tests become time bombs that go red months later on their own, and testing timeouts and budgets requires real sleeping, so the suite could never run in a second.

## How to verify the 461

Collection alone finds four hundred and sixty-four cases across seventeen test files. The largest are the orchestrator and retrieval, in the nineties and sixties respectively, together a third of the suite — and those two are exactly the most complex and failure-prone parts of the system, stage orchestration with gates, and fetching with deduplication. The distribution is itself information.

State the definition yourself, because this is the easiest place on this line to be caught: the 461 on the resume is the passed count, not the collected count. Collection is 464, and the difference is 3 skips. The skipped three are always the same: the database reconnection tests, skipped on the condition that a reachable PostgreSQL is available.

Reporting the passed count is the better definition to defend: 461 is what actually ran and went green, with no gap between collected and executed. But still be able to volunteer that the suite has 464 cases and the other 3 are conditionally skipped database reconnection tests, not failures. Fumbling that makes the number look invented.

A word on the composition too: this is not a strict unit/integration split, it is closer to behavioural testing by module, where every case runs the real classes and the real control flow and only the act of leaving the process is scripted. When asked how the tests are layered, that answer is more honest than forcing it into the testing pyramid.

## Settle the ambiguity in "end to end" first

The correct reading is that the whole test suite runs start to finish in about a second and a half. Grammatically it follows "461 pytest tests" and modifies those tests.

But in engineering conversation the phrase usually means an end-to-end flow, and it is easily heard as "one six-stage pipeline run completes in a second". If the interviewer takes it that way they will ask how six stages complete in a second and what about the model calls — so recognise immediately which one they are asking about.

To remove the ambiguity, the resume could say "461 pytest tests in 1.5 seconds" instead.

## Four definitions behind the timing

**Which command.** Run pytest from the server directory; the project config already sets the default arguments, so no flags are needed.

**Serial or parallel.** Serial, single-process. The evidence is that the dev dependencies contain only pytest, async test support and the linter — no parallel plugin is installed. That is actually a point in its favour: a second and a half is four hundred-odd cases run serially in one process, not eight processes stacked up. Being that fast without parallelism shows the speed comes from having no IO waits rather than from concurrency.

**Does it include collection.** The 1.5 seconds pytest reports includes collection plus execution, and excludes interpreter start-up, module imports and the package manager's own overhead. Wrapping the whole command in `time` measures a little over two seconds and includes everything, from pressing enter to getting the prompt back. The resume prints the number pytest reports, so be able to say which one it is. Report pytest's number, because it is comparable: another machine has different package manager start-up overhead, but the suite's execution time is comparable.

**Which machine.** A MacBook Pro with sixteen gigabytes of memory. And volunteer the follow-up: this number is insensitive to the machine, because it is pure CPU work with no IO waits. Another machine might give nought point nine seconds or two seconds, but never thirty. That insensitivity is itself the argument — if any real network call remained in the suite, changing the machine or the network would move the time by an order of magnitude. Staying in the low seconds is what proves the IO is genuinely gone.

## Why it can be this fast

Item by item, and each maps to one of the seams.

Network round trips are gone because of the fake HTTP transport; without it, each page fetch is hundreds of milliseconds and dozens of pages is a dozen seconds. Real waiting is gone because of the fake clock; the fetch module waits a second between requests to the same host, which alone would be painful, and timeout cases would have to wait in full. Model calls are gone because of the scripted client; one model call is seconds at minimum, and that item alone would push the suite into minutes. Loading the embedding model is gone because of the hash-based fake embeddings; loading real model weights takes seconds to tens of seconds. Database round trips are gone because those three cases are skipped.

The fake embeddings deserve a note: they hash tokens into fixed buckets and normalise to produce deterministic vectors, so the heavyweight embedding library is never imported during the test run at all. That is not only faster — it also means the tests do not depend on model weight files existing.

## What the number actually means

It is not saying our tests are fast. It is saying our dependency isolation is complete.

The reasoning is simple: with those four kinds of IO, missing any single one moves the time by an order of magnitude. A missed network call is seconds to tens of seconds. A missed real wait accumulates by the second. A missed model call is minutes.

So the second and a half is a proof, not an achievement. What it proves is that no test path quietly leaks out of the process. The first half of this note describes the structure — four seams; this half shows the structure has no holes.

## The one number that can be verified on the spot

Every other number is either behind a corporate network, needs a particular environment, or is somebody else's system's definition. This one is different: an interviewer clones the repository, installs dependencies, runs one command, and sees the result a second later — no API key, no network.

Raising that yourself does more than the number does: the repository is public, run the tests from the server directory, no keys and no network required, you can verify it right now.

A number that can be verified on the spot raises the interviewer's trust in every other number at the same time.

## Wording to get right

Three things people say wrong. Stub, fake and mock are distinct: a stub returns a hard-coded value, a fake is a working simplified implementation — the fake clock is a fake — and a mock also asserts how many times it was called. Being able to separate them earns credit. The core criterion is: the seam goes as close to the process boundary as possible, and the further out it is, the more real code the test still exercises. And "the second is evidence that no test path leaks out of the process, not a performance claim".

## The 30-second answer

> The hardest thing about testing an AI system is that everything it depends on is non-deterministic: the model returns different results, search and web pages change daily, and time is different every run. So I put a seam at every point where bytes would leave the process — the model, search, page fetching and the clock — with the real thing in production and a script in tests. What matters is where the seam sits: the scripted model client only overrides the method that sends the request, so prompt assembly, JSON extraction, schema validation, the repair loop and cost accounting are all still running for real; and page fetching replaces the HTTP transport, so robots handling, per-host concurrency limits and redirect following are all genuinely tested. The criterion is that the seam goes as close to the process boundary as possible, because the further out it is, the more real code the test still exercises. The result is four hundred-odd tests in a second and a half, with no keys and no network. And that second and a half is evidence rather than an achievement: missing any one of those four kinds of IO would move the time by an order of magnitude.

## Self-check

1. Can you define a seam and name where each of the four sits?
2. Can you explain how the seam's placement decides how much real code is tested, and give the wrong version?
3. Can you say which injection technique suits which situation?
4. Can you explain why time is a business input rather than environmental noise?
5. Can you volunteer that 461 is passed, 464 is collected, and 3 are conditionally skipped?
6. Can you settle the ambiguity in "end to end"?
7. Can you say that the 1.5 seconds is serial and single-process, is pytest's own number, and is insensitive to the machine?
8. Can you make the argument that the second is a proof, not an achievement?
