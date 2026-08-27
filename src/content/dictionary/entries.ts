import type { WordEntry } from './types';

/**
 * 单词本正文。
 *
 * 加词的流程：站里任何一页按 `w`（或点右下角那个按钮）把词丢进本地队列，
 * 队列攒着不释义；整理时把队列交出来，在这里补上词性、英文释义、中文释义
 * 和一句例句，然后把队列清掉。
 *
 * 释义写给「读英文技术文档时卡住的人」，不是写给词典编辑：
 * 英文那行要能独立读懂，中文那行解决的是「这个词到底在说哪件事」。
 */
export const wordEntries: WordEntry[] = [
  {
    term: 'tuning',
    pos: 'noun / verb (tune)',
    en: 'Adjusting the settings of a system — parameters, thresholds, prompts — to make it behave better, without rewriting it.',
    zh: '调参、调优：不重写系统，只调它的参数、阈值或提示词，让表现更好。注意跟 fine-tuning（微调模型权重）不是一回事。',
    example: 'Most of the eval gain came from tuning the retrieval threshold, not from a better model.',
    also: ['fine-tuning', 'tunable'],
    tags: ['ai', 'general'],
    added: '2026-08-27',
  },
  {
    term: 'idempotent',
    pos: 'adj.',
    en: 'Safe to run more than once: doing the same operation twice leaves the system in the same state as doing it once.',
    zh: '幂等：同一个操作做一次和做十次，结果一样。重试、重复回调、用户狂点提交，靠的就是这条。',
    example: 'The withdrawal endpoint is idempotent, so a retried request never pays out twice.',
    also: ['idempotency key'],
    tags: ['backend', 'interview'],
    added: '2026-08-27',
  },
  {
    term: 'throughput',
    pos: 'noun',
    en: 'How much work a system finishes per unit of time — requests per second, frames per second, rows per minute.',
    zh: '吞吐量：单位时间内做完多少活。跟 latency（单次多快）是两个指标，常常互相打架。',
    example: 'Batching raised throughput but also raised tail latency.',
    tags: ['backend', 'interview'],
    added: '2026-08-27',
  },
  {
    term: 'regression',
    pos: 'noun',
    en: 'Something that used to work and now does not, caused by a recent change.',
    zh: '回归（退步）：本来好使的东西被新改动弄坏了。regression test 就是专门用来接住这种情况的测试。',
    example: 'The instancing rewrite shipped a frustum-culling regression nobody caught for a week.',
    also: ['regression test'],
    tags: ['general', 'interview'],
    added: '2026-08-27',
  },
  {
    term: 'trade-off',
    pos: 'noun',
    en: 'A choice where getting more of one thing necessarily costs you some of another.',
    zh: '取舍：多拿一样就得少拿另一样。面试里问「你怎么权衡的」，问的就是这个——答不出代价，等于没答。',
    example: 'Dropping per-instance culling was a deliberate trade-off: fewer draw calls, more vertices.',
    tags: ['interview', 'general'],
    added: '2026-08-27',
  },
  {
    term: 'stale',
    pos: 'adj.',
    en: 'Out of date — data that is still being shown or used after the real value has already changed.',
    zh: '陈旧的：真实数据已经变了，手上这份还是旧的。缓存、React Query 的 staleTime、闭包里抓到的旧 state，都用这个词。',
    example: 'A stale closure kept reading the first page number after the user paged forward.',
    also: ['staleness', 'stale-while-revalidate'],
    tags: ['frontend'],
    added: '2026-08-27',
  },
  {
    term: 'boilerplate',
    pos: 'noun (uncountable)',
    en: 'Repetitive code you have to write that carries no decision — the same shape every time.',
    zh: '样板代码：每次都得写、但不包含任何判断的重复代码。说某个方案「cuts boilerplate」是夸它。',
    example: 'The typed contract removed the boilerplate of hand-writing the same request wrapper per endpoint.',
    tags: ['general'],
    added: '2026-08-27',
  },
  {
    term: 'ergonomics',
    pos: 'noun',
    en: 'How pleasant an API or tool is to use day to day — not what it can do, but how much friction it costs.',
    zh: '（开发）人机工效、用起来顺不顺手：讲的不是能力，是每天用它要付多少摩擦成本。',
    example: 'MSW wins on ergonomics: the mock lives next to the test instead of in a separate server.',
    tags: ['frontend', 'general'],
    added: '2026-08-27',
  },
];
