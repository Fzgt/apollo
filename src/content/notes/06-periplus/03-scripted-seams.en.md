---
title: "③ Scripted seams and 461 tests"
section: Periplus
---

# ③ Scripted seams and 461 tests

> **Resume line**
>
> **Put a scripted seam behind every external dependency** — the model provider, search, **httpx** page fetch and the clock — so the whole system runs with **no API keys and no network**: **461 pytest tests, 1.5 seconds end to end**.

> ✅ **Re-measured locally on 2026-08-27**: `uv run pytest` prints `461 passed, 3 skipped in 1.37s`, and `--collect-only` collects 464. The 461 on the resume is **the passed count**, excluding the 3 skips; the 1.5 seconds is the whole wall-clock round including collection, serial and single-process.

## What this bullet is about

⭐ **This is the best-evidenced of the three** — the code is on this machine, you can point at line numbers, **and the interviewer can run it themselves on the spot.**

**But the numbers are only the surface. What it really says is: here is how an AI system gets a full test suite with no API keys and no network** — and the core of the answer is one sentence in section 3: **put the seam as close to the process boundary as possible.**

## 1. The problem

**Testing an AI system has one fundamental difficulty: everything it depends on is non-deterministic.**

| Dependency | Why it cannot be tested against directly |
|---|---|
| **The model** | The same input can give different results on two calls; providers also swap model versions quietly |
| **Search** | What it returns today is not what it returns tomorrow |
| **Web pages** | They get redesigned or 404 at any moment |
| **Time** | `now()` differs every call — **and this system's staleness decisions consume time directly** |

**Writing tests against the real dependencies gives you**: tests that **go red at random** (called **flaky tests**), runs taking tens of seconds to minutes, **money spent on every run**, and a total failure in CI when there is no network.

> **So most AI projects choose either to write no tests, or to keep a couple of smoke tests for appearances.**
>
> **This bullet describes the other road — locking all the non-determinism into four replaceable openings.**

## 2. What a seam is

**Where the term comes from**: Michael Feathers, *Working Effectively with Legacy Code*.

> **A seam is a place where you can change a program's behaviour without editing the code at that place.**

**The practice: put a seam at every point where bytes leave the process** — **the real thing in production, a script in tests.**

**Four seams, exactly the four the resume lists:**

| Dependency | Production implementation | Test implementation | Injection technique |
|---|---|---|---|
| **The model** | Really calls the API | `ScriptedClient` | Abstract base class, **overriding one method only** |
| **Search** | Really calls the search service | `ScriptedSearch` | Abstract base class |
| **Page fetch** | Really sends HTTP | **A fake transport layer** | **Swap the HTTP client's underlying transport** |
| **The clock** | Really reads system time | `FakeClock` | **Structural typing** |

(There is a fifth: `ScriptedEmbeddings`, deterministic vectors made with a hashing trick.)

## 3. ⭐ The crucial point: which layer the seam sits at decides how much reality the test retains

**This section is the technical core of the bullet; answer it and you have won.**

Look at the scripted model client (`llm/scripted.py`):

```python
class ScriptedClient(LLMClient):
    """按顺序返回排好的回复。"""
    async def _chat(self, messages, policy, *, json_object) -> RawResponse:
        self.requests.append(list(messages))     # record what it was asked
        ...
        return RawResponse(text=reply, ...)      # return the scripted reply
```

> ⭐ **It overrides `_chat` and nothing else.**

**And the base class owns all of this** (the file header of `llm/base.py` states it directly):

- Prompt assembly
- **Extracting JSON** from the model's reply
- **Validating the shape against the data models**
- The **repair-and-retry loop** after a validation failure
- Recording each call as an audit entry and computing its token cost

> ⭐ **All of that still really runs. The only thing replaced is the act of putting the request on the wire.**

**Compare the common mistake:**

```python
# ❌ substituting at the agent layer
mock_research_agent.run.return_value = fake_claims
```

**A test like that verifies that "my fake object returned what I put into it" — it covers not one line of real logic.**

> ⭐ **The rule in one sentence: put the seam as close to the process boundary as possible. The further out it is, the more real code the test exercises.**
>
> Which is also why the comment in the evals module reads *"Only the two seams that leave the process are replaced, so a case exercises the real orchestrator, agents, gates and budget accounting"*.

