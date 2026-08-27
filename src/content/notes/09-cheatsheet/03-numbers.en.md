---
title: Number audit (21 claims)
section: Cheat sheet
---

# Day 1 · Auditing every number

> This day has one purpose: **be able to answer "how did you measure that" for every number**. It is not self-censorship, it is preparing the wording.

## How to fill it in

For each of the 21 claims below, answer five questions:

1. Where does this number come from?
2. How was it measured — tool, environment, sample, baseline?
3. Did I measure it, did the team, is it product scale, or is it a benchmark result?
4. What time range and what definition does it cover?
5. Can it still be reproduced, or is there evidence to show?

Then tag each one:

`Directly measured by me` · `Team-measured` · `Product scale` · `Benchmark result` · `Needs rewording`

**Output for the day**: for every number, write down the source, the way it was measured, the scope it can be attributed to, and a one-line answer for when someone pushes. Anything that cannot be defended gets its wording changed that day — do not spend thirteen days rehearsing wording you are going to drop.

> **Aligned to resume v66 (2026-08-27).** The struck-through entries are numbers v66 removed from the resume. You still have to be able to answer them — removing a line does not stop anyone asking about the topic next to it.

## The table

| # | Number / claim | Where from | What to audit |
|---|---|---|---|
| 1 | 60-second, usage-scoped keys | Beyz credentials | Why 60 seconds; who mints them; expiry and renewal; what the scope restricts |
| 2 | ~~six subscription events~~ | Beyz Stripe | **Removed from the resume** (v66, 2026-08-27); the event model and "which six" still have to be answerable |
| 3 | ~~LCP under 500 ms~~ | BioMap | **Removed from the resume** (2026-08-20), replaced by `detail pages open instantly`; the analysis still has to be answerable |
| 4 | 5M+ daily page views | Baidu virtual list | Daily average PV or something else; platform figure or page figure |
| 5 | DOM nodes constant at ~100 | Baidu virtual list | How it was counted; does it change with viewport or overscan |
| 6 | 30 → 60 FPS | Baidu virtual list | Tool, device, interaction; is it a stable value |
| 7 | 2,000+ peak QPS | Baidu withdrawal | Peak or sustained; monitoring or load test; system scale vs my own implementation |
| 8 | ~~without a single dollar of financial loss~~ | Baidu withdrawal | **Removed from the resume** (2026-08-19); the topic still has to be answerable |
| 9 | 10+ incompatible packages | Baidu Webpack | Which kinds of problem; can I give 1–2 representative cases |
| 10 | ~15% bundle reduction | Baidu Webpack | Comparison scope, compression, build mode |
| 11 | 70% build-time reduction | Baidu Webpack | Cold or warm; local or CI; sample and machine |
| 12 | 30M+ DAU | Baidu white screen | Public product scale; must not be implied as my own result |
| 13 | First to diagnose | Baidu white screen | An attribution claim, and it gets pushed on like a number |
| 14 | 461 pytest tests | Periplus | ✅ Measured 2026-08-27: 461 passed / 464 collected. **Note that the 406 printed on v40 was the collected count and the 461 on v66 is the passing count — the definition changed** |
| 15 | 1.5 seconds end to end | Periplus | ✅ Measured 2026-08-27: pytest reports 1.52s, `time` reports 2.02s. The resume quotes the pytest figure; serial, single process, no xdist |
| 16 | golden set numbers | Periplus | ✅ Measured: 4 cases / 8 claims / 8727 tokens / 0.009s |
| 17 | 1,020 generated layouts | WinterFell | ✅ Reproduced by a real run on 2026-08-19: `--sections 20 --trials 51` = 1,020; 480 is only the script default. Raise it yourself that the last 3 sections have 0 obstacles, so the sections with content give 867 |
| 18 | 129 → 76 draw calls | WinterFell | Which probe; same scene and same device; the p50 filter condition |
| 19 | ~~2.6× triangles~~ | WinterFell | **Removed from the resume** (v66); the cost half of the sentence became plain language, but 26,230 → 69,112 still has to be answerable |
| 20 | ~~no gap narrower than 15 units~~ | WinterFell | **Removed from the resume** (v66, along with the random-scatter control group); the threshold still has to be answerable |
| 21 | twenty scenes | WinterFell | ✅ Measured 2026-08-27: the `SCENES` array has exactly 20 entries, one scene per 1,800 world units, and the last one does not loop |

