---
title: "Day 2 · 必看 · 转录与触发"
section: Beyz · Day 2–4
icon: radio
day: 2
level: S
status: done
---


> 🔴 **必看**。这条 bullet 最核心的两个技术点：防重复上屏、为什么在 utterance end 触发。
# Day 2 · 转录合并与 utterance-end 触发

> 回答 **Q2**（怎么防止 interim 和 final 重复上屏）和 **Q4**（为什么在 utterance end 触发而不是每句都触发）。
>
> **这是整条 bullet 里最需要动脑子的一段**，也是简历那句 `interim and finalized transcripts reconciled in the client` 的全部内容。

## 一、interim 和 final 是什么

Deepgram 开了 `interim_results: true`（`useAudioToText.ts:85`）之后，**同一句话会被推送很多次**：

```
用户说："What's your biggest weakness?"

t=0.3s   interim  "what"
t=0.6s   interim  "what's your"
t=0.9s   interim  "what's your big"
t=1.2s   interim  "what's your biggest"
t=1.5s   interim  "what's your biggest weak"
t=1.8s   final    "What's your biggest weakness?"   ← is_final: true
```

| | 含义 |
|---|---|
| **interim** | 「我现在**猜**你说的是这个」——**会被后续结果覆盖**，可能改写前面已经吐出的词 |
| **final** | 「这一段我**定稿**了」——不会再变 |

**为什么要 interim？** 因为不开的话，用户说完一整句才看到字，**屏幕会空白好几秒**。开了之后是边说边出字——**这是「实时感」的主要来源**。

**interim 会改写前面的词**，这点很关键：语音识别是带上下文的，听到后面的词可能会修正前面的判断（`"recognise speech"` vs `"wreck a nice beach"`）。**所以 interim 不能简单地往后追加，它是一个不断被替换的猜测。**

---

## 二、Q2：怎么防止重复上屏

### 天真做法为什么会炸

```js
// ❌ 每来一条就追加
transcript += data.channel.alternatives[0].transcript
```

结果：

```
what what's your what's your big what's your biggest ...
```

**因为 interim 每次推送的都是「从这段开头到现在」的完整猜测，不是增量。**

### 实际做法：两段拼接

```js
// useAudioToText.ts:116-127
const onTranscript = (data: LiveTranscriptionEvent) => {
  const transcript = data.channel.alternatives[0]?.transcript
  if (!transcript) return

  const joinedTranscript = clsx(confirmedTranscriptRef.current, transcript)
  setTranscript(joinedTranscript)

  if (data.is_final) {
    confirmedTranscriptRef.current = joinedTranscript
  }
}
```

**核心是把状态劈成两半：**

| 变量 | 存什么 | 谁能改 |
|---|---|---|
| `confirmedTranscriptRef`（ref） | **已经定稿**的部分 | **只有 `is_final` 时推进** |
| `transcript`（state） | 屏幕上显示的 = 已定稿 **+** 当前这段的临时猜测 | 每条消息都更新 |

**走一遍：**

```
confirmed = ""
  interim "what"          → 屏幕 = "" + "what"                = "what"
  interim "what's your"   → 屏幕 = "" + "what's your"         = "what's your"
  final   "What's your biggest weakness?"
                          → 屏幕 = "" + "What's your ..."
                          → confirmed 推进为 "What's your biggest weakness?"

confirmed = "What's your biggest weakness?"
  interim "and"           → 屏幕 = "What's your biggest weakness?" + "and"
  ...
```

> **关键洞察：临时结果永远是「追加在已确认之后」的，而不是「累积进已确认」。** 下一条 interim 来了，它替换掉的是上一条 interim，`confirmed` 纹丝不动。**替换 + 追加，而不是累加——重复就不可能发生。**

### 为什么 `confirmed` 用 `useRef` 而不是 `useState`

`confirmedTranscriptRef` 是 ref（`:44`），`transcript` 是 state（`:43`）。

**这不是随手写的**：