## 4. The four seams use three different injection techniques

**Being able to explain why these three places use different techniques is where the depth shows.**

### Technique 1: an abstract base class with one method overridden (model, search)

**Suited to "there is a lot of real shared logic to preserve".** The base class implements all shared behaviour and the subclass fills in only "how the bytes go out".

### Technique 2: structural typing (the clock)

```python
# orchestrator/clock.py:16-19
class Clock(Protocol):
    def now(self) -> datetime: ...
    def monotonic(self) -> float: ...
```

**`Protocol` is Python's structural typing** — it does not require you to inherit from it; **having those two methods makes you a Clock.**

> **Neither the real clock nor the fake clock inherits from `Clock`. Merely looking like one is enough.**
>
> **Why a Protocol here rather than an abstract base class**: the interface has two methods and **no shared implementation at all**, so forcing inheritance would only add coupling.
>
> ⭐ **The test: narrow interface with no shared logic → Protocol; wide interface with shared logic → abstract base class.**

### Technique 3: swapping the transport layer (page fetch) — the neatest of the three

```python
# tests/test_retrieval.py:63
httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
```

**What is replaced is not the "fetch a page" function, it is the HTTP client's transport layer** — the layer that actually puts bytes on the network.

**So the entire body of logic in the fetch module really executes:**

- robots.txt parsing and compliance
- One in-flight request per domain
- The delay between consecutive requests to the same domain
- Streamed reading with a 2MB byte ceiling
- ⭐ **Redirect following** (even this behaviour is genuinely under test)
- Cache before network

**Only the final step of opening a network connection never happens.**

> ⭐ **That is the value of putting the seam far enough out**: replace the "fetch a page" function instead and **none of those six things is tested.**

## 5. ⭐ Why even the clock is injected (a frequent follow-up)

The file header of `clock.py` puts it plainly:

> *"Nothing in the orchestrator calls `datetime.now` or `time.monotonic` directly."*

**Time has three uses in this system:**

1. **The runtime budget** — how long a run may take
2. **Various timestamps**
3. ⭐ **The "today" used to decide whether evidence is still fresh**

**The third is the crucial one**: one of this system's core pieces of business logic is "**is this evidence stale**", computed as `today − the page's publication date > the freshness window for that class of claim`.

> ⭐ **Time is itself a business input, not environmental noise.**

**What happens without an injected clock:**

| Problem | Note |
|---|---|
| **Time-bomb tests** | Write a case asserting "a price within 30 days should be valid" — **it goes red on its own a few months later.** That is the nastiest kind of flaky failure |
| **The suite cannot be fast** | Cases testing timeouts and budgets have to **really sleep**. One case with a 1-second timeout costs a second — ⭐ **461 tests in 1.5 seconds depends on the fake clock by itself** |

**A fake clock turns "wait 30 seconds" into one assignment:**

```python
# clock.py:45-49
def advance(self, seconds: float) -> None:
    if seconds < 0:
        raise ValueError("a clock cannot go backwards")   # ⭐ a clock cannot run backwards
    self._now += timedelta(seconds=seconds)
    self._monotonic += seconds
