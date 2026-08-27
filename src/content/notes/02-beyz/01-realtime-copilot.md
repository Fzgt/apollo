---
title: "① 实时面试 copilot"
tier: must
section: Beyz
icon: radio
day: 2
level: S
status: done
---

# ① 实时面试 copilot

> **简历原句**
>
> Built the real-time interview copilot end to end: tab and system audio through **getDisplayMedia**, streamed over a **WebSocket** to Deepgram on **60-second usage-scoped keys minted per session behind a plan gate**, and answered by **GPT-4o token by token as each utterance ends** — socket kept alive across pauses, token usage logged.

> ℹ️ **v66 把原来的 bullet 1 和 bullet 2 合并成了这一条。**本篇只讲链路本身：捕获 → 转写 → 判断说完 → 流式作答。凭证、用量与状态机在 [② 凭证、配额与四态机](/docs?section=beyz&item=credential-quota)。

## 先看懂产品，再看 API

它做的事情是：捕获会议软件中**面试官的声音**，实时转成文字；判断面试官问完一句后，把问题交给 GPT-4o，并把答案逐步显示出来。

```text
面试官的标签页 / 系统音频
  → 浏览器 getDisplayMedia
  → MediaRecorder 每 250ms 产生音频块
  → WebSocket 发送到 Deepgram
  → 客户端合并 interim 和 final transcript
  → UtteranceEnd 判断一轮说话结束
  → server action 调 GPT-4o
  → 答案 token by token 返回前端
```

这条 bullet 的重点不是「接了两个 API」，而是**把采集、转写、断句和生成整条链路都做成流式，并正确处理流式状态。**

---

# 第一层：必须答明白的六个问题

## 1. 为什么用 `getDisplayMedia`，不用麦克风？

浏览器有两条不同的采集路径：

| API | 采集什么 |
|---|---|
| `getUserMedia` | 用户麦克风，主要是求职者自己的声音 |
| `getDisplayMedia` | 共享标签页或系统播放的音频，也就是面试官的声音 |

产品需要听的是会议软件播放出来的远端声音，所以麦克风不是正确的数据源。

```ts
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true,
});
```

`getDisplayMedia` 的授权模型围绕共享一个可见画面建立，音频是附加轨，因此必须请求 video。项目拿到 stream 后立即停止并移除 video track，只保留音频：

```ts
for (const track of stream.getVideoTracks()) {
  track.stop();
  stream.removeTrack(track);
}
```

`stop()` 停止实际采集，`removeTrack()` 把轨道从 stream 移除。这既减少资源消耗，也符合最小权限原则。

**一句话答法：**

> The interviewer’s voice was playing from another tab, so the microphone was the wrong source. I used `getDisplayMedia` to capture the shared tab audio, then immediately stopped and removed the video track because the product needed no screen frames.

---

## 2. 音频如何实时送到 Deepgram？为什么是 WebSocket？

`MediaRecorder.start(250)` 让浏览器大约每 250ms 产生一个音频 chunk：

```ts
const recorder = new MediaRecorder(stream);
recorder.start(250);

recorder.ondataavailable = ({ data }) => {
  if (data.size > 0) connection.send(data);
};
```

为什么 250ms？这是实际调出来的延迟与包数量折中：

- 更小：包数和固定开销上升；
- 更大：必须先攒满一块，转写首字延迟更明显；
- 250ms 能稳定出字，同时连接压力很小。

不要把它说成理论计算结果。

WebSocket 适合这里，因为：

- 浏览器持续上行音频；
- Deepgram 持续下行识别结果；
- 一次握手后双方都能随时发送；
- 消息顺序和可靠交付适合语音转写。

SSE 主要是服务端单向推送，不能独立解决持续音频上行；轮询会带来大量请求开销和额外延迟。

**一句话答法：**

> `MediaRecorder` emitted a non-empty audio chunk every 250 milliseconds, and the browser sent those chunks over one long-lived WebSocket because both audio upload and transcript delivery were continuous.

---

## 3. Interim 和 final transcript 有什么区别？

Deepgram 会发送两类结果：

| 类型 | 标志 | 更新规则 |
|---|---|---|
| Interim | `is_final: false` | 当前片段的最新猜测，后续结果会重写它 |
| Final | `is_final: true` | 当前片段已经定稿，可以追加到已确认文本 |

最容易写错的是把所有消息直接追加：

```ts
transcript += incomingText; // 错
```

假设 interim 依次是：

```text
"what"
"what is"
"what is your"
```

它们不是新增词，而是当前片段的完整重写。直接追加会显示：

```text
what what is what is your
```

正确做法是把状态拆成：

- `confirmedTranscript`：所有 final 的累计结果；
- 当前 interim：只替换，不累计；
- 屏幕显示：`confirmed + current`。

```ts
const displayed = [confirmedRef.current, incoming]
  .filter(Boolean)
  .join(' ');

setTranscript(displayed);

if (data.is_final) {
  confirmedRef.current = displayed;
}
```

使用 ref 是因为 WebSocket 回调可能在 React 下一次渲染前连续触发；这里需要同步读写最新累计值，而这个内部值本身不需要触发渲染。

**一句话答法：**

> Interim results are rewrites, not appends. I kept committed final text separately and rendered it together with only the latest interim segment, so revisions never duplicated words on screen.

---

## 4. 为什么不能收到 `is_final` 就立刻调用 GPT？

`is_final` 只表示**这一小段音频定稿了**，不表示面试官完整问题已经说完。

