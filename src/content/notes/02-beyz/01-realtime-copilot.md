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
> Built the real-time interview copilot end to end: tab and system audio through **getDisplayMedia**, streamed over a **WebSocket** to Deepgram and answered by **GPT-4o token by token as each utterance ends**.
>
> ---
>
> 端到端做了实时面试 copilot：用 getDisplayMedia 采集标签页与系统音频，经 WebSocket 流给 Deepgram，每句话说完由 GPT-4o 逐 token 作答。

> ℹ️ **本篇只讲链路本身**：捕获 → 转写 → 判断说完 → 流式作答。凭证、用量与状态机是另一条 bullet，在 [② 凭证、配额与四态机](/docs?section=beyz&item=credential-quota)。

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

---

# 附：预期追问（第二层）

> 这些内容在 2026-08-24 的一次结构重写里被删掉了，**删的理由是读起来累，不是它不会被问**。上面正文回答「是什么、怎么做的」，这一节回答「为什么不是别的做法、哪里还不行」——追问第二层才用得上。

## 为什么是 WebSocket 而不是 WebRTC

实时音频的「标准答案」往往是 WebRTC，所以这一问八成会来。

| | 为什么存在 |
|---|---|
| **WebRTC** | 为**人对人通话**优化：走 UDP、**允许丢包**换极低延迟、内建回声消除和抖动缓冲 |
| **WebSocket** | 把数据**可靠地**送到对端：走 TCP、不丢包、保证顺序 |

⭐ **这里选 WebSocket 是对的：目标是转写不是通话——一个丢失的音频包等于一段听不见的话，等于一段错的转写。可靠性优先于极致低延迟。** 在 250 毫秒的延迟预算下，TCP 偶尔重传的代价完全可以接受。

> **还有一个有意的顺序**：代码里**先确认 socket 打开了，才启动录音器**。反过来的话，录音器在连接建立之前就开始吐音频块，**那些块无处可发只能丢掉——开头几百毫秒的话就没了**。

## 那个 `size > 0` 检查为什么是必须的

```ts
if (data.size > 0) connection.send(data);
```

录音器在启动瞬间可能吐出一个空块，而 ⭐ **Deepgram 收到 0 字节的包会认为「客户端结束了」，直接把连接关掉**。这一行不是防御性冗余，是防止链路在第一秒就自己断掉。

## 250 毫秒的第二层理由

正文说了它是延迟与包数量的折中，被追问时还有三点可讲：

- ⭐ **这是整条链路里唯一一个你能自由选择的延迟项**——识别耗时和模型生成耗时都不由你控制；
- **它比「判断说完了」的 2 秒窗口小 8 倍**，切片粒度远小于静默判定的粒度，两者不会互相干扰；
- **诚实的基线**：250 也是 Deepgram 官方示例里的默认值。**「是默认值」和「它合理」不冲突**——对方想听的是你能不能讲清它为什么合理。

## 断线重连要补什么（正文只说了「应带退避」）

| 做法 | 说明 |
|---|---|
| **指数退避重连** | 1 → 2 → 4 → 8 秒、封顶 30 秒，**再加随机抖动（jitter）**，避免大量客户端同时重连打爆服务端 |
| **重连必须重新铸凭证** | 那把临时钥匙只有 60 秒有效期，**不能复用** |
| **断开期间的音频** | 三选一：丢掉（转写出现空洞）／本地缓冲重连后补发（要限上限）／**暂停录制并明确提示「连接中断」**。**面试场景第三个最诚实**——与其给一段有空洞的转写让用户以为面试官没说话，不如明说断了 |
| **区分主动停和意外断** | 现在两者走同一个关闭事件。要做重连就必须能分辨，**否则用户点了停止，代码还在勤勤恳恳地重连** |

> **一个真实的坑**：重连后已确认的转写不会丢（它存在 ref 里）。**但如果断在一句话说到一半，那半句会留着，和重连后的下半句拼成一句语义断裂的话。**

## 没有做背压

**背压（backpressure）＝ 生产速度超过消费速度，数据在中间堆积。** 这里生产者是录音器（每秒 4 块），消费者是 WebSocket 发送。代码直接 `send`，没看 `bufferedAmount`（已调用 send 但还没真正发出去的字节数）。

正常网络下问题不大，**但网络严重降级时会形成恶性循环**：缓冲堆积 → 音频越来越滞后 → 识别结果延迟越来越大 → **屏幕上的字比实际说话慢好几秒，用户以为系统卡死**。

⭐ **正确做法是超过阈值就丢掉最旧的一块，而不是排队——一段五秒前的音频现在才发过去，转写出来也没有价值了。「实时系统里，过期的数据不如没有数据。」**

## 九条失败分支

| # | 情况 | 处理 |
|---|---|---|
| 1 | **用户点了取消** | 抛 `NotAllowedError` → 走「用户拒绝」分支，**和真出错分开**（拒绝是正常选择，不该弹「出错了」） |
| 2 | **选了屏幕但没勾「分享音频」** | 流里没有声音轨 → **显式检查并报错**。⭐ 这是这个接口**最常见的用户失误**——勾选框默认不勾 |
| 3 | **空音频包** | `size > 0` 才发 |
| 4 | **Deepgram 连接断了** | ⚠️ 只改状态，**没有自动重连** |
| 5 | **麦克风暂停导致连接空闲** | 每 10 秒发一次心跳（见 [②](/docs?section=beyz&item=credential-quota)） |
| 6 | **生成期间又说话** | 不发起第二次生成，**但字会攒着**，等生成完一起发 |
| 7 | **提问次数用完** | **持续检查**，超限就停止面试并弹订阅框——不是只在开始时查一次 |
| 8 | **免费用户绕过界面直接调接口** | 服务端 `throw Unauthorized`——**前端的拦截不算数** |
| 9 | **一个字都没识别出来** | 空文本直接不提交 |

## 为什么不用其他方案

| 备选 | 为什么没用 |
|---|---|
| **服务端转发音频** | 多一跳延迟翻倍；服务器要为每个用户长期扛一条音频流 |
| **SSE / 轮询** | 音频要持续上行，SSE 只能往下推；轮询做不了流 |
| **等整段说完再转写** | 延迟 = 整段时长 + 识别时长，**产品直接不成立** |
| **每个 final 都触发生成** | 一句话多个 final，几倍成本 + 一堆半截答案 |
| **一次性返回完整答案** | 首字时间从几百毫秒变成好几秒 |
| **`getUserMedia` 抓麦克风** | 听到的是**自己**说话，**方向反了** |
| **浏览器自带的 Web Speech API** | ⭐ **它只接受麦克风输入，没有任何入口能把一条已有的音频流喂进去**——而我们要听的正是标签页里的声音，**这一条就判死刑**。另外 Safari 基本不可用，Chrome 上其实也是把音频送到 Google 的服务器 |
