---
title: "#1 补充 · keepAlive 与 10 秒心跳"
section: Beyz · Day 2–4
icon: radio
tier: ref
day: 3
level: 前置
status: done
---

# #1 补充 · keepAlive 与 10 秒心跳

> [#1](/docs?section=beyz&item=n01-ephemeral-keys) 讲的是 60 秒 TTL（凭证的寿命）。这一篇讲挨着它的另一个数字：10 秒心跳（连接的寿命）。**这两个数字管的是完全不同的事，是这条 bullet 最容易讲混的地方。**

## 对应简历原句

同样是 Beyz 第 2 条 bullet 里的一个短语：

> Kept the transcription credential out of the browser by minting 60-second, usage-scoped keys per session behind a plan gate, **held the socket alive across microphone pauses**, and logged per-request token usage that backs per-plan quotas...

`held the socket alive across microphone pauses` 就是这一篇的全部内容。

---

## 一、10 秒是什么

就是**心跳间隔**：麦克风暂停期间，每隔 10 秒往 WebSocket 上发一次「我还在」。

```ts
// useAudioToText.ts:159-167
if (microphoneState !== MicrophoneState.Open && connectionState === SOCKET_STATES.open) {
  connection.keepAlive()                              // 先立刻发一次
  keepAliveInterval.current = setInterval(() => {
    connection.keepAlive()                            // 之后每 10 秒一次
  }, 10000)
}
```

---

## 二、为什么需要它

**Deepgram 的实时流连接有空闲超时：10 秒收不到任何东西，服务端主动关连接**（错误码 `NET-0001`）。这是官方文档明确写的数字。

站在 Deepgram 的角度这很合理——一条 WebSocket 在它那边占着识别引擎的资源，客户端不发音频了它凭什么一直养着。

所以问题变成：**面试中途用户把麦克风暂停了，超过 10 秒，连接就没了。** 而重连意味着要重新铸 key、重新握手、之前的转录上下文断掉。

心跳就是解决这个的：**没有音频可发的时候，发个空信号告诉服务端别关。**

---

## 三、关键：为什么只在麦克风**关着**的时候发

看那个条件 —— `microphoneState !== MicrophoneState.Open`。心跳**只在麦克风不是 Open 状态时才跑**。

因为麦克风开着的时候根本不需要心跳：

```ts
// useMicrophone.ts:55
microphone?.start(250)     // MediaRecorder 每 250 毫秒吐一个音频 chunk
```

每 250 毫秒就有一个音频包发过去（`useAudioToText.ts:111-113`），**音频本身就在不停重置那个 10 秒计时器**。10 秒的窗口里会经过 40 个音频包，离超时差得远。

所以逻辑是：

| 麦克风状态 | 谁在维持连接 | 频率 |
|---|---|---|
| **Open** | 音频数据流本身 | 每 250 ms |
| **暂停 / 停止** | keepAlive 心跳 | 每 10 s |

`useAudioToText.ts:168-170` 那个 `else` 分支就是在做这个切换——麦克风一开，立刻 `clearInterval` 把心跳停掉，交给音频流接管。

**这是个很干净的设计：同一个「保活」职责，在两种状态下由两个不同的机制承担，永远只有一个在跑。**

---

## 四、keepAlive 到底发了什么

不是音频。SDK 里就是一条 JSON **文本帧**：

```json
{ "type": "KeepAlive" }
```

（`@deepgram/sdk` 的 `ListenLiveClient.js:99` 能看到。）

**为什么不发一段静音音频顶替？** 两个原因：静音也是音频，Deepgram 会处理它、会计费、还可能吐出空转录污染 transcript；而且代码里有 `if (e.data.size > 0)` 的检查（`useAudioToText.ts:111`），本来就在防止发空包——**发 size 0 的包 Deepgram 会直接关连接**。心跳走的是完全独立的信令通道，不进识别管线。

---

## 五、这个 10 秒选得有问题

**Deepgram 的超时是 10 秒，官方建议心跳间隔 3–5 秒。代码写的是 10 秒——正好卡在超时线上，一点余量都没有。**

算一下就明白：麦克风停在 t=0，代码立刻发一次心跳，下一次在 t=10s。而 Deepgram 的关闭倒计时也从 t=0 开始，t=10s 到点。

那第二次心跳要在**恰好第 10 秒那一刻之前**到达服务端才行。但：

- `setInterval` 从来不保证准时，它保证的是「**不早于**」10000 ms，事件循环一忙就往后拖
- 还要加上到 Deepgram 服务器的网络延迟（几十到几百毫秒）
- 浏览器对**后台标签页**的定时器有节流——而面试场景下 Beyz 这个标签大概率不在前台

也就是说，这个心跳**结构上就是踩线到达甚至迟到**的。它在实践中没大面积炸，多半是靠服务端有点宽容度，不是靠设计。

> **对比着讲会很漂亮**：60 秒那个 TTL 留了 100 倍余量（握手只要几百毫秒），10 秒这个心跳留了 **0 倍**余量。同一份代码里，一个参数保守得很好，另一个贴着悬崖走。

**面试里怎么答**

> 心跳间隔应该是 3–5 秒，代码里写成 10 秒和服务端超时值相同，等于没有余量——`setInterval` 的漂移和网络延迟会让它踩线。这是我会改的第一个数。

---

## 六、和 60 秒放一起记

这两个数字管的是**完全不同的两件事**，对比着记最牢：

| | 60 秒 | 10 秒 |
|---|---|---|
| 管什么 | key 还能不能用来**建立**连接 | 已建立的连接**会不会被服务端关掉** |
| 谁在倒计时 | Deepgram 的 key 过期 | Deepgram 的空闲超时 |
| 过期后果 | 得重新铸一把 key 才能连 | 连接直接断 |
| 触发时机 | 建连前一次性 | 建连后持续，仅麦克风暂停时 |
| 余量 | 100 倍（够用） | 0 倍（危险） |

**一句话**：60 秒管「能不能进门」，10 秒管「进门之后会不会被赶出去」。

**把 keepAlive 说成「续期 key」就露馅了——它续的是连接，不是凭证。**

---

## 七、顺带一个措辞问题

简历写的是 `minting 60-second, usage-scoped keys **per session**`，但代码里凭证的生命周期绑的是**连接**，不是会话：一场面试中途断线重连，会重新铸一把新 key。严格说是 **per connection**。

被追问时主动说清楚就行：*「一次会话正常只铸一把，但断线重连会重铸——所以准确讲是每次建连一把。」*
