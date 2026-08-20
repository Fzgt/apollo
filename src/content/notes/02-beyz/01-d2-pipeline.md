---
title: "Day 2 · 必看 · 数据流全图"
section: Beyz · Day 2–4
icon: radio
day: 2
level: S
status: done
---


> 🔴 **必看**。今天的产出（那张图）和要出声练的两段话都在这里。
# Day 2 主篇 · 实时 copilot 的数据流全图

> 这是 Day 2 的当日产出：**一张完整数据流图，含失败分支**。四个分支笔记从这里展开：
> [采集层](/docs?section=beyz&item=d2-capture) · [传输层](/docs?section=beyz&item=d2-transport) · [转录与触发](/docs?section=beyz&item=d2-transcript) · [端到端延迟](/docs?section=beyz&item=d2-latency)

## 对应简历原句

Beyz 第 1 条 bullet（v40）：

> Built the real-time interview copilot end to end: tab and system audio captured through getDisplayMedia, streamed over a WebSocket to Deepgram's live recognizer, with interim and finalized transcripts reconciled in the client and utterance-end events triggering GPT-4o answers streamed back token by token.

**这句话就是一条流水线的六个环节**，每个环节都能指到行号：

| 简历短语 | 环节 | 代码 |
|---|---|---|
| `captured through getDisplayMedia` | 采集 | `useAudioStream.ts:28` |
| （隐含）切片 | 分块 | `useMicrophone.ts:55` |
| `streamed over a WebSocket` | 传输 | `useDeepgram.ts:35` |
| `Deepgram's live recognizer` | 识别 | `useAudioToText.ts:84-88` |
| `interim and finalized transcripts reconciled in the client` | 合并 | `useAudioToText.ts:116-127` |
| `utterance-end events triggering` | 触发 | `useAudioToText.ts:129-131` |
| `GPT-4o answers streamed back token by token` | 生成 + 渲染 | `copilot.ts:101-135` / `CopilotSection.tsx:257-266` |

---

## 一、主干（happy path）

```
┌─ ① 采集 ─────────────────────────────────────────────┐
│ navigator.mediaDevices.getDisplayMedia({              │
│   video: true,   ← 必须为 true，否则拿不到音频        │
│   audio: true,                                        │
│ })                                                    │
│   → 用户在弹窗里选「标签页 / 整个屏幕」并勾「分享音频」│
│   → 得到 MediaStream（video track + audio track）     │
│   → videoTrack.stop() + stream.removeTrack(videoTrack)│
│   → 只剩一条 audio track                              │
└──────────────────────────────────────────────────────┘
                    │ MediaStream
                    ▼
┌─ ② 切片 ─────────────────────────────────────────────┐
│ new MediaRecorder(mediaStream)                        │
│ recorder.start(250)      ← 每 250 ms 吐一个 Blob      │
└──────────────────────────────────────────────────────┘
                    │ ondataavailable(Blob) × 4 次/秒
                    ▼
              if (e.data.size > 0)   ←── 见失败分支 ③
                    │
                    ▼
┌─ ③ 传输 ─────────────────────────────────────────────┐
│ connection.send(blob)                                 │
│ 一条从浏览器直连 Deepgram 的 WebSocket                │
│ （SDK 的 deepgram.listen.live() 内部就是它）          │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌─ ④ 识别 · Deepgram nova-2 ───────────────────────────┐
│ interim_results: true    不断吐临时结果，不等说完     │
│ smart_format: true       标点、数字、专名格式化       │
│ filler_words: false      去掉 uh / um                 │
│ utterance_end_ms: 2000   静默 2 秒 = 这句说完了       │
└──────────────────────────────────────────────────────┘
          │                              │
          │ Transcript 事件               │ UtteranceEnd 事件
          │ （interim 和 final 都走这里） │ （静默 2 秒后一次）
          ▼                              ▼
┌─ ⑤ 合并 ────────────────┐   ┌─ ⑥ 触发 ────────────────┐
│ 屏幕 = 已确认 + 当前临时 │   │ onSpeechEnd()            │
│ is_final 时才推进「已确认」│  │   → submitQuestion()     │
└─────────────────────────┘   └──────────────────────────┘
                                        │ transcript 文本
                                        ▼
┌─ ⑦ 生成 · 服务端 Server Action ──────────────────────┐
│ getAuthUser() → Free 直接 throw      ←── 失败分支 ⑧   │
│ history.slice(-4)  只带最近四条上下文                 │
│ streamText({ model: openai("gpt-4o") })               │
│ createStreamableValue() → 逐 delta stream.update()    │
│ onFinish → 写 copilotUsageLogs + messages             │
└──────────────────────────────────────────────────────┘
                    │ StreamableValue
                    ▼
┌─ ⑧ 渲染 ─────────────────────────────────────────────┐
│ for await (const delta of readStreamableValue(v)) {   │
│   suggestionContent += delta                          │
│   startTransition(() => setMessages(...))             │
│ }                                                     │
└──────────────────────────────────────────────────────┘
```

