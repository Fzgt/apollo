---
title: Periplus 五条 bullet 口播
section: 项目口播
icon: mic-2
---

# Periplus 五条 bullet — 只练「能讲出来做了什么」

> **这不是笔记，是口播稿。** 每条先照着念两遍，然后合上页面用自己的话复述一遍。
> 复述不出来的那条，回「资料 → Periplus」那一组找对应小节。
> 目标是**五条都能讲 30 秒不卡壳**，不是把笔记读完。
>
> 面试是 2026-09-10。Periplus 是配角，主菜是 React + TS + 前端性能——这一篇的定位是「被顺嘴问到时接得住」，不是复习重点。

## 先搞定六个词（不懂这六个，下面的话说不顺）

| 词 | 一句话 | 在 Periplus 哪儿 |
|---|---|---|
| **structured output** | 让模型返回严格 JSON 而不是自然语言，代码能直接解析 | 每个 agent 都用 Pydantic 模型接住，`extra="forbid"`：模型多返回一个字段就报错，不静默吞掉 |
| **grounding / 幻觉** | 模型会编造事实。grounding = 每句话都必须能指回原文出处 | Explorer 要求每条 claim 附一段**逐字引文**，代码回原文核对 |
| **RAG（检索增强生成）** | 先搜网页 → 把网页塞进 prompt → 让模型基于它回答，而不是凭记忆 | `retrieval/` 那一层：search → fetch → 清洗 → 截断 |
| **embedding / pgvector** | 把文本变成一串数字（向量），意思相近的向量距离近。pgvector 是 Postgres 存向量、查近邻的扩展 | 证据缓存：新问题来了先查「以前抓的页里有没有意思接近的」，命中就不再花一次抓取 |
| **temperature / thinking** | temperature 高 = 更发散，0 = 最确定。thinking = 让模型先推理再答 | 验证阶段 temperature 0 且**关掉 thinking**——那一步要的是比对，不是论证 |
| **eval / golden set** | 一组固定的测试用例＋固定答案，用来量化「改了 prompt 之后变好还是变坏」 | `server/evals/cases/` 四个 case，每个把输入、网页、时间全冻住 |

## 第 1 条 · 六阶段 + typed stage contracts + OpenAPI 生成类型

> 原文：Built a six-stage agentic workflow … where the orchestrator knows only typed stage contracts, carried through to the React client as types generated from the OpenAPI schema.

**30 秒口播**

「整个流程分六个阶段：研究、验证、规划、写作、编辑、配图。编排器叫 Hermes，它只认一件事——每个阶段的输入输出类型。它不知道任何一个阶段内部是怎么调模型、怎么抓网页的，它只决定下一步能不能跑。阶段之间通过 adapter 连，adapter 把各 agent 自己的契约翻译成 Hermes 眼里统一的 `artifact in → StageResult out`。同一套类型经 FastAPI 的 OpenAPI schema，用 openapi-typescript 生成到前端，所以后端改一个字段，前端是编译期报错，不是运行时白屏。」

**代码落点**

- `orchestrator/hermes.py` — 只管顺序、预算、重试、审计
- `orchestrator/stages.py` — `StageAdapter` 协议，六个 adapter
- `web/package.json` → `generate:api`: `openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.generated.ts`

**必被追问**

- *「生成类型跟手写类型怎么选？」* → 跨进程边界的用生成的，因为那是别人（后端）说了算的形状；进程内自己的 UI state 手写。生成的类型不该手改，改了下次生成就没了。
- *「后端改字段，前端怎么知道？」* → 重跑 `generate:api`，`tsc -b` 当场爆。真正的保障是这一步进 CI，不是靠人记得跑。

## 第 2 条 · 证据与判断分离（**这条最该主动讲**）

> 原文：the research stage emits claims bound to exact source quotes, a separate verification stage rules on them, and application code — not prompts — enforces citation membership and freshness windows.

**30 秒口播**

「研究阶段（Explorer）只做两件事：找出候选地点，把每个事实写成一条 claim，并且**逐字**摘一段原文当引文。它自称的引文我不信——代码拿这段字符串回原页面做包含检查，只做大小写和空白归一化，标点、数字、措辞动了一个字就整条丢弃。验证阶段（Auditor）是**另一次模型调用**，它看不到研究阶段的推理过程，只看到 claim 和挂在它旁边的那几条证据，逐条判 supported / partial / contradicted / unsupported。而 no-evidence 和过期这两种结论**模型无权给**，是代码算的——每类事实有自己的新鲜度窗口，价格类的窗口短，地标位置这种永不过期。一条没有支撑引文的断言，进不了下一阶段。」

**代码落点**

- `retrieval/document.py:132` `contains()` → `_fold()` 只折叠空白 + casefold
- `agents/research.py:420` 引文回绑，失败计入 `rejected_quotes`
- `agents/verification.py` 系统提示里明写 "Never decide freshness … application code owns those"
- `agents/verification.py:382` `evidence_is_stale()`，按 `FRESHNESS_DAYS[claim.kind]`

**必被追问**

- *「引文匹配怎么做的？模型改了个标点呢？」* → 就是丢掉。归一化只到空白和大小写，不做模糊匹配——一条对不上原文的引文比没有引文更糟，它看起来像出处。
- *「提示注入怎么办？」* → 系统提示里把 claim 和网页正文都声明为不可信数据；`evals/cases/injected-instruction.json` 就是专门测这个的 case。
- **前端向的追问（简历上一个字没有，必须自己想好）**：引文在界面上怎么呈现？点开是原文还是跳转？一条 partial 的断言长什么样？→ 现在的实现是 `VerdictBadge` 组件把 verdict 显示成不同色的标签。这个答案要诚实：可视化只做到标签级。

