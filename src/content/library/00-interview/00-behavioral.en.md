---
title: General behavioural interview
section: General interview
---

# Behavioural interview prep

> Written 2026-08-18. This is a **reference draft, not a final script** — everywhere it says
> `[only you can fill this in]`, I don't know the facts and I won't invent them for you.
> Everything else uses only facts already on the resume and things that are in your own code.
>
> The existing `Coreflow self-intro` note was for the 8/4 phone screen: tied to that company, and
> written long before the current resume. This one is the general base; layer the company-specific part on top of it
> before each interview.

---

## 0. Ground rules for behavioural rounds

- **Nobody asks about technology in the first ten minutes.** They ask: who you are, why you came, why you left, how you work with people. However thick your technical prep is, if these ten minutes collapse there is no later.
- **One structure per story**: Situation → Task → Action → **Result** → Reflection. Nine out of ten people die on Result — a long account of what they did, no statement of what came out of it.
- **Two minutes per story, maximum.** Finish and stop. Let them follow up. Someone who talks straight through looks like they can't read the room.
- **Never speak badly of anyone.** Past company, past colleagues, past manager — not one line. The way to talk about a former employer is facts plus your own judgement, with no emotional adjectives.
- **Say "I'm not sure" when you're not sure.** Australian interviewers have far less tolerance for making things up than you're used to; get caught once and the whole round is gone.

---

## 1. Self-introduction

### 30-second version (phone screen, HR opener)

I'm a full-stack engineer with about four years of commercial experience, mostly on consumer-facing
frontend and full-stack work. At Baidu I worked on products with over a hundred million daily users;
at BioMap I led the frontend architecture of the core product; most recently at an AI startup I owned
the real-time pipeline and the paid conversion path end to end. I finished my Master's in IT at UTS
this June. Over the past two years I've moved toward AI engineering — my latest project grounds every
LLM claim in a verifiable source quote and scores the whole pipeline against an offline golden set.
That's the kind of role I'm looking for now.

### 90-second version (opening of a full round)

Four parts, one sentence each. Do not expand:

1. **Who I am + the range of scale**: four years, from a product with over a hundred million daily users at a large company, to a seven-person early-stage startup, to owning a whole area remotely on my own.
   The range itself is the selling point — **a big company teaches you how not to break things, a small one teaches you how to finish them**.
2. **What I've been doing lately**: AI engineering. Not "I called an API", but turning unreliable model output into a system you can check and measure.
   The Periplus line works as is: evidence and judgment are separate stages, and citations and freshness are enforced in code rather than requested in a prompt.
3. **Why I'm good at this**: because I handled high traffic and production incidents at Baidu, so I know the distance between "it runs" and "it can ship".
   That is exactly what AI systems are short of — most people stop at the demo.
4. **What I want**: one sentence about this company's direction. [only you can fill this in: rewrite per company]

---

## 2. The four things on your timeline that will always be asked

The interviewer has one sheet of paper, and they will read the dates back at you. **All four need a prepared answer. Do not improvise these.**

### ① The fifteen months from October 2022 to January 2024

`[only you can fill this in]` I don't know what happened here, and I won't invent it.

