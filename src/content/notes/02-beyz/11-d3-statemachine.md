---
title: "② 四态机"
tier: must
section: Beyz
icon: key-round
day: 3
level: S
status: done
---

# 四态机与重叠生成

> 🔴 **必看**。**这是 Day 3 唯一全新的技术内容**——凭证那半条 Day 1 已学完。
>
> 简历用的动词是 **`drops`（丢弃）**，不是 queues、不是 cancels。**这个词选得很准。**

## 四个状态，五处转移

```
        初始 :146
           ↓
   ┌──→ Ready ──startInterview→ Listening ──UtteranceEnd/手动──→ Generating
   │      :146        :189          :239                            ↑    │
   │                                          再次 submit → :229-232 丢弃 │
   │                                                              流结束 :267-269
   │                                                     （prev 仍是 Generating 才转）
   └────── stopInterview :218 ──────── Done ←──────────────────────┘
                                        │ 下一次 UtteranceEnd → Generating
```

> **`Listening` 和 `Done` 其实都是「等下一个问题」**，只差屏幕上有没有上条答案。分开是为了 UI 的 switch（`:381-402`）能直接按状态渲染——**多一个状态换掉一个条件分支，这是个真实取舍。**

## Q：为什么不用几个 boolean

**最有说服力的答法是算组合数：4 个 boolean = 2⁴ = 16 种组合，合法的只有 4 种，剩下 12 种全是 bug。**

| 非法组合 | 怎么发生 | 后果 |
|---|---|---|
| `isListening && isGenerating` | 上一条还在生成，用户又说了一句 | UI 不知道画什么，两个 spinner 同时转 |
| `isGenerating && isDone` | 流结束忘了把前者置 false | 「要答案」按钮永远不出现，卡死 |
| **四个全 false** | 某个异常路径漏了一次 setState | **未定义状态**，什么都不渲染 |

> **根本问题：boolean 之间的互斥关系只存在于你脑子里，代码里没有任何东西强制它。** 每加一个 boolean，要手动维护的不变量翻一倍。**enum 把「靠自觉」变成「类型上不可能」——这不是代码风格问题，是把运行时 bug 变成编译期错误。**

## Q：怎么保证两次生成不重叠

```js
// CopilotSection.tsx:228-232
if (statusRef.current === CopilotStatus.Generating) return;   // 直接丢弃
```

**重叠有两条互不知情的来源**：语音 `UtteranceEnd` 自动触发；用户手动点「要答案」。**而且语音自己也会连续触发**——说完停两秒（触发），又补一句再停两秒（又触发）。

**⭐ 为什么必须用 `statusRef` 而不是 `status`**：`submitQuestion` 是 `useCallback(..., [])`，**依赖数组是空的**，闭包里的 `status` 永远是初始值 `Ready`——写成 `if (status === Generating)` 这个守卫**永远不会命中**。

> **和 [Day 2 的 `confirmedTranscriptRef`](/docs?section=beyz&item=d2-transcript) 是同一类问题，成因不同**：那个是回调频率高于渲染节奏，这个是空依赖闭包。**两个例子并起来讲，说明你真理解 React 闭包而不是背了条规则。**

**为什么丢弃而不是排队/取消上一个**：

| 策略 | 后果 |
|---|---|
| 排队 | 等第一个生成完再生成第二个——**用户看到的是过时问题的答案** |
| 取消上一个 | 第二次触发常常只是无意义的补充，**却毁掉一个正在生成的有用答案** |
| **丢弃** ✅ | **面试是实时的，过期的答案没有价值** |

## Q：取消之后才到达的响应怎么办

**代码里没有 `AbortController`，但有个更轻的处理，位置很准**：

```js
// :267-269
setStatus((prev) => prev === CopilotStatus.Generating ? CopilotStatus.Done : prev);
```

```
t0  submitQuestion → Generating，开始消费流
t1  用户点停止 → stopInterview → Ready      :218
t2  流终于消费完
```

**如果 t2 无条件写 `Done`**，用户明明停了面试，界面却自己跳回「已生成」。加了 `prev === Generating` 检查后，t2 时 `prev` 已是 `Ready`，写不进去。

> **这就是 stale async response 的标准处理：不阻止它到达，而是让它到达之后写不进去。**

**⚠️ 但它只挡住了状态，没挡住内容**——`:257-266` 的流循环体里没有检查，用户停止后 token 还在往屏幕上写。

**补法**：①`AbortController` 传 signal，**从源头掐掉流**顺带省 token ②**递增的请求 id**，循环里 `if (myId !== currentIdRef.current) break`（改动小，不依赖底层支持）。

> **主动交代这个缺口，比含糊说「我们用了 AbortController」强得多**——后者一查代码就露馅。
