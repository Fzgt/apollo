import type { ApplicationGroup } from './types';

/**
 * 换哪家公司都能用的题。改一个字都不用，直接粘。
 */
export const general: ApplicationGroup = {
  id: 'general',
  title: '通用',
  subtitle: '不绑公司，直接粘',
  answers: [
    {
      id: 'role-looking-for',
      q: 'What kind of role are you looking for?',
      keywords: ['期望岗位', '想要什么样的工作', 'motivation', 'what are you looking for'],
      used: '2026-08-25',
      note: '落点是「扩展能力边界」+「产品被更多人用」。末句刻意写成「热情过去之后还在投入」——比单说成就感更像长期主义。',
      a: `The role I'm looking for is one that keeps pushing my own boundaries — where I'm learning something new rather than repeating what I already know, widening my technical range, and at the same time picking up experience in directions outside the one I've specialised in so far.

The other thing that matters to me is reach. If what I build ends up in front of a lot of people, that's what makes the work feel worth doing — and it's the thing that keeps me putting the effort in long after the novelty of a problem has worn off.`,
    },
  ],
};
