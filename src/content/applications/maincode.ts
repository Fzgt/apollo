import type { ApplicationGroup } from './types';

/**
 * Maincode（墨尔本 · AI Software Engineer, Front End）。
 * 事实来源是 Argus 里那份 JD（job 5700，2026-08-24 抓），2026-08-25 又用 Ashby 的
 * posting API 拉原文核对过一次，两份一致（职位页本身是空壳 JS，抓不到正文）。
 * 岗位在产品交付层——streaming UX、cancellation、retries、会话状态、生产环境调试。
 * JD 明写不给 visa sponsorship、要求墨尔本 in person，并且写着 one or two years of experience。
 */
export const maincode: ApplicationGroup = {
  id: 'maincode',
  title: 'Maincode',
  subtitle: 'AI Software Engineer (Front End) · 墨尔本 · 不给 sponsorship',
  companySpecific: true,
  answers: [
    {
      id: 'hardest-problem',
      q: 'This is hard work. Building the front end for a production AI system means handling real users, real failures, and performance issues that only appear at scale. Tell us about the hardest engineering problem you have taken on recently. Then tell us why you want to build this kind of system at Maincode.',
      keywords: [
        '最难的问题', 'hardest problem', 'hardest engineering problem', 'why us', 'why this company',
        'Beyz', '四态机', 'state machine', 'streaming', 'Deepgram', '虚拟列表', 'haokan-kit', 'Matilda',
      ],
      used: '2026-08-25',
      note: '两问一答，别只答前半。第三段那个「丢比排队对」的取舍是这题真正的分数——JD 明说要 think clearly about product tradeoffs and failure modes，能把代价说出口的人不多。百度那段压成一段第二例证，只留形状（越用越坏 + 量出来的数 + 被别人拿去用），别展开。结尾只留两句：不复述 JD 对岗位的描述（招聘方不需要听人把自己的 JD 念一遍），也不在结尾回扣一次 Beyz（第二段已经讲过）。只答「为什么是他们」这一件事。',
      a: `The hardest problem I've taken on recently was the real-time layer of the interview copilot at Beyz. Tab and system audio is captured in the browser, streamed over a WebSocket to a live recogniser, and GPT-4o answers stream back token by token — while the user is still talking.

Streaming the tokens was the easy half. The hard half is that a live model surface never gets a quiet moment in which to reconcile its state. Speech arrives as interim results the recogniser keeps rewriting until it marks a segment final, so what's on screen has to be confirmed text plus the current provisional segment — anything that appends interim results accumulates duplicates and flickers. And generation triggers collide: an utterance-end event can fire while the previous answer is still generating, and the user can also ask for an answer manually at any moment. Handled naively, two answers cross-update in the same pane, which is worse than showing nothing, because nobody can tell which sentence belongs to which question.

I modelled the lifecycle as an explicit four-state machine — Ready, Listening, Generating, Done — where a submission arriving during Generating is dropped rather than queued. That's a real tradeoff and I'd defend it: dropping loses the question someone interjected mid-answer, but queueing produces an answer to a question that stopped mattering thirty seconds ago, and in an interview stale is worse than missing. None of this was visible locally. It only appeared with real speech, real network timing and real interruption, so most of the work was reproducing production conditions rather than reasoning about the happy path.

The work I'm proudest of has the same shape. At Baidu I built the virtualised feed for the Xiaodu App, on a surface serving 5M+ page views a day, where nothing triggered the failure — it accumulated: the longer someone scrolled, the more live DOM nodes the page carried and the lower the frame rate went, so the experience degraded in proportion to how engaged the user was. A custom useVirtualList hook, windowed entirely off IntersectionObserver with two sentinel elements and no scroll listener, holds live nodes near 100 at any scroll depth and took scrolling from around 30 FPS to a stable 60 — measured under load, not asserted. It was later pulled into haokan-kit, the shared internal toolkit for Baidu's video products.

As for why Maincode: you build the whole stack instead of renting it. I'd rather be close enough to the core to understand why the product behaves the way it does than wrap an API somebody else operates.`,
    },
  ],
};
