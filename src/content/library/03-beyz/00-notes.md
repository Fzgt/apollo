---
title: Beyz · 四条 bullet
section: Beyz
icon: radio
---

# Beyz —— 简历 v42 四条 bullet 的代码出处与讲法

> 2026-08-17 写，2026-08-18 校，2026-08-23 复核：下面引的四条与 **v42 一字不差**（v40→v42 这四条未改动），这是 Beyz 唯一该用的复习笔记。
> 旧的 `LEARNING_NOTES_BEYZAI.md` 对应更早的简历（RHF+Zod 表单、Jest 覆盖率、TSLint/SonarQube），四条里三条在 v40 已不存在，**2026-08-18 已删除**。
>
> 代码：`~/Desktop/Beyz/beyz-web`（Next.js 14 App Router）、`~/Desktop/Beyz/beyz-server`（NestJS + Fastify）。

---

## Bullet 1 —— 实时面试助手全链路

> Built the real-time interview copilot end to end: tab and system audio captured through getDisplayMedia, streamed over a WebSocket to Deepgram's live recognizer, with interim and finalized transcripts reconciled in the client and utterance-end events triggering GPT-4o answers streamed back token by token.

### 一句话是什么

面试时对方的声音在浏览器的另一个标签页里，麦克风采不到——这条讲的就是我怎么把那股声音接出来、变成字、再变成答案。声音每 250 毫秒切一片推给 Deepgram，边说边出字；判断「这句说完了」不靠静音检测，靠 Deepgram 的断句事件；答案的 token 一到就往屏幕上推，不等整段生成完。

**它证明的是：一条实时链路我能从采集一直接到模型输出，中间没有别人的活。**

### 代码出处

| 环节 | 文件 | 关键行 |
|---|---|---|
| 采集标签页/系统音频 | `src/hooks/useAudioStream.ts` | `:28` `getDisplayMedia({video:true, audio:true})`；`:39-43` 拿到后立刻 `stop()` 并 `removeTrack()` 掉 video 轨 |
| 切片 | `src/hooks/useMicrophone.ts` | `:35` `new MediaRecorder(mediaStream)`；`:55` `microphone.start(250)` —— **250 ms 一个 chunk** |
| 建连 | `src/hooks/useDeepgram.ts` | `:36` `deepgram.listen.live(options)`（SDK 内部是 WebSocket） |
| 识别参数 | `src/hooks/useAudioToText.ts` | `:84-88` `model: "nova-2"`, `interim_results: true`, `smart_format: true`, `filler_words: false`, `utterance_end_ms: 2000` |
| 送包 | 同上 | `:109-114` `e.data.size > 0` 才发——**发 size 0 的包 Deepgram 会直接关连接**，这是注释里写死的坑 |
| 临时/最终转写调和 | 同上 | `:116-127` `confirmedTranscriptRef` 只在 `data.is_final` 时推进，界面显示的是「已确认 + 当前临时」 |
| 触发生成 | 同上 `:129-131` → `CopilotSection.tsx:191` | `UtteranceEnd` 事件 → `submitQuestion()` |
| 流式回答 | `src/server/actions/copilot.ts` | `:101` `createStreamableValue()`、`:103` `streamText({model: openai("gpt-4o")})`、`:131-135` 逐 delta `stream.update` |
| 前端消费 | `CopilotSection.tsx` | `:257-266` `readStreamableValue()` 逐块拼接，包在 `startTransition` 里更新 |

### 讲的顺序（40 秒版）

1. **问题**：面试时对方的声音在浏览器的另一个标签页里，麦克风采不到。
2. **采集**：所以用 `getDisplayMedia` 走「共享标签页」路径——这个 API **必须带 `video: true` 才能拿到音频**，拿到后我立刻把 video 轨停掉并移除，只留音频。
3. **传输**：`MediaRecorder` 每 250 ms 出一个 blob，直接 push 进 Deepgram 的 WebSocket；nova-2 开 `interim_results`，边说边出字。
4. **调和**：Deepgram 会先给临时结果、再给 `is_final` 的最终结果。我用一个 ref 存「已确认」部分，界面 = 已确认 + 当前这段临时的，所以字不会闪回也不会重复。
5. **切句**：不靠静音检测，用 Deepgram 的 `UtteranceEnd`（`utterance_end_ms: 2000`，两秒没新词就判一句结束）触发生成。
6. **生成**：服务端 action 里 `streamText` + RSC 的 `createStreamableValue`，token 一到就往下推，前端 `readStreamableValue` 逐块渲染——**面试场景里首字延迟比总时长重要**。