**Skeleton of the answer** (just drop the facts in):
> During that period I was [doing what]. I didn't look for the next job straight away because [reason].
> In that time I [something concrete and verifiable]. Looking back, [what it gave me / what I'd change].

**Three rules**:
- **Do not apologise.** Don't say "unfortunately I wasted that time." Gaps are extremely common in the Australian market; it's the defensive posture that looks suspicious.
- **Give one concrete fact**, however small: studying for an exam, learning something, family, health, preparing a study application, the pandemic. Concrete always beats "getting myself back on track".
- **Land back in the present**: one sentence saying that where you are now is stable and you can commit long term.

### ② 10 months at Baidu, 7 months at BioMap — both under a year

This one always comes up, and it is a probe for "will you leave again".

**Skeleton of the answer**:
> Baidu ended because [reason — only you can fill this in]. BioMap ended because [reason — only you can fill this in].
> Neither was about not getting on with people, and neither was about not being able to do the work — at Baidu I was the first person to trace that P2 white-screen incident,
> and at BioMap I was the one leading the architecture. After that I left to do my Master's, which had been planned all along,
> so the length of those two roles was cut by the study timeline, not by restlessness.

**The key move**: attribute "short" to **an explainable external timeline** (the degree), and pin down any doubt about competence with two facts that say "I was the person responsible there".
If the real reason is something else, use the real one — but keep the structure: **reason + what I got done there + how stable I am now**.

### ③ Beyz ran from January to October 2024, and you started at UTS in August

Two months overlap, it's visible on paper, and you should not wait to be asked.

**Answer**:
> Beyz is a Canadian company and I worked remotely. Those two months at the start of semester did overlap; I finished the work and handed it over properly before I stopped —
> which is why that role ends in October and not August.

**If they push with "could you really do a full-time job while studying?"**: answer it head-on, don't argue. Explain how it actually worked (hours, how you set priorities),
then volunteer the evidence: what shipped in that period was the complete real-time pipeline and the paid path, not scraps of work.

### ④ The Master's finished in June 2026, and it's now August

A two-month gap. Not long, but have something to say.

**Answer**: since graduating I've been [working on Periplus / job hunting / [only you can fill this in]].
Periplus is usable as evidence directly — **code you're actively writing is the best possible proof of your state while job hunting**.

---

## 3. "Why the move into AI" — this is your central question

This question isn't asking about interest, it's asking about **credibility**: a frontend engineer of four years says he wants to do AI. On what basis?

**Don't answer**: "AI is the future", "I'm really interested in large models", "I've taught myself a lot of courses". Anyone can say those.

**Do answer** (three steps, one fact each):

1. **This isn't from zero, it's a continuation.** The real-time interview assistant I built at Beyz was already an LLM application — streaming recognition, tokens emitted one by one, usage-based billing, a state machine for concurrent generation. That's where I found the hard part isn't the model, it's **everything around the model**.
2. **So I went and built that "everything around it".** The whole of Periplus is about this: evidence separated from judgment,
   citations and freshness enforced by code rather than asked for in a prompt, run state persisted so a run resumes from where it stopped,
   and a replaceable seam behind every external dependency — which is why all 461 tests run through without an API key and without a network.
3. **What I bring is exactly what the field is short of.** I handled production incidents and high traffic on a product with over a hundred million daily users at Baidu,
   so I know what stands between "it works" and "I'd put my name on shipping it". AI teams have plenty of people who can build a demo; **there are far fewer who can turn the demo into a system that regresses, attributes, and can be debugged when it breaks** — that's me.

**Closing line** (this one is worth a lot):
> The work I least want to do is the "I changed the prompt and it feels better now" kind. So I built a golden set for my own project, and every change produces a metric-by-metric before/after table. That's how I understand the difference between AI engineering and AI tinkering.

---

## 4. STAR material — which story answers which question

**One story can answer several questions, but don't reuse the same one twice in the same interview.** Each row below is tagged with what it fits best.

| Material | One line | Best answer for |
|---|---|---|
| **Baidu P2 white screen** | The search page went white for a product with a hundred million DAU; I was the first to trace it to a Node version mismatch that regenerated the lockfile and pulled in a breaking minor upgrade, then pushed for version pinning and a pre-release check | Pressure / initiative / what you learned from a failure (at the process level) / how you debug something nobody knows the cause of |
| **Baidu Webpack 3→5** | A dozen-plus incompatible packages, a staged migration, a shared runtime extracted and persistent caching turned on: bundle -15%, local build -70% | Long-term tech debt / how you persuade a team to invest in something with no direct business value / how you break down a large task |
| **Baidu withdrawals at 2000 QPS** | A request lock plus a defensive fallback: not a cent lost at peak | Risk awareness / how you choose between correctness and speed / the most cautious decision you've made |
| **Baidu virtualized list** | I wrote useVirtualList myself: DOM from 500+ down to around 20, scrolling from 30 FPS to a stable 60 | The technical work you're proudest of / how you quantify an experience problem |
| **BioMap ESLint boundaries** | A custom lint rule turned module boundaries into a check that fails, instead of a convention in a document | How you drive team standards / what you do when you disagree with a colleague / how you influence people who don't report to you |
| **BioMap TanStack Query, three layers** | API functions → a queryOptions factory → typed hooks, one cache key, mutation-driven invalidation, and no second detail request after a successful prefetch | Architecture decisions / why this design rather than something simpler |
| **Beyz real-time pipeline** | Tab audio → WebSocket → streaming recognition → an end-of-utterance event as the trigger → tokens streamed back one at a time | The most complex thing you've built / owning something end to end |
| **Beyz: entitlements written only by webhook** | A user landing back on success_url is not the same as money arriving; the only trustworthy source of truth is the signed event | How you handle a design that looks like it works but isn't right / choosing correctness first |
| **Beyz: an email service and the repo's first CI, both unasked for** | Nobody asked; I saw that the scheduled job needed a long-running process and split it into its own service, then added the repo's first CI gate on the way past | Initiative (the best one you have) / how you find work when nothing is assigned |
| **Periplus: evidence separated from judgment** | The stage that produces evidence is not the stage that rules on it, and the separation is enforced by code rather than by prompt | System design / how you handle unreliable input |
| **Periplus golden set** | Brief, corpus and clock all frozen; assertions on ranges rather than literal output; a before/after for every change | How you know your change made things better / quality mindset / something you learned recently |
| **WinterFell: fog froze a whole frame** | Every palette change stalled one frame; I traced it to the fog object being rebuilt because it was declared in JSX — and fog is part of a material's program key, so every material in the scene recompiled inside that one frame | **"Tell me about a bug you caused yourself"** / how you test a hypothesis (I wrote a probe that counted newly created pipelines per frame) |
| **WinterFell: what instancing cost** | Merging into two InstancedMeshes took draw calls from 129 to 76, at the cost of losing per-instance frustum culling | How you volunteer the downside of your own design / trade-offs |

**Note on the two WinterFell rows**: you **measured those yourself, with your own tools**, which makes them the most credible things you have. For "how did you verify that?" questions in a behavioural round, they're the hardest evidence available.

---

## 5. Skeletons for the frequent questions

### "Tell me about a disagreement with a colleague"
**Don't** turn it into "and in the end I was proved right". That's the worst version.
**Skeleton**: what the disagreement was → I first went and understood their reasoning (this step is mandatory) → what evidence I brought, rather than what attitude → what the conclusion was (**it can be that they convinced me — that scores higher, not lower**) → what rule we set afterwards.
**Material**: the BioMap ESLint boundaries. Core sentence: **"I didn't want the boundary to depend on me repeating myself in code review, so I turned it into a check that fails."**

### "Tell me about a failure / a mistake you made"
The easiest question to fake. **It has to be your own mistake — not someone else's, not the environment's.**
**Use the WinterFell fog bug**: I wrote it (fog declared in JSX, so the object was rebuilt on every palette change),
the symptom was a full frame stalling on every palette switch, my first suspicion was wrong, and I only confirmed it with a probe counting how many pipelines were created per frame.
The lesson: **in a declarative framework, something that "looks like it's just describing state" may be rebuilt every frame — and it may be hanging off somebody else's cache key.**
**Second choice**: the Beyz Stripe webhook has no event-id dedupe table; it relies on convergent writes (each event sets the target state).
That's an honest "I know it isn't strict enough and I haven't fixed it yet" answer, which beats inventing a story that ends perfectly.

### "What's your biggest weakness"
**Don't** use a strength in disguise ("I'm too much of a perfectionist"); they hear that eight times a day.
**Skeleton**: a real weakness that isn't fatal for this role + the concrete action you're already taking + visible progress.
**Real material you have**: testing. Neither of your commercial repos (beyz-web / beyz-server) has a test file. That's a fact.
You can say: I used to put delivery speed ahead of tests, and in those two Beyz repos I only added CI for lint/typecheck/build, no tests.
Later, on Periplus, I did it the other way round — every external dependency became a replaceable seam first, so 461 tests run offline in about a second and a half.
**Why this answer works**: it's true, it has evidence of improvement, and it walks the conversation onto your strongest bullet.

### "Why do you want to work here"
`[only you can fill this in — rewrite for every company]`
**Skeleton**: one concrete thing they're doing (product / technology / open-source repo) → what it lines up with in my own work → what I'd bring in.
**Red line**: never say "your company is a big platform" or "I'd learn a lot". When a candidate says "I'd learn a lot", it sounds like "I'm here to consume your resources".

### "Where do you see yourself in three to five years"
**Skeleton**: deeper, not wider — keep working at the AI systems-engineering layer (evaluation, reliability, cost, attribution),
moving from "I can build the system" to "I can define a team's quality bar". **Don't say you want to move into management**, unless the role points that way.

### "How do you handle pressure / deadlines"
Use the Baidu white-screen story. **The point isn't "I cope with pressure", it's "the order in which I act under pressure"**: stop the bleeding first (roll back / degrade), then find the root cause,
and once you have it, turn it into process immediately (version pinning, a pre-release check) so there is no second time.

### "How do you work with non-technical people"
`[only you can fill this in — do you have a concrete product/design collaboration story]`
General point available to you: the MSW mock layer — **it lets frontend delivery stop depending on backend progress**, which is really about unblocking collaboration.

---

## 6. Questions you must ask back (having none reads as not caring)

**Keep three or four ready, and pick by who's in front of you:**

**For an engineering lead / technical interviewer**
1. How do you currently tell whether a prompt or model change made things better or worse? Is there an offline evaluation, or does someone eyeball it?
   (**This is your home ground** — whatever they answer, you have the Periplus approach to follow with)
2. When something breaks in production, how long does it usually take to go from a user report to knowing which stage failed?
3. In the first three months, what would you want this person to have got done?
4. Where are code review and testing right now? Which gates does CI enforce?

**For HR / the hiring manager**
5. How big is the team now, and is this role backfilling or growing it?
6. What are the next steps, and roughly what timeline?

**Never ask in a first round**: salary, overtime, whether you can work remotely, whether there's sponsorship (sponsorship has its own handling, below).

---

## 7. Three practical questions you must answer

### Visa
`[only you can fill this in: what visa you hold, how long your work rights run, whether you need sponsorship]`
**Rule**: one sentence, clear, **don't expand and don't sound anxious**.
Australian employers ask this because the process requires it, not to trap you. It's vagueness that puts them on alert.
If you do need sponsorship, the right moment is **when they ask** or **when the process reaches offer discussion** — not thrown out by you in the first round.

### Salary expectations
`[only you can fill this in: your range]`
**Rules**: give a range, not a number; ask for their band first ("what's the budget range you have for this role?");
if you have to go first, give a market range you've actually researched and add "I'm flexible on the overall package".
**Don't** say "salary isn't important to me".

### Start date
`[only you can fill this in]` If you have a date, give the date. "Any time" sounds desperate; "two weeks" is the safest default.

---

## 8. Red lines — don't say any of these

- **Don't present the two teaching projects (concept-tracker / job-tracker) as work experience.** They are self-built learning projects; say so yourself.
- **Don't claim you've written a lot of tests with Jest / Vitest** — there are no test files in either commercial repo, and that's checkable. Keeping them in the skills row is fine; turning it into "I've written a lot of tests" is not.
- **Don't invent numbers for Beyz.** All that period can report is the 250ms slices, the 60-second key TTL, utterance_end at 2000ms, and a four-message history window. Nothing else has a benchmark behind it.
- **Don't comment on people at a former employer.**
- **Don't volunteer a weakness before you're asked** — honesty is not the same as dismantling yourself. Answer when asked, and follow it with the action you took.
- **Ask when you don't understand.** In an Australian interview, "Could you clarify what you mean by X?" scores points; answering confidently in the wrong direction loses them.

---

## 9. Scan this page 30 minutes before the interview

- The 30-second self-intro, out loud, once in Chinese and once in English
- The four timeline traps, one sentence each
- "Why the move into AI", three steps, one sentence each
- Pick 4 rows from the STAR table for today; check they don't overlap
- Pick 3 questions to ask back; write them on paper
- Visa / salary / start date, one sentence each
