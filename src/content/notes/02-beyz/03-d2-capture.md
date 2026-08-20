---
title: "① 采集层"
tier: ref
section: Beyz
icon: radio
day: 2
level: S
status: done
---

# 采集层（速查）

> ⚪ 被追问 `video:true` 或 250ms 时翻这里。核心结论已在[必看清单](/docs?section=beyz&item=day02)。

## 一句话

**抓的是标签页/系统音频，不是麦克风**——听的是面试官不是自己，方向搞反整个产品不成立。

| API | 抓什么 | 代码 |
|---|---|---|
| `getDisplayMedia` | **标签页/系统音频** ⭐ 主路径 | `useAudioStream.ts:28` |
| `getUserMedia` | 麦克风（另一个模式） | `utils/audio-stream.ts:2` |

> `getUserMedia` 那条开了 `echoCancellation`/`noiseSuppression`——**只对麦克风有意义**（防止扬声器的声音被录回去）。标签页音频是数字信号直接拿的，没经过空气，**信噪比高得多**。

## 追问速查

| 问题 | 答法 |
|---|---|
| **为什么必须 `video: true`？** | 规范要求至少请求一条 video track。**深层原因：授权模型围绕「一个可见画面」建立**——弹窗让用户选的是一个画面，音频是挂在画面上的附属权限。没有画面，用户无法确认自己在共享什么 |
| **拿到后为什么立刻停 video？** | ①省 CPU/内存（否则一直在编码屏幕）②不留能读屏的流（最小权限）③`MediaRecorder` 会录 stream 里所有 track。**`stop()` 和 `removeTrack()` 要都做**——只 remove 不 stop，采集还在跑 |
| **`start(250)` 不传参数？** | 变成批式：**录到 `stop()` 才吐一次数据**。这个参数就是流式和批式的开关 |
| **250 调小（50ms）** | 每秒 20 个包，**包头开销占比上升**；片段太短形不成有效编码帧 |
| **250 调大（1000ms）** | **每块音频自带最多 1 秒延迟**（要攒满才发）；屏幕上的字一顿一顿 |
| **为什么 250 合理** | ①切片延迟人感知不到 ②每秒 4 个包 WebSocket 很轻松 ③比 `utterance_end_ms: 2000` 小 8 倍，不干扰静默判定。（诚实基线：也是 Deepgram 官方 starter 的默认值） |
| **用户没勾「分享音频」？** | `getAudioTracks()[0]` 为空 → `onError` + 清空 stream（`:46-51`）。**这是这个 API 最常见的用户失误**，勾选框默认不勾 |
| **用户点了取消？** | `NotAllowedError` → `onDecline`（`:57-58`），**和真错误分开**——拒绝是正常选择 |
| **用户中途换共享源？** | 先 `stop()` 掉旧的 audio track（`:33-36`），否则泄漏 + 两条共享指示条 |