```

> **Note that it rejects negatives** — **"a clock cannot run backwards" is a business invariant**, written into behaviour.

**The one-paragraph answer**

> "Because **time is not environmental noise, it is a business input**. This system decides whether evidence is fresh by subtracting the page's publication date from the current time. Without injecting the clock, **first the tests become time bombs** — a case green today goes red on its own in a few months; **second, testing timeouts and budgets means really sleeping, and the suite could never run in under a second.**"

## 6. How to verify the 461 (measured on 2026-08-27)

```bash
cd server && uv run pytest --collect-only -q
```

**Summed across 17 test files:**

| File | Count | | File | Count |
|---|---|---|---|---|
| `test_orchestrator.py` | **92** | | `test_media.py` | 21 |
| `test_retrieval.py` | **66** | | `test_models.py` | 20 |
| `test_evals.py` | 38 | | `test_editor.py` | 14 |
| `test_verification.py` | 35 | | `test_observability.py` | 13 |
| `test_research.py` | 35 | | `test_navigation.py` | 13 |
| `test_llm.py` | 32 | | `test_illustration.py` | 13 |
| `test_api.py` | 26 | | `test_embeddings.py` | 12 |
| `test_geo.py` | 22 | | `test_content.py` | 9 |
| | | | `test_postgres_reconnect.py` | 3 |

**Total = 464 collected**, and running it gives `461 passed, 3 skipped in 1.52s`.

### ⚠️ The definition changed, which is the easiest thing here to get caught on

**The 406 printed on v40 was the collected count; the 461 on v66 is the passed count. The two versions changed the definition, not just the number.**

| Version | Number on the resume | What it is | The other number in that version |
|---|---|---|---|
| v40 | 406 | collected | 403 passed |
| **v66** | **461** | **passed** | **464 collected** |

The 3 skips have always been the same batch: the database reconnection tests, skipped on the condition "**requires a reachable PostgreSQL**".

> **The v66 definition is actually easier to defend**: 461 is exactly "what really ran and went green", with no gap for "collected but not executed".
> **But you still have to volunteer the rest**: the suite has 464 in total, and the other 3 are **conditionally skipped** database reconnection tests, **not failures**.
>
> **Not being clear about this makes the number look invented.**

## 7. What the test breakdown says

**The distribution is itself information**: 67 for the orchestrator and 66 for retrieval, a third of the suite — **and those two are the most complex, most error-prone parts of the system** (stage orchestration and gates; fetching and deduplication).

**This is not a strict unit/integration split**, it is closer to **behaviour tests per module**: every case runs real classes and real control flow, **with only the step that leaves the process scripted.**

> **Asked "how are your tests layered", this answer is more honest than forcing it into the testing pyramid.**

---

## 8. First, settle an ambiguity: what `end to end` means

| Reading | What it means |
|---|---|
| ✅ **A** | **The whole test suite** runs start to finish in about a second |
| ❌ **B** | One six-stage pipeline **completes** in about a second |

**A is correct.** Grammatically it follows `461 pytest tests` and modifies those 461 tests.

> ⚠️ **But in engineering usage `end to end` usually means "an end-to-end flow", and it is easily heard as B.** An interviewer reading it as B will ask "the six stages complete in a second? what about the model calls?" — **you have to spot immediately which one they are asking about.**
>
> **To be clearer it could be written `461 pytest tests in 1.5 seconds`** — replace `end to end` with `in` and the ambiguity is gone.

## 9. The measured data (verified)

```bash
cd server && uv run pytest
```

```
461 passed, 3 skipped in 1.52s
```

**Wrapping the whole command in `time`:**

```
1.56s user  0.24s system  89% cpu  2.020s total
```

**Both numbers are correct but mean different things — which is exactly what an audit asks about.**

## 10. The four terms of this time figure

### ① Which command

`cd server && uv run pytest`. The project configuration already sets the default arguments, so no options are needed.

### ② Serial or parallel

**Serial, single process.**

**Evidence**: the dev dependencies contain only `pytest`, `pytest-asyncio` (async test support) and `ruff`, **with no `pytest-xdist`** (the parallel plugin).

> ⭐ **This actually earns credit**: **1.52 seconds is 461 cases in one serial process, not eight processes stacked up.**
>
> **Being that fast without parallelism shows the speed comes from having no IO waits, not from concurrency.**

### ③ Does it include collection time?

**That is where the two numbers differ:**

| Number | Includes | Excludes |
|---|---|---|
| **1.52s** (pytest's own figure) | **Collection plus execution** | Python interpreter startup, module imports, `uv`'s own overhead |
| **2.02s** (measured by `time`) | **Everything** — from pressing enter to getting the prompt back | — |

> **The "1.5 seconds" printed on the resume is pytest's own figure**, not the 2.02 seconds from `time`. **Be able to say which one you are quoting.**
>
> **Quote pytest's 1.52 seconds**, because it is **comparable** — `uv`'s startup overhead differs by machine, but the suite's own execution time carries across.

### ④ Which machine

This MacBook Pro (16 GB of memory).

**And volunteer one more sentence**: the figure is **insensitive to the machine** — because it is **pure CPU work with no IO waits at all.** On another machine it might become 0.9 seconds or 2 seconds, **but it will not become 30 seconds.**

> ⭐ **That insensitivity is itself the argument**: if a single real network call were still lurking in the suite, **a change of machine or network would move the time by an order of magnitude.** **Staying in the low seconds proves the IO really was cleaned out.**

## 11. Why it can be this fast

**Broken down item by item, each one maps to a seam from the first half:**

| What was removed | Which seam | How much slower without it |
|---|---|---|
| **Network round trips** | The fake HTTP transport | Hundreds of milliseconds per page; dozens of pages is a dozen seconds |
| **Real waiting** | The fake clock | The fetch module waits 1 second between requests to a domain — **that alone is painful**; timeout cases wait out the full duration |
| **Model calls** | The scripted model client | Seconds per call at minimum — ⭐ **this item alone drags the suite into minutes** |
| **Loading the embedding model** | Hash-trick fake embeddings | Loading real embedding weights takes seconds to tens of seconds |
| **Database round trips** | 3 cases are skipped | Connect, create tables, clean up |

> **The fake embeddings deserve particular note**: they produce deterministic vectors by **hashing words into fixed buckets and normalising**, so **the heavyweight embedding library is never imported during the tests at all.** **That is not only fast, it also frees the tests from depending on model weight files existing.**

## 12. ⭐ What the number really means

**It is not saying "our tests are fast", it is saying "our dependency isolation is complete".**

**The reasoning is simple: with four classes of IO, missing any single one moves the time by an order of magnitude.**

- One leaked network call → seconds to tens of seconds
- One real wait → seconds, accumulating
- One leaked model call → minutes

> ⭐ **So "a second" is a proof, not an achievement. What it proves is that no test path quietly slips out of the process.**
>
> **That is how the first half and this half become one argument**: **the first half describes the structure (four seams), this half shows the structure has no leaks.**

## 13. ⭐ The one number that can be verified on the spot

**Every other number is either on a company intranet, or needs a specific environment, or is defined inside someone else's system.**

**This one is different: the interviewer clones the repo, installs the dependencies, runs one command, and sees the result themselves a second later. No API key and no network.**

**Volunteering this has a much bigger effect than the number itself:**

> "The repo is public, `cd server && python -m pytest` runs it, **no keys and no network needed — you could verify it right now.**"

> ⭐ **One number that can be verified on the spot raises the interviewer's trust in every other number you gave.**

## Glossary

| 中文 | English |
|---|---|
| 接缝 | **seam** (*a scripted seam behind every external dependency*) |
| 替换点 | **substitution point** |
| 进程边界 | **process boundary** (⭐ *put the seam as close to the process boundary as possible*) |
| 打桩 / 假实现 | **stub · fake · mock** (three different things; see below) |
| 不稳定测试 | **flaky test** |
| 确定性 | **determinism** |
| 假时钟 | **fake clock** |
| 时间炸弹测试 | **time-bomb test** |
| 注入 | **inject · dependency injection** |
| 抽象基类 | **abstract base class** |
| 结构化类型 | **structural typing** (Python `Protocol`) |
| 传输层 | **transport layer** |
| 重定向跟随 | **redirect following** |
| 速率限制 | **rate limiting** |
| 收集到的用例 ↔ 实际执行 | **collected ↔ executed** (464 collected, 461 passed, 3 skipped) |
| 有条件跳过 | **conditionally skipped** |
| 串行 ↔ 并行 | **serial ↔ parallel** (`pytest-xdist`) |
| 端到端 | **end to end** (⚠️ here it means the whole suite, not one pipeline run) |

> ⭐ **The three easiest to get wrong**:
>
> 1. **The difference between stub / fake / mock**: a stub returns hard-coded values; **a fake is a working simplified implementation** (the fake clock is one); a mock also asserts how many times you called it. Being able to separate them earns credit
> 2. The core rule in one sentence: **"The seam goes as close to the process boundary as possible — the further out it is, the more real code the test still exercises."**
> 3. "The second is evidence, not an achievement" is **the second is evidence that no test path leaks out of the process, not a performance claim**
