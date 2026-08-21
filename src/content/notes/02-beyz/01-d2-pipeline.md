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

> 🔴 **必看**。分支细节：[转录与触发](/docs?section=beyz&item=d2-transcript) · [采集层](/docs?section=beyz&item=d2-capture) · [传输层](/docs?section=beyz&item=d2-transport) · [端到端延迟](/docs?section=beyz&item=d2-latency)

## 对应简历原句

> Built the real-time interview copilot end to end: tab and system audio captured through getDisplayMedia, streamed over a WebSocket to Deepgram's live recognizer, with interim and finalized transcripts reconciled in the client and utterance-end events triggering GPT-4o answers streamed back token by token.

## 30 秒版（改一改就能用）

> 求职者线上面试时，面试官问的问题他可能一下答不上来。这个东西会**实时听会议软件里传出来的声音**——注意不是听你自己的麦克风——边听边转文字，等面试官这句话说完，就把问题发给 GPT-4o，几百毫秒内开始一个字一个字把参考答案打在屏幕上，全程不用点任何东西。
>
> 难点全在「实时」：**如果等对方说完一整段再一次性处理，答案出来面试早就尴尬了。** 所以每 250 毫秒就把音频送出去一次、边说边出字、靠两秒静默判断说完了没有、答案也流式吐出来——**用户看到第一个字的时间比等完整答案早好几秒。**

---

## 主干八环节

### ① 采集：拿到面试官的声音

```js
// useAudioStream.ts:28
navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
```

**`getDisplayMedia` 是浏览器的「屏幕共享」接口** —— 用户点了之后会弹一个窗，让他选要共享哪个标签页或哪个窗口，**并且可以勾上「同时分享音频」**。

**为什么用它而不是麦克风**：我们要听的是**面试官的声音**，那个声音是从会议软件（Zoom / Teams）里播出来的，属于**另一个标签页/应用的音频**。麦克风只能听到你自己说话，**方向反了**。

**为什么 `video: true`**：这个接口规定**必须至少请求画面**，音频只是附带的选项。写 `video: false` 会直接报错。（深层原因见[采集层](/docs?section=beyz&item=d2-capture)。）

拿到之后**立刻把画面那一路关掉**，只留声音（`:39-43`）——我们一帧画面都不用。

### ② 切片：把连续的声音切成小块

```js
// useMicrophone.ts:35,55
new MediaRecorder(mediaStream).start(250)
```

**`MediaRecorder` 是浏览器的录音器。** `start(250)` 里那个 250 的意思是：**每隔 250 毫秒，吐出这段时间录到的音频**，通过一个事件交给你。

**不传这个参数会怎样**：它会一直录，**直到你叫停才一次性给你全部数据** —— 那就完全不是实时了。**所以这个参数就是「流式」和「批式」的开关。**

### ③ 送出去

```js
// useAudioToText.ts:111-113
if (e.data.size > 0) connection.send(e.data);
```

每 250 毫秒来的那一小块音频，直接从**浏览器发给 Deepgram**（不经过我们自己的服务器）。

**那个 `size > 0` 的检查是必须的**：`MediaRecorder` 在启动瞬间可能吐出一个空块，而 **Deepgram 收到 0 字节的包会认为「客户端结束了」，直接关掉连接**。

### ④ 识别

Deepgram 是语音转文字的服务商。开的几个参数（`useAudioToText.ts:84-88`）：

| 参数 | 作用 |
|---|---|
| `model: "nova-2"` | 用哪个识别模型 |
| `interim_results: true` | ⭐ **边听边推临时结果**，不等说完 |
| `smart_format: true` | 自动加标点、格式化数字 |
| `filler_words: false` | 滤掉 uh / um 这类填充词 |
| `utterance_end_ms: 2000` | ⭐ **静默 2 秒 = 判定这个人说完了** |

### ⑤ 合并：把推回来的字拼成屏幕上的内容

Deepgram 推回来的东西有两种：**临时猜测**（会被覆盖）和**定稿**（不会再变）。**这两种的更新规则相反，所以要分开处理**，否则屏幕上会出现重复的字。

👉 **这一段是整条链路里最需要想清楚的，完整走查在[转录与触发](/docs?section=beyz&item=d2-transcript)。**

### ⑥ 触发：什么时候把问题发出去

**收到 `UtteranceEnd` 事件时**（也就是静默满 2 秒），把攒好的文字发给 GPT-4o。

⚠️ **不是每收到一个「定稿」就发** —— 一句话中间有停顿就会产生好几个定稿，每个都发就是几倍成本加一堆半截问题。**详见[转录与触发](/docs?section=beyz&item=d2-transcript)。**

### ⑦ 生成

这一步走**我们自己的服务器**（前面几步都不经过）：

```js
// copilot.ts:94-135
if (subscribedPlan === Free) throw new Error("Unauthorized");   // 免费用户拦掉
const recentHistory = history.slice(-4);                         // 只带最近 4 条上下文
const { textStream } = await streamText({ model: openai("gpt-4o"), ... });
for await (const text of textStream) stream.update(text);        // 模型每吐一块就往前端推一块
```

