---
title: "Day 2 · 传输层"
tier: ref
section: Beyz · Day 2–4
icon: radio
day: 2
level: S
status: done
---


> ⚪ **速查**。核心结论（为什么 WebSocket、断了没重连）已在必看清单里；这里是被追问 WebRTC、backpressure、重连方案时翻的。
# Day 2 · 传输层：为什么是 WebSocket，断了会怎样

> 回答 **Q1**（Why WebSocket instead of SSE or polling）和 **Q3**（Deepgram 断了会怎样）。

## 一、Q1：为什么是 WebSocket

**先把三个方案的能力摆清楚——这是回答的骨架，不要一上来就说「WebSocket 是全双工的」。**

| | 方向 | 连接 | 谁能主动发 |
|---|---|---|---|
| **轮询 / 长轮询** | 客户端问、服务端答 | 每次一条新请求 | 只有客户端发起 |
| **SSE**（Server-Sent Events） | **只能服务端 → 客户端** | 一条长连接 | 只有服务端 |
| **WebSocket** | **双向** | 一条长连接 | 两边都能，随时 |

### 这个场景的需求是什么

```
浏览器 ──── 每 250 ms 一个音频 Blob，持续几十分钟 ────→ Deepgram   （上行，高频）
浏览器 ←─── interim / final / UtteranceEnd 事件，不定时 ──── Deepgram （下行，高频）
```

**两个方向都是持续的、高频的、不定时的。**

### 于是逐个排除

**SSE 直接出局** —— 它是**单向的**，只有服务端能往客户端推。而这里**音频必须持续上行**。用 SSE 的话，上行还得另开一条 HTTP 通道，等于两套机制维护一个逻辑流。

**轮询出局** —— 两个理由：

1. **上行做不了流**：每 250 ms 发一个 HTTP 请求，就是每秒 4 次完整的请求-响应往返。**每次都要带完整 header（可能上 KB），而音频块本身可能才几 KB**——协议开销和数据本身一个量级
2. **下行拿不到实时性**：识别结果什么时候出来是不确定的，轮询要么间隔短（空转浪费），要么间隔长（延迟）。**而 interim 结果的价值恰恰在于「立刻」**

**WebSocket 留下** —— 一次握手，之后双向随时发，**每帧只有 2–14 字节的帧头**。对一条要跑几十分钟、每秒来回十几条消息的通道，这是唯一合理的选择。

### 一句话答法

> 因为这条链路是**双向且持续**的：音频每 250 毫秒一块要一直往上传，识别结果又要随时往下推。SSE 只能服务端往客户端推，上行没法走，得另开通道；轮询的话上行每秒四次完整 HTTP 往返，光 header 就和音频数据一个量级，下行还拿不到实时性——因为识别结果什么时候出来不确定，间隔短是空转，间隔长就是延迟。WebSocket 一次握手之后两边随时发，每帧只有几个字节的帧头，是这个场景唯一合理的选择。

### 加分层：那 WebRTC 呢

**面试官可能追这一句**（因为实时音频的标准答案往往是 WebRTC）：

| | 适合什么 |
|---|---|
| **WebRTC** | **人对人**的实时通话：UDP、可丢包、极低延迟、内建回声消除和抖动缓冲 |
| **WebSocket** | **把数据可靠送到服务端**：TCP、不丢包、顺序保证 |

**这里选 WebSocket 是对的**，因为：
- 目标是**转写**，不是通话——**一个丢失的音频包 = 一段听不见的话 = 错的转写**，可靠性优先于极致低延迟
- 250 ms 的延迟预算下，TCP 的重传代价完全可以接受
- Deepgram 的 live API 本身就是 WebSocket 接口

---

## 二、连接的生命周期

代码在 `useDeepgram.ts`：

```
connectToDeepgram(options)                    :30
  ├── getApiKey()          ← fetch 临时凭证    :32
  ├── createClient(key)                        :33
  ├── deepgram.listen.live(options)            :35   ← 这里握手
  ├── on(Open)  → setConnectionState(open)     :37-40
  └── on(Close) → setConnectionState(closed)   :42-45

disconnectFromDeepgram()                       :52
  └── connection.requestClose() + setConnection(null)
```

**状态驱动的挂载/卸载**（`useAudioToText.ts:133-153`）：

```js
if (connectionState === SOCKET_STATES.open) {
  connection.addListener(Transcript, onTranscript)
  connection.addListener(UtteranceEnd, onUtteranceEnd)
  microphone.addEventListener(DataAvailable, onData)
  startMicrophone()          // ← socket 开了才开麦
}
return () => { /* 全部 removeListener */ }
```

> **注意顺序：socket 先开，麦克风后开。** 反过来的话，麦克风在连接建立前就开始吐数据，那些包无处可发只能丢掉——**开头几百毫秒的话就丢了**。这个顺序是有意的。

---

## 三、Q3：Deepgram 断了会怎样

### 代码的实际行为

```js
// useDeepgram.ts:42-45
newConnection.addListener(LiveTranscriptionEvents.Close, () => {
  console.log("[Deepgram] connection closed", key)
  setConnectionState(SOCKET_STATES.closed)
})
```

**就这些。** 状态从 open 变成 closed，然后：

1. `useAudioToText.ts:133` 那个 `if (connectionState === open)` 不再成立
2. cleanup 跑掉，所有 listener 被摘掉
3. `useAudioToText.ts:159-161` 的 keepAlive 条件也不成立，interval 被清掉
4. **麦克风还在录，`onData` 已经被摘了，音频直接进虚空**

