---
title: "#1 · 60 秒临时凭证"
section: Day 1 · 数字口径
icon: calculator
day: 1
level: 前置
status: done
---

# #1 · `60-second, usage-scoped keys`

> **标记约定**：★ **必会** = 被问到这条必须答得上来，答不出这条 bullet 就是负资产；☆ **扩展** = 答出来加分、往深一层走，答不出不致命。

## 对应简历原句

Beyz 第 2 条 bullet（v40）：

> Kept the transcription credential out of the browser by **minting 60-second, usage-scoped keys per session behind a plan gate**, held the socket alive across microphone pauses, and logged per-request token usage that backs per-plan quotas; a four-state machine drops overlapping generations.

**这句话的主干动词就是论点**：`Kept the transcription credential out of the browser`——把凭证挡在浏览器外面。后面的 `60-second`、`usage-scoped` 全是**怎么做到**的手段。所以答这条不是在答两个参数，是在答一个安全设计。

> ☆ **扩展**：同一句里 `held the socket alive across microphone pauses`（keepAlive）和 `60-second`（TTL）说的是**两条不同的生命周期**，挨着放很容易被听成一回事。见下方「③ 过期与续签」的对照表，这是本条最容易讲翻车的地方。

---

## 一、这两个词长在哪个功能里 ★ 必会

`60-second` 和 `usage-scoped` 不是两个独立参数，是**同一个设计的两个维度**，属于实时面试 copilot 的**凭证下发**环节。

功能整体：

```
面试进行中的音频  →  实时转成文字  →  文字喂给 GPT-4o  →  流式吐出建议答案
                        ↑
                   Deepgram 干这一步
```

关键约束是**实时**。音频得像水流一样持续送到 Deepgram，延迟越低越好。那么这条流从哪儿发出去？

| | 路径 | 代价 |
|---|---|---|
| A | 浏览器 → 自己的服务器 → Deepgram | 多一跳，延迟翻倍；服务器要为每个用户长期扛一条音频流，带宽和成本都难看 |
| B | 浏览器 → Deepgram（直连 WebSocket） | 最快、最省 |

Beyz 走的是 **B**。代码里能看见：`useDeepgram.ts:35` 直接 `deepgram.listen.live(options)`，SDK 内部开的是一条从浏览器出去的 WebSocket，**服务端全程不碰音频**。

**但 B 有个致命前提：直连意味着浏览器必须自己持有 Deepgram 的凭证。**

而**浏览器里没有秘密**。F12 打开 Network 面板，任何下发到前端的东西都是明文。混淆、加密、藏在变量里全没用——代码最终要用它，用的那一刻它就是明文。

所以这条 bullet 真正要解决的问题是：

> **在一个守不住秘密的环境里，怎么安全地直连第三方服务？**

---

## 二、答案：临时凭证（ephemeral credential） ★ 必会

思路是个转向：

**既然浏览器守不住秘密，那就别给它值钱的秘密。** 给它一把又**小**又**短命**的钥匙。

- **小** → 限定权限（scope）：只能开一扇门
- **短命** → 限定寿命（TTL）：很快自己作废

安全模型整个变了。原来是「**保证 key 不泄露**」（浏览器里做不到），现在是「**假设它一定会泄露，但泄露了也不值钱**」。安全工程里管这个叫缩小**爆炸半径（blast radius）**。

**`60-second` 就是「短命」，`usage-scoped` 就是「小」。这就是这两个词的全部来历。**

> ☆ **扩展**：这不是 Deepgram 特有的招数，是通用模式——AWS STS 临时凭证、OpenAI Realtime API 的 ephemeral token、GCP signed URL、Twilio access token 全是一套思路。**把它讲成「通用模式的一个实例」，比讲成「Deepgram 的用法」高一个层次。**

**技术栈，一句话各一个：**

