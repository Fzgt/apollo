---
title: "Day 2 · 参考 · 采集层"
section: Beyz · Day 2–4
icon: radio
day: 2
level: S
status: done
---


> ⚪ **速查**。核心结论（抓的是标签页音频不是麦克风）已在必看清单里；这里是被追问 `video:true` 和 250 ms 时翻的。
# Day 2 · 采集层：getDisplayMedia 与 250 ms 切片

> 回答 [Day 2 清单](/docs?section=beyz&item=day02) 的 **Q6**（为什么必须 `video: true`）和 **Q7**（250 ms 怎么定的）。

## 一、抓的是谁的声音——方向搞反就全错了

**这条 bullet 最容易被误读的地方：它抓的不是麦克风。**

简历原句写的是 `tab and system audio`——**面试官的声音**，从会议软件（Zoom / Teams / Meet）里放出来的那一路。

**方向搞反了整个产品就不成立**：抓麦克风等于听你自己说话，而你需要的是「别人问了什么」。

代码里两个 API 都在，用途完全不同：

| API | 抓什么 | 代码 | 用途 |
|---|---|---|---|
| `getDisplayMedia` | **标签页 / 系统音频**（别人的声音） | `useAudioStream.ts:28` | ⭐ 主路径 |
| `getUserMedia` | **麦克风**（自己的声音） | `utils/audio-stream.ts:2` | 另一个模式 |

`getUserMedia` 那条还开了 `echoCancellation` 和 `noiseSuppression`——**这两个参数只对麦克风有意义**：回声消除是为了不把扬声器放出来的声音又录回去。**抓标签页音频根本不需要，因为那是数字信号直接拿的，没有经过空气。**

> **一个能体现理解的对比**：`getUserMedia` 拿到的是**经过麦克风、空气、房间混响的模拟信号**；`getDisplayMedia` 拿到的是**系统混音的数字信号**。后者信噪比高得多，这也是识别准确率更高的原因之一。

---

## 二、Q6：为什么必须 `video: true`

```js
// useAudioStream.ts:28-31
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true,
}) // video must be true for this API, making it explicit here
```

**代码里那句注释就是答案的一半**，但要能讲清另一半。

### 规范层面

`getDisplayMedia` 的语义是**「屏幕共享」**，不是「音频捕获」。规范规定：

> **必须至少请求一条 video track。** `audio` 是可选的附加项。

写 `{ video: false, audio: true }` 会直接被拒绝（抛 `TypeError`），**不是因为浏览器小气，是因为这个 API 的定义就是「共享一个画面，顺带可以带上它的声音」。**

### 为什么规范要这么定（这一层是加分的）

**因为音频没有可视化的授权载体。**

用户点「共享」时，浏览器弹窗展示的是**一个个可选的窗口/标签页缩略图**——**用户是在选一个画面**。「顺带分享它的声音」是挂在这个画面上的一个勾选框。

**如果允许只要音频不要画面**，那弹窗要怎么展示？「请选择一个你要被窃听的应用」——用户没有任何视觉锚点判断自己授权了什么。

> **一句话答法**：`getDisplayMedia` 的授权模型是围绕「一个可见的画面」建立的，音频是挂在画面上的附属权限。没有画面就没有东西可以让用户确认自己在共享什么，所以规范要求必须请求 video。

### 拿到之后为什么立刻停掉 video track

```js
// useAudioStream.ts:38-43
// remove video track since we only need audio
const videoTrack = stream.getVideoTracks()[0]
if (videoTrack) {
  videoTrack.stop()
  stream.removeTrack(videoTrack)
}
```

**四个理由，前两个是硬的：**

1. **省资源**——一条活着的 video track 意味着浏览器在持续编码屏幕画面，CPU 和内存都在烧，而我们一帧都不用
2. **隐私**——不留一条能读到用户屏幕内容的流。这条讲出来很加分：**拿到了不需要的权限就立刻交还，是最小权限原则在客户端的体现**
3. **`MediaRecorder` 的行为**——`new MediaRecorder(stream)` 会录 stream 里所有 track，留着 video 就会编码视频数据发给 Deepgram
4. **共享指示条**——浏览器在共享画面时会显示醒目的提示条，停掉 video 后行为更干净

**注意 `stop()` 和 `removeTrack()` 是两件事**，都要做：

| 调用 | 作用 |
|---|---|
| `videoTrack.stop()` | **停止采集**——真正释放摄像头/屏幕捕获资源 |
| `stream.removeTrack(videoTrack)` | **从 stream 里摘掉**——后续 `MediaRecorder` 看不到它 |

**只 `removeTrack` 不 `stop`，采集还在跑，资源没释放。** 这是个常见的漏。

### 顺带：先停旧的再设新的

```js
// useAudioStream.ts:33-36
if (mediaStream) {
  mediaStream.getAudioTracks().forEach((track) => track.stop())
}
```

