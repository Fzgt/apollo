import type { ApplicationGroup } from './types';

/**
 * Sitemate（悉尼/墨尔本 · Junior Full Stack Engineer - Hybrid）。
 * 事实来源是 Argus 里抓到的那份 JD，不是搜索摘要——
 * 摘要给的「2016 年成立」是错的，JD 原文写的是 2018 年上线。
 */
export const sitemate: ApplicationGroup = {
  id: 'sitemate',
  title: 'Sitemate',
  subtitle: 'Junior Full Stack · Sydney/Melbourne · A$85K–115K inc. super',
  companySpecific: true,
  answers: [
    {
      id: 'why-sitemate',
      q: 'What interests you in Sitemate specifically?',
      keywords: ['为什么选这家', 'why us', 'why this company', '技术栈契合', 'AI'],
      used: '2026-08-25',
      note: 'The stack list is straight from the JD: TypeScript, React, Node.js, Angular, MongoDB, AWS. In paragraph two, "organising its engineering around that" picks up their own wording (own outcomes, deliver at speed with AI) — it is a response, not flattery. Do not call them a small company: 150+ people, 18 countries, backed by Blackbird.',
      a: `Two things drew me to Sitemate specifically.

The first is the stack. TypeScript, React and Node are where I've spent my career, and Angular is what I've been building in most recently — so this isn't a role where I'd spend the first few months translating my experience into a different set of tools. I'd be useful in the codebase early.

The second is timing. 2026 is the year AI tooling got good enough to change the rate at which an engineering team can actually build, and Sitemate is already organising its engineering around that rather than treating it as an add-on. That's a shift I'd rather be part of than watch from outside.`,
    },
  ],
};
