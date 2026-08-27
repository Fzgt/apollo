import type { QuestionSource } from './types';

/**
 * Beyz —— 简历 bullet 的实战问答（v66 起收到三条，题库仍按原四条分组）。
 * 代码出处见 `content/library/03-beyz/00-notes.md`，这里只放「怎么答」。
 */
export const beyz: QuestionSource = {
  id: 'beyz',
  title: 'Beyz',
  subtitle: 'Real-time interview copilot · three resume bullets in v66 (the bank is still grouped by the original four)',
  bullets: [
    {
      id: 'bullet-1',
      title: 'Bullet 1 · The real-time path end to end (v66 bullet one, first half)',
      resume:
        'Built the real-time interview copilot end to end: tab and system audio through getDisplayMedia, streamed over a WebSocket to Deepgram on 60-second usage-scoped keys minted per session behind a plan gate, and answered by GPT-4o token by token as each utterance ends — socket kept alive across pauses, token usage logged.',
      questions: [
        {
          id: 'b1-main',
          keywords: ['全链路', '端到端', 'getDisplayMedia', 'Deepgram', 'WebSocket', '转写', '流式', 'is_final', 'UtteranceEnd', '标签页音频'],
          kind: 'main',
          asked: '2026-08-23',
          q: {
            zh: '用户点击开始后，从「浏览器里对方的声音」到「GPT 答案逐步显示在页面上」，完整的数据链路是什么？请按音频采集 → 音频切块 → 语音转写 → 临时/最终文本处理 → 触发 GPT → 流式显示答案的顺序讲。',
            en: 'After the user clicks Start, walk me through the complete path from the interviewer’s audio in the browser to the GPT answer appearing progressively on screen: capture, chunking, transcription, interim/final reconciliation, generation trigger, and streamed rendering.',
          },
          a: {
            zh: `先讲六步主链路。身份、套餐校验和 60 秒临时 key 属于 Bullet 2；可以在开头交代一句，但不要让安全细节淹没这道题。

1. **采集** —— 对方的声音在浏览器另一个标签页里，麦克风采不到。所以走 \`getDisplayMedia({ video: true, audio: true })\` 的「共享标签页」路径。**这个 API 必须带 \`video: true\` 才拿得到音频**，拿到之后立刻把 video 轨 \`stop()\` 并 \`removeTrack()\`，只留音频。
2. **切片** —— \`MediaRecorder\` 每 250 ms 产生一个音频 \`Blob\`，\`size > 0\` 才发（发空包 Deepgram 会直接关连接）。
3. **传输** —— WebSocket 连 Deepgram live，nova-2，开 \`interim_results\`、\`smart_format\`，关 \`filler_words\`。
4. **调和** —— 开启 \`interim_results\` 后，Deepgram 返回的 transcript 消息带 \`is_final\`。\`false\` 的当前临时文本只替换显示；\`true\` 的定稿才追加进 ref 里的「已确认」串。界面始终显示「已确认 + 当前临时」，所以不会重复累加。
5. **切句** —— 不自己写静音检测，用 Deepgram 通过**同一条 WebSocket** 发来的 \`UtteranceEnd\` 事件（由 \`utterance_end_ms: 2000\` 配置）判定一句问完了，触发生成。**它不是 webhook。**
6. **生成** —— Next.js server action 里用 \`streamText({ model: openai('gpt-4o') })\` 读取 GPT-4o 的文本增量，再通过 RSC 的 \`createStreamableValue()\` 往客户端推；前端以 \`readStreamableValue()\` 逐块消费，每拿到一块就在 React 的 \`startTransition\` 里更新页面——包进 \`startTransition\` 是把这些高频更新标记成低优先级，所以答案刷得再快，用户点按钮、滚页面也不会被卡住。这里的 chunk 是**文本增量，不保证刚好等于一个 token**。**面试场景里首字延迟比总时长重要**，所以不等整段完成。

收尾一句：整条链路没有第三方的中间层，采集、调和、切句、生成都是我自己接的。

> ⚠️ 五个最容易说错的地方，前三个错在概念，后两个错在名字：
>
> 1. \`UtteranceEnd\` 是 Deepgram 从同一条 WebSocket 发回来的事件，不是 webhook。
> 2. GPT 答案下行走的是 RSC 的 streamable value，不是我手写的 \`ReadableStream\`。
> 3. 一个 chunk 是一段文本增量，不保证刚好等于一个 token。
> 4. 判断一段转写是否定稿的字段叫 \`is_final\`，另有一个字段叫 \`speech_final\`，句子结束的事件叫 \`UtteranceEnd\`。
> 5. **没有「Silent event」这个东西，也没有 \`utterance_end: true\` 这个字段。** 这两个名字是我自己最可能脱口而出的错，单独列在这里就是为了防它出口。`,
          },
          phrases: [
            'The interviewer’s audio lives in another tab, so the mic can’t reach it — I capture it with getDisplayMedia.',
            'Interim results are rewrites, not appends. Only is_final segments get committed.',
            'I don’t roll my own silence detection — Deepgram’s UtteranceEnd event is the trigger.',
          ],
        },
        {
          id: 'b1-webspeech',
          keywords: ['Web Speech', '浏览器原生语音识别', '选型'],
          kind: 'followup',
          q: {
            zh: '浏览器自己就带语音识别，为什么不用 Web Speech API？',
            en: 'Browsers ship speech recognition. Why not just use the Web Speech API?',
          },
          a: {
            zh: `Web Speech API 有三个问题。前两个是「不好用」，第三个是「在我这个场景里根本跑不起来」——所以面试时把第三个提到最前面说。

- **准确率和语言支持由浏览器厂商决定。** 同一段音频在不同浏览器上识别成什么样，我既控制不了，也没有换模型这个选项；用 Deepgram 我可以指定 nova-2。
- **Safari 上基本不能用。** 各家浏览器对这个 API 的实现程度差得很远，Safari 是最差的那一档。
- **它只认麦克风输入。** 我要送去识别的是面试官的声音，那条流在浏览器的另一个标签页里，只有 \`getDisplayMedia\` 抓得到；Web Speech API 的输入源只有本机麦克风一个选项，这条流它根本接不上。

前两条换个场景还能将就，第三条没有任何绕法。所以真正的答案是「它拿不到我需要的那条音频流」，另外两条是补充。`,
          },
        },
        {
          id: 'b1-numbers',
          keywords: ['250ms', 'utterance_end_ms', '切片', '断句', '参数怎么定', '权衡'],
          kind: 'followup',
          q: {
            zh: '250 毫秒切片、2 秒判定一句结束——这两个数怎么定的？为什么不是 100 毫秒 / 5 秒？',
            en: '250 ms chunks and a two-second utterance timeout — how did you land on those? Why not 100 ms or 5 seconds?',
          },
          a: {
            zh: `**这两个数都是试出来的，不是算出来的——面试时就照这么说。** 说成「根据某个理论算出来的」，对方往下追一层就穿。

- **250 ms 是 \`MediaRecorder\` 的切片间隔，它决定音频多久上传一次。** 往小调到 100 ms，同样长度的音频被拆成更多个包，每个包都要带一份包头，连接上的收发次数和开销都涨上去。往大调到 500 ms 以上，最快出字的时间就被这个间隔本身拖住，肉眼能看出来。250 ms 是我试下来既能稳定出字、又不给连接添压力的值。
- **2 秒是 \`utterance_end_ms\`，它决定「多久没有新词算这句话说完」。** 往小调到 1 秒以内，面试官正常的思考停顿会被判成一句话结束，半句问题就被送去生成答案。往大调到 5 秒，面试官已经问完了，用户还要干等 5 秒才看到答案开始出。2 秒是我试下来既容得住停顿、又不明显拖沓的点。`,
          },
        },
        {
          id: 'b1-interim-conflict',
          keywords: ['is_final', 'interim', '临时结果', '调和', '闪回'],
          kind: 'followup',
          q: {
            zh: '临时结果和最终结果冲突了怎么办？',
            en: 'What happens when an interim transcript conflicts with the final one?',
          },
          a: {
            zh: `**这个冲突在我的实现里不会发生，因为临时结果和最终结果写的不是同一份数据。**

Deepgram 在开启 \`interim_results\` 之后，同一句话会先发若干条 \`is_final: false\` 的临时结果，最后发一条 \`is_final: true\` 的定稿。我用一个 ref 存「已确认文本」，只有 \`is_final: true\` 的那条会被追加进去；\`is_final: false\` 的临时文本存在另一处 state 里，每来一条就整个替换掉上一条。界面显示的是「已确认文本 + 当前这条临时文本」。所以定稿到达的那一刻，临时那份被清空、定稿被追加，屏幕上换的是同一段文字，没有两份内容需要调和。

真正会出冲突的是**把临时结果也追加进已确认串**的写法：一句话发了五条临时结果，五条全被追加，屏幕上就出现五段重复的半句。

这题值得答好的原因是：它区分的是「我读懂了这个 API 的契约」和「我试出来一种碰巧能跑的写法」。`,
          },
        },
        {
          id: 'b1-stream-transport',
          keywords: ['SSE', 'ReadableStream', 'EventSource', '传输', 'server action', 'streamable value', '流式返回'],
          kind: 'followup',
          asked: '2026-08-23',
          q: {
            zh: '这条链路里有两种流：浏览器 ↔ Deepgram，以及服务端 → 浏览器。为什么第一条用 WebSocket，而 GPT 答案下行没有继续用 WebSocket？请从通信方向、连接生命周期和业务需求比较。',
            en: 'There are two streams here: browser ↔ Deepgram and server → browser. Why does the first use WebSocket while the GPT answer path does not? Compare their direction, connection lifetime, and product requirements.',
          },
          a: {
            zh: `**因为两条链路的通信形状不同。**

- **浏览器 ↔ Deepgram** 是长时间存在的双向会话：浏览器持续上传音频，Deepgram 同时不断下发 transcript、metadata 和 \`UtteranceEnd\` 等事件。双方都要随时发消息，连接还要跨越整场面试，所以 WebSocket 合适。
- **服务端 → 浏览器** 是一次提问对应一次答案的请求—响应：问题提交以后，主要需求只是把 GPT 文本增量单向推回来，答案结束这次流也结束。为它再维护一条 WebSocket，需要自己处理连接关联、清理和错误状态，却没有换来双向通信价值。

实际实现是 Next.js server action + AI SDK RSC 的 \`createStreamableValue()\`，前端用 \`readStreamableValue()\` 消费，底层走 RSC Flight stream，不是手写 \`ReadableStream\`，也不是 SSE。

**这句要主动说清楚，别含糊成「异步流式」——含糊比说错更掉分。**

如果对方追问「不用 RSC 你会怎么做」，那才轮到另外两条：

- **fetch + ReadableStream**：服务端 \`return new Response(stream)\`，前端 \`res.body.getReader()\` 循环读。
- **SSE**：浏览器原生 \`EventSource\` **只支持 GET**，而提问内容要 POST 上去——所以这条路直接不通，除非拿 fetch 手写 SSE 解析。

能把「为什么 SSE 在这个场景不成立」讲出来，比答对名字更值钱。`,
          },
          phrases: [
            'Deepgram is a long-lived, bidirectional session; the GPT answer is a finite, one-way response stream.',
            'It’s a Next.js server action using the AI SDK’s streamable value — not another WebSocket I had to operate.',
            'EventSource is GET-only, and the question payload has to be POSTed, so plain SSE was out.',
          ],
        },
        {
          id: 'b1-latency',
          keywords: ['延迟', '首字延迟', 'TTFT', '端到端延迟', '量化数字', '性能'],
          kind: 'followup',
          asked: '2026-08-23',
          unresolved: true,
          q: {
            zh: '从面试官说完到屏幕上出第一个字，大概多久？',
            en: 'From the moment the interviewer stops talking to the first character on screen — how long?',
          },
          a: {
            zh: `**这个数我还没有量过，所以面试时不能报具体数字，别编。**

**量法**：在前端 \`UtteranceEnd\` 事件触发的那一行打第一个时间戳，在第一个 GPT 文本块到达的那一行打第二个时间戳，两者相减就是这条链路的处理耗时。同一段话跑五次，报一个范围而不是单个值。

**答的时候必须把两段时间拆开说。** 不拆开，我自己设的 2 秒断句门槛会被算进「处理耗时」里，对方听到的就是「这个系统要三秒才出字」——而那 2 秒是在等对方确实说完，不是我的系统在算东西。原话可以是：

> 「2 秒是我自己设的断句门槛，那不是处理耗时——是在等对方确实说完。真正的处理链路是从判定结束到出第一个字，实测大概 ___ 毫秒，主要成本是模型的首 token 时间。」

说完这句，下一个问题必然是「你怎么量的」。所以量法和数字要一起准备好；答不上来量法，这个数字就等于没有。`,
          },
        },
      ],
    },
    {
      id: 'bullet-2',
      title: 'Bullet 2 · Credentials, keep-alive, quota and concurrency (v66 bullet one, second half)',
      resume:
        'Built the real-time interview copilot end to end: tab and system audio through getDisplayMedia, streamed over a WebSocket to Deepgram on 60-second usage-scoped keys minted per session behind a plan gate, and answered by GPT-4o token by token as each utterance ends — socket kept alive across pauses, token usage logged. — v66 merged the original bullets 1 and 2 into this one. The four-state machine no longer appears on the resume; the questions stay.',
      questions: [
        {
          id: 'b2-main',
          keywords: ['API key', '凭据', '密钥', '临时 key', 'TTL', '保活', '配额', '并发', '安全'],
          kind: 'main',
          asked: '2026-08-23',
          q: {
            zh: '实时识别是浏览器直接连第三方服务的，那你的 API key 怎么办？除了这个，这条实时链路上你还提前防了哪些事？',
            en: 'The browser talks to the transcription provider directly — so what about your API key? And beyond that, what else on this real-time path did you defend against up front?',
          },
          a: {
            zh: `这条实时链路上我提前防了四件事，凭据只是第一件。这条 bullet 值钱的地方不是「我接了个 SDK」，而是「接完之后会出什么事，我提前想过」。

1. **凭据：浏览器直连第三方，密钥一定会出现在前端，所以出现在前端的那把不能是长期 key。** 服务端在每次会话开始时现签一把临时 key，权限范围只有 \`usage:write\`，TTL 60 秒。签发接口本身按套餐拦，Free 档直接拒。响应上再挂全套 no-store 头，避免这把 key 被 CDN 或浏览器缓存下来给别人复用。
2. **保活：Deepgram 的连接一段时间收不到音频包，就会被判成空闲、主动断开。** 用户中途关掉麦克风的时候，前端每 10 秒调一次 \`keepAlive()\` 把连接吊住，用户恢复说话时直接接着用。不这么做就得重连，而重连意味着重新签 key、重新握手，用户会看到一段哑火。
3. **计量：每次生成结束时，在 AI SDK 的 \`onFinish\` 回调里把这次的 input / output token 数落库。** 配额按套餐算——每个 copilot 能问多少个问题——超限就停掉这场面试并弹订阅页。
4. **并发：语音触发的生成是异步来的，用户还能自己点「要答案」，两条路径会撞在一起。** 一个四态状态机（Ready / Listening / Generating / Done）管住这件事：处在 \`Generating\` 时，新提交直接丢掉，不排队。

> ⚠️ 措辞：这把临时 key **不是「一次性 key」**，它是「带 TTL 和权限范围的 key」。60 秒之内它能建多条连接，说成一次性，懂 Deepgram 的人一句话就抓出来。`,
          },
          phrases: [
            'The long-lived key never leaves the server — each session gets a freshly minted 60-second, usage-scoped key.',
            'The point isn’t that the key can’t leak; it’s that a leaked key isn’t worth anything.',
          ],
        },
        {
          id: 'b2-mint-endpoint',
          keywords: ['鉴权', '越权', '白嫖', '滥用', '限流', '套餐门禁', '未登录'],
          kind: 'followup',
          asked: '2026-08-23',
          q: {
            zh: '那个签发临时 key 的接口，谁都能调吗？不登录循环打它，是不是就能白嫖你的识别额度？',
            en: 'That endpoint that mints the temporary key — can anyone call it? Couldn’t someone just hammer it and burn your transcription quota?',
          },
          a: {
            zh: `**不是谁都能调，接口里按套餐拦了。这件事要主动说出来，别等对方来戳**——「有没有想过这个接口会被人白嫖」本身就是这道题在考的东西。

签发接口拿到请求后先取当前用户的 \`subscribedPlan\`，Free 档直接拒绝，key 根本不签。只有开发环境才走那个「直接下发长期 key」的分支，生产环境走不到那里。

更完整的说法是**两道互相独立的门**：识别这一侧在签发接口拦一次，生成这一侧在 server action 里再拦一次，两处各自去查当前用户的套餐，不互相依赖。所以有人绕过前端界面，最多是多看一次订阅弹窗，识别和生成两样都拿不到。

> ⚠️ 有一层配额确实只拦在前端，要自己先交代：「每个 copilot 能问几个问题」这个上限是前端计数的，服务端没有独立校验，兜底靠的是上面那道套餐门禁。同理，「一个连接上限 200 条消息」这类限额，说的时候必须讲清楚它拦在哪一层——**前端计数只是体验约束，不算防护**。被对方先发现你在藏，比自己说出来难看得多。`,
          },
        },
        {
          id: 'b2-ttl',
          keywords: ['TTL', '过期', '60 秒', '长连接', '建连鉴权'],
          kind: 'followup',
          q: {
            zh: '60 秒够用吗？面试开了半小时，key 早过期了，连接不会断吗？',
            en: 'Is 60 seconds enough? If the interview runs half an hour, doesn’t the key expire mid-session?',
          },
          a: {
            zh: `**不会断。这把 key 的 TTL 管的是「建立连接那一刻的鉴权」，不是连接的存活时间。** WebSocket 握手时 Deepgram 校验一次 key，握手通过之后这条连接就一直有效，key 到第 61 秒过期也不会把已经建好的连接踢下来。面试开三小时，用的还是那次握手的结果。

**正因为过期不影响已建立的连接，TTL 才敢设这么短。** 如果过期会断连，60 秒就是个荒唐的值。

60 秒本身怎么选的：它只需要覆盖「拿到 key 到握手完成」这一小段。再长没有意义，只是白白延长这把 key 能被人捡去用的窗口；再短则对用户是压力——点错一次、网络抖一下、握手慢几百毫秒，都可能让这把 key 在建连之前就作废。一分钟足够任何正常用户完成建连。`,
          },
        },
        {
          id: 'b2-leaked-key',
          keywords: ['泄露', '最小权限', 'scope', 'least privilege', '爆炸半径'],
          kind: 'followup',
          q: {
            zh: '假设有人真的从前端把那把临时 key 抠出来了，能干什么？',
            en: 'Say someone does scrape that temporary key out of the client. What can they do with it?',
          },
          a: {
            zh: `**他能做的事只有一件：拿这把 key 替我转写一分钟音频。**

这把 key 的 scope 只有 \`usage:write\`，也就是「消耗额度做识别」这一个权限。他读不了我的项目信息，列不出我名下其他的 key，也建不了新的 key——所以他没有办法用这把 key 换一把长期的。再加上 60 秒之后它自己作废，能捞到的额度也就是一分钟音频。

这就是最小权限在这里的意义：**目标不是让密钥永远不泄露，而是让泄露出去的那把不值钱。** 这句话本身就是这道题要的答案，比罗列一串防护手段更有分量。`,
          },
        },
        {
          id: 'b2-proxy',
          keywords: ['中转', '代理', 'proxy', '延迟', '架构取舍'],
          kind: 'followup',
          q: {
            zh: '为什么不让浏览器连你的服务器、服务器再连 Deepgram？那样密钥根本不用出去。',
            en: 'Why not proxy through your own server so the key never leaves the backend at all?',
          },
          a: {
            zh: `**这个方案可行，我没选它是因为它要多付两样东西：一跳延迟，和一台得扛住长连接的服务器。**

中转意味着音频先到我的服务器、再由我的服务器转给 Deepgram，回来的 transcript 同样多走一段。实时场景里这一跳直接加在用户看到字的时间上——**延迟在这个产品里就是体验本身**，不是可以事后优化的指标。另外，中转让我的服务器要为每个用户维持一条全程不断的 WebSocket，这类连接的扩容和运维成本，跟无状态请求完全不是一回事。

而临时 key 正是 Deepgram 为「浏览器直连」这个场景给出的官方方案。它换来的安全性和中转等价——真泄露出去的也只是一把 60 秒、只能写用量的 key——代价却只有每次会话多一个签发请求。`,
          },
        },
        {
          id: 'b2-race',
          keywords: ['竞态', 'race condition', '乱序', '并发', '请求 id', '丢弃', '状态机'],
          kind: 'followup',
          asked: '2026-08-23',
          q: {
            zh: '上一个答案还在生成，新问题又来了，你怎么处理？',
            en: 'A new question arrives while the previous answer is still generating. What happens?',
          },
          a: {
            zh: `**先把术语说出来：这是竞态，具体是响应乱序（out-of-order response）。** 同一件事，说「我加了个判断防止冲突」和说「这是竞态，我用状态机收敛」，分量差一倍。

**我的处理是丢弃，不是排队。** 状态机处在 \`Generating\` 期间，新来的提交直接被扔掉，不进队列。这个取舍有两条理由：面试里的问题有时效性，排队等三十秒再去生成一个已经过去的问题，答案出来也没用了；而两段答案在同一个面板里交叉刷新，用户根本读不下去。代价也很明确——上一句还在生成时插进来的那句会被漏掉。

**如果要求既不漏也不乱序，标准做法是给每次请求打一个 id。** 前端记住「当前有效的那个 id」，每发起一次新请求就更新它；响应回来时先比对 id，对不上的直接丢弃，对得上的才渲染。这样新问题可以立刻发起，旧答案自动作废，两个目标同时满足。

把最后这段补上，这题就从「我做了个判断」变成「我知道完整解法，也知道自己为什么选了简版」。`,
          },
          phrases: [
            'That’s a race — overlapping generations. I drop the newer one rather than queue it.',
            'The rigorous fix is tagging each request with an id and discarding stale responses.',
          ],
        },
      ],
    },
    {
      id: 'bullet-3',
      title: 'Bullet 3 · The paid conversion path (v66 bullet two)',
      resume:
        'Owned the paid conversion path — Stripe Checkout, trials and lifetime purchases on Next.js and Drizzle — with entitlements written only by signature-verified webhooks: no event can downgrade a lifetime purchase.',
      questions: [
        {
          id: 'b3-main',
          keywords: ['Stripe', 'Checkout', '升级', '链路', 'server action', 'webhook', 'metadata', 'tRPC'],
          kind: 'main',
          asked: '2026-08-24',
          q: {
            zh: '用户在页面上点「升级到 God」，到他账号里那个字段真的变成 God——中间经过哪几个环节？按顺序说。',
            en: 'A user clicks “upgrade to God”. Walk me through every hop between that click and the plan field on their account actually changing.',
          },
          a: {
            zh: `**开口第一句先定框架：这中间是两条互不相干的链路。** 浏览器走的那条只负责把人送到 Stripe 的付款页，它一个权限字段都不写；真正把 \`subscribedPlan\` 改成 God 的，是付款之后 Stripe 从他们服务器打回来的 webhook。先把这句说出来，后面所有细节才有位置放。

**链路一 · 下单（浏览器 → server action → Stripe）**

1. 用户点击，前端调 server action \`createStripeSession\`。前端自始至终不直接连 Stripe，也拿不到任何 Stripe key。
2. server action 在服务端自己取当前登录用户，然后过**四道拦截**：已经是 Lifetime 的，拒；\`hasPurchasedPlan\` 为 true 却还想要试用的，拒（试用是 7 天，只给首单）；已经在他要买的这一档上的，拒；**已有付费订阅、要换的又是另一个订阅档的，转去 \`createUpdateSession\`，不发新的 checkout**——最后这条是为了不造出第二份订阅，细节在换档那道题里。
3. 四道都过了才调 \`stripe.checkout.sessions.create\`。订阅档用 \`mode: "subscription"\`，买断用 \`mode: "payment"\`，当前用户的 id 挂在这个 session 的 metadata 里，字段名是 \`payingUserId\`。接口返回 session.url。
4. 前端拿到 url 跳转到 Stripe 托管的付款页，用户在 Stripe 的页面上付款，付完 Stripe 把他跳回我的 success 页。**这条链路到此结束，它没有写过任何一个数据库字段。**

**链路二 · 入账（Stripe → 我的服务端 webhook）**

5. Stripe 朝 \`/api/stripe/webhook\` 发一个 POST。处理函数进门第一件事是验签，验不过直接 400，一个字都不往下走。
6. 验签通过后按事件类型分发：订阅落在 \`customer.subscription.created\` 上，买断落在 \`checkout.session.completed\` 上。
7. \`users.subscribedPlan\` 这个字段**只在这里被写**。写之前靠 \`stripeCustomerId\` 反查出是哪个用户，而且每一条写语句的 where 里都带 \`ne(subscribedPlan, Lifetime)\`，防止订阅事件把终身用户覆盖掉。
8. webhook 处理完不往前端推任何东西。用户从 Stripe 跳回 success 页之后，前端自己重新拉一次用户状态，看到的就是已经写好的新套餐。

> ✅ **这个隐患 v66 已经拆掉**：简历以前写「on Next.js, tRPC and Drizzle」，但**整条付费链路一行 tRPC 都没有**（tRPC 在这个仓里只出现在 copilot 和 resume 两个 router 上，付费走的是 server actions + webhook route + Drizzle）。v66 已改成「Next.js and Drizzle」，顺着简历问下来不会再穿帮。`,
          },
          phrases: [
            'Two paths that never touch: the browser starts the purchase, the webhook is the only thing that grants it.',
            'Nothing the browser can reach writes an entitlement.',
          ],
        },
        {
          id: 'b3-success-page',
          keywords: ['success', '回跳', 'redirect', '真相源', 'source of truth', '前端写库'],
          kind: 'followup',
          asked: '2026-08-24',
          q: {
            zh: '支付成功后 Stripe 把人跳回你的 success 页。为什么那个页面一个权限字段都不写？写了会发生什么？',
            en: 'Stripe redirects the user back to your success page after payment. Why doesn’t that page write anything? What breaks if it does?',
          },
          a: {
            zh: `**因为那个页面同时不可信、又不可靠——两个毛病方向相反，各自都足以否掉它。**

**不可信：success 页的 URL 在用户手里。** 回跳地址就是一个普通的前端路由，任何人都能把它直接敲进浏览器地址栏，一分钱不付页面照样加载。如果升级逻辑写在那个页面上，等于把「把我升级成 God」这个按钮公开挂在网上。

**不可靠：付款成功不等于那个页面会被加载。** 用户付完就关了浏览器、网络在跳转那一刻断了、Stripe 的回跳因为任何原因失败——这些情况下钱已经收了，而那段写库代码根本没有机会执行。结果是用户付了钱拿不到权限。

所以权限的唯一真相源只能是另一条路：Stripe 的服务器直接 POST 到我的 webhook，请求带签名，全程不经过用户的机器，用户既改不了它也拦不住它。success 页在这套设计里只是一块「谢谢惠顾」的招牌，权限早在别处写好了。

> ⚠️ 这题最容易答偏的方向是「怕在前端泄漏用户信息」。那是另一个问题，答到那儿去说明没听懂在问什么——这题问的是**谁有资格写权限**，不是信息暴露。`,
          },
          phrases: [
            'The success URL is attacker-controlled and unreliable — it’s a thank-you page, nothing more.',
            'Entitlements only ever come from a signed, server-to-server event.',
          ],
        },
        {
          id: 'b3-webhook-verify',
          keywords: ['验签', 'signature', 'constructEvent', 'raw body', '伪造', '幂等', 'idempotency', '重放'],
          kind: 'followup',
          asked: '2026-08-24',
          q: {
            zh: 'webhook 进门第一件事做什么？这步省了，攻击者能拿到什么？',
            en: 'What is the first thing your webhook handler does? What can an attacker do if you skip it?',
          },
          a: {
            zh: `**第一件事是验签。这是整条 bullet 的支点**——前面链路讲得再顺，这题答不出来，整条就塌了。

具体做法：从请求头里取出 \`stripe-signature\`，配上环境变量里的 \`STRIPE_WEBHOOK_SECRET\`，一起交给 \`stripe.webhooks.constructEvent\`。请求没带签名头，直接返回 400；签名验不过，同样返回 400。两种情况都在碰数据库之前就结束。

**验签必须拿原始请求体，这是最常被追问、也最常被踩的一处。** 在 Next.js 的 route handler 里要用 \`await req.text()\` 拿未经解析的字符串，绝对不能先 \`req.json()\` 解析、再把对象序列化回去验——Stripe 的签名是对原始字节算出来的，JSON 解析再序列化的过程中，空格、键的顺序、数字格式都可能变，签名当场就对不上。

**省掉这步的后果**：\`/api/stripe/webhook\` 这个路由是公网可达的，它不需要登录，也没有别的鉴权。任何人都能朝它 POST 一段自己编的 JSON，声称某个 customer 完成了一笔 Lifetime 付款，服务端会照着写进数据库。付费墙等于拆了。

> ⚠️ 主动交代一个短板：**我没有做 event id 去重表。** Stripe 在收不到 200 的时候会重投同一个事件，所以严格说 webhook 应该幂等。我这边的幂等是靠写操作本身收敛来的——每次都是按 \`stripeCustomerId\` 把 plan 覆写成同一个值，同一个事件重放十次，数据库里的结果和执行一次完全一样。但这只对「覆写型」的写操作成立，以后一旦加了「给用户加 100 积分」这种累加型操作就不再安全。标准做法是拿 \`event.id\` 建一张带唯一索引的表，进门先插一条，插不进去说明见过，直接返回 200。照实这么说，别硬圆成「我已经幂等了」。`,
          },
          phrases: [
            'Signature verification on the raw body — anything that fails gets a 400 before it touches the database.',
            'Without it that route is an open API for granting yourself a lifetime plan.',
            'Idempotency comes from convergent writes, not an event-id table — I’d add the table if replays mattered more.',
          ],
        },
        {
          id: 'b3-lifetime-guard',
          keywords: ['Lifetime', '终身', '降级', 'ne', 'guard', 'cancel', '重复扣费', '守卫'],
          kind: 'followup',
          asked: '2026-08-24',
          q: {
            zh: '一个用户已经买了终身，名下还挂着一个没退的月订阅。月底 Stripe 发来订阅更新事件——他会不会掉回 Standard？靠什么挡住的？另外，买断成功那一刻，你还主动做了一件事，是什么？',
            en: 'Someone bought lifetime but still has a monthly subscription running. When the next subscription event arrives, do they drop back to Standard? What stops it? And what did you actively do at purchase time?',
          },
          a: {
            zh: `**不会掉。这里有两手，方向相反，只说一半就是答漏了。**

**第一手是守，在写数据库那一侧。** 每一条会改 \`users.subscribedPlan\` 的语句，where 条件里都带上 \`ne(subscribedPlan, Lifetime)\`：升降档用的 \`updateUserSubscription\` 带，订阅被暂停或删除时把用户打回 Free 的 \`deleteUserSubscription\` 也带。所以月订阅的更新事件打到一个 Lifetime 用户身上时，那条 UPDATE 命中 0 行，什么都没发生，也不报错。**这个条件写在 SQL 的 where 里，不是写在某个调用点的 if 里**——这一点值得单独强调，因为它意味着以后新增任何写路径，只要复用这两个函数就自动受保护，不依赖写代码的人记得判断。

**第二手是攻，在收钱那一侧。** \`checkout.session.completed\` 的处理里，一旦发现这一单包含的是 Lifetime 商品，就先调 \`stripe.subscriptions.list\` 把这个 customer 名下所有还在跑的订阅拉出来，逐个调 \`stripe.subscriptions.cancel\` 取消掉，然后才把 \`subscribedPlan\` 写成 Lifetime、\`hasPurchasedPlan\` 置成 true。

**这两手解决的是两个不同的问题：守卫防的是数据被覆盖，主动取消防的是钱被继续划走。** 只讲守卫，用户的套餐是保住了，但他名下那份月订阅每个月照扣；只讲取消，万一某条订阅没取消干净，事件回来照样能把他打回 Standard。`,
          },
          phrases: [
            'Every write carries ne(plan, Lifetime) in the WHERE clause — it’s a database-level guard, not a caller-side if.',
            'On a lifetime purchase I also cancel every running subscription for that customer, so they aren’t billed twice.',
          ],
        },
        {
          id: 'b3-upgrade-session',
          keywords: ['升级', 'upgrade', 'checkout', 'billing portal', 'proration', '补差价', '重复订阅'],
          kind: 'followup',
          asked: '2026-08-24',
          q: {
            zh: '已经是 Standard 的人要换 God。你为什么不给他新开一个 checkout？那你走的是什么？',
            en: 'A Standard subscriber wants God. Why not just create another checkout session? What do you do instead?',
          },
          a: {
            zh: `**因为再开一个 checkout 会造出第二份订阅。** Stripe 的 checkout 每成功一次，就在这个 customer 名下新建一份订阅，它不会去动已经存在的那份。结果是同一个用户名下 Standard 和 God 两份订阅并行，每个周期扣两笔钱。**这是钱的 bug，不是体验的 bug**——先把这句说出来，再讲我怎么做的。

所以 \`createStripeSession\` 在判断出「这个用户已经有 \`stripeCustomerId\`、当前不是 Free、要换的又是另一个订阅档」这三条同时成立时，不走 checkout，转去 \`createUpdateSession\`。那里的做法是：先拉出这个 customer 当前的订阅，然后开一个 **Billing Portal session**，\`flow_data.type\` 设成 \`subscription_update_confirm\`，并把订阅里现有那个 item 的 price 指定成新档的 price。用户被送到 Stripe 的确认页，点一下确认就完成，然后回跳我的 success 页。**这里改的是既有订阅上的那一行 item，订阅本身自始至终只有一份。**

补差价（proration）是 Stripe 按 Billing Portal 的配置结算的，不是我在代码里算的。被问到就这么说——把它讲成自己实现的按比例计算逻辑，追问一层就露。

> ⚠️ 一个已知薄弱点，被追问就认：拉当前订阅时我用的是 \`subscriptions.list\` 取 \`limit: 1\` 的第一条，等于假设一个 customer 名下只有一份订阅，取不到就直接抛错。这个前提在当前产品里成立，因为买断那条路径会把名下订阅全部清空；但它不是一个通用写法，换个允许多份订阅的产品就是 bug。`,
          },
          phrases: [
            'A second checkout would create a second subscription — that’s double billing, not a UX problem.',
            'I deep-link into the Billing Portal’s subscription_update_confirm flow and swap the price on the existing item.',
          ],
        },
      ],
    },
    {
      id: 'bullet-4',
      title: 'Bullet 4 · Standalone mail service, deployment and the first CI gate (v66 bullet three)',
      resume:
        'Sole author of a NestJS service for subscription emails and scheduled payment reminders, Dockerized and deployed to EC2 through GitHub Actions, and of the repo’s first CI gate on every push.',
      questions: [
        {
          id: 'b4-main',
          keywords: ['部署', 'deploy', 'EC2', 'Docker', 'cron', '定时任务', 'Vercel', '拆服务', '常驻进程'],
          kind: 'main',
          asked: '2026-08-23',
          q: {
            zh: '订阅邮件和定时催款，为什么要单独开一个服务，不直接放在 Next.js 项目里？然后说说这个服务是怎么上线的、怎么保证它一直活着。',
            en: 'Why did the subscription emails and scheduled reminders need a separate service instead of living inside the Next.js app? Then walk me through how it gets deployed and how you keep it alive.',
          },
          a: {
            zh: `分三段答：为什么拆出来、怎么上线、怎么保证它一直活着。

**为什么拆 —— 把限制条件说具体，别说「放一起配置麻烦」**

- 定时任务需要一个**一直活着的进程**来数时间。Next.js 部署在无状态平台上，函数是被请求唤起、跑完就销毁的，没有一个进程能跨请求存活，所以 cron 语义只能靠平台从外部按时触发。
- Vercel 提供的 cron 在 Hobby 档**一天只能触发一次**，而且函数本身有执行时长上限。催款要按更细的粒度扫一遍用户表、再遍历用户逐个发信，这两条限制各自都卡死了它。
- 拆成独立服务之后，它可以独立扩容、独立重启，前端发版不会顺带重启它。

**怎么上线**

推 main 触发 GitHub Actions，Actions 里 ssh 到 EC2，在机器上执行 \`git pull origin main\`，然后 \`docker-compose up -d --build\` 重新构建并起容器。**线上跑的是容器**，不是裸的 node 进程。

**怎么保证它活着**

两层：compose 文件里给这个服务配了 \`restart: unless-stopped\`，容器异常退出会被自动拉起；容器内部用 \`pm2-runtime\` 作为启动命令来跑 Node 进程。

**最后自己把取舍认下来，这比装企业级加分：** 这套 ssh + pull + rebuild 的流程很简陋——没有零停机，重建期间服务是断的；没有回滚，上一版的产物根本没留；没有健康检查，进程活着但功能坏了没人知道；单实例，机器挂了就是全挂。而且构建是在生产机器上做的，一次构建失败就可能让服务直接下线。个人项目里我选了最省事的那条路；真要改，下一步是把镜像构建挪到 CI、推到 registry，加健康检查，再做滚动替换。`,
          },
          phrases: [
            'It’s a separate long-running process because scheduled work needs one — the Next.js side is stateless.',
            'Push to main triggers Actions, which SSHes into EC2 and rebuilds the compose stack.',
            'It’s deliberately simple: no zero-downtime, no rollback, no health check. I know what it’s missing.',
          ],
        },
        {
          id: 'b4-container-or-process',
          keywords: ['容器', '裸进程', 'PM2', 'pm2-runtime', 'docker-compose', 'restart policy', '守护进程', '报警', '监控'],
          kind: 'followup',
          asked: '2026-08-23',
          q: {
            zh: '所以你线上跑的到底是容器还是裸进程？',
            en: 'So is it running in a container, or as a bare process?',
          },
          a: {
            zh: `**是容器。准确的一句话：服务跑在 Docker 容器里，容器里的 1 号进程是 \`pm2-runtime\`。**

先说一个措辞问题：以前我会把 Dockerfile、\`git pull\`、PM2 三样并排列出来，听起来像三套互相打架的方案，面试官接下来必然追这一句。这三样不是并列关系——容器是运行形态，\`git pull\` 是上线动作，PM2 是容器内的启动命令。

如果对方接着问「都用容器了为什么还要 PM2」，这是个好问题，照实答：

- \`pm2-runtime\` 是 PM2 专门为容器提供的模式：**它在前台运行、不 daemon 化**。这一点是必须的，因为普通的 \`pm2 start\` 会把进程转到后台、自己立刻退出，容器看到 1 号进程退出就跟着结束了。
- 但对我这个单进程服务来说，PM2 基本是冗余的。崩溃自动重启这件事，compose 的 \`restart: unless-stopped\` 已经做了。PM2 真正独有的能力是 cluster 多进程和日志格式化，这个服务两样都没用上。
- 所以这是**我会去掉的东西**：直接写 \`CMD ["node", "dist/src/main.js"]\` 就够了。

能把 \`pm2 start\` 和 \`pm2-runtime\` 的区别讲清楚，这题反而从减分项变成加分项。

> ⚠️ 有一句必须改掉：**PM2 本身不发报警。** 它做的是进程守护、重启和日志收集，通知能力要么上 PM2 Plus，要么自己接。以前说过的「PM2 会触发相应的报警」，遇到真用过 PM2 的人就是当场穿帮。`,
          },
          phrases: [
            'It runs as a container — pm2-runtime is PID 1 inside it.',
            'Honestly PM2 is redundant there; the compose restart policy already covers crashes.',
          ],
        },
        {
          id: 'b4-idempotency',
          keywords: ['幂等', 'idempotency', '重复发信', '唯一约束', 'unique constraint', '去重', '并发', 'catch-up', '先占坑再发送'],
          kind: 'followup',
          asked: '2026-08-23',
          q: {
            zh: '定时催款最怕的就是同一个人收到两封。你怎么保证不重复发？',
            en: 'The classic failure mode for a reminder job is emailing the same user twice. How do you prevent that?',
          },
          a: {
            zh: `**这题问的是幂等：同一个动作重复执行，结果必须和只执行一次一样。** 先说当时的做法，再说它不够的地方——**加分点全在后半段**，因为面试官想听的是「你知道这类系统真实的事故长什么样」。

**当时的做法**：单独建了一张 \`upgradeReminders\` 表，发过谁就往里插一条记录。每轮扫描的查询是 users 左连接 upgradeReminders，条件里带 \`isNull(upgradeReminders.id)\`，也就是只捞出「还没有发送记录」的那些用户；发完信再插一条记录进去。

**三个不够的地方，我现在会这样改：**

1. **写记录和发信的顺序反了。** 我是先发信、再写记录。如果在这两步中间进程被杀掉，或者写库超时失败，这个人的记录就没写成，下一轮扫描他还是「没有记录」，于是再收一封。正确的顺序是**先占坑再发送**：先 INSERT 一条状态为 \`pending\` 的记录，插入成功才去调发信接口，发送成功再 UPDATE 成 \`sent\`；中途失败的记录留在 \`pending\`，由另一个任务扫出来重试。这样最坏情况从「重复发」变成「漏一封」，而对用户来说，漏一封比收两封轻得多。
2. **表上没有唯一约束，去重全靠查询里那个 \`isNull\`。** 「先查有没有发过、再决定发不发」是典型的 read-then-write，它在并发下不成立：两个 tick 同时进来，或者一次执行超时导致下一次重叠触发，两边都会查到「这个人没发过」，然后两边都发。正确做法是把 \`(userId, 提醒类型, 周期标识)\` 建成唯一键，让**数据库**在第二次插入时报冲突，代码里那个查询只当快路径用。判断权必须交给数据库，因为只有它能保证「查」和「写」是一个原子操作。
3. **cron 表达式是 \`EVERY_MINUTE\`。** 每天 9 点跑那一行被注释掉了，留在代码里生效的是每分钟跑一次，这本身是调试时改的、忘了改回去。更麻烦的是 \`@nestjs/schedule\` 默认不防重入：上一轮还在逐个发信、下一轮就已经开始了，配合前面两条，重复发信几乎是必然的。

**再补两句就满分：**

- 邮件服务商自己也会重试，所以调发信 API 的时候要带上 **Idempotency-Key**（Resend、SendGrid 都支持这个头）。同一个 key 重复提交，服务商那边只会真的发一封。
- 服务重启之后**不要补跑错过的周期**。正确的语义是按当前时间算「现在该发给谁」，而不是遍历宕机期间每一个错过的时间点。否则宕机一整天，开机瞬间就是一堆积压的催款信砸到用户脸上。

> 面试里这么答的效果远好过硬吹：你展示的是「我知道这类系统的真实事故长什么样」，而不是「我写过一个能跑的 cron」。`,
          },
          phrases: [
            'I keep a reminders table and only select users who don’t have a record yet.',
            'Looking back, the record should be written before the send, and the dedup belongs in a unique constraint rather than a read-then-write check.',
            'Read-then-write isn’t safe under concurrency — the database has to be the one saying no.',
          ],
        },
        {
          id: 'b4-ci',
          keywords: ['CI', 'GitHub Actions', '测试', 'lint', 'typecheck', '流水线'],
          kind: 'followup',
          q: {
            zh: '你说加了仓库第一道 CI，那 CI 里跑什么？没有测试吗？',
            en: 'You added the repo’s first CI gate — what does it run? No tests?',
          },
          a: {
            zh: `**照实说：这个仓当时没有测试，所以 CI 里跑的是 lint、typecheck 和 build 三件事**，触发条件是每次 push，所有分支都跑。

它的价值不在于跑了什么，而在于把「我本地能跑就推上去」变成「每次推送都过一遍类型检查和构建」。在我加它之前，这个仓没有任何自动检查——所以这是从 0 到 1，不是从 1 到 2。要再往上加一档，下一步就是补一个 test job。

> ⚠️ 一条硬规矩：**「写了测试」这句已经从简历里删掉了，永远别再往回加。** 两个仓的完整 git 历史里翻不出任何 test 或 spec 文件，\`beyz-web\` 连 jest、playwright 这类依赖都没装。在面试里承诺一个不存在的测试套件，对方让你讲讲测了哪些 case，当场就下不来台。`,
          },
        },
        {
          id: 'b4-fastify',
          keywords: ['Fastify', 'Express', 'NestJS', 'adapter', '选型'],
          kind: 'followup',
          q: {
            zh: 'NestJS 为什么配 Fastify，不用默认的 Express？',
            en: 'Why Fastify instead of the default Express adapter?',
          },
          a: {
            zh: `**这是一道选型题，不是性能瓶颈题——按「我们量太大所以必须换 Fastify」去答，反而危险。**

事实层面：NestJS 把 HTTP 层抽象成了 adapter，Express 和 Fastify 可以直接互换，业务代码基本不用动。选 Fastify 的理由是它的吞吐更好，而且 schema 校验和 swagger 集成用起来更自然。

但**这个服务的量级根本压不到 Express 的瓶颈**。所以照实说「adapter 反正可以换，顺手选了更快的那个」，比现编一套性能论证安全得多——对方真追问 QPS 数字，硬吹那种答法立刻就穿。`,
          },
        },
      ],
    },
  ],
};