用户可以中途换共享源。**不停掉旧的，旧那条 track 会一直活着采集**——典型的资源泄漏，而且用户会看到两条共享指示条。

---

## 三、Q7：250 ms 的 chunk 是怎么定的

```js
// useMicrophone.ts:55
microphone?.start(250)
```

`MediaRecorder.start(timeslice)` 的参数含义：**每隔 timeslice 毫秒触发一次 `dataavailable`，吐出这段时间的音频 Blob。**

**不传这个参数会怎样？** `start()` 不带参数 = **录到 `stop()` 才吐一次数据**。对实时转写来说等于没有流——**这个参数是「流式」和「批式」的开关。**

### 这个数字的取舍

```
        延迟 ←──────────────────────────→ 开销
    50ms                250ms                1000ms
   每秒 20 个包        每秒 4 个包          每秒 1 个包
   延迟最低            折中                 延迟最高
   包头开销大          ✅                   一秒的音频攒着才发
   WS 帧频繁
```

**调小（比如 50 ms）**：
- ✅ 音频更快到达 Deepgram，理论延迟更低
- ❌ 每秒 20 次 WebSocket 发送，**每个包的固定开销（帧头、编码容器头）占比上升**
- ❌ 太短的音频片段可能不足以形成有效的编码帧，**反而增加解码端负担**

**调大（比如 1000 ms）**：
- ✅ 开销低
- ❌ **每一块音频天然带来最多 1 秒的延迟**——因为得攒满才发
- ❌ interim 结果的刷新变卡顿，屏幕上的字一顿一顿地出

### 为什么 250 落在合理区间

**几个可以拿来论证的角度：**

1. **它把切片延迟压在了「感知不到」的量级**——250 ms 以内的延迟人基本察觉不到，而这是整条链路里**你唯一能自由选择**的延迟项（识别和生成的耗时你控制不了）
2. **每秒 4 个包**——WebSocket 上非常轻松的频率，不会造成消息堆积
3. **它和 `utterance_end_ms: 2000` 的量级差了 8 倍**——切片粒度远小于「判断说完」的粒度，不会因为切片太粗而误判静默

> **诚实的基线**：250 也是 Deepgram 官方 Next.js starter 示例里的值。**但和 [60 秒 TTL](/docs?section=numbers&item=n01-ephemeral-keys) 一样，「是模板默认值」和「它合理」不冲突**——面试官问的是你能不能讲清它合理在哪，不是你有没有亲手推导过。

### 一句话答法

> `MediaRecorder.start(250)` 的意思是每 250 毫秒吐一块音频。不传这个参数它会录到停止才吐一次，那就完全不是流式了——**所以这个参数本身就是流式和批式的开关**。250 是延迟和开销的折中：更小的话每秒要发几十个包，包头开销占比上去了、片段短到形不成有效编码帧；更大的话每块音频天然自带那么多延迟，一秒一块就意味着最多一秒的固定延迟，屏幕上的字也会一顿一顿。250 毫秒的切片延迟人感知不到，而且它比判断「说完了」的两秒静默窗口小了八倍，不会干扰那个判定。

---

## 四、这一层的失败分支

| 情况 | 代码 | 处理 |
|---|---|---|
| 用户点了取消 | `:57-58` | `NotAllowedError` → `onDecline`，**和真错误分开**——拒绝是正常选择，不该弹「出错了」 |
| 选了屏幕但没勾「分享音频」 | `:46-51` | `getAudioTracks()[0]` 为空 → `onError` + 清空 stream |
| 其他异常 | `:59-60` | `onError(error)` |
| 无论成败 | `:62-64` | `finally { onPromptFinish?.() }` ——关掉 loading 状态 |

**第二条是这个 API 最常见的用户失误**：弹窗里「分享音频」的勾选框**默认不勾**，而且在「整个屏幕」模式下部分平台根本不提供系统音频。**代码没有假设 audio track 一定存在，显式检查了——被问「用户没勾会怎样」时，能指着这几行说话。**

---

## 五、预期追问速查

| 问题 | 要点 |
|---|---|
| 为什么不用 `getUserMedia`？ | 那是麦克风，听的是自己。方向反了 |
| 为什么 `video: true`？ | 规范要求；深层原因是授权模型围绕「可见画面」建立，音频是挂在画面上的附属权限 |
| 为什么拿到就停掉 video？ | 省 CPU/内存、不留能读屏的流、避免 MediaRecorder 录进视频。`stop()` 和 `removeTrack()` 要都做 |
| `start(250)` 不传参数会怎样？ | 变成批式，录到 stop 才吐一次数据 |
| 250 调大调小？ | 见上面的取舍 |
| 用户没勾分享音频？ | 显式检查 `getAudioTracks()[0]`，走 `onError` |
| 用户中途换共享源？ | 先 `stop()` 掉旧的 audio track，否则泄漏 |
