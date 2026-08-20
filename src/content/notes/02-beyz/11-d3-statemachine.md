---
title: "Day 3 · 必看 · 四态机"
section: Beyz · Day 2–4
icon: key-round
day: 3
level: S
status: done
---

# Day 3 · 必看 · 四态机与重叠生成

> 🔴 **必看**。回答 **Q2**（为什么不用几个 boolean）、**Q3**（怎么保证两次生成不重叠）、**Q4**（取消之后到达的响应怎么办）。
>
> **这是 Day 3 唯一全新的技术内容**——凭证那半条你在 [#1](/docs?section=numbers&item=n01-ephemeral-keys) 和 [keepAlive 补充](/docs?section=numbers&item=n01b-keepalive) 已经学过了。

## 对应简历原句

> ...logged per-request token usage that backs per-plan quotas; **a four-state machine drops overlapping generations**.

注意动词是 **`drops`（丢弃）**，不是 queues、不是 cancels。**这个词选得很准，下面第三节讲为什么。**

---

## 一、四个状态与真实的转移图

```
                          初始 :146
                             │
                             ▼
                       ┌───────────┐
      stopInterview    │           │
   ┌───────────────────▶   Ready   │
   │        :218       │           │
   │                   └─────┬─────┘
   │                         │  startInterview() → requestStart()
   │                         │  socket 打开 + 麦克风启动 → onStart
   │                         │  :189
   │                         ▼
   │                   ┌───────────┐
   ├───────────────────┤ Listening │
   │                   └─────┬─────┘
   │                         │  UtteranceEnd → submitQuestion()
   │                         │  或用户手动点「要答案」
   │                         │  :239
   │                         ▼
   │                   ┌────────────┐
   │                   │ Generating │◀──┐  再次 submit
   │                   └─────┬──────┘   │  被 :229-232 直接丢弃
   │                         │  └───────┘
   │                         │  流结束 :267-269
   │                         │  ⚠️ 只有 prev 仍是 Generating 才转
   │                         ▼
   │                   ┌───────────┐
   └───────────────────┤   Done    │
                       └─────┬─────┘
                             │  下一次 UtteranceEnd
                             └──────────► Generating
```

**代码里的五处转移，一个不多一个不少：**

| 行 | 转移 | 触发 |
|---|---|---|
| `:146` | → `Ready` | 组件初始值 |
| `:189` | → `Listening` | `onStart`：socket 开了且麦克风启动了 |
| `:239` | → `Generating` | `submitQuestion` 过了守卫之后 |
| `:267-269` | → `Done` | 流消费完，**且 `prev` 仍是 `Generating`** |
| `:218` | → `Ready` | `stopInterview()` |

### 一个值得讲的设计观察

**`Listening` 和 `Done` 其实都是「等下一个问题」的状态**，区别只在屏幕上有没有上一条答案。

理论上可以合成一个状态加一个 `hasAnswer` 标志。**但分开之后 UI 那个 switch（`:381-402`）能直接按状态渲染**，不需要在一个分支里再判断有没有答案。

> **这是「状态机的状态该切多细」的一个真实取舍**：多一个状态换掉一个条件分支。能主动说出这一点，比只会背四个状态名强。

---

## 二、Q2：为什么不用几个 boolean

**最有说服力的答法是算一下组合数。**

假设用四个 boolean：

```js
const [isReady, setIsReady] = useState(true)
const [isListening, setIsListening] = useState(false)
const [isGenerating, setIsGenerating] = useState(false)
const [isDone, setIsDone] = useState(false)
```

**4 个 boolean = 2⁴ = 16 种组合，而合法的只有 4 种。剩下 12 种全是 bug。**

**举三个具体的非法组合：**

| 非法组合 | 现实里怎么发生 | 后果 |
|---|---|---|
| `isListening && isGenerating` 都为真 | 上一条还在生成，用户又说了一句 | UI 不知道该显示「正在听」还是「正在生成」，两个 spinner 同时转 |
| `isGenerating && isDone` 都为真 | 流结束时忘了把 `isGenerating` 置回 false | 「要答案」按钮永远不出现，用户卡死 |
| **四个全 false** | 某个异常路径漏了一次 `setState` | **未定义状态**，UI 什么都不渲染，用户以为页面挂了 |

**根本问题是：boolean 之间的互斥关系只存在于你脑子里，代码里没有任何东西强制它。** 每加一个 boolean，你要手动维护的不变量就翻一倍。

**enum 把这件事从「靠自觉」变成「类型上不可能」：**

```ts
enum CopilotStatus { Ready, Listening, Generating, Done }
const [status, setStatus] = useState<CopilotStatus>(CopilotStatus.Ready)
```

**一个变量只能持有一个值，非法组合在类型层面就不存在。**

> **一句话答法**：四个 boolean 是 16 种组合，合法的只有 4 种，另外 12 种是 bug 而且没人拦着它们发生——比如「在听」和「在生成」同时为真，UI 就不知道该画什么。互斥关系写在 boolean 里只存在于开发者脑子里，写成枚举就变成类型层面不可能。**这不是代码风格问题，是把运行时 bug 变成编译期错误。**

---

## 三、Q3：怎么保证两次生成不重叠

### 守卫在这里

```js
// CopilotSection.tsx:228-232
const submitQuestion = useCallback(async () => {
  if (statusRef.current === CopilotStatus.Generating) {
    console.log("[Submit Question] attempt to submit while generating")
    return          // ← 直接丢弃，不排队、不取消
  }
  ...
}, [])
```

### 重叠是怎么来的——两条独立路径

```
路径 A：语音自动触发   UtteranceEnd → onSpeechEnd → submitQuestion()
路径 B：用户手动点击   「要答案」按钮 → submitQuestion()
```

**这两条路径互相不知道对方存在。** 面试官问完一句（触发 A），用户觉得答案不够又手动点一下（触发 B）——两次提交撞在一起。

**而且 A 自己也可能连续触发**：面试官说完一句停顿两秒（触发），又补了一句，再停两秒（又触发）——**第一条还在生成，第二条就来了。**

### 为什么必须用 `statusRef` 而不是 `status`

**这一点是这节的技术核心，也是最容易被追问的。**

```js
// :148-149
const statusRef = useRef(status)
statusRef.current = status
```

`submitQuestion` 是 `useCallback(..., [])`——**依赖数组是空的**（`:270`）。

**这意味着它只在首次渲染时创建，闭包里捕获的 `status` 永远是初始值 `Ready`。** 如果守卫写成：

```js
if (status === CopilotStatus.Generating) return    // ❌ 永远读到 Ready
```

**这个守卫永远不会命中，等于没写。**

`statusRef.current` 是**一个稳定的对象引用，读的时候取当前值**——闭包捕获的是 ref 对象本身，不是某一刻的值。

> **和 Day 2 的 [`confirmedTranscriptRef`](/docs?section=beyz&item=d2-transcript) 是同一类问题，但成因不同**：
> - Day 2 那个：**回调频率高于渲染节奏**，用 state 会读到上一次渲染的值
> - 这里：**`useCallback` 空依赖**，闭包永远停在初始值
>
> **两个场景都指向同一句话：需要读「此刻最新的值」时，用 ref，不用 state。** 面试里能把这两个例子并起来讲，说明你是真理解 React 闭包，不是背了条规则。

**注意 `:149` 是在渲染期间直接赋值**（不是放在 `useEffect` 里）。这是「latest value ref」的常见写法：赋值在渲染时同步完成，所以下一次事件回调读到的一定是最新的；放进 `useEffect` 反而会晚一拍。

### 为什么是「丢弃」而不是「排队」或「取消上一个」

**这一问是这条 bullet 的题眼，`drops` 那个词就是为它准备的。**

| 策略 | 在这个场景下会怎样 |
|---|---|
| **排队（queue）** | 面试官问了第二个问题，你还在生成第一个问题的答案。等第一个生成完再生成第二个——**用户看到的是一个已经过时的问题的答案**，而他现在需要的是第二个 |
| **取消上一个（cancel & restart）** | 第一条生成到一半被打断。如果第二次触发只是用户手抖或者一句无意义的补充，**就把一个本来有用的答案毁了** |
| **丢弃新的（drop）** ✅ | 保住正在生成的那条，新的直接不做 |

**核心理由：面试是实时的，过期的答案没有价值。**

> **一句话答法**：重叠有两条来源——语音的 UtteranceEnd 自动触发，和用户手动点「要答案」，两条路径互相不知道对方存在。守卫是在 `submitQuestion` 开头读 `statusRef.current`，正在生成就直接 return。**必须用 ref 是因为这个 callback 的依赖数组是空的，闭包里的 status 永远停在初始值 Ready，守卫会永远不命中。** 选择丢弃而不是排队，是因为面试场景里过期的问题排队生成没有意义；不选取消上一个，是因为第二次触发很可能只是一句无意义的补充，不该毁掉一个正在生成的有用答案。

---

## 四、Q4：取消之后才到达的响应怎么处理

**这一问看着像在问 `AbortController`。代码里没有 `AbortController`——但有一个更轻的处理，而且位置很准。**

```js
// CopilotSection.tsx:267-269
setStatus((prev) =>
  prev === CopilotStatus.Generating ? CopilotStatus.Done : prev
)
```

**这是一个函数式更新，而且带了一个 `prev` 的条件检查。**

### 它在防什么

想象这个时序：

```
t0   submitQuestion() → status = Generating，开始消费流
t1   用户点了「停止面试」→ stopInterview() → status = Ready   (:218)
t2   流终于消费完了
```

**如果第 t2 步无条件写 `setStatus(Done)`：**

```
用户明明已经停止了面试，界面却自己跳回「已生成」状态
```

**加了 `prev === Generating` 这个检查之后**：t2 时 `prev` 已经是 `Ready` 了，条件不成立，`setStatus` 返回 `prev` 原值——**迟到的响应写不进去，用户的意图被保住了。**

> **这就是「stale async response（迟到的异步响应）」的标准处理**：**不阻止它到达，而是让它到达之后写不进去。** 判据是「我离开的时候状态还是不是我离开时那个」。

### 但它只挡住了状态，没挡住内容 ⚠️

**这是个真实的缺口，值得主动说：**

```js
// :257-266  流的循环体里，没有任何检查
for await (const delta of readStreamableValue(suggestion)) {
  suggestionContent = `${suggestionContent}${delta}`
  startTransition(() => {
    setMessages([...prevMessages, { ...newMessage, suggestion: suggestionContent }])
  })
}
```

**用户点了停止之后，这个循环还在跑，`setMessages` 还在往屏幕上写字。** 只有最后那一次 `setStatus` 被挡住了。

**该怎么补**（能说出方案就把缺口变成了加分项）：

1. **`AbortController`**——把 signal 传进 Server Action / fetch，用户停止时 `abort()`，**从源头掐掉流**，顺带省掉后续的 token 成本
2. **请求版本号（generation id）**——每次 submit 递增一个 ref，循环体里检查 `if (myId !== currentIdRef.current) break`。**改动小，不依赖底层支持**
3. 至少在循环体里也加上和 `:267` 一样的状态检查

> **面试答法**：「迟到的响应我们是靠函数式更新里的 `prev` 检查挡住的——只有离开时状态还是 Generating 才写 Done。**但要说清楚它只挡住了状态没挡住内容**：流的循环体里没有检查，用户停止之后 token 还在往屏幕上写。正确做法是 AbortController 从源头掐掉，或者至少用一个递增的请求 id 在循环里 break。」

**主动交代这个缺口，比含糊说「我们用了 AbortController」强得多**——后者一查代码就露馅。

---

## 五、预期追问速查

| 问题 | 要点 |
|---|---|
| 四个状态是哪四个？ | `Ready / Listening / Generating / Done`，五处转移能背出来 |
| 为什么不用 boolean？ | 4 个 boolean = 16 种组合，合法只有 4 种；互斥关系没人强制。enum 把运行时 bug 变成类型错误 |
| 重叠从哪来？ | 语音 UtteranceEnd 自动触发 + 用户手动点击，两条路径互不知情；语音自己也会连续触发 |
| 守卫为什么用 ref？ | `useCallback` 空依赖，闭包里的 `status` 永远是初始值 `Ready` |
| 为什么丢弃不排队？ | 面试是实时的，**过期的答案没有价值** |
| 为什么不取消上一个？ | 第二次触发常常只是无意义的补充，不该毁掉正在生成的有用答案 |
| 迟到的响应怎么办？ | `setStatus(prev => prev === Generating ? Done : prev)`。**但只挡了状态没挡内容**——主动说，并给 AbortController / 版本号两个补法 |
| `Listening` 和 `Done` 有什么本质区别？ | 都是「等下一个问题」，只差屏幕上有没有上条答案。分开是为了 UI 的 switch 能直接按状态渲染 |
