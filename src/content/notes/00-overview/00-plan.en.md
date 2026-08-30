---
title: Review master plan
section: Overview
---

# Master plan for the resume interview review

Matches resume **v72**. Bullets in total: **22** — Beyz 4, BioMap 4, Baidu 5, WinterFell 5, Periplus 4.

There are 22 notes, one per bullet. Two things to know: Beyz ① and ② were merged into one line in v66, and v72 split them back apart (credentials and usage get their own line). Periplus ⑤ (separating evidence from judgment) is still not on the resume; the note stays, because interviewers ask about it anyway.

## Order of work

| Day | Topic | Level |
|---|---|---|
| 1 | Audit of every number (must be finished first) | prerequisite |
| 2 | Beyz ① real-time interview copilot | S |
| 3 | Beyz ② credentials, state machine and usage | S |
| 4 | Beyz ③ Stripe + ④ service / deploy / CI | A |
| 5 | BioMap, all four | B |
| 6 | Baidu ⑤ H5/JSBridge + ④ withdrawal + ② Webpack | A |
| 7 | Baidu ① virtual list + ③ production white screen | S |
| 8 | Periplus ① six stages and the typed contract | S |
| 9 | Periplus ⑤ evidence and the ruling | S |
| 10 | Periplus ② persistence/resume + ③ scripted seam | S |
| 11 | Periplus ④ golden set and evals | S |
| 12 | WinterFell, all five | B |
| 13 | Skills row: Angular / Django (Go has been off since v66) | A |
| 14 | Full mock interview | — |

The first column is the **order of work**, and it matches the Day tag on each note. It is not a calendar. If a big block of time turns up, run ahead; otherwise just follow the numbers.

## Four structural changes since v1

1. **The audit of every number moved from last to first.** If a number cannot be defended, the resume wording has to change — and rehearsing before that change means rehearsing twice.
2. **Day 13, the skills row, is new.** The Skills line said Angular / Go / Django and the v1 schedule never mentioned it once. **Go came off in v66**, so this day now only has to cover Angular and Django.
3. **Days 8–12 read the code before writing the answer.** The Periplus and WinterFell sources are on this machine. Rebuilding them from memory is the main reason interviews go wrong.
4. **Periplus grew from 3 sessions to 4, BioMap shrank from 2 to 1** — redistributed by the S/A/B ranking.

## Priority (cut from the bottom when time runs short)

**S**: all four Periplus lines · the Beyz real-time pipeline and the credentials/usage line (split back apart in v72) · Baidu virtual list · Baidu white screen

**A**: Stripe entitlement · NestJS service, CI and deploy · TanStack Query tiers and hover prefetch · React architecture boundaries · Webpack migration · withdrawal idempotency · skills row Angular/Django

**B**: LIMS/Luckysheet/scaffolding · design system/Storybook/MSW · H5/JSBridge · the five WinterFell lines

If the target is mainly AI Engineer / full-stack AI, push time toward **Periplus + Beyz**. WinterFell is there to prove low-level performance analysis; it should not fight for the headline. But those lines are **numbers measured with my own tools**, which makes them the most credible material here — do not deliver them as a throwaway B-grade story.
