---
title: "② 凭证、配额与四态机"
tier: must
section: Beyz
icon: shield-check
day: 3
level: S
status: done
---

# ② 凭证、配额与四态机

> **简历原句**
>
> Built the real-time interview copilot end to end: tab and system audio through **getDisplayMedia**, streamed over a **WebSocket** to Deepgram on **60-second usage-scoped keys minted per session behind a plan gate**, and answered by **GPT-4o token by token as each utterance ends** — socket kept alive across pauses, token usage logged.

> ℹ️ **本篇和 [① 实时面试 copilot](/docs?section=beyz&item=realtime-copilot) 共用简历上的第一条。**临时密钥与 token 用量还在句子里；**四态状态机 v66 已经不在简历上了**，笔记留着——「两条路径同时触发生成怎么办」照样会被问。

## 先看懂：这条是在给实时 demo 补生产边界

Bullet 1 解决「链路怎么跑通」，Bullet 2 解决跑通之后的四类问题：

```text
长期密钥不能泄露     → 60 秒、最小 scope 的临时 key
暂停音频不能断线     → keepAlive
模型成本必须可记录   → 每次生成记录 input / output tokens
异步触发不能互相打架 → 四态状态机丢弃重叠 generation
```

这条的价值是：**不是接通 SDK 就结束，而是继续考虑凭据、连接生命周期、成本和并发。**

---

# 第一层：必须答明白的六个问题

## 1. 浏览器直连 Deepgram，API key 怎么办？

Bullet 1 为了减少音频中转延迟，让浏览器直接连接 Deepgram。但浏览器中的代码、请求和内存都可以被用户检查，因此浏览器不能安全保存长期 key。

正确边界：

```text
长期 Deepgram key：只在服务端
  ↓
服务端为当前会话 mint 临时 key
  ↓
TTL 60 秒 + scope 只有 usage:write
  ↓
浏览器用临时 key 建立 WebSocket
```

这把 key 不是“一次性 key”：60 秒内理论上可以多次建连。准确描述是 **short-lived, scoped credential**。

安全目标也不是保证临时 key 永不泄露，而是限制泄露后的价值：

- 时间窗口短；
- 权限范围小；
- 不能读取项目、列举或创建其他 key。

这就是最小权限和缩小 blast radius。

**一句话答法：**

> The long-lived Deepgram key never left the server. For each session, the backend minted a 60-second key scoped only to `usage:write`, so a leaked browser credential had a very small lifetime and permission surface.

---

## 2. 谁可以调用临时 key 签发接口？

签发接口本身必须有 plan gate，否则任何未登录用户都能循环调用它消耗识别额度。

当前逻辑：

- Free 用户直接拒绝；
- 只有开发环境才允许直接使用长期 key 的分支；
- 响应和客户端 fetch 都使用 no-store，避免凭据被缓存复用；
- 生成答案的 server action 还会独立检查套餐。

所以有两道服务端门：

```text
Deepgram key 签发接口：检查套餐
GPT generation action：再次检查套餐
```

⚠️ 当前签发接口没有按用户限流。付费用户仍可能短时间 mint 大量临时 key。60 秒 TTL 只能降低影响，不能代替 rate limiting。

**一句话答法：**

> The mint endpoint was behind a server-side plan gate, and generation had its own independent plan check. The missing control was per-user rate limiting on the mint endpoint; the short TTL reduced the damage but did not prevent abuse.

---

## 3. 60 秒后 key 过期，半小时面试会断吗？

不会。TTL 主要限制**建立新连接时的认证窗口**：

```text
临时 key 有效 → 完成 WebSocket 鉴权
连接建立
key 后来过期 → 已建立的 socket 继续工作
```

60 秒不等于面试只能运行 60 秒，也不是每分钟续签。

如果 socket 之后真的断开，要重新 mint key 并重新连接。当前实现没有完整的自动重连流程，这是 Bullet 1 的已知缺口。