一句长问题可能因为换气产生多个 final：

```text
final: "Tell me about a time"
final: "you handled a difficult stakeholder"
final: "and what you learned"
```

如果每个 final 都触发生成，就会产生多次 GPT 请求、重复成本和互相覆盖的答案。

项目使用 Deepgram 的 `UtteranceEnd` 消息，并配置：

```text
utterance_end_ms: 2000
```

连续约两秒没有新词，才把它当成一轮说话结束。

- 太短：正常换气也会提交半截问题；
- 太长：用户需要额外等待；
- 两秒是容纳自然停顿与响应速度之间的经验折中。

⚠️ 名字要说准：`is_final`、`speech_final`、`UtteranceEnd`。没有 `Silent event`，也没有 `utterance_end: true` 这个字段。

**一句话答法：**

> `is_final` closes an acoustic segment, not a conversational turn. I waited for Deepgram’s `UtteranceEnd` event so normal pauses inside one question did not trigger several GPT generations.

---

## 5. GPT 的答案如何流回前端？

实际实现不是手写 SSE，也不是直接暴露一个自定义 `ReadableStream`。

服务端使用 Next.js server action 和 AI SDK RSC：

```text
streamText()
  → createStreamableValue()
  → RSC flight stream
  → readStreamableValue()
  → 前端逐块更新答案
```

答案不等待完整生成，而是 token 到达就显示。面试场景更关心首字延迟，而不是整段答案什么时候全部完成。

如果不用 RSC，可以考虑 `fetch + ReadableStream`。原生 `EventSource` 只支持 GET，而问题内容需要 POST，所以不能直接用普通 EventSource 完成这条请求。

**一句话答法：**

> The answer came back through a Next.js server action using the AI SDK’s streamable value. The client consumed it with `readStreamableValue`, so tokens appeared immediately instead of waiting for the full answer.

---

## 6. 端到端延迟是多少？

这项目前没有可靠实测数字，不能编。

要把延迟拆成两部分：

```text
A. 断句等待：人为配置的 2 秒 UtteranceEnd 阈值
B. 处理延迟：从 UtteranceEnd 到第一个答案 token
```

正确测量方法：UtteranceEnd 到达时记录时间戳，第一个 token 到达时再记录，重复多次给出范围或中位数。

**诚实答法：**

> The two-second silence threshold was a product decision, not processing time. I did not record a reliable post-trigger time-to-first-token measurement, so I would instrument the UtteranceEnd timestamp and the first streamed token rather than inventing a number.

---

# 第二层：整条链路的职责边界

```text
浏览器 → Deepgram：音频和 transcript
浏览器 → 我们的服务端 → GPT-4o：问题和答案
```

音频不经过自己的服务器，减少了一跳延迟，也避免自己的服务为每个用户代理长时间音频流。

代价是浏览器需要直接连接 Deepgram，因此必须获得能建连的凭据。浏览器不能保存长期秘密，这正是 [② 凭证、配额与四态机](/docs?section=beyz&item=credential-quota) 要解决的问题。

---

# 第三层：并发时发生什么？

上一条答案仍在生成时，新的 `UtteranceEnd` 或用户手动请求可能再次触发生成。Bullet 2 的状态机会在 `Generating` 状态直接返回。

需要说准确：**丢掉的是这一次提交动作，不一定立即清掉 transcript 内容。** 守卫发生在 `resetTranscript()` 之前，所以新转写可能继续留在 buffer 中，随后与下一段一起提交。

这对「面试官补充说明」可能有用，但对两个无关问题可能错误合并。更好的方向是让生成期间的新 conversational turn 独立入队或交给用户确认，而不是继续拼进同一个 buffer。

---

# 当前实现要主动承认的三个缺口

1. **没有可靠的 time-to-first-token 实测。** 不能把 2 秒断句阈值说成处理耗时。
2. **Deepgram 连接关闭后没有自动重连。** 更完整的实现应带退避、最大重试次数和状态恢复。
3. **生成期间的新转写可能被合并到下一次提交。** 补充问题适合合并，无关问题则需要独立 turn buffer。

---

# 30 秒主回答

> The interviewer’s audio lived in another tab, so I captured it with `getDisplayMedia`, removed the unused video track and emitted an audio chunk every 250 milliseconds. The browser streamed those chunks directly to Deepgram over WebSocket. Interim transcripts were rewrites, so I kept committed final text separately and rendered it with only the latest interim segment. I did not trigger GPT on every final segment; I waited for Deepgram’s `UtteranceEnd` event to identify the conversational turn. Then a Next.js server action streamed the GPT-4o answer back through the AI SDK’s streamable value so the first tokens appeared immediately.

---

# 最后自测：先答这六题

1. 为什么用 `getDisplayMedia` 而不是麦克风？
2. 250ms 音频块和 WebSocket 分别解决什么？
3. Interim 为什么只能替换，final 为什么可以累计？
4. 为什么 `is_final` 不能直接触发 GPT？
5. 答案如何从 server action 流回浏览器？
6. 两秒静默和实际处理延迟有什么区别？

---

## 术语速查

| 中文 | 英文 |
|---|---|
| 标签页 / 系统音频 | tab / system audio |
| 屏幕共享采集 | display capture |
| 音频块 | audio chunk |
| 临时结果 | interim result |
| 定稿结果 | final result |
| 调和 / 合并 | reconcile |
| 对话轮次 | conversational turn |
| 断句 | utterance segmentation |
| 首字延迟 | time to first token |
| 退避重连 | reconnect with backoff |