| 技术 | 干什么 | |
|---|---|---|
| Next.js Route Handler `app/api/deepgram/route.ts` | 服务端铸币端点，唯一能碰长期 key 的地方 | ★ |
| Deepgram Management API `createProjectKey` | 用长期 key 铸出临时 key | ★ |
| next-auth `getAuthUser` | 认人，顺便读套餐 | ★ |
| Deepgram SDK `listen.live` | 浏览器拿临时 key 直连的 WebSocket | ★ |
| HTTP 缓存控制头 | 防止凭证被任何中间层缓存 | ☆ |

---

## 三、按「审什么」逐条过

### ① 为什么是 60 秒

**诚实的基线** ☆：`60` 是 Deepgram 官方 Next.js starter 模板里的默认值，这个 route 的注释（`// exit early so we don't request 70000000 keys while in devmode`）就是从模板原样带过来的。严格讲它不是谁坐下来推算出来的。

**但它站得住脚，你要能讲出为什么合理**——这才是面试官想听的。

> ★ **必会，最关键的一句先说**：**60 秒约束的不是通话时长，是握手窗口。**

这把 key 的全部使命就是完成一次 WebSocket 握手。握手一成，连接自己立住，key 从此再用不上。所以：

- **下界（不能更短）** ★：这 60 秒要覆盖 `fetch("/api/deepgram")` → 拿到 key → `listen.live()` 建连这一段，正常几百毫秒。60 秒给了约 **100 倍余量**，兜住慢网络、用户点了「开始」又愣一下、握手失败重试一次。为什么不设 5 秒?余量太薄，网络一抖就误伤真实用户，而安全收益几乎为零。
- **上界（不能更长）** ★：握手完成后这把 key 就是纯负债——只剩暴露窗口，没有任何用处。设成 1 小时等于白送攻击者 59 分钟。
- **第三个理由，藏在代码里** ☆：这个路由**没有任何限流**（全仓库 grep 不到 `ratelimit`）。任何付费用户都能无限刷 `/api/deepgram` 铸 key，而 Deepgram 项目 key 数量有上限——模板注释里那句「70000000 keys」说的就是这事。**60 秒 TTL 顺带当了垃圾回收**：铸出来的 key 一分钟后自动消失，堆不起来。

**一句话答法** ★

> 60 秒不是通话时长的预算，是握手窗口的预算。握手实际只要几百毫秒，60 秒留了两个数量级的余量兜网络抖动；再长没有任何收益，只是白白拉长泄露窗口，顺带还能让无限流铸出来的 key 自动回收。

---

### ② 谁签发

信任链三段，**每段的边界都要说清楚** ★：

**第一段——长期 root key 只在服务端。**
`route.ts:24` 的 `process.env.DEEPGRAM_API_KEY` 是那把「母钥匙」，能铸 key、能读用量、能看账单。它在 Node 进程的环境变量里，**从不下发**。

**第二段——服务端替浏览器铸币，铸之前先查票。**
注意顺序，**这个顺序本身就是设计**：

```ts
// route.ts:10-13  —— 先查票
const { subscribedPlan } = await getAuthUser()   // 没登录直接 throw
if (subscribedPlan === SubscriptionPlan.Free) { ...拒绝 }

// route.ts:44-49  —— 再铸币
await deepgram.manage.createProjectKey(project.project_id, {
  scopes: ["usage:write"],
  time_to_live_in_seconds: 60,
})
```

**套餐门禁（plan gate）在铸币动作之前**——entitlement 的判定发生在服务端、发生在钱被花掉之前。前端连「要不要给你这个功能」的决定权都没有，**它只能问，服务端说了算**。

> 简历里 `behind a plan gate` 就是指这几行。

**第三段——浏览器拿到的只是产物。**
`useDeepgram.ts:12` 一次 `fetch("/api/deepgram", { cache: "no-store" })`，拿到就用。

**☆ 扩展：防缓存做了三层**

| 位置 | 代码 |
|---|---|
| 路由级 | `route.ts:7` `export const revalidate = 0` |
| 响应头 | `route.ts:56-61` `Surrogate-Control: no-store` + `Cache-Control: s-maxage=0, no-store, no-cache, must-revalidate, proxy-revalidate` + `Expires: 0` |
| 客户端 | `useDeepgram.ts:12` `cache: "no-store"` |

