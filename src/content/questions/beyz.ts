import type { QuestionSource } from './types';

/**
 * Beyz —— 简历 v42 四条 bullet 的实战问答。
 * 代码出处见 `content/library/03-beyz/00-notes.md`，这里只放「怎么答」。
 */
export const beyz: QuestionSource = {
  id: 'beyz',
  title: 'Beyz',
  subtitle: '实时面试助手 · 简历 v42 四条 bullet',
  bullets: [
    {
      id: 'bullet-1',
      title: 'Bullet 1 · 实时链路全流程',
      resume:
        'Built the real-time interview copilot end to end: tab and system audio captured through getDisplayMedia, streamed over a WebSocket to Deepgram’s live recognizer, with interim and finalized transcripts reconciled in the client and utterance-end events triggering GPT-4o answers streamed back token by token.',
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
6. **生成** —— Next.js server action 里用 \`streamText({ model: openai('gpt-4o') })\` 读取 GPT-4o 的文本增量，再通过 RSC 的 \`createStreamableValue()\` 往客户端推；前端以 \`readStreamableValue()\` 逐块消费并更新页面。这里的 chunk 是**文本增量，不保证刚好等于一个 token**。**面试场景里首字延迟比总时长重要**，所以不等整段完成。

收尾一句：整条链路没有第三方的中间层，采集、调和、切句、生成都是我自己接的。

> ⚠️ 三个最容易说错的点：\`UtteranceEnd\` 是 WebSocket 事件，不是 webhook；GPT 下行是 RSC streamable value，不是手写 \`ReadableStream\`；chunk 不保证等于一个 token。`,
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
            zh: `三个理由，最后一个是决定性的：准确率和语言支持不可控、Safari 基本不能用、**它只认麦克风输入**。

我要的是「对方在另一个标签页里的声音」，Web Speech 根本拿不到这条流。前两条是偏好，第三条是硬性不可行——**先说第三条**。`,
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
            zh: `照实说，都是试出来的，不是算出来的。

- **250 ms**：往小了走，包数和包头开销上去、连接压力大；往大了走，首字延迟肉眼可见。250 是能稳定出字又不卡的值。
- **2 秒**：这是「多久没新词算一句话说完」。太短会把面试官正常的思考停顿切断，半句问题就被喂给模型；太长用户干等。2 秒是能容住停顿又不明显拖沓的点。

**别装成算出来的。**「试出来的」是可信答案；「根据某个理论算出来的」问一层就穿。`,
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
            zh: `冲突不存在——因为临时结果永远是**当前这一段的重写**，不累加；只有 \`is_final\` 的才追加进已确认串。

冲突只会发生在把临时结果也累加的写法里，那种写法屏幕上会出现重复的半句。这个答案的价值在于：它说明我理解了这个 API 的契约，而不是试出来一个能跑的写法。`,
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
            zh: `**这个数还没量，别编。**

量法：前端在 \`UtteranceEnd\` 触发那一刻打一个时间戳，第一个 token 到达时再打一个，跑五次取范围。

答的时候必须**拆成两段**，否则 2 秒的断句门槛会被记到「你系统慢」的账上：

> 「2 秒是我自己设的断句门槛，那不是处理耗时——是在等对方确实说完。真正的处理链路是从判定结束到出第一个字，实测大概 ___ 毫秒，主要成本是模型的首 token 时间。」

下一句必然是「你怎么量的」。答不上来这个数，就等于没有这个数。`,
          },
        },
      ],
    },
    {
      id: 'bullet-2',
      title: 'Bullet 2 · 凭据、保活、配额与并发',
      resume:
        'Kept the transcription credential out of the browser by minting 60-second, usage-scoped keys per session behind a plan gate, held the socket alive across microphone pauses, and logged per-request token usage that backs per-plan quotas; a four-state machine drops overlapping generations.',
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
            zh: `四件事，凭据只是第一件。这条 bullet 值钱的地方是「接完 SDK 之后会出什么事，我提前想过」。

1. **凭据** —— 浏览器直连意味着密钥必须到前端，所以**长期 key 绝不下发**。服务端每次会话现签一把临时 key：scope 只有 \`usage:write\`、TTL 60 秒。接口本身按套餐拦（Free 直接拒），再配全套 no-store 头，防止被 CDN 或浏览器缓存复用。
2. **保活** —— Deepgram 的连接没有音频包会被判空闲断开。用户中途暂停麦克风时每 10 秒发一次 \`keepAlive()\`，恢复时不用重连——重连意味着重新签 key、重新握手，用户会看到一段哑火。
3. **计量** —— 每次生成结束在 \`onFinish\` 里把 input/output token 落库，配额按套餐算（每个 copilot 能问几个问题），超限停面试并弹订阅。
4. **并发** —— 语音是异步来的，用户还能手动点「要答案」，两条路径会撞。四态状态机（Ready / Listening / Generating / Done）在 \`Generating\` 期间直接丢掉新提交。

> ⚠️ 措辞：这把临时 key **不是「一次性」的**，它是「带 TTL + 权限范围」，60 秒内能建多条连接。说成一次性会被抓。`,
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
            zh: `拦了，而且要**主动说**，别等对方戳——这是这道题真正的答案。

接口里按 \`subscribedPlan\` 判断，Free 档直接拒；只有开发环境才走直接下发长期 key 的分支。

更完整的说法是**两道门**：识别侧在签发接口拦一次，**生成侧在 server action 里独立拦第二次**。绕过前端最多多看一次弹窗，识别和生成两样都拿不到。

> ⚠️ 但「每个 copilot 能问几个问题」这层配额是**前端拦的**。这条主动交代，别让对方发现你在藏——「提问数那层在前端，服务端有独立的套餐门禁兜底」。同理，「一个连接上限 200 条」这种限额，说的时候必须讲清楚**拦在哪一层**，前端计数不算防护。`,
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
            zh: `不会。key 的 TTL 管的是**建连那一刻的鉴权**，socket 一旦建立就不会因为 key 过期被踢下来。**这正是 TTL 敢设这么短的原因。**

60 秒本身的选法：太长没必要，太短对用户是压力——点错、网络抖一下、握手慢几百毫秒都可能超时。一分钟足够任何正常用户完成建连。`,
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
            zh: `损失面被压到「替我转一分钟音频」。

scope 只有 \`usage:write\`——不能读项目、不能列 key、不能建新 key，60 秒后作废。

这就是最小权限的意义：**不是让密钥不泄露，是让泄露了也不值钱。** 这句话本身就是答案。`,
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
            zh: `可以，代价是多一跳延迟，外加一台要扛长连接的服务器。

实时场景里延迟就是产品体验本身。而临时 key 正是官方为这个场景给的方案——它换来的安全性等价于中转，代价只有一次签发请求。`,
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
            zh: `这是**竞态 / 响应乱序**问题——先把术语说出来，分量差一倍。

我的处理是状态机在 \`Generating\` 期间**直接丢弃**新提交，不排队。取舍很明确：面试里排队去生成一个已经过期的问题没有意义，而两段答案在同一个面板里交叉刷新是灾难。代价是会漏掉「上一句还在生成时插进来的那句」。

如果要做得更严，标准做法是**给每次请求打一个 id，回来时对不上当前 id 就丢弃**——这样既不漏也不乱序。把这句补上，这题就从「我做了个判断」变成「我知道完整解法，并且知道自己选了简版」。`,
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
      title: 'Bullet 3 · 付费转化链路',
      resume:
        'Owned the paid conversion path — Stripe Checkout, trials and lifetime purchases on Next.js, tRPC and Drizzle — with plan eligibility enforced in typed server actions and entitlements written only by signature-verified webhooks across six subscription events, none of which can downgrade a lifetime purchase.',
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
            zh: `**先把这句放在最前面：这是两条互不相干的链路。** 浏览器那条只负责把人送到付款页，权限一个字段都不写；写权限的是 Stripe 事后打回来的 webhook。先说这句，后面全是细节。

**链路一 · 下单（浏览器 → server action → Stripe）**

1. 点击调 server action \`createStripeSession\`。前端不直接连 Stripe，也拿不到任何 key。
2. 服务端自己取当前用户，**四道拦截**：已是 Lifetime 拒；\`hasPurchasedPlan\` 还想要试用的拒（试用 7 天，只给首单）；已经在这一档拒；**已有付费订阅又要换订阅档的，转 \`createUpdateSession\`，不发新 checkout**。
3. 都过了才 \`stripe.checkout.sessions.create\`：订阅走 \`mode: "subscription"\`，买断走 \`mode: "payment"\`，userId 挂在 metadata 的 \`payingUserId\` 上，返回 session.url。
4. 前端跳到 Stripe 托管页付款，付完回跳 success 页。**这条链路到此为止。**

**链路二 · 入账（Stripe → webhook）**

5. Stripe 朝 \`/api/stripe/webhook\` POST 事件，进门先验签，不过直接 400。
6. 按事件类型分发：订阅落在 \`customer.subscription.created\`，买断落在 \`checkout.session.completed\`。
7. \`users.subscribedPlan\` **只在这里被写**，靠 \`stripeCustomerId\` 反查用户，而且每条写都带 \`ne(subscribedPlan, Lifetime)\`。
8. 没有任何东西被推回前端——回跳之后前端自己重新拉一次用户状态。

> ⚠️ 简历这条写的是「on Next.js, tRPC and Drizzle」，但**付费链路一行 tRPC 都没有**（tRPC 只在 copilot / resume 两个 router），走的是 server actions + webhook route + Drizzle。顺着问会穿帮，已建议 v43 改成「Next.js and Drizzle」。`,
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
            zh: `两个方向都不成立，各一句就够。

**它不可信** —— success 的 URL 在用户手里。他一分钱不付、直接把地址敲进浏览器，页面照样加载。在那里写库，等于把升级按钮公开挂在网上。

**它也不可靠** —— 付款成功但人关了浏览器、网断了、跳转失败，页面根本不会加载。钱收了，权限没给。

所以权限的唯一真相源只能是那条服务端到服务端的链路：Stripe 直接 POST 给我的 webhook，带签名，全程不经过用户的机器。success 页在这套设计里只是一块「谢谢惠顾」的招牌。

> ⚠️ 别答成「怕泄漏用户信息」——方向就错了，那是另一个问题。`,
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
            zh: `**验签。** 这是整条 bullet 的支点，这题答不出来，前面说得再顺也没用。

取请求头里的 \`stripe-signature\`，配 \`STRIPE_WEBHOOK_SECRET\`，交给 \`stripe.webhooks.constructEvent\`。没有签名头 400，验不过也 400，一个字都不往下走。

**必须用原始 body。** Next.js 里是 \`await req.text()\`，绝不能先 \`req.json()\` 再验——签名是对字节算的，parse 完再序列化回去，空格或键序一变签名就对不上。这是最常被追问、也最常被踩的一处。

省掉这步的后果：那个路由公网可达，任何人 POST 一段自己编的 JSON，声称某个 customer 买了 Lifetime，服务端照写。付费墙等于拆了。

> ⚠️ 主动交代短板：**没有 event id 去重表**。Stripe 会重投，我的幂等是靠写操作本身收敛——每次都是按 customer 覆写成同一个 plan，同一个事件重放结果一样。要做严格幂等，标准做法是拿 \`event.id\` 建唯一索引，见过就直接 200 返回。照实说，别硬圆。`,
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
            zh: `**不会掉。两手，方向相反，只说一半就是答漏了。**

**守 —— 写库那一侧。** 每一条改 \`users.subscribedPlan\` 的语句，where 里都带 \`ne(subscribedPlan, Lifetime)\`：升降档用的 \`updateUserSubscription\` 带，暂停/删除时把人打回 Free 的 \`deleteUserSubscription\` 也带。所以任何订阅事件打到 Lifetime 用户身上，命中 0 行，静默无效。**它写在 SQL 的条件里，不是写在某个 if 里**——这点值得强调，它不依赖调用方记得判断。

**攻 —— 收钱那一侧。** \`checkout.session.completed\` 里一旦发现这单包含 Lifetime 商品，立刻 \`stripe.subscriptions.list\` 拉出这个 customer 名下所有订阅，逐个 \`stripe.subscriptions.cancel\`，然后才把 \`subscribedPlan\` 写成 Lifetime、\`hasPurchasedPlan\` 置 true。

两件事解决的是两个问题：守卫防**数据**被覆盖，主动取消防**钱**被继续划走。`,
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
            zh: `**因为新开 checkout 会造出第二份订阅。** 同一个 customer 名下两份订阅并行，两笔都扣钱。这是钱的 bug，不是体验的 bug——先把这句说出来。

所以 \`createStripeSession\` 判断出「有 stripeCustomerId、当前不是 Free、要换的又是订阅档」时，转 \`createUpdateSession\`：拉出这个 customer 当前的订阅，开一个 **Billing Portal session**，\`flow_data.type\` 用 \`subscription_update_confirm\`，把订阅里现有那个 item 的 price 换成新档，用户在 Stripe 的确认页点一下就完成，回跳我的 success 页。**改的是既有订阅上的那一行，订阅始终只有一份。**

补差价（proration）由 Stripe 按 Billing Portal 的配置结算，不是我在代码里算的——问到就这么说，别把它讲成自己实现的逻辑。

> ⚠️ 已知薄弱点，被追问就认：\`subscriptions.list\` 取的是 \`limit: 1\` 的第一条，等于假设一个 customer 只有一份订阅，取不到就抛错。这个前提在当前产品下成立（买断时会把订阅清空），但不是通用写法。`,
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
      title: 'Bullet 4 · 独立邮件服务、部署与首个 CI',
      resume:
        'Sole author of a NestJS and Fastify service for subscription emails and scheduled payment reminders — Dockerized, cron-triggered, deployed to EC2 under PM2 through GitHub Actions — and of the repo’s first CI gate: lint, typecheck and build on every push.',
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
            zh: `三段：为什么拆、怎么上线、怎么活着。

**为什么拆** —— 把数说出来，别说「配置麻烦」：

- 定时任务需要一个**常驻进程**；Next.js 部署在无状态平台上，cron 语义要靠平台外部触发。
- Vercel 的 cron 在 Hobby 档**一天只能跑一次**，函数还有执行时长上限。催款要按更细的粒度扫、要遍历用户逐个发信，这条路走不通。
- 拆出来还能独立扩容、独立重启，不受前端发版影响。

**怎么上线** —— 推 main 触发 GitHub Actions → ssh 上 EC2 → \`git pull origin main\` → \`docker-compose up -d --build\`。**跑的是容器。**

**怎么活着** —— compose 里 \`restart: unless-stopped\`；容器内用 \`pm2-runtime\` 起进程。

**最后自己认取舍，这比装企业级加分**：这套 ssh + pull + rebuild 很简陋——没有零停机、没有回滚、没有健康检查，单实例挂了就是挂了，而且构建是在生产机上做的，一次构建失败就可能让服务下线。个人项目里我选了最省事的；要改的话下一步是把镜像推到 registry、加 health check、做滚动替换。`,
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
            zh: `**容器。** 别再把 Dockerfile、git clone、PM2 三样并排说——那听起来像三套互相打架的方案，面试官只会问这一句。

准确的一句话：**容器跑的，容器里用 \`pm2-runtime\` 当 1 号进程。**

如果对方接着问「有了容器为什么还要 PM2」——这是个好问题，照实答：

- \`pm2-runtime\` 是 PM2 专门给容器用的模式：**前台运行、不 daemon 化**，所以它能当 PID 1 而不会让容器立刻退出。
- 但对单进程应用它基本是冗余的：崩溃重启已经被 compose 的 \`restart: unless-stopped\` 兜住了。它真正能提供的是 cluster 多进程和日志格式，这个服务两样都没用上。
- 所以这是**我会去掉的东西**——直接 \`CMD ["node", "dist/src/main.js"]\` 就够。

能把 \`pm2 start\` 和 \`pm2-runtime\` 的区别说清楚，这题反而变成加分项。

> ⚠️ 还有一句必须改掉：**PM2 本身不发报警**，它只做重启和日志。报警要么上 PM2 Plus，要么自己接。说「PM2 会触发相应的报警」，遇到懂的人就是当场穿帮。`,
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
            zh: `这题问的就是**幂等**：同一个动作重复执行，结果必须和执行一次一样。先说当时做的，再说它不够的地方——**加分点全在后半段。**

**当时做的**：单独一张 \`upgradeReminders\` 表记录发过谁。查询是 users 左连接 upgradeReminders，条件里带 \`isNull(upgradeReminders.id)\`，也就是「只捞还没有发送记录的人」；发完再插一条记录。

**三个不够的地方，我现在会这样改：**

1. **顺序反了。** 我是先发信、后写记录。中间任何一步失败（进程被杀、写库超时），下一轮这人还是「没有记录」，就会再收一封。正确顺序是**先占坑再发送**：先 INSERT 一条 \`pending\`，插入成功才发，发完 UPDATE 成 \`sent\`；失败留 \`pending\`，另开一个任务扫出来重试。最坏情况从「重复发」变成「漏一封」，而漏比重复轻得多。
2. **没有唯一约束。** 表上 \`userId\` 没有唯一索引，去重全靠查询里那个 \`isNull\`。**「先查有没有、再决定发不发」在并发下不成立**——两个 tick 同时进来、或者一次执行超时被重叠触发，两边都查到「没发过」，两封信就出去了。正确做法是把 \`(userId, 提醒类型, 周期标识)\` 做成唯一键，**让数据库来挡**，代码里的 if 只是快路径。
3. **cron 是 \`EVERY_MINUTE\`。** 每天 9 点那行被注释掉了，留下的是每分钟跑一次，这本身是调试残留。而 \`@nestjs/schedule\` 默认不防重入：上一轮还在发信、下一轮就开始了，配合前两条，重复发几乎是必然的。

**再补两句就满分：**

- 邮件服务商自己也会重试，所以调 API 时带 **Idempotency-Key**（Resend、SendGrid 都支持）。
- 服务重启后**不要补跑错过的周期**——按当前时间算「现在该发给谁」，而不是遍历历史。否则宕机一天，开机就是一堆催款信砸到用户脸上。

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
            zh: `照实说：**这个仓当时没有测试。** CI 跑的是 lint、typecheck、build，触发是每次 push（所有分支）。

它的价值在于把「本地能跑就发」变成「每次推送都过一遍类型和构建」——在我加之前没有任何自动检查，这是从 0 到 1。要强化就是补一个 test job。

> ⚠️ 硬规矩：测试那条**已经从简历删了，永远别再往回加**。两个仓的完整 git 历史里没有任何 test/spec 文件，\`beyz-web\` 连 jest / playwright 依赖都没装。别在面试里承诺一个不存在的测试套件。`,
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
            zh: `**选型题，不是性能瓶颈题，别硬吹。**

NestJS 的 adapter 可换，Fastify 吞吐更好、schema 校验和 swagger 集成更自然。

这个服务的量级根本压不到 Express 的瓶颈——照实说「顺手选了更快的那个」，比现编一套性能论证安全得多。`,
          },
        },
      ],
    },
  ],
};
