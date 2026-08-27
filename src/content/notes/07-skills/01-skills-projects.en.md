---
title: "The Go and Django teaching projects"
section: Skills row
---

# How the three words in the Skills row hold up

> 🔴 **Must read.** ⚠️ **The main material is [the Skills-row note in the Library](/library?section=skills&item=day13)** (338 lines: how to present all three, follow-ups with answers, the comparison table, and the framing for the four bare words). **This page gives the framing floor, how to spend the day, and one support table I verified myself.**

## ⚠️ The framing floor (establish this first; it matters more than anything else)

**`concept-tracker` and `job-tracker` are self-built teaching projects.**

| ✅ Say this | ❌ Never say this |
|---|---|
| "I wrote this project myself to learn Go / Django" | Presenting it as work experience |
| "Go has 16 tests, all green under `-race`; Django has 27 in 0.045 seconds" | **Inventing any performance number** |
| "I wrote them so the Skills row would line up with actual code" | Implying real users or scale |

> ⭐ **Volunteering "I wrote these so the Skills row lines up with code" earns credit** — it turns "he listed something he has not done" into "he knows where his gap is and he closed it".

## How to spend the day (four steps)

1. **Start both projects and click through them**: `make api` / `make web` (the Makefile targets are the same in both)
2. **Run each test suite once**: `make test-go` / `make test-py`. ⭐ **The measured figures: 16 Test functions in Go, 27 test methods in Django** — **quote nothing beyond those two**
3. **Practise the 90-second version once each from sections 1 and 4 of the Library note**
4. ⭐ **Section 6's comparison table must be reproducible from memory** — hand-written SQL in Go vs the Django ORM. **When pushed on the choice, that table is more convincing than any memorised answer**

## Each of the three in one line

| Skill | Project | In one line |
|---|---|---|
| **Angular** | Both projects' front ends are Angular 22 | Used in both, so the word has double support |
| **Go** | `concept-tracker/server` | **Hand-written SQL** — you know what every query looks like, at the cost of owning mapping and N+1 yourself |
| **Django** | `job-tracker/server` | **The ORM** — fast to write, migrations automatic, at the cost of not knowing what it did unless you read the generated SQL |

> **When asked "why hand-written SQL in one and an ORM in the other", the right answer is not "each has its merits", it is "I deliberately built the same kind of system both ways to feel that trade-off".**

## ⭐ The Skills-row support table (I checked each one against the code)

**This table is the guardrail that stops you falling over on the Skills row.**

| Word | Support | How to answer when pushed |
|---|---|---|
| **Playwright** | ✅ WinterFell's bench harness (five probes under `bench/*.mjs`) | Talk straight through how those probes measure draw calls and pipeline compilation |
| **Vitest** | ✅ **Used by Periplus's web (`vitest run`) and by Prometheus** | Supported; you can talk about it |
| **Jest** | ⚠️ **Only `@testing-library/jest-dom` — a matcher library, not Jest itself** | **This word has zero support.** If asked, say "what I actually use is Vitest, whose API is Jest-compatible" |
| **AWS** | ✅ **The Beyz mail service is deployed on EC2** | Walk through GitHub Actions → SSH → EC2 → docker-compose ([④ Deployment and CI/CD](/docs?section=beyz&item=service-cicd)) |
| **Jenkins** | ❌ No code on this machine | Conceptual: the difference from GitHub Actions is **self-hosted vs managed**, an older and broader plugin ecosystem, **but you maintain the agents yourself** |
| **MongoDB** | ❌ No code on this machine | Conceptual: the document model suits volatile schemas and nested read-heavy data; **the difference from the PostgreSQL I actually use is the lack of a strict schema and transactional guarantees** (though recent versions have multi-document transactions) |
| **Cloudflare** | ❌ No code on this machine | Conceptual: CDN + edge compute + DNS; **Workers are serverless at the edge, with faster cold starts than Lambda but a restricted runtime** |

### The rule for the three bare words (Library section 9)

> **Answer as far as "I know what problem it solves, when I would pick it, and how it differs from what I have used".**
>
> ⭐ **When pushed on details, say: "I know this one at the conceptual level; what I have actually built is X." — do not pretend to have used it.**

**That sentence is itself a plus**: asking about the Skills row is often a test of whether you inflate, **and drawing the line cleanly beats hedging tenfold.**

## Library navigation

| What to read | Why |
|---|---|
| **Sections 1 and 4** | The 90-second versions for Angular/Go and Angular/Django |
| **Sections 2, 3 and 5** | Follow-ups with answers — **mark the ones you cannot answer and fill them the next day** |
| ⭐ **Section 6's comparison table** | **Must be reproducible from memory**: hand-written SQL in Go vs the Django ORM |
| **Section 9** | The minimum viable answer for the four bare words |