**为什么值得铺三层？因为凭证一旦被缓存，就等于被共享。** CDN 缓存了这个响应，下一个用户拿到的就是上一个用户的 key，临时凭证「一人一把、一次一把」的全部意义当场归零。这是「每层都可能自作主张缓存」这类问题的标准打法：**在你能控制的每一层都显式说不**。

**一句话答法** ★

> 长期 key 只活在服务端环境变量里；浏览器发一个请求，服务端先用 next-auth 认人、查套餐门禁，通过了才用长期 key 调 Deepgram Management API 铸一把限权 60 秒的临时 key 给它。前端从头到尾没有决定权，只有请求权。

---

### ③ 过期与续签

> ★ **必会**：**不续签。而且不需要续签。**

代码能证死：全仓库只有一处 mint（`route.ts:44`），`getApiKey()` 只被 `connectToDeepgram()` 调用（`useDeepgram.ts:32`），而 `connectToDeepgram()` 只被 `requestStart()` 调用（`useAudioToText.ts:83`）。**一条链，一次性，没有任何刷新逻辑。**

**为什么不需要？** 回到 ①：key 只用于握手。socket 一旦 open，认证已经完成，key 过不过期跟这条连接无关。

**☆ 扩展：一个很好用的反向自证**
`useAudioToText.ts:163-167` 每 10 秒调一次 `connection.keepAlive()`，是为了在麦克风暂停时不让连接因空闲被断掉。**如果 key 过期会杀连接，这套 keepAlive 就完全没有意义**——所有面试都会在第 60 秒整齐地挂掉。keepAlive 的存在本身就证明了连接的寿命和 key 的寿命是两回事。

> ★ **必会：必须分清的两条生命周期。**这正是简历同一句里挨着的两个短语，最容易讲混。

| | 管什么 | 谁的机制 | 简历对应短语 |
|---|---|---|---|
| **60 秒 TTL** | 这把 key 还能不能用来**建立新连接** | 凭证的寿命 | `minting 60-second ... keys` |
| **10 秒 keepAlive** | 这条**已建立的连接**会不会因空闲被断掉 | 连接的寿命 | `held the socket alive across microphone pauses` |

**两者互不相干。把 keepAlive 说成「续期 key」就露馅了——它续的是连接，不是凭证。**

**断线了怎么办？** `useDeepgram.ts:52-57` 的 `disconnectFromDeepgram()` 把 connection 置 null；要恢复只能重走 `requestStart()`，那条链会**重新 fetch 一把全新的 key**。

**一句话答法** ★

> 不续签，重连即重铸。凭证的生命周期绑在「建立连接」这个动作上，不绑在会话上；连接活着靠 keepAlive，跟 key 没关系；连接断了就重铸一把新的重连。

**☆ 扩展：主动交代一个真实短板**（比被问出来强）
代码里**没有自动重连**。`Close` 事件只是把状态改成 closed（`useDeepgram.ts:42-45`），没有退避重试。面试中途网络抖一下，得用户自己点重启。诚实版：*「重连是手动的，没做指数退避——这是我会优先补的地方，因为面试场景断一次的代价很高。」*

---

### ④ scope 具体限了什么

代码是 `scopes: ["usage:write"]`（`route.ts:46`），**只有一个 scope** ★。

**最小权限原则（principle of least privilege）** 的教科书用法：不是「给它够用的权限」，是「给它**刚好只够用**的权限」。这把 key 只能干一件事——提交转录请求、消耗额度。

**靠代码本身就能推的两条** ★：

- **不带 `keys:write`** → 拿到这把 key 的攻击者**没法用它再铸 key**。**这条最重要**：它斩断了提权和长期驻留的路。否则攻击者拿到一把 60 秒的 key，第一件事就是用它铸一把永久的，TTL 立刻形同虚设。
- **不带任何读权限** → 读不了项目列表、用量统计、账单。攻击者拿到它，连你用了多少额度都看不到。