**⚠️ 没有自动重连。没有退避重试。没有给用户的提示。**

### 这是这条 bullet 最该主动交代的短板

**面试官问「断了会怎样」，标准的糟糕答法是含糊过去。正确答法是直接说清楚，然后说该怎么补：**

> 「现在的行为是：Close 事件只把状态改成 closed，没有自动重连。面试中途网络抖一下，用户得自己点重启。**这是我会优先补的地方，因为面试场景断一次的代价很高**——用户可能过几十秒才发现屏幕不出字了。」

### 该怎么补（能说出方案就把短板变成了加分项）

**① 指数退避重连**

```
断开 → 等 1s 重连 → 失败 → 等 2s → 4s → 8s → 封顶 30s
```

加**抖动（jitter）**避免多个客户端同步重连打爆服务端。

**② 重连要重新铸 key**

`getApiKey()` 在 `connectToDeepgram` 里，所以走 `requestStart()` 自然会重铸——**60 秒 TTL 的凭证不能复用**（见 [#1](/docs?section=numbers&item=n01-ephemeral-keys)：不续签，重连即重铸）。

**③ 断开期间的音频怎么办——这是最难的一问**

```
选项 A：丢掉        断开期间说的话直接没了，转写出现空洞
选项 B：本地缓冲    重连后补发；但要限制缓冲上限，否则断久了内存爆
选项 C：暂停录制    停掉 MediaRecorder，明确告诉用户「连接中断」
```

**面试场景下 C 可能最诚实**——与其给用户一段有空洞的转写让他以为面试官没说话，不如明确提示「断线了」。

**④ 区分「用户主动停」和「意外断开」**

现在的代码里两者都走 `Close` 事件。要做重连就必须能分辨——否则用户点了停止，代码还在勤勤恳恳地重连。加一个 `intentionalCloseRef` 标志位就行。

### 顺带：转录上下文会丢吗

**不会。** `confirmedTranscriptRef`（`useAudioToText.ts:44`）是**客户端的 ref**，连接断了它还在。重连后新的 transcript 会接着往上拼。

**但有个真实的坑**：`resetTranscript()` 只在提交问题时调用（`CopilotSection.tsx:238`）。如果断线发生在**一句话说到一半**，那半句会留在 `confirmedTranscriptRef` 里，**和重连后的下半句拼成一句语义断裂的话**。

**这个细节能主动说出来，说明你真的想过失败路径，而不只是背了「没有重连」这一条。**

---

## 四、backpressure（背压）

**复习重点里列了这个词，但代码里其实没处理——要能说清「为什么这里问题不大」和「什么时候会变成问题」。**

**背压是什么**：生产速度 > 消费速度时，数据在中间堆积。

这条链路上的生产者是 `MediaRecorder`（每秒 4 个 Blob），消费者是 WebSocket 发送。

**代码是这样发的**（`useAudioToText.ts:111-113`）：

```js
if (e.data.size > 0) {
  connection?.send(e.data)    // ← 不检查缓冲区，直接发
}
```

**没有检查 `bufferedAmount`**。如果网络慢，数据会在浏览器的 WebSocket 发送缓冲区里堆积。

**为什么这里问题不大：**

- 音频码率不高，每 250 ms 的块通常几 KB
- 每秒 4 个包，频率很低
- 正常网络下，发送速度远快于生产速度

**什么时候会变成问题：**

- 网络严重降级（弱网、切换 WiFi）时缓冲区会涨
- **而且这里有个恶性循环**：缓冲区堆积 → 发出去的音频越来越滞后 → 识别结果延迟越来越大 → **屏幕上的字比实际说话慢好几秒**，用户会以为系统卡死了

**正确做法**（能说出来就够）：

```js
if (connection.getReadyState() === OPEN && ws.bufferedAmount < THRESHOLD) {
  connection.send(e.data)
} else {
  // 丢弃最旧的、或者降低采样率、或者提示用户网络差
}
```

> **对实时音频，丢掉旧数据比排队更好**——一段五秒前的音频现在才发过去，转写出来也已经没有价值了。**「实时系统里，过期的数据不如没有数据」**，这句话能讲出来很加分。

---

## 五、预期追问速查

| 问题 | 要点 |
|---|---|
| 为什么 WebSocket 不用 SSE？ | SSE 单向，音频要持续上行 |
| 为什么不用轮询？ | 上行每秒 4 次完整 HTTP 往返，header 和数据一个量级；下行拿不到实时性 |
| 为什么不用 WebRTC？ | WebRTC 为人对人通话优化，可丢包换低延迟；这里要的是**可靠送达**做转写，丢一个包就是一段错的转写 |
| 为什么麦克风在 socket 打开后才启动？ | 否则开头的音频包无处可发，直接丢掉 |
| 断了会怎样？ | **只改状态，没有重连**——主动承认，然后给退避重连 + 重铸 key + 断开期音频处理 + 区分主动/意外关闭的方案 |
| 重连后转录会重复吗？ | `confirmedTranscriptRef` 在客户端不会丢；但半句话断开会拼出语义断裂的句子 |
| 背压怎么处理？ | 现在没处理；音频码率低所以正常网络下不成问题；弱网下要看 `bufferedAmount` 并**丢旧包而不是排队** |