**`streamText` 的意思是「流式生成」**：不等模型把整个答案写完，而是它写出一个词就传回来一个词。

### ⑧ 渲染

```js
// CopilotSection.tsx:257-266
for await (const delta of readStreamableValue(suggestion)) {
  suggestionContent += delta;                    // 收到一块就接在后面
  startTransition(() => setMessages(...));       // 更新界面
}
```

**所以用户看到的是字一个一个出现**，而不是等几秒钟突然出现一整段。

---

## 整条链路的形状

```
浏览器 ──音频（每 250ms 一块）──→ Deepgram        ← 服务端完全不参与
浏览器 ←──文字（临时 + 定稿）───── Deepgram

浏览器 ──问题文本──→ 我们的服务器 ──→ GPT-4o      ← 只有这一段走服务端
浏览器 ←──答案（一个字一个字）── 我们的服务器
```

> ⭐ **注意音频从不经过自己的服务器。** 这样省了一跳延迟，也省了「服务器要为每个用户长期扛一条音频流」的带宽成本。
>
> **代价是：浏览器必须自己持有 Deepgram 的密钥** —— 而浏览器里藏不住秘密。**这就是 [② 60 秒临时凭证](/docs?section=beyz&item=n01-ephemeral-keys) 那条 bullet 存在的全部原因。**

---

## 九条失败分支

**只会讲顺利路径的人，面试时一问就停。**

| # | 情况 | 处理 |
|---|---|---|
| 1 | **用户点了取消** | 抛 `NotAllowedError` → 走「用户拒绝」分支，**和真出错分开**（拒绝是正常选择，不该弹「出错了」） |
| 2 | **选了屏幕但没勾「分享音频」** | 拿到的流里没有声音轨 → 显式检查并报错。**这是这个接口最常见的用户失误**，勾选框默认不勾 |
| 3 | **空音频包** | `size > 0` 才发 —— **发 0 字节 Deepgram 会直接关连接** |
| 4 | **Deepgram 连接断了** | ⚠️ **只是把状态改成「已断开」，没有自动重连** —— 详见[传输层](/docs?section=beyz&item=d2-transport) |
| 5 | **麦克风暂停导致连接空闲** | 每 10 秒发一次心跳，防止 Deepgram 因为 10 秒没收到东西把连接断掉（见 [② 10 秒 keepAlive](/docs?section=beyz&item=n01b-keepalive)） |
| 6 | **上一个答案还在生成时又说话了** | 不发起第二次生成，**但字会攒着**，等生成完一起发（见[转录与触发](/docs?section=beyz&item=d2-transcript)） |
| 7 | **提问次数用完了** | 持续检查，超限就停止面试并弹订阅框 —— **不是只在开始时查一次** |
| 8 | **免费用户绕过界面直接调接口** | 服务端 `throw Unauthorized` —— **前端的拦截不算数** |
| 9 | **一个字都没识别出来** | 空文本直接不提交 |

---

## 3 分钟版骨架

| 段 | 要点 |
|---|---|
| **Problem** | 浏览器里做实时语音转文字 + AI 应答，端到端必须压到「对方说完，一两秒内屏幕有字」，否则产品没意义 |
| **Why hard** | 三段都可能慢：采集→送出、语音识别、大模型生成。**任何一段做成「攒够了再处理」，延迟就是三段之和** |
| **Solution** | 整条链路流式：抓标签页音频 → 每 250ms 一块边录边发 → **浏览器直连** Deepgram → 边听边出字 → 两秒静默判定说完才触发 → 答案逐字回传 |
| **Decision** | ① **用 WebSocket 不用 SSE/轮询**（双向持续）② **靠静默判定而不是每个定稿都触发**（一句话多个定稿）③ **直连而不是服务端转发**（省一跳，代价是浏览器要持凭证） |
| **Result** | 对方说完，一两秒后屏幕开始出字 |
| **Reflection** | 最该补**自动重连**（现在断了要用户自己点）；其次**没有埋延迟测量点**——代码里没有任何一行在记时间，所以给不出 P95，只能说体感 |

---

## 为什么不用其他方案

| 备选 | 为什么没用 |
|---|---|
| **服务端转发音频** | 多一跳延迟翻倍；服务器要为每个用户长期扛一条音频流 |
| **SSE / 轮询** | 音频要**持续往上传**，而 SSE 只能服务端往下推；轮询做不了流 |
| **等整段说完再转写** | 延迟 = 整段时长 + 识别时长，**产品直接不成立** |
| **每个定稿都触发生成** | 一句话多个定稿，几倍成本 + 一堆半截答案 |
| **一次性返回完整答案** | 首字时间从几百毫秒变成好几秒 |
| **用 `getUserMedia` 抓麦克风** | 那听到的是**自己**说话，方向反了 |
| **浏览器自带的 Web Speech API** | ⭐ **它只接受麦克风输入，没有任何入口把一条已有的音频流喂进去** —— 而我们要听的正是标签页里的声音，这一条就判死刑。另外 Safari 基本不可用，Chrome 上其实也是把音频送到 Google 的服务器 |