**所以最坏情况是什么？** 攻击者在 60 秒内抢到这把 key，能干的极限是**替你消耗一点转录额度**。**没有数据泄露、没有提权、没有持久化。** 这就是「爆炸半径」的具体含义——**量化出来讲，比背概念有力得多** ☆。

> ⚠️ **待办**：查 Deepgram 官方文档（`developers.deepgram.com/docs/authenticating` 和 Management API 参考）**没拿到完整的 scope 清单**，文档里只顺带提到了 `keys:read` / `keys:write`。所以「`usage:write` 精确覆盖哪些端点」这句，**去 Deepgram 控制台看一眼 key 的权限详情再定稿**——别在面试里替第三方 API 编语义，被追一层就崩。上面「不带什么」那两条是安全的逻辑推论（scope 数组里确实只有一个元素），可以直接讲。

**一句话答法** ★

> 只给了 `usage:write` 一个 scope，就是「能提交转录请求」这一件事。它不带 `keys:write`，所以拿到这把 key 也没法用它铸新 key 提权；不带读权限，连用量和账单都看不到。最坏情况就是 60 秒内被人蹭掉一点转录额度——把爆炸半径压到这个程度，才是这个设计真正的产出。

---

## 四、面试官读了代码会问的两个真坑 ☆ 扩展

主动交代 > 被挖出来。

**① dev 模式把 root key 直接发给浏览器**
`route.ts:16-19`：`DEEPGRAM_ENV === "development"` 时返回的是 `process.env.DEEPGRAM_API_KEY` 本体，也就是那把母钥匙。**整个临时凭证设计在开发环境是关掉的**，只靠环境变量隔离兜着。
答法：*「这是为了开发时不刷爆 Deepgram 的 project key 配额留的口子，代价是 dev 下这层保护完全失效。更稳的做法是 dev 也走 mint、只是把 TTL 放长。」*

**② Free 用户被拒时返回的是 HTTP 200**
`route.ts:12`：`return NextResponse.json(new Error("User is not subscribed"))`。`new Error()` 序列化成 JSON 是 **`{}`**，状态码还是 **200**。前端 `result.key` 拿到 `undefined`，`createClient(undefined)` 之后连接以一个看不懂的错误失败，而不是干净的 403。
**这是个真 bug**，主动指出来比背十条安全概念加分。

---

## 五、口径审计结论

| 项 | 结论 |
|---|---|
| 数字从哪来 | `route.ts:48` 写死的常量 `time_to_live_in_seconds: 60`；`route.ts:46` 的 `scopes: ["usage:write"]` |
| 怎么测的 | **不是测量值，是配置值**——无需测量 |
| 归因 | 见下方⚠️ |
| 时间范围与口径 | 无时间口径问题；`per session` 严格说是 **per connection**（中途重连会重铸，见③） |
| 能否复现 | ✅ `grep -n "time_to_live_in_seconds" src/app/api/deepgram/route.ts` 当场就是证据 |
| **标签** | 五个标签都不贴切，实际是 **Code-verifiable constant**——这是 20 条里最安全的一条 |

> ⚠️ **归属待处理（比数字口径严重，先解决再往下走）**
> `git blame` 显示 `/api/deepgram/route.ts` 全文 64 行**每一行**都是 `58ea6195 (Teresa Tian 2024-08-28)`，包括 `time_to_live_in_seconds: 60` 和 `scopes: ["usage:write"]` 两行。同样地，`useDeepgram.ts` / `useAudioToText.ts` / `useAudioStream.ts` / `server/actions/copilot.ts` / `api/stripe/webhook/route.ts` / `CopilotSection.tsx` 里 `Fzgt` 的行数均为 **0**。
> 本仓库 `Fzgt <fzgt320@gmail.com>` 共 14 个提交，集中在 landing page / navbar / email login / cheatsheet 侧边栏 / resumeParser API / updateReminders 表 / next.config 去 console / **`ci.yml`（`92b5605` 2024-04-08，这个确实是你的）**。
> → Beyz 四条 bullet 里能被 git 支撑的只有第 4 条的 CI gate。**这条得先定，再决定这份笔记的答案要不要说出口。**