---

## 1. 60-second, usage-scoped keys

**From**: Beyz credentials · ✅ done, full write-up in [#1 · 60-second temporary credentials](/docs?section=beyz&item=credential-quota)

Why 60 seconds and not 5 minutes? Who mints them (which server route)? How does the frontend renew after expiry? What exactly does the `usage:write` scope allow and forbid?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 2. ~~six subscription events~~

**From**: Beyz Stripe · ✅ done, full write-up in [#2 · six subscription events](/docs?section=beyz&item=stripe-billing)

> ⚠️ **v66 took this number off the resume** (along with tRPC and the typed server action). That line now only says no event can downgrade a lifetime purchase. **The question does not go away**: talking about a webhook writing entitlement means talking about which events exist, and what happens when they arrive out of order or twice.

Which six events? Can I name them on the spot? Which bit of entitlement does each one change? What happens if one is missed?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 3. ~~LCP under 500 ms~~ (removed from the resume)

**From**: BioMap TanStack Query · ✅ done, full write-up in [#3 · LCP under 500 ms](/docs?section=biomap&item=tanstack-query)

Which tool measured it (Lighthouse / WebPageTest / RUM)? Lab or field data? Which page, on what network? What was the baseline before the work?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 4. 5M+ daily page views

**From**: Baidu virtual list · ✅ done, full write-up in [#4 · 5M+ daily page views](/docs?section=baidu&item=virtual-list)

Is it daily average PV or something else? The whole platform or this page? How do I describe my own contribution without overstating it?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 5. DOM nodes constant at ~100

**From**: Baidu virtual list · ✅ done, full write-up in [#5 · DOM nodes constant at ~100](/docs?section=baidu&item=virtual-list)

How was it counted (DevTools Elements count / `document.querySelectorAll`)? Does the number move with viewport height or a different overscan setting?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 6. 30 → 60 FPS

**From**: Baidu virtual list · ✅ done, full write-up in [#6 · 30 → 60 FPS](/docs?section=baidu&item=virtual-list)

Which tool (Performance panel / FPS meter)? Which device, which interaction? Is 60 a stable value or a peak?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 7. 2,000+ peak QPS

**From**: Baidu withdrawal · ✅ done, full write-up in [#7 · 2,000+ peak QPS](/docs?section=baidu&item=withdrawal)

Peak or sustained? From monitoring or from a load test? Is that system scale or the part I implemented? Which layer did I measure — gateway, service, or frontend request count?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 8. ~~without a single dollar of financial loss~~ (removed from the resume)

**From**: Baidu withdrawal

**2026-08-19: the wording changed and this sentence is off the resume.** It was the hardest thing to prove — zero financial loss is a finance reconciliation conclusion, and the frontend cannot measure it. Who told you? Does it cover the campaign period or everything? Can you produce the reconciliation report? It was replaced by three provable actions: the request lock, the idempotency key, and treating uncertainty as failure. **The sentence is gone, the topic still comes up; the answer is in the write-up.**

✅ done, full write-up in [#8 · Zero financial loss (removed from the resume)](/docs?section=baidu&item=withdrawal)

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 9. 10+ incompatible packages

**From**: Baidu Webpack migration · ✅ done, full write-up in [#9 · 10+ incompatible packages](/docs?section=baidu&item=webpack-migration)

Which kinds of incompatibility (loader API changes / removed Node polyfills / plugins that were never updated)? Can I give 1–2 representative cases and explain how I tracked them down?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 10. ~15% bundle reduction

**From**: Baidu Webpack migration · ✅ done, full write-up in [#10 · ~15% bundle reduction](/docs?section=baidu&item=webpack-migration) · see also [SplitChunks in practice](/docs?section=baidu&item=webpack-migration)

What was compared (first-screen chunk / everything the build emits)? Was the compression the same on both sides (before or after gzip)? Production mode against production mode?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 11. 70% build-time reduction

**From**: Baidu Webpack migration · ✅ done, full write-up in [#11 · 70% build-time reduction](/docs?section=baidu&item=webpack-migration)

Cold build or warm build? Local or CI? How many runs, averaged? What machine? **This number most likely comes from a warm build with the filesystem cache — say so explicitly.**

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 12. 30M+ DAU

**From**: Baidu white screen

This is public product-scale data. How do I tell it **without implying it is my own achievement**?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 13. First to diagnose

**From**: Baidu white screen

This is an attribution claim, and it gets pushed on exactly like a number. Who else was investigating? What backs up "first" (ticket timestamps / chat history)? If it cannot be defended, change it to "I found the root cause".

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 14. 461 pytest tests

**From**: Periplus · ✅ done, full write-up in [#14 · 461 pytest tests](/docs?section=periplus&item=scripted-seams)

✅ **Measured 2026-08-27**: `uv run pytest` reports `461 passed, 3 skipped in 1.52s`, and `--collect-only` collects 464 (the sum over 17 test files; `test_orchestrator.py` went from 67 to 92, and `test_observability.py` added 13).

> ⚠️ **The definition changed, and this is the easiest place to get caught**: the 406 printed on v40 was the **collected** count (that version actually ran 403 passed), and the 461 on v66 is the **passing** count (464 collected). The 3 skips have always been the same database-reconnect tests, which need a reachable PostgreSQL — **they are not failures**.

**What still needs an answer is the mix of test types**: how many unit, integration and eval tests? Re-run `uv run pytest --collect-only -q` before the interview.

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 15. 1.5 seconds end to end

**From**: Periplus · ✅ done, full write-up in [#15 · about a second end to end](/docs?section=periplus&item=scripted-seams)

Which machine? Which command? Serial or parallel? Does it include collection time? Does "one second" mean the test suite or a single run?

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 16. golden set numbers

**From**: Periplus evals · ✅ done, full write-up in [#16 · golden set numbers](/docs?section=periplus&item=golden-set-evals)

✅ Measured: 4 cases, 8 claims, 8727 tokens, 0 citation failures, whole suite in 0.009s. **Do not inflate the case count — four is four.** Raise it yourself that this is a seed set, not a claim about coverage.

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 17. 1,020 generated layouts

**From**: WinterFell · ✅ done, full write-up in [#17 · 1,020 generated layouts](/docs?section=winterfell&item=level-fairness)

✅ **Measured (re-run 2026-08-19)**: `node bench/fairness.mjs --sections 20 --trials 51`, so 20 × 51 = **1,020**, and the report header says exactly `# Obstacle-layout fairness (51 generated layouts per section)`. **480 is the script default (12 × 40), not the resume figure** — the two do not contradict each other; the resume run passed the arguments explicitly.

The same run also reproduced the other two halves of this bullet: `Every layout sampled had a continuous path through it.`; across the sections with content the smallest Tightest gap is **15 units** (sections 3 and 10), so "no gap narrower than 15 units" holds; the random control group gives 1338 vs 1224 units.

**A limit I have to raise myself**: sections 17, 18 and 19 are the finish area, with 0 obstacles and a Tightest gap of Infinity — those 3 × 51 = 153 layouts are free. The ones with real content are 17 × 51 = **867**. Better to say it than to have someone work it out.

| Item | Fill in |
|---|---|
| Where the number comes from | The report header of `bench/fairness.mjs`, 20 sections × 51 layouts each |
| How it was measured (tool / environment / sample / baseline) | The script imports the real generator through the Vite dev server (it does not copy the logic), and sweeps step by step using the horizontal reach available at that level's speed; the baseline is a random-scatter control group at the same density on the same ground |
| Attribution (me / team / product scale / benchmark) | `Directly measured by me` |
| Time range and definition | Two runs on 2026-08-17, one re-run on 2026-08-19, same conclusion; the figure counts generated layouts, including the 3 empty sections at the end |
| Can it be reproduced, where is the evidence | Yes — `npm run dev`, then `node bench/fairness.mjs --sections 20 --trials 51` |
| **Tag** | `Directly measured by me` |

**One-line answer when pushed**

> I did not get that from playing it, I measured the generator itself: 20 sections, 51 layouts each, 1,020 in total, stepping through and asking "at this level's speed, can the ship move sideways far enough to get past". Every one had a continuous path, the tightest gap across the sections with content is 15 units, and I compared it against random scatter at the same density. The last three sections are the finish area with no obstacles, so the ones with real content are 867.


## 18. 129 → 76 draw calls

**From**: WinterFell · ✅ done, full write-up in [#18 · 129 → 76 draw calls](/docs?section=winterfell&item=instancing)

Which probe measured it? Same scene, same device? Be ready to explain why `bench/run.mjs:123` filters on `fps.p50 > 115`.

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 19. ~~2.6× triangles~~

**From**: WinterFell · ✅ done, full write-up in [#19 · 2.6× triangles](/docs?section=winterfell&item=instancing)

> ⚠️ **v66 took this number off the resume**, and the cost half of the sentence became "obstacles off screen can no longer be skipped one by one". **The question does not go away**: the moment you say draw calls went from 129 to 76, "and what did that cost" follows, and 2.6× the triangles is the answer.

Why did the triangle count go *up* (26,230 → 69,112)? How does that relate to the drop in draw calls? What did it do to the actual frame rate? **The value of this one is that it is a number moving the wrong way — better said than extracted.**

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in


## 20. ~~no gap narrower than 15 units~~

**From**: WinterFell · ✅ done, full write-up in [#20 · no gap narrower than 15 units](/docs?section=winterfell&item=level-fairness)

> ⚠️ **v66 took this threshold off the resume together with the random-scatter control group**, and that line now only says every layout has a path through it. **The question does not go away**: what decides that a path exists, and the answer is this threshold.

What is a "unit" in this game? How was the threshold of 15 chosen? How does it relate to the ship's collision radius? (Note: the earlier "14 units" was **reading the wrong column** — 14 came from "how wide", and the measured value is 15–20.)

| Item | Fill in |
|---|---|
| Where the number comes from | |
| How it was measured (tool / environment / sample / baseline) | |
| Attribution (me / team / product scale / benchmark) | |
| Time range and definition | |
| Can it be reproduced, where is the evidence | |
| **Tag** | `Directly measured by me` / `Team-measured` / `Product scale` / `Benchmark result` / `Needs rewording` |

**One-line answer when pushed**

> to fill in

---

## Closing out the day

- [ ] All 20 items tagged
- [ ] For everything tagged `Needs rewording`, write down the fix
- [ ] Collect the wording changes into a v41 list
- [ ] Until v41 exists, do not rehearse the old wording

### Wording that has to change for v41

| # | Current wording | Problem | Change to |
|---|---|---|---|
| | | | |


## 21. twenty scenes

**From**: WinterFell (the opening bullet added in v66) · ✅ done, full write-up in [WinterFell project notes](/docs?section=winterfell&item=bloom-webgpu)

✅ **Measured 2026-08-27**: the `SCENES` array in `src/config/scenes.ts` has exactly **20** entries, from `Neon City` to `The Terminus`.
`SCENE_DISTANCE = 1800`, so the scene changes every 1,800 world units; `sceneAt()` clamps the last scene with `Math.min`, so **flying past the end does not loop — it stays on the final scene**.

The colour palettes are a separate thing: `LEVELS` in `src/config/levels.ts` has only **6** entries (Signal / Vapour / Circuit / Ember / Toxic / Nova).

> ⚠️ **Do not mix these two up**: **20 is scenes, 6 is palettes.** Switching palette is exactly what triggers the fog stall in [④ A frame-accurate hunt](/docs?section=winterfell&item=fog-freeze).

| Item | Fill in |
|---|---|
| Where the number comes from | `SCENES.length`, a source constant, not a runtime count |
| How it was measured (tool / environment / sample / baseline) | Counted the array directly; `SCENE_DISTANCE` sets the switching interval |
| Attribution (me / team / product scale / benchmark) | `Directly measured by me` |
| Time range and definition | `main` as of 2026-08-27 |
| Can it be reproduced, where is the evidence | Yes — `src/config/scenes.ts` |
| **Tag** | `Directly measured by me` |

**One-line answer when pushed**

> "The twenty scenes are a hard-coded constant, one every 1,800 world units, and once you pass the last one it stays there instead of looping. The thing people confuse it with is the palette, and there are only six of those."