**一句话答法：**

> The TTL controlled the connection handshake, not the lifetime of an already authenticated WebSocket. Once connected, the interview could continue; a later reconnect would require a freshly minted key.

---

## 4. 用户暂停麦克风时，为什么连接不会断？

Deepgram 的 live socket 在长时间收不到数据时可能被判为空闲并关闭。

- 音频开启：每 250ms 的音频块自然维持连接；
- 音频暂停：客户端定期发送 `keepAlive()` 信令；
- 音频恢复：清理 keepalive timer，让音频重新承担保活。

KeepAlive 管的是**连接**，不是临时 key：

```text
60 秒 TTL：还能不能建立新连接
keepAlive：已建立连接会不会因空闲被关闭
```

心跳不是静音音频，也不会给 key 续期。

⚠️ 当前代码每 10 秒发送一次，而服务端空闲阈值也接近 10 秒，余量太小。浏览器定时器延迟、网络抖动或后台标签页节流都可能让心跳迟到。更合理的是 3–5 秒并对断线实施退避重连。

**一句话答法：**

> Audio chunks kept the socket active while recording. During a pause, a separate keep-alive signal preserved the existing connection; it did not renew the key. The original ten-second interval had too little safety margin and should have been shorter.

---

## 5. Token usage 和 plan quota 到底是怎么实现的？

每次 GPT 生成结束时，使用模型供应商返回的 usage 记录：

```ts
onFinish: async ({ usage }) => {
  await db.insert(copilotUsageLogs).values({
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
  });
};
```

为什么不自己按字符数估算？Tokenizer 与字符数没有稳定比例，中文尤其明显；供应商返回的 usage 才能对应实际计费。

Input 和 output 分开记录，因为价格不同，也方便判断成本来自长 prompt 还是长答案。

### 但简历措辞比代码实现更强

实际配额按**问题条数**计算，不是按 token：

- Free：服务端套餐门禁阻止使用；
- 付费套餐：前端根据 `questionsPerCopilot` 检查问题数量；
- token usage 表目前主要是审计/成本分析，没有被 quota enforcement 查询。

因此 `token usage that backs per-plan quotas` 并不完全准确。正确理解是：**token usage 被可靠记录；套餐和问题数量限制另有实现，但条数上限主要在前端。**

前端检查可以提前给用户反馈，但不能成为安全边界。更完整的实现应在生成的 server action 中原子检查并消耗服务端额度。

**一句话答法：**

> I logged the provider-reported prompt and completion tokens after each generation. To be precise, the implemented quota was question-count based and the paid-plan limit was mainly enforced in the client, while the server independently blocked Free users. I would move the count enforcement server-side.

---

## 6. 四态状态机解决什么？为什么丢弃重叠请求？

系统有四个互斥状态：

```ts
enum CopilotStatus {
  Ready,
  Listening,
  Generating,
  Done,
}
```

它们大致表示：

```text
Ready → Listening → Generating → Done
  ↑                                  |
  └──────── 用户停止 / 下一轮 ───────┘
```

为什么不用多个布尔变量？四个布尔会产生 16 种组合，但只有四种有意义；例如 Listening 和 Generating 同时为真就是非法状态。一个枚举变量让互斥关系由数据结构保证。

重叠 generation 可能来自：

- `UtteranceEnd` 自动提交；
- 用户手动点击请求答案；
- 面试官补充一句，又产生一次 UtteranceEnd。

在 `Generating` 状态，guard 直接返回：

```ts
if (statusRef.current === CopilotStatus.Generating) return;
```

为什么用 ref？这个回调可能长期保持同一个函数引用；直接读取闭包里的 state 可能拿到旧值，ref 提供此刻最新的状态。

为什么选择丢弃新的提交？

- 排队：实时面试中，旧问题的答案可能已经过时；
- 取消当前：一次无意义补充可能破坏正在生成的有用答案；
- 丢弃新触发：保住当前 generation，行为最简单可预测。

