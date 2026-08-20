---
title: "① 数据流全图"
tier: must
section: Beyz
icon: radio
day: 2
level: S
status: done
---

# 实时 copilot 全链路

> 🔴 **必看**。分支细节：[采集层](/docs?section=beyz&item=d2-capture) · [传输层](/docs?section=beyz&item=d2-transport) · [延迟](/docs?section=beyz&item=d2-latency) · [转录与触发](/docs?section=beyz&item=d2-transcript)

## 30 秒版（改一改就能用）

> 求职者线上面试时，面试官问的问题他可能一下答不上来。这个东西会**实时听会议软件里传出来的声音**——注意不是听你自己的麦克风——边听边转文字，等面试官这句话说完，就把问题发给 GPT-4o，几百毫秒内开始一个字一个字把参考答案打在屏幕上，全程不用点任何东西。
>
> 难点全在「实时」：**如果等对方说完一整段再一次性处理，答案出来面试早就尴尬了。** 所以每 250 毫秒就把音频送出去一次、边说边出字、靠两秒静默判断说完了没有、答案也流式吐出来——**用户看到第一个字的时间比等完整答案早好几秒。**

## 3 分钟版骨架

| 段 | 要点 |
|---|---|
| **Problem** | 浏览器里做实时语音转文字 + AI 应答，端到端必须压到「对方说完，一两秒内屏幕有字」，否则产品没意义 |
| **Why hard** | 三段都可能慢：采集→送出、语音识别、大模型生成。**任何一段做成「攒够了再处理」，延迟就是三段之和** |
| **Solution** | 整条链路流式：`getDisplayMedia` 抓标签页音频 → `MediaRecorder.start(250)` 边录边发 → **浏览器直连** Deepgram WebSocket → 开 `interim_results` 边说边出字 → `utterance_end_ms: 2000` 判定说完才触发 → `streamText` + `createStreamableValue` 逐 token 回传 |
| **Decision** | ①**WebSocket 而非 SSE/轮询**：双向持续 ②**utterance end 而非每个 final 触发**：一句话多个 final ③**直连而非服务端转发**：省一跳延迟，代价是浏览器要持有凭证 |
| **Result** | 对方说完，一两秒后屏幕开始出字 |
| **Reflection** | 最该补**自动重连**（现在断了要用户自己点）；其次**没有延迟埋点**，只能靠体感说快 |

## 主干八环节

```
① 采集   getDisplayMedia({video:true, audio:true})
         → 停掉 video 轨，只留 audio          useAudioStream.ts:28,39-43
              ↓ MediaStream
② 切片   new MediaRecorder(stream).start(250)  useMicrophone.ts:35,55
              ↓ 每 250ms 一个 Blob
         if (e.data.size > 0)  ← 发空包 Deepgram 会关连接
              ↓
③ 传输   connection.send(blob)                 useDeepgram.ts:35
         浏览器直连 Deepgram 的 WebSocket
              ↓
④ 识别   nova-2 / interim_results / smart_format
         filler_words:false / utterance_end_ms:2000   useAudioToText.ts:84-88
         ↓ Transcript 事件          ↓ UtteranceEnd 事件
⑤ 合并   屏幕 = 已确认 + 当前临时   ⑥ 触发 submitQuestion()
         is_final 才推进「已确认」          :116-127 / :129-131
              ↓ transcript
⑦ 生成   Free 直接 throw → history.slice(-4)
         streamText(gpt-4o) → 逐 delta stream.update()   copilot.ts:94-135
              ↓ StreamableValue
⑧ 渲染   for await (readStreamableValue) → startTransition(setMessages)
                                                CopilotSection.tsx:257-266
```

> **注意服务端的位置：音频从不经过自己的服务器**，只有第⑦步生成才走 Server Action。**这个拓扑就是 [Day 1 #1 凭证](/docs?section=beyz&item=n01-ephemeral-keys) 存在的全部原因**——直连意味着浏览器必须持有 Deepgram 凭证。

## 失败分支（当日产出要求）

| # | 情况 | 处理 |
|---|---|---|
| 1 | 用户拒绝授权 | `NotAllowedError` → `onDecline`，**和真错误分开** |
| 2 | 选了屏幕但没勾「分享音频」 | 显式检查 `getAudioTracks()[0]` → `onError` |
| 3 | **空音频包** | `if (e.data.size > 0)`——**发 size 0 的包 Deepgram 会直接关连接**，不是防御性编程是必需的 |
| 4 | **Deepgram 断开** | ⚠️ **只改状态，没有自动重连**（见[传输层](/docs?section=beyz&item=d2-transport)） |
| 5 | 麦克风暂停致连接空闲 | 每 10 秒 `keepAlive()`（见 [#1 补充](/docs?section=beyz&item=n01b-keepalive)） |
| 6 | 上一条还在生成又触发 | `statusRef.current === Generating` 直接 return（Day 3 四态机） |
| 7 | 提问配额用完 | `useEffect` **持续检查**，不只开始时查一次 |
| 8 | Free 用户走到生成 | 服务端 `throw Unauthorized`——**前端拦截不算数** |
| 9 | 空转录 | `if (!transcript) return` |

## 为什么不用其他方案

| 备选 | 为什么没用 |
|---|---|
| 服务端转发音频 | 多一跳延迟翻倍；服务器要为每个用户长期扛一条音频流 |
| SSE / 轮询 | 音频要持续**上行**，SSE 只能下行；轮询做不了流 |
| 非流式 ASR | 延迟 = 整段时长 + 识别时长，产品直接不成立 |
| 每个 final 都触发 | 一句话多个 final，几倍成本 + 一堆半截答案 |
| 非流式生成 | 首字时间从几百毫秒变成好几秒 |
| `getUserMedia` 抓麦克风 | 听到的是**自己**，方向反了 |
| **Web Speech API** | ⭐ **它只接受麦克风，没有任何入口把已有的 MediaStream 喂进去**——而我们要听的正是标签页的声音，这一条就判死刑。另外 Safari 基本不可用，Chrome 上其实也是把音频送到 Google 服务器 |
