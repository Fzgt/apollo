import type { ApplicationGroup } from './types';

/**
 * 换哪家公司都能用的题。改一个字都不用，直接粘。
 */
export const general: ApplicationGroup = {
  id: 'general',
  title: 'General',
  subtitle: 'Not tied to any company — paste as is',
  answers: [
    {
      id: 'proudest-work',
      q: 'Please detail your biggest achievements or work you are most proud of?',
      keywords: [
        '最自豪', '成就', 'achievement', 'proud of', 'biggest achievement',
        'Baidu', '虚拟列表', 'useVirtualList', 'IntersectionObserver', 'haokan-kit', '小度',
      ],
      used: '2026-08-25',
      note: 'Each of the four paragraphs does one job: the backwards failure mode (the more you scroll, the worse it gets), what I did about it, the measured result, and the last hit — it was pulled into haokan-kit and became what other teams use by default. Only that last paragraph proves the word "achievement". Everything before it is setup. Do not cut it.',
      a: `The work I'm proudest of is the virtualised feed I built at Baidu for the Xiaodu App, on a surface serving 5M+ page views a day. The failure mode was interesting because nothing triggered it — it accumulated. The longer someone scrolled, the more live DOM nodes the page carried, and frame rate fell with them, so the experience degraded in proportion to how engaged the user was. That's exactly backwards for a feed.

I wrote a custom useVirtualList hook rather than pulling in a list library. The rule it enforces is that the number of mounted rows stays constant no matter how long the list grows — rows are mounted only for the window around the viewport and unmounted the moment they leave it, so an endlessly appending feed costs the same in DOM as a short one. Spacers carry the height of everything unmounted, so the scrollbar and scroll position stay accurate. The windowing itself is driven entirely off IntersectionObserver — two sentinel elements bracketing the mounted window, no scroll listener anywhere — so the decision to recycle never costs main-thread work on every frame.

The part I'm proud of is that the result was measured and held under load, rather than asserted: live DOM nodes stay near 100 at any scroll depth, however long the session runs, and scrolling went from around 30 FPS to a stable 60 — on a production surface at that traffic level.

What settled it for me was what happened afterwards. The hook was pulled into haokan-kit, the shared internal toolkit for Baidu's video products, and became the standard way every team on that line renders a long feed. It stopped being my optimisation for one page and became infrastructure other engineers depended on without ever talking to me about it.`,
    },
    {
      id: 'web-experience-summary',
      q: 'Please summarise your professional experience with web app development and previous projects',
      keywords: [
        '工作经历', '经验总结', 'summarise experience', 'background', 'tell us about your experience',
        'Beyz', 'BioMap', 'Baidu', 'Periplus', 'WinterFell', 'OpenClaw',
      ],
      used: '2026-08-25',
      note: 'Three jobs in reverse order, each landing on a number someone can check. The last paragraph folds the side projects and the agentic way of working into one claim: this is already how I build — not a willingness to learn, a fact. Keep Vue next to React; do not drop it.',
      a: `I'm a full-stack engineer with just over two years across consumer and enterprise web products, working mostly in TypeScript — React and Vue on the front, Node.js services behind them.

Most recently at Beyz (Canada, remote, Jan–Oct 2024) I was a full-stack engineer on a real-time interview copilot, and built the core feature end to end: tab and system audio captured in the browser, streamed over a WebSocket to a live speech recogniser, with GPT-4o answers streamed back token by token and a four-state machine dropping overlapping generations. I also owned the paid conversion path — Stripe Checkout on Next.js and Drizzle, with entitlements written only by signature-verified webhooks — and was sole author of a NestJS/Fastify service for subscription emails and scheduled payment reminders, Dockerised and deployed to EC2 through GitHub Actions, plus the repo's first CI gate.

At BioMap (Beijing, 2022) I led the React 18 + TypeScript architecture for Digital OS, the team's core consumer-facing product, and built their LIMS platform in Vue 3. I layered TanStack Query in three tiers with single-source cache keys and mutation-driven invalidation, and built a design system on Radix UI, Storybook and CVA with an MSW mock layer, so frontend delivery ran independent of backend progress.

At Baidu (Beijing, 2021–2022) I worked on the Xiaodu App and Haokan Video. I built a virtualised React feed serving 5M+ daily page views on a custom hook over IntersectionObserver — live DOM nodes stay near 100 at any scroll depth, scroll from 30 to a stable 60 FPS — built the withdrawal client on a path peaking above 2,000 QPS with idempotency keys that survive reloads, and led a Webpack 3-to-5 migration that cut bundle size ~15% and warm build times 70%.

Alongside that I build my own products: Periplus, an agentic LLM travel-research pipeline (FastAPI, React, pgvector) where every claim is bound to an exact source quote and application code — not prompts — enforces citation integrity, with 461 tests that run offline with no API keys; and WinterFell, a WebGPU racing game in React Three Fiber. I also keep two smaller Angular apps (Go and Django backends) in rotation. Day to day I work in Claude Code and Codex, and I self-host OpenClaw — an open-source agent gateway — as a persistent agent with tool access to my own repos, scheduled jobs and custom skills. Agentic engineering is how I already build, not something I'd be picking up on the job.`,
    },
    {
      id: 'built-with-ai',
      q: "Tell us about something you've built with AI. What was it, what did you use, and what did it change for you or your team?",
      keywords: ['AI 项目', 'built with AI', 'AI 工具', 'Copilot', 'Beyz', '通知服务', 'NestJS', 'Stripe'],
      used: '2026-08-25',
      note: 'This answers "what I built with AI", not "which AI products I have used". The point is the line drawn in the second paragraph: architecture, failure branches and trust boundaries are mine; boilerplate and the first pass at tests go to the model. The models were weak in 2024, which made that split easier to state. It ends on throughput — a team gain, not a personal trick.',
      a: `The most useful thing I've built with AI is the standalone notification service at Beyz. I was its sole author: a NestJS and Fastify service handling subscription lifecycle emails and scheduled payment reminders — Dockerised, cron-triggered, deployed to EC2 under PM2 through GitHub Actions, and scalable independently of the main Next.js app. It had to be right about money: six Stripe subscription events, each with its own failure branch, and no path that could downgrade a lifetime purchase. I added the repo's first CI gate along the way — lint, typecheck and build on every push.

This was 2024, when the models were considerably weaker than they are now, and that made the division of labour explicit: I held the architecture, the failure cases and the trust boundaries; the model absorbed boilerplate, unfamiliar framework idioms and the first pass at tests. What it changed was throughput — one engineer shipped and owned a production backend service, and the team stopped queuing behind a backend dependency for anything email- or billing-related.`,
    },
    {
      id: 'role-looking-for',
      q: 'What kind of role are you looking for?',
      keywords: ['期望岗位', '想要什么样的工作', 'motivation', 'what are you looking for'],
      used: '2026-08-25',
      note: 'It lands on two things: widening my range, and building something a lot of people use. The last line is deliberately "still putting the effort in after the novelty wears off" — that reads as long-term commitment, not just a taste for the feeling.',
      a: `The role I'm looking for is one that keeps pushing my own boundaries — where I'm learning something new rather than repeating what I already know, widening my technical range, and at the same time picking up experience in directions outside the one I've specialised in so far.

The other thing that matters to me is reach. If what I build ends up in front of a lot of people, that's what makes the work feel worth doing — and it's the thing that keeps me putting the effort in long after the novelty of a problem has worn off.`,
    },
  ],
};