这是明确取舍，不是没有代价。新的 transcript 内容可能仍保留在 buffer 中，随后与下一段合并。

**一句话答法：**

> A single enum made the four UI states mutually exclusive. If an automatic or manual submission arrived while generation was active, a ref-backed guard dropped the new trigger because queued answers become stale in a live interview.

---

# 第二层：为什么 ref 很重要？

这两篇里 ref 解决两个相关问题：

| 场景 | 如果只用 state，可能发生什么 | ref 的作用 |
|---|---|---|
| Transcript final 累积 | WebSocket 回调在渲染前连续到达，读取旧累计值 | 同步读写最新 confirmed text |
| Generation guard | 稳定回调捕获初始 status，守卫读到 stale closure | 每次调用读取最新状态 |

共同点是：事件处理器需要“此刻最新值”，但这个内部值不一定需要驱动渲染。

---

# 第三层：停止面试后迟到的响应

流结束时，代码只在状态仍是 `Generating` 时改为 `Done`：

```ts
setStatus((previous) =>
  previous === CopilotStatus.Generating
    ? CopilotStatus.Done
    : previous,
);
```

这样用户已经停止并回到 `Ready` 后，迟到的完成回调不会把界面重新改成 Done。

⚠️ 但它只挡住最终状态写入，没有阻止流循环继续向消息内容追加 token。更好的实现：

- 使用 `AbortController` 真正取消底层生成；或
- 给每次请求分配 version，循环中发现自己不是最新请求就停止写入。

这还能节省用户停止后的模型 token 成本。

---

# 当前实现要主动承认的五个缺口

1. **临时 key 签发接口没有按用户限流。** TTL 不能代替 rate limiting。
2. **KeepAlive 的 10 秒间隔几乎没有安全余量。** 应更短并配合自动重连。
3. **Token usage 没有真正驱动套餐配额。** 实际配额按问题条数，且付费条数限制主要在前端。
4. **丢弃的是提交触发，不一定丢掉 transcript 内容。** 新内容可能和下一段合并。
5. **用户停止后，迟到的流仍可能继续写内容。** 应使用 AbortController 或请求版本。

---

# 30 秒主回答

> Because the browser connected directly to Deepgram, I never exposed the long-lived credential. The backend minted a 60-second key scoped only to `usage:write`, behind a server-side plan gate, and the browser used it only for the handshake. While audio was paused, keep-alive messages preserved the existing socket. After each GPT generation, I logged provider-reported input and output tokens separately. Automatic utterance events and manual requests could overlap, so a ref-backed four-state machine dropped a new trigger while generation was active. The main limitations were missing mint-endpoint rate limiting, an overly tight keep-alive interval, and question-count quota enforcement that should have lived fully on the server.

---

# 最后自测：先答这六题

1. 为什么浏览器不能持有长期 Deepgram key？
2. 60 秒 key 如何限制风险？谁能调用签发接口？
3. Key 过期为什么不会让现有 socket 断开？
4. KeepAlive 保活的到底是 key 还是连接？
5. Token usage 和真实 quota enforcement 分别做到了什么？
6. 四态机为什么选择丢弃重叠 generation？

---

## 术语速查

| 中文 | 英文 |
|---|---|
| 长期凭据 | long-lived credential |
| 临时凭据 | ephemeral / short-lived credential |
| 签发 | mint |
| 有效期 | TTL / time to live |
| 权限范围 | scope |
| 最小权限 | principle of least privilege |
| 影响范围 | blast radius |
| 套餐门禁 | plan gate |
| 限流 | rate limiting |
| 空闲超时 | idle timeout |
| 心跳 / 保活 | heartbeat / keep-alive |
| 用量 / 配额 | usage / quota |
| 状态机 | state machine |
| 守卫 | guard |
| 陈旧闭包 | stale closure |
| 迟到的响应 | late-arriving response |