### 预期追问

- **「为什么不用 Web Speech API？」** 浏览器自带识别只认麦克风输入、准确率和语言支持不可控、Safari 基本不能用；而且我们要的是「对方在标签页里的声音」，Web Speech 拿不到这条流。
- **「250 ms 这个值怎么定的？」** 是延迟与包数量的折中：太小连接压力和包头开销上去，太大首字延迟肉眼可见。这是当时试出来的值，不是算出来的——照实说。
- **「临时结果和最终结果冲突了怎么办？」** 临时结果永远是「当前这一段」的重写，不累加；只有 `is_final` 的才追加进已确认串。所以冲突不存在，冲突只会发生在你把临时结果也累加的写法里。
- **「`filler_words: false` 是什么？」** 过滤 uh/um 这类填充词，转写更干净，喂给模型的 prompt 噪声更少。
- **「流式回答怎么保证顺序？」** `streamText` 的 `textStream` 是 async iterable，本身有序；RSC streamable value 也是单向追加，前端只做字符串拼接。

---

## Bullet 2 —— 实时链路的凭据、保活、配额与并发

> Kept the transcription credential out of the browser by minting 60-second, usage-scoped keys per session behind a plan gate, held the socket alive across microphone pauses, and logged per-request token usage that backs per-plan quotas; a four-state machine drops overlapping generations.

**这条是整段最值钱的一条**，因为它讲的不是「我接了个 SDK」，是「我知道接完之后会出什么事」。

### 一句话是什么

上一条是「我接通了」，这条是「接通之后会出的四种事我都提前堵了」：密钥不能裸奔在浏览器里（改成每次会话现签一把 60 秒、只能上报用量的临时钥匙）；用户中途停下不能把连接断掉；每次生成烧了多少 token 要能算账；两个请求撞在一起要有人裁决。

**它证明的是：我不是接完 SDK 就交差的人。**

### 代码出处

| 点 | 文件 | 关键行 |
|---|---|---|
| 临时密钥签发 | `src/app/api/deepgram/route.ts` | `:44-49` `createProjectKey(..., {scopes: ["usage:write"], time_to_live_in_seconds: 60})` |
| 套餐门禁 | 同上 | `:10-13` Free 直接拒；`:16-20` 开发环境才直接下发长期 key |
| 防缓存 | 同上 | `:56-61` `Surrogate-Control: no-store` + `Cache-Control: no-store, must-revalidate`，`export const revalidate = 0` |
| 客户端取 key | `src/hooks/useDeepgram.ts` | `:12` `fetch("/api/deepgram", {cache: "no-store"})` |
| 保活 | `src/hooks/useAudioToText.ts` | `:156-175` 麦克风不在 Open 状态且 socket 还开着时，每 10 s 发一次 `connection.keepAlive()` |
| token 计量 | `src/server/actions/copilot.ts` | `:107-117` `onFinish({usage})` → 写 `copilotUsageLogs(inputTokens, outputTokens)` |
| 生成侧套餐门禁 | 同上 | `:94-97` Free 直接 `Unauthorized` |
| 提问配额 | `CopilotSection.tsx` | `:173-176` `questionsPerCopilot` 超限 → `:221-226` 停止面试并弹订阅 |
| 四态状态机 | `CopilotSection.tsx` | `:42-47` `Ready/Listening/Generating/Done`；`:229-232` `statusRef.current === Generating` 时直接 return |

### 讲的顺序