**注意整条链路里服务端的位置**：音频**从不经过自己的服务器**，浏览器直连 Deepgram；只有第 ⑦ 步生成答案才走 Server Action。**这个拓扑是 [Day 3 凭证那条](/docs?section=numbers&item=n01-ephemeral-keys) 存在的全部原因**——直连意味着浏览器必须持有 Deepgram 凭证。

---

## 二、失败分支（当日产出明确要求）

**这一节是 Day 2 的重点。只会画 happy path 的人，面试时一问就停。**

### ① 用户拒绝授权

```
getDisplayMedia() → DOMException { name: "NotAllowedError" }
  → onDecline?.()          （useAudioStream.ts:57-58）
```

**和其他错误分开处理**：拒绝是用户的正常选择，不该弹「出错了」。

### ② 用户选了屏幕但没勾「分享音频」

```
拿到 stream，但 stream.getAudioTracks()[0] === undefined
  → onError?.()
  → setMediaStream(undefined)   （useAudioStream.ts:46-51）
```

**这是这个 API 最常见的用户失误**——弹窗里那个「分享音频」的勾选框默认不勾，而且在「整个屏幕」模式下某些平台根本没有。**代码显式检查了这一点，没有假设 audio track 一定存在。**

### ③ 空音频包

```
if (e.data.size > 0) connection.send(e.data)     （useAudioToText.ts:111-113）
```

注释写得很直白：

> prevent packetZero from being sent. **If sent at size 0, the connection will close.**

**发一个 0 字节的包，Deepgram 会直接关连接。** MediaRecorder 在启动瞬间/暂停边界确实会吐出空 Blob，**这个判断不是防御性编程，是必需的**。

### ④ Deepgram 连接断开

```
LiveTranscriptionEvents.Close → setConnectionState(closed)   （useDeepgram.ts:42-45）
```