- `confirmed` **只是拼接时的输入**，它自己变化不需要触发重渲染——真正要上屏的是 `transcript`
- **更重要的是时序**：`onTranscript` 是 WebSocket 回调，一秒可能触发好几次。用 state 的话，闭包捕获的是**上一次渲染时的值**，连续两条消息之间 React 还没重渲染，第二条读到的 `confirmed` 就是旧的——**会丢字**
- ref 的 `.current` 是**立即可见**的，没有这个问题

**这是个很值得讲的细节**：*「这里必须用 ref，因为 WebSocket 回调的频率高于 React 的渲染节奏，用 state 会读到陈旧闭包。」*

### `clsx` 在这里干什么

`clsx(a, b)` 会**跳过 falsy 值并用空格连接**。所以：

- `confirmed` 为空时不会拼出一个前导空格
- 两段之间自动有一个空格分隔

**用一个 className 工具做字符串拼接算是取巧**，被问到可以坦率说：*「这里其实是借了 clsx 的『跳过空值 + 空格连接』行为，语义上不太贴切，`[a, b].filter(Boolean).join(' ')` 更直白。」*

### 顺带：`filler_words: false`

```js
// useAudioToText.ts:87
filler_words: false
```

**过滤掉 uh / um / er 这类填充词。** 两个收益：

- 屏幕上的转写更干净，用户读起来不费劲
- **喂给 GPT-4o 的 prompt 噪声更少**——「uh, so, um, tell me about, uh, a time」和「So tell me about a time」对模型是两个输入质量

**代价**：如果哪天要做「面试表现分析」（比如统计口头禅频率），这些词已经在识别阶段被丢了，拿不回来。**是个明确的取舍，不是白捡的。**

---

## 三、Q4：为什么在 utterance end 触发

### 三种触发时机

| 方案 | 会怎样 |
|---|---|
| **每条 interim 都触发** | 一句话触发十几次，**荒谬** |
| **每条 final 都触发** | ⚠️ 这是最容易被误选的，见下 |
| **UtteranceEnd 触发** | ✅ 实际做法 |

### 为什么「每个 final 触发」也不行——这是关键

**很多人以为 final = 说完了。不是。**

**`is_final` 的含义是「这一段音频我定稿了」，不是「这个人说完了」。** 一句长句会产生**多个** final：

```
"So, tell me about a time"          final   ← 停顿了一下
"when you had to deal with"         final   ← 又停顿
"a difficult stakeholder."          final   ← 说完了
```

**如果每个 final 都触发生成：**

- **三次 GPT-4o 调用，三倍成本**
- 前两次拿到的是**半截问题**，生成的答案毫无意义
- 屏幕上会闪过两个错误答案再被第三个覆盖，**用户体验是灾难**
- 而且前两次调用还会各自写一条 `copilotUsageLogs` 和 `messages`，**污染历史记录**

### UtteranceEnd 是什么

```js
// useAudioToText.ts:88
utterance_end_ms: 2000
```

**Deepgram 在检测到 2000 毫秒的静默之后，发一个 `UtteranceEnd` 事件**——意思是「这个人说完了，不是中间喘气」。

```js
// useAudioToText.ts:129-131
const onUtteranceEnd = () => {
  void onSpeechEnd?.()
}
```

`onSpeechEnd` 一路接到 `CopilotSection` 的 `submitQuestion`。

> **一句话答法**：`is_final` 说的是「这一段音频我定稿了」，不是「这个人说完了」——一句长句中间只要有停顿就会切出好几个 final。每个 final 都触发就是三倍成本加上一堆半截问题的答案在屏幕上闪。`utterance_end_ms: 2000` 是让 Deepgram 用两秒静默判断「这轮说完了」，**把「转写的分段」和「对话的轮次」这两件事分开**——前者是声学问题，后者是对话问题。

### 2000 毫秒这个值的取舍

```
   太短（500ms）                    太长（4000ms）
   说话中间喘口气就被当成说完了      面试官说完你要等四秒才开始生成
   → 半截问题被提交                  → 延迟直接吃掉四秒
   → 用户还没说完答案已经出来了
```