1. **凭据**：实时识别是浏览器直连 Deepgram 的，所以密钥必须到前端。**不能把长期 key 发下去**——所以服务端每次会话现签一把只有 `usage:write` 权限、**TTL 60 秒**的临时 key，并且这个接口本身按套餐拦；再配全套 no-store 头，防止被 CDN 或浏览器缓存复用。
2. **保活**：Deepgram 的连接在没有音频包时会被判空闲断开。用户中途暂停麦克风（换页、喝水）时我每 10 秒发一次 keepAlive，恢复时不用重连——**重连意味着重新签 key、重新握手，用户会看到一段哑火**。
3. **计量**：每次生成结束在 `onFinish` 里把 input/output token 落库，用户级用量可查；配额本身按套餐算（每个 copilot 能问几个问题），超限就停面试并弹订阅。
4. **并发**：语音是异步来的，用户还能手动点「要答案」，两条路径会撞。所以状态机在 `Generating` 期间直接丢掉新的提交——**丢比排队对**，面试里过期的问题排队生成没有意义。

### 预期追问

- **「60 秒够用吗？连接开着超过 60 秒会断吗？」** key 的 TTL 管的是**建连时刻的鉴权**，连上之后的 socket 不会因为 key 过期被踢；这也正是为什么 TTL 可以设得这么短。
- **「如果有人拿到那把临时 key？」** 只有 `usage:write` 一个 scope（不能读项目、不能列 key、不能建 key），60 秒后作废，损失面被压到「替你转一分钟音频」。
- **「为什么不做服务端中转（浏览器 → 你的服务器 → Deepgram）？」** 可以，代价是多一跳延迟和一台要扛长连接的服务器；实时场景下延迟是产品体验本身。临时 key 就是官方为此给的方案。
- **「配额只在前端拦，不是能绕过吗？」** 提问数是前端拦的，但**生成本身在服务端 action 里按 `subscribedPlan` 拦**，`/api/deepgram` 也拦——绕过前端最多多看一次弹窗，拿不到识别也拿不到生成。这条要主动说，别等对方戳。
- **「丢掉重叠请求会不会漏掉用户真正想问的？」** 会，代价是明确的：漏掉的是「上一句还在生成时插进来的那句」。当时的取舍是宁可漏一次，也不让两段答案在同一个面板里交叉刷新。

---

## Bullet 3 —— 付费转化链路

> Owned the paid conversion path — Stripe Checkout, trials and lifetime purchases on Next.js, tRPC and Drizzle — with plan eligibility enforced in typed server actions and entitlements written only by signature-verified webhooks across six subscription events, none of which can downgrade a lifetime purchase.

### 一句话是什么

钱的整条路是我修的：试用、订阅、终身买断。核心是**两把锁分开**——「谁能买」由服务端判断；「你买到了什么」只有 Stripe 亲口回调、且验过签名才能写进数据库。前端改不了、用户改不了、我自己的业务代码也不许绕过这道门去发权益，钱的账本只有一个写入口。另外订阅那边六种事件（开通、升降档、到期、暂停、恢复、买断）每一条都确认过不会顺手把终身买断一起注销掉——用户花大钱买了永久版却因为一次扣款失败被连坐降级，是这类系统最典型的赔钱事故。

**它证明的不是「我会接支付」，是「钱交给我管不会出事」。**

### 代码出处

- 入参类型即门禁：`src/server/actions/subscription.ts:13` `selectedPlan: Exclude<SubscriptionPlan, SubscriptionPlan.Free>` —— **免费档在类型层面就传不进来**。
- 已买终身再买：`:45-49` 直接拒绝。
- 试用：`:139-144` 用独立的 trial product，`:163` `trial_period_days` 仅当 `addTrial`；用户表里记 trial 是否已买过。
- 签名校验：`src/app/api/stripe/webhook/route.ts:23-32` 缺 `stripe-signature` 返 400，`constructEvent(buf, sig, secret)` 用**原始 body** 验签。
- 六类事件：`:42-67` `customer.subscription.created / updated / deleted / paused / resumed` + `checkout.session.completed`。
- 终身不可降级：`:384`、`:407` 每个改档路径的 where 条件里都带 `ne(users.subscribedPlan, SubscriptionPlan.Lifetime)`。

### 预期追问