## 第 3 条 · 持久化续跑 + 预算 + pgvector 缓存

> 原文：Persisted run state, stage artifacts and a pgvector evidence cache in PostgreSQL under per-run token and time budgets.

**30 秒口播**

「一次运行的状态、每个阶段的产物都落 Postgres，所以中途挂掉可以从最后一个完成的阶段续跑，不用从头烧 token。预算是四个维度——搜索次数、抓取次数、token、墙钟时间，每个都可以不设。检查点在两处：一个阶段跑完之后、下一个阶段开始之前；正在跑的阶段不会被打断。**续跑时预算是接着算的，不是清零**，否则反复重启就能绕过上限。另外证据缓存用 pgvector：抓过的页面存向量，新查询先看有没有语义足够接近的旧页，命中就省一次抓取。」

**代码落点**

- `orchestrator/budget.py` — `RunBudget` 四个 optional 上限；文档里明写 replay 要 seed 已花的量
- `orchestrator/clock.py` — 时间也走注入的 Clock，没有一处直接 `datetime.now()`
- `storage/postgres_evidence.py` — 真实现；`retrieval/evidence_cache.py` 是 seam + 内存实现

**必被追问**

- *「前端怎么知道跑到哪一步了？」* → **1 秒轮询**。`web/src/api/queries.ts:21` 的 `refetchInterval` 返回 1000，直到 status 是终态才返回 false 停掉。选轮询不选 SSE 的理由：阶段是秒级到分钟级，1 秒粒度够，而 SSE 要在服务端维护连接、处理断线重连，为这个粒度不值得。刷新页面不丢，因为进度是查出来的不是推来的。
- *「为什么 Clock 也要注入？」* → 新鲜度判断、墙钟预算、时间戳全依赖它。不注入就没法写「一年后跑同一个 case 结果一样」的测试。

## 第 4 条 · 脚本化接缝 + 测试

> 原文：Put a scripted seam behind every external dependency — model provider, search, page fetch and clock — so the whole system runs with no API keys and no network: 406 server tests, about a second end to end.

**30 秒口播**

「出进程的依赖只有四个：模型、搜索、抓网页、时钟。每一个后面都有一个协议接口，测试里换成脚本化实现——`ScriptedClient` 就是把要返回的回复排成队列，按顺序吐出来，还能反查它被问了什么。所以整个系统在没有 API key、没有网络的情况下能跑完。后端测试跑完大约一秒。关键是**被替换掉的只有这四个**：grounding、引文拒绝、去重、新鲜度降级、gate 拦截、成本核算走的全是生产代码路径，不是 mock 自己跟自己说话。」

**必须知道的三个事实（别说错）**

- 简历写的 **406 是当时的数，现在是 464**。被问就说「简历定稿时 406，现在 464」。
- **406 是 server tests**。前端是 vitest，5 个测试文件、约 24 个用例，外加 Playwright e2e。被问「前端测了多少」就照实说，别把 406 往前端身上安。
- **都是快测试**。集成层的答案是：eval harness 装的是**真的 Hermes、真的 agent、真的 gate**，只换那两个出进程的 seam——它就是这个项目的集成测试。

**必被追问**

- *「接缝跟真依赖行为不一致怎么办？」* → 这是所有 fake 的通病，我的兜底是 eval 里那个 oracle 会**匹配真实 prompt 的前缀**（`_VERIFY_PREAMBLE`），prompt 结构一改，这里当场炸，而不是悄悄给出错的判定。

## 第 5 条 · 黄金集打分，断言区间不断言字面

> 原文：Scored the pipeline against a golden set … asserts ranges rather than literal output on evidence-gap rate, citation integrity and token cost.

**30 秒口播**

「改 prompt 最大的问题是没法判断改好了还是改坏了。所以我建了一组 case，每个 case 把三样东西冻住：输入的行程需求、检索到的网页、以及时钟。跑完之后算一组指标——证据缺口率、引文完整性、token 成本。断言写的是**区间**不是字面输出：『缺口率不高于 0.4』『引文错误等于 0』。断言模型逐字输出的测试只会天天红，最后被人删掉。报告里还记了每个阶段的 **prompt 摘要哈希**，所以指标动了能追到是不是 prompt 改了。」

**必须知道的三个事实**

- golden set 现在是 **4 个 case**：baseline、提示注入、被改写的引文、过期价格降级。别说成「一套大规模评测集」。
- harness 目前只驱动 **research + verify 两个阶段**（`SUPPORTED_STAGES`）。后四个阶段还没有模型脚本。**这条要主动说**，面试官点开仓库就能看到。
- 引文完整性拆了四种失败：引了不存在的证据 ID、引了自己没带的 claim ID、把 verdict 不允许的 claim 当事实陈述、post-verification 产物里带着没判过的 claim。

**必被追问**

- *「区间的上下界怎么定的？」* → 先跑 baseline 拿到当前值，再往外放一点余量。这是承认的弱点：它防的是回归，不是证明「够好」。
- *「跑一次多少钱？」* → 零。整套 eval 离线跑，模型走 oracle。

## 练的顺序

1. 上面六个词先看一遍（10 分钟）
2. 五条口播各念两遍、合上页面复述（每条 15 分钟）
3. 复述卡住的那条，回「资料 → Periplus」翻对应小节
4. **第 2 条和第 5 条要能主动开口讲**，剩下三条能接住就行
