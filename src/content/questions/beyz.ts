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
            zh: '你简历第一条说端到端做了个实时面试助手。从用户点「开始」那一刻讲起——对方的声音是怎么一步步变成屏幕上那段答案的？每一步你为什么这么选。',
            en: 'Your first bullet says you built the real-time interview copilot end to end. Start from the moment the user hits "Start" — how does the interviewer’s voice become the answer on screen, and why did you make each choice the way you did?',
          },
          a: {
            zh: `六步。名字必须说对——这题最容易掉分的地方就是把 Deepgram 的字段名说错。

1. **采集** —— 对方的声音在浏览器另一个标签页里，麦克风采不到。所以走 \`getDisplayMedia({ video: true, audio: true })\` 的「共享标签页」路径。**这个 API 必须带 \`video: true\` 才拿得到音频**，拿到之后立刻把 video 轨 \`stop()\` 并 \`removeTrack()\`，只留音频。
2. **切片** —— \`MediaRecorder\` 每 250 ms 出一个 blob，\`size > 0\` 才发（发空包 Deepgram 会直接关连接）。
3. **传输** —— WebSocket 连 Deepgram live，nova-2，开 \`interim_results\`、\`smart_format\`，关 \`filler_words\`。
4. **调和** —— Deepgram 先给临时结果、再给 \`is_final\` 的定稿。用一个 ref 存「已确认」串，界面显示 = 已确认 + 当前这段临时的。临时结果是**重写**不是追加，所以字不会闪回也不会重复。
5. **切句** —— 不自己写静音检测，用 Deepgram 的 **\`UtteranceEnd\` 消息**（由 \`utterance_end_ms: 2000\` 配出来）判定一句问完了，触发生成。
6. **生成** —— server action 里 \`streamText({ model: openai('gpt-4o') })\`，\`createStreamableValue()\` 边生成边往外推；前端 \`readStreamableValue()\` 逐块拼，包在 \`startTransition\` 里更新。**面试场景里首字延迟比总时长重要**，所以全程流式。

收尾一句：整条链路没有第三方的中间层，采集、调和、切句、生成都是我自己接的。

> ⚠️ 名字别说错：是 \`is_final\` / \`speech_final\` / \`UtteranceEnd\`。**没有「Silent event」，也没有 \`utterance_end: true\` 这个字段。** 意思对、名字错，是最容易掉分的那一类。`,
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
            zh: '后端把答案流回前端，走的是什么？SSE 还是 ReadableStream？',
            en: 'How does the answer stream back to the browser — SSE or a ReadableStream?',
          },
          a: {
            zh: `**都不是。** 实际用的是 Next.js server action + AI SDK RSC 的 \`createStreamableValue()\`，前端 \`readStreamableValue()\` 消费，底层走 RSC 的 flight 流，不是我手写的传输层。

**这句要主动说清楚，别含糊成「异步流式」——含糊比说错更掉分。**

如果对方追问「不用 RSC 你会怎么做」，那才轮到另外两条：

- **fetch + ReadableStream**：服务端 \`return new Response(stream)\`，前端 \`res.body.getReader()\` 循环读。
- **SSE**：浏览器原生 \`EventSource\` **只支持 GET**，而提问内容要 POST 上去——所以这条路直接不通，除非拿 fetch 手写 SSE 解析。

能把「为什么 SSE 在这个场景不成立」讲出来，比答对名字更值钱。`,
          },
          phrases: [
            'It’s a Next.js server action using the AI SDK’s streamable value — not something I hand-rolled.',
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
      questions: [],
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