- **「支付为什么走 tRPC？」** 简历那句把 Stripe 和 tRPC 并列写了，会被顺着问。照实说：**项目里有 tRPC，但付费链路没走 tRPC。** root router 只挂了 `resume` 和 `copilot` 两组、共三个 procedure，全是 CRUD；下单走的是 `"use server"` 的 server action，因为这个动作一次性、要跳转、不需要缓存也不需要失效，能少一层 router 注册；webhook 则必须是独立的 route handler。**别现编「设计原则」，就说选型省事。**
- **「为什么权益只能由 webhook 写？」** 因为「用户跳回 success_url」不等于「钱到账」——用户可以直接手敲 success_url，也可能付完就关页面。唯一可信的事实源是 Stripe 的签名事件。
- **「验签为什么必须用原始 body？」** 签名是对**字节流**算的 HMAC；框架一旦 `JSON.parse` 再 `stringify`，键序和空白就变了，签名必然对不上。
- **「幂等呢？」** 我做的是**收敛写**：每个 handler 都是把用户置成事件描述的目标状态（而不是做增量），重复投递同一个事件结果一样；终身档另有 `ne(Lifetime)` 保护。**没有单独的 event id 去重表——这条照实说，是个可以做得更严的地方。**
- **「六个事件为什么要都接？」** created/updated 覆盖开通与升降档、deleted 覆盖到期、paused/resumed 覆盖暂停、checkout.session.completed 覆盖终身买断（一次性支付不产生 subscription 事件）。

---

## Bullet 4 —— 独立的邮件服务与首个 CI

> Sole author of a NestJS and Fastify service for subscription emails and scheduled payment reminders — Dockerized, cron-triggered, deployed to EC2 under PM2 through GitHub Actions — and of the repo's first CI gate: lint, typecheck and build on every push.

### 一句话是什么

一个人从零写完一个独立的后端服务（发订阅邮件、到点催款），并且把它送上线活着：打成 Docker 镜像、cron 定时触发、部署到 EC2、PM2 守着崩了自动拉起、GitHub Actions 推代码就发版。最后半句还藏了个加分项——我给这个仓库加了**第一道** CI 关卡，「第一道」意思是在我之前没人做过，之后全组都在这条线的保护下写代码。

**它是四条里唯一证明「他不只是前端」的那条：从写出来、装进容器、扔上服务器、守住它、到自动化发版，全程闭环。**

### 代码出处

- `~/Desktop/Beyz/beyz-server`：NestJS 10 + `@nestjs/platform-fastify` + Drizzle + `@nestjs/schedule`（cron）+ `@fastify/swagger`；`Dockerfile`、`docker-compose.yml`、`syncEC2.sh`、`package.json` 里的 `start:pm2`。
- `beyz-web` 的 `ci.yml`：trigger 是 `push: ["**"]`，跑 lint / typecheck / build。

### 预期追问

- **「为什么邮件要单独一个服务，不放 Next.js 里？」** 定时任务需要一个**常驻进程**；Next.js 部署在无状态平台上，cron 语义要靠外部触发。拆出来还能独立扩容、独立重启，不受前端发版影响。
- **「Fastify 而不是 Express？」** NestJS 的 adapter 可换，Fastify 吞吐更好、schema 校验和 swagger 集成更自然。**这是选型题，不是性能瓶颈题，别硬吹。**
- **「PM2 解决什么？」** 进程守护与崩溃重启、日志、零停机 reload。
- **「CI 只有 lint/typecheck/build，没有测试？」** 照实说：**这个仓当时没有测试**。CI 的价值在于把「本地能跑就发」变成「每次推送都过一遍类型和构建」。想强化就是补 test job——想清楚再答，别现编。

---

## 硬规矩

- **测试那条已经从简历删了，永远别再往回加**：两个仓的完整 git 历史里没有任何 test/spec 文件，`beyz-web` 连 jest/playwright 依赖都没装。
- 技能栏里的 `Jest, Vitest` 现在**全篇零支撑**（Playwright 是靠 WinterFell 的 bench harness 撑着的）。他知道，自己定。
- 数字只有两个：**250 ms** 切片、**60 秒** key TTL、`utterance_end_ms` **2000**、历史窗口 **4 条**（`copilot.ts:86` `MaxHistoryLength`）。除此之外不要在面试里报任何 Beyz 的量化数字——没有 benchmark 能撑。
