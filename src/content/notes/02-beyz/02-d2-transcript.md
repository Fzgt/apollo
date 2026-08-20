---
title: "Day 2 · 转录与触发"
tier: must
section: Beyz · Day 2–4
icon: radio
day: 2
level: S
status: done
---

# Day 2 · 转录合并与 utterance-end 触发

> 🔴 **必看**。这是整条 bullet 里最需要动脑子的一段，也是 `interim and finalized transcripts reconciled in the client` 的全部内容。

## interim 和 final 是什么

开了 `interim_results` 之后，**同一句话会被推送很多次**：

```
interim  "what"
interim  "what's your"
interim  "what's your big"
final    "What's your biggest weakness?"   ← is_final: true
```

| | 含义 |
|---|---|
| **interim** | 「我现在**猜**你说的是这个」——**会被后续覆盖，可能改写前面已吐出的词** |
| **final** | 「这一段我**定稿**了」 |

> **为什么要 interim**：不开的话用户说完一整句才看到字，**屏幕空白好几秒**。开了才有「实时感」。
>
> **interim 会改写前面的词**——语音识别带上下文，听到后面可能修正前面（`recognise speech` vs `wreck a nice beach`）。**所以它不是增量，是一个不断被替换的猜测。**

## Q：怎么防止重复上屏

**天真做法会炸**：`transcript += 新来的` → `what what's your what's your big ...`
**因为 interim 每次推的都是「从这段开头到现在」的完整猜测。**

**实际做法是把状态劈成两半**（`useAudioToText.ts:116-127`）：

```js
const joined = clsx(confirmedTranscriptRef.current, transcript);
setTranscript(joined);                          // 屏幕 = 已确认 + 当前临时
if (data.is_final) confirmedTranscriptRef.current = joined;   // 只在 final 推进
```

| 变量 | 存什么 | 谁能改 |
|---|---|---|
| `confirmedTranscriptRef`（**ref**） | 已定稿部分 | **只有 `is_final` 时** |
| `transcript`（state） | 屏幕显示 = 已定稿 + 当前临时 | 每条消息 |

> **核心：临时结果永远是「追加在已确认之后」，不是「累积进已确认」。** 下一条 interim 替换掉的是上一条 interim，`confirmed` 纹丝不动。**替换 + 追加，重复就不可能发生。**

**为什么 `confirmed` 必须用 ref 不能用 state**：`onTranscript` 是 WebSocket 回调，一秒触发好几次。**用 state 的话闭包捕获的是上一次渲染时的值，两条消息之间 React 还没重渲染，第二条读到旧值 → 丢字。** ref 的 `.current` 立即可见。

## Q：为什么在 utterance end 触发，而不是每个 final

> ⭐ **题眼：`is_final` ≠ 说完了。** 它的含义是「**这一段音频我定稿了**」。

一句长句中间只要有停顿就会切出多个 final：

```
"So, tell me about a time"       final   ← 停顿
"when you had to deal with"      final   ← 又停顿
"a difficult stakeholder."       final
```

**每个 final 都触发的后果**：三次 GPT-4o 调用（三倍成本）+ 前两次是**半截问题**的无意义答案在屏幕上闪 + 各写一条 `copilotUsageLogs` 和 `messages` **污染历史**。

**`utterance_end_ms: 2000`** 让 Deepgram 用**两秒静默**判定「这个人说完了，不是中间喘气」，发 `UtteranceEnd` 事件 → `onSpeechEnd` → `submitQuestion`。

> **一句话答法**：`is_final` 说的是「这一段音频定稿了」，不是「这个人说完了」——长句中间有停顿就会切出好几个 final，每个都触发就是三倍成本加一堆半截答案。`utterance_end_ms` 干的事是**把「转写的分段」和「对话的轮次」分开——前者是声学问题，后者是对话问题。**

**2000 这个值的取舍**：太短（500ms）说话中间喘口气就被当成说完；太长（4000ms）延迟直接吃掉四秒。**2 秒大致是自然对话里一个明显的停顿**——比句中换气长，比尴尬沉默短。**面试场景特殊在面试官问完会真的停下来等**，所以这个信号可靠；换成会议纪要这个值就得调。

## 三个小追问

| 问题 | 答法 |
|---|---|
| **`filler_words: false`** | 滤掉 uh/um。收益：转写干净 + **喂给模型的 prompt 噪声更少**。**代价**：做不了口头禅分析，识别阶段就丢了 |
| **流式回答怎么保证顺序** | 两端都是 `for await` **串行消费有序的 async iterable**，RSC streamable value 单向追加。**这里根本没有并发**——真正的并发被四态机挡掉了 |
| **只带 4 条历史** | `MaxHistoryLength = 4`。省 token 和 TTFT；**代价是二十分钟前的上下文丢了** |
| **`startTransition` 干什么** | token 每秒几十个，每个都 `setMessages` 就是每秒几十次重渲染。标为**低优先级可中断**，避免和用户交互抢主线程 |