**⚠️ 没有自动重连。** 只是把状态改成 closed，没有退避重试。要恢复得用户重新点 `requestStart()`，那条链路会**重新铸一把 key**（见 [#1](/docs?section=numbers&item=n01-ephemeral-keys)）。

**这是这条 bullet 最该主动交代的短板**，详见[传输层](/docs?section=beyz&item=d2-transport)。

### ⑤ 麦克风暂停导致连接空闲

```
microphoneState !== Open && connectionState === open
  → connection.keepAlive() 每 10 秒            （useAudioToText.ts:159-167）
```

Deepgram 的空闲超时是 **10 秒**。详见 [keepAlive 补充篇](/docs?section=numbers&item=n01b-keepalive)。

### ⑥ 上一条还在生成时又触发了

```
if (statusRef.current === CopilotStatus.Generating) return   （CopilotSection.tsx:229-232）
```

四态机 `Ready / Listening / Generating / Done` 丢弃重叠生成——**Day 3 的内容**。

### ⑦ 提问配额用完

```
checkQuestionLimit() → stopInterview() + 弹订阅框     （CopilotSection.tsx:221-226）
```

**注意它是在 `useEffect` 里持续检查的**，不只是开始时查一次——面试进行中额度耗尽也会停。

### ⑧ Free 用户走到生成

```
getAuthUser() → subscribedPlan === Free → throw new Error("Unauthorized")
                                                        （copilot.ts:94-97）
```

**服务端兜底。** 前端已经拦过一道（`:209-212`），但**前端的拦截不算数**——Day 3 那条「前端只能问，服务端说了算」在这里也成立。

### ⑨ 空转录

```
if (!transcript) return          （CopilotSection.tsx:236）
```

UtteranceEnd 触发时如果一个字都没识别出来（纯噪音、纯静默），直接不提交。

---

## 三、30 秒人话版

> 面向非技术 recruiter。先讲用户问题和结果。

> 求职者在线上面试的时候，面试官问的问题他可能一下答不上来。我们做的这个东西，会实时听面试官在说什么——注意是**听会议软件里传出来的声音**，不是听你自己的麦克风——一边听一边转成文字，等面试官这句话说完，就把问题发给 GPT-4o，几百毫秒之内开始一个字一个字地把参考答案打在屏幕上。整个过程用户什么都不用点。
>
> 难的地方是「实时」两个字：如果等对方说完一整段再一次性处理，等答案出来面试早就尴尬了。所以每 250 毫秒就把音频送出去一次，边说边转文字，靠两秒静默判断这句话说完了没有，再让答案流式地吐出来——**用户看到第一个字的时间，比等完整答案要早好几秒。**

---

## 四、3 分钟技术版

> 结构：Problem → Why → Solution → Decision → Result → Reflection

**Problem** —— 在浏览器里做实时语音转文字加 AI 应答，端到端延迟必须压到「对方说完，一两秒内屏幕上开始有字」，否则这个产品没有意义。

**Why hard** —— 三段都可能慢：音频采集到送出去、语音识别、大模型生成。**任何一段做成「攒够了再一次性处理」，延迟就是三段之和。**

**Solution** —— 整条链路做成流式：
1. `getDisplayMedia` 抓**标签页/系统音频**，不是麦克风——听的是面试官不是自己
2. `MediaRecorder.start(250)` 每 250 ms 切一块，边录边发
3. 浏览器**直连** Deepgram 的 WebSocket，服务端不碰音频，少一跳
4. 开 `interim_results`，识别结果不等整句就往回吐，屏幕上边说边出字
5. `utterance_end_ms: 2000`，静默两秒判定说完，**这一刻才触发生成**
6. 生成走 `streamText` + `createStreamableValue`，前端 `readStreamableValue` 逐 delta 拼接

**Decision** —— 三个关键取舍：
- **WebSocket 而不是 SSE 或轮询**：这是**双向持续**的流，音频要一直往上传（见[传输层](/docs?section=beyz&item=d2-transport)）
- **utterance end 触发而不是每个 final 触发**：一句话会产生多个 final 片段，每个都触发就是几倍的成本和一堆半截答案（见[转录与触发](/docs?section=beyz&item=d2-transcript)）
- **浏览器直连而不是服务端转发**：延迟和带宽成本；代价是必须解决浏览器持有凭证的问题（见 [#1](/docs?section=numbers&item=n01-ephemeral-keys)）

**Result** —— 用户体感是「对方说完，一两秒后屏幕开始出字」。

**Reflection** —— 现在最该补的是**自动重连**：`Close` 事件只改了状态，没有退避重试，面试中途网络抖一下要用户自己点重启，而面试场景断一次的代价很高。其次是**没有端到端延迟埋点**，现在只能靠体感说快，说不出 P95（见[端到端延迟](/docs?section=beyz&item=d2-latency)）。

---

## 五、为什么不用其他方案

| 备选 | 为什么没用 |
|---|---|
| **浏览器 → 自己的服务器 → Deepgram** | 多一跳延迟翻倍；服务器要为每个用户长期扛一条音频流，带宽和成本都难看 |
| **SSE / 轮询代替 WebSocket** | 音频要持续**上行**，SSE 只能下行；轮询做不了流 |
| **等整段说完再转写（非流式 ASR）** | 延迟变成「整段时长 + 识别时长」，产品直接不成立 |
| **每个 final 片段都触发生成** | 一句话多个 final，几倍成本 + 一堆半截答案 |
| **一次性返回完整答案（非流式生成）** | 首字时间从几百毫秒变成好几秒 |
| **用 `getUserMedia` 抓麦克风** | 那听到的是**自己**说话，方向反了 |