**2 秒大致对应「自然对话里一个明显的停顿」**——比句中换气长，比尴尬沉默短。

**面试场景还有个特殊性**：面试官问完问题**通常会真的停下来等你回答**，所以 2 秒的静默是可靠信号。**换个场景（比如会议纪要）这个值就该调**，因为多人对话里没有这么干净的停顿。

---

## 四、生成阶段的两个设计

### 只带最近 4 条上下文

```js
// copilot.ts:86, 99
const MaxHistoryLength = 4
const recentHistory = history.slice(-MaxHistoryLength)
```

**为什么截断**：token 成本 + 延迟。面试进行三十分钟，全量历史会膨胀到很大，而**对回答当前这个问题真正有用的只有最近几轮**。

**代价**：面试官在第 20 分钟问「你刚才提到的那个项目」，模型看不到二十分钟前的内容。**这是个可以主动交代的取舍。**

### 逐 delta 流式回传

```js
// copilot.ts:101, 131-135
const stream = createStreamableValue()
for await (const text of textStream) {
  stream.update(text)
}
stream.done()
```

```js
// CopilotSection.tsx:257-266
for await (const delta of readStreamableValue(suggestion)) {
  suggestionContent = `${suggestionContent}${delta}`
  startTransition(() => {
    setMessages([...prevMessages, { ...newMessage, suggestion: suggestionContent }])
  })
}
```

**`startTransition` 在这里的作用值得说**：token 到达的频率很高（每秒几十个），每个都触发一次 `setMessages` 就是每秒几十次重渲染。**`startTransition` 把这些更新标记为「可中断的低优先级」**，React 可以合并它们、并且在有更高优先级的更新（比如用户点击）时先处理那个。

> **不加会怎样**：答案越长，每次重渲染的开销越大，到后面输入框可能开始卡顿——**因为渲染答案的更新在和用户交互抢主线程**。

### 流式回答怎么保证顺序

**这一问看起来吓人，其实答案很短——但答不出来会显得没想过并发。**

```js
for await (const text of textStream) { stream.update(text) }   // 服务端
for await (const delta of readStreamableValue(v)) { ... }       // 客户端
```

**两端都是 `for await`，也就是串行消费一个 async iterable。**

- `streamText` 返回的 `textStream` 是**有序的异步迭代器**，前一个 chunk 消费完才轮到下一个
- RSC 的 streamable value 是**单向追加**的，客户端只做字符串拼接，没有乱序的可能

> **换句话说：这里根本没有并发，所以不存在顺序问题。** 真正需要担心顺序的是「多个请求同时在跑」——而那个场景被四态机挡掉了（`Generating` 期间直接 return，Day 3 的内容）。

---

## 五、预期追问速查

| 问题 | 要点 |
|---|---|
| interim 和 final 差在哪？ | interim 是会被覆盖的猜测，**可能改写前面的词**；final 是定稿 |
| 怎么防重复上屏？ | 两段状态：`confirmed`（只在 `is_final` 推进）+ 当前 interim。**替换 + 追加，不是累加** |
| 为什么 confirmed 用 ref？ | WebSocket 回调频率高于 React 渲染节奏，用 state 会读到陈旧闭包**丢字** |
| 为什么不每个 final 都触发？ | `is_final` ≠ 说完了。一句长句多个 final → 三倍成本 + 半截问题 + 污染历史 |
| 2000 ms 怎么定的？ | 比句中换气长、比尴尬沉默短；面试场景问完会真停顿，所以这个信号可靠。换场景要重调 |
| 为什么只带 4 条历史？ | token 成本和延迟；代价是长面试里的早期上下文丢失 |
| `startTransition` 干什么？ | 把每 token 的重渲染标为低优先级可中断，避免和用户交互抢主线程 |
| `filler_words: false` 是什么？ | 滤掉 uh/um；转写更干净、prompt 噪声更少。代价是做不了口头禅分析 |
| 流式回答怎么保证顺序？ | 两端都是 `for await` 串行消费有序的 async iterable，**这里没有并发**；真正的并发被四态机挡掉了 |
