---
title: "④ 406 server tests"
tier: ref
section: Periplus
icon: workflow
day: 10
level: S
status: done
---

# 没有网络、没有 API key，怎么全量测试

> ⚪ **速查**。⭐ **这是二十个数字里证据最硬的一条** —— 代码在本机，能指行号，能当场重跑。
>
> **但数字只是表皮。这条 bullet 真正在讲的是：一个 AI 系统怎么做到「没有 API key、没有网络也能全量测试」。**

## 对应简历原句

> **Put a scripted seam behind every external dependency — model provider, search, page fetch and clock — so the whole system runs with no API keys and no network: 406 server tests**, about a second end to end.

## 一、要解决什么

**AI 系统的测试有个根本困难：它依赖的东西全都是不确定的。**

| 依赖 | 为什么没法直接测 |
|---|---|
| **模型** | 同样的输入两次调用结果可能不同；服务商还会悄悄换模型版本 |
| **搜索** | 今天搜出来的和明天搜出来的不一样 |
| **网页** | 随时改版、随时 404 |
| **时间** | `now()` 每次都不同 —— **而这个系统的过期判定直接吃时间** |

**直接对着真实依赖写测试，结果是**：测试**随机变红**（这种叫 flaky test）、跑一次要几十秒到几分钟、**每跑一次都花钱**、CI 里没网就全挂。

> **于是大多数 AI 项目的选择是：干脆不写测试，或者只留几个冒烟测试装装样子。**
>
> **这条 bullet 说的是另一条路 —— 把不确定性全部关进四个可替换的口子里。**

## 二、什么是 seam（接缝）

**术语出处**：Michael Feathers 的《修改代码的艺术》。

> **seam = 你能在不修改这个位置的代码的前提下，改变程序行为的地方。**

**做法：在每一个「字节要离开进程」的位置放一个 seam** —— **生产环境接真货，测试环境接脚本。**

**四个 seam，正是简历列的那四个：**

| 依赖 | 生产实现 | 测试实现 | 注入手法 |
|---|---|---|---|
| **模型** | 真的调 API | `ScriptedClient` | 抽象基类，**只覆写一个方法** |
| **搜索** | 真的调搜索服务 | `ScriptedSearch` | 抽象基类 |
| **抓网页** | 真的发 HTTP | **假的传输层** | **换掉 HTTP 客户端的底层传输** |
| **时钟** | 真的读系统时间 | `FakeClock` | **结构化类型** |

（还有第五个：`ScriptedEmbeddings`，用哈希技巧做的确定性向量。）

## 三、⭐ 最关键的一点：seam 放在哪一层，决定了测试还剩多少真实性

**这一节是整条 bullet 的技术核心，答出来就赢了。**

看那个脚本化的模型客户端（`llm/scripted.py`）：

```python
class ScriptedClient(LLMClient):
    """按顺序返回排好的回复。"""
    async def _chat(self, messages, policy, *, json_object) -> RawResponse:
        self.requests.append(list(messages))     # 记下它被问了什么
        ...
        return RawResponse(text=reply, ...)      # 返回排好的回复
```

> ⭐ **它只覆写了 `_chat` 一个方法，别的什么都没动。**

**而基类负责这些**（`llm/base.py` 文件头注释直接写明了）：

- 提示词组装
- 从模型返回里**提取 JSON**
- **用数据模型校验格式**
- 校验失败后的**修复重试循环**
- 把每次调用记成一条审计记录、算 token 成本

> ⭐ **这些全部还在真实运行。被换掉的只有「把请求发出去」那一下。**

**对比一下常见的错误做法：**

```python
# ❌ 在 agent 层替换
mock_research_agent.run.return_value = fake_claims
```

**这样测试测的是「我的假对象返回了我塞进去的东西」—— 一行真实逻辑都没覆盖到。**

> ⭐ **判断标准一句话：seam 要放在最接近进程边界的位置。越靠外，被测的真实代码越多。**
>
> 这也是为什么评测那个模块的注释说 *"Only the two seams that leave the process are replaced, so a case exercises the real orchestrator, agents, gates and budget accounting"*（**只替换会离开进程的那两个**，所以一个用例跑的是真实的编排器、agent、关卡和预算记账）。

## 四、四个 seam 用了三种不同的注入手法

**能讲出「为什么这三个地方用了不同手法」，是深度的体现。**

### 手法 1：抽象基类 + 只覆写一个方法（模型、搜索）

**适用于「有大量真实的公共逻辑要保留」的场景。** 基类把所有共享行为实现掉，子类只填「怎么把字节送出去」。

### 手法 2：结构化类型（时钟）

```python
# orchestrator/clock.py:16-19
class Clock(Protocol):
    def now(self) -> datetime: ...
    def monotonic(self) -> float: ...
```

**`Protocol` 是 Python 的「结构化类型」** —— 它不要求你继承它，**只要你有这两个方法，你就算是一个 Clock**。

> **真实时钟和假时钟都没有继承 `Clock`。它们只是「长得像」就能用。**
>
> **为什么这里用 Protocol 而不是抽象基类**：因为接口只有两个方法、**没有任何共享实现**，强制继承只是徒增耦合。
>
> ⭐ **判据：接口窄、无共享逻辑 → 用 Protocol；接口宽、有共享逻辑 → 用抽象基类。**

### 手法 3：换掉传输层（抓网页）—— 这个最妙

```python
# tests/test_retrieval.py:63
httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
```

**换掉的不是「抓网页」这个函数，是 HTTP 客户端的传输层** —— 也就是「真正把字节送上网络」的那一层。

**于是抓网页模块里那一整套逻辑全部真实执行：**

- robots.txt 解析与遵守
- 每个域名只允许一个请求在飞
- 同一域名连续请求之间的延迟
- 流式读取 + 2MB 字节上限
- ⭐ **重定向跟随**（连这个行为都在真测）
- 缓存优先于网络

**只有最后建立网络连接那一步没发生。**

> ⭐ **这就是「seam 放得够外」的价值**：如果替换的是「抓网页」这个函数，上面这六条**一条都测不到**。

## 五、⭐ 为什么连时钟都要注入（高频追问）

`clock.py` 的文件头说得很直白：

> *"Nothing in the orchestrator calls `datetime.now` or `time.monotonic` directly."*
>
> （编排器里**没有任何地方直接读系统时间**。）

**时间在这个系统里有三个用途：**

1. **运行时长预算** —— 一次 run 最多能跑多久
2. **各种时间戳**
3. ⭐ **判断证据新不新鲜的「今天」**

**第三个才是关键**：这个系统的核心业务逻辑之一就是「**这条证据过期了没有**」，公式是 `今天 − 页面发布日期 > 该类声明的新鲜度窗口`。

> ⭐ **时间本身就是业务输入，不是环境噪音。**

**不注入时钟会怎样：**

| 问题 | 说明 |
|---|---|
| **时间炸弹测试** | 写一个测「30 天内的价格应该判有效」的用例 —— **过几个月它会自己变红**。这是最恶心的一类随机失败 |
| **测试跑不快** | 测超时和预算的用例得**真的 sleep**。一个 1 秒超时的用例就要等 1 秒 —— ⭐ **406 个测试跑 1.38 秒这件事，本身就依赖假时钟** |

**假时钟把「等 30 秒」变成一次赋值：**

```python
# clock.py:45-49
def advance(self, seconds: float) -> None:
    if seconds < 0:
        raise ValueError("a clock cannot go backwards")   # ⭐ 时钟不能倒流
    self._now += timedelta(seconds=seconds)
    self._monotonic += seconds
```

> **注意它拒绝负数** —— **时钟不能倒流是个业务不变量**，写在了行为里。

**一句话答法**

> 「因为**时间不是环境噪音，是业务输入**。这个系统要判断一条证据新不新鲜，判定依据就是当前时间减去页面发布时间。时钟不注入的话，**一是测试会变成时间炸弹** —— 今天绿的用例过几个月自己红；**二是测超时和预算就得真 sleep，整个套件跑不到一秒。**」

## 六、406 这个数怎么核（已实测）

```bash
cd server && uv run pytest --collect-only -q
```

**16 个测试文件求和：**

| 文件 | 数量 | | 文件 | 数量 |
|---|---|---|---|---|
| `test_orchestrator.py` | **67** | | `test_geo.py` | 22 |
| `test_retrieval.py` | **66** | | `test_media.py` | 21 |
| `test_evals.py` | 38 | | `test_models.py` | 20 |
| `test_verification.py` | 35 | | `test_editor.py` | 14 |
| `test_llm.py` | 29 | | `test_navigation.py` | 13 |
| `test_research.py` | 26 | | `test_embeddings.py` | 12 |
| `test_api.py` | 23 | | `test_content.py` | 9 |
| | | | `test_illustration.py` | 8 |
| | | | `test_postgres_reconnect.py` | 3 |

**合计 = 406** ✅

### ⚠️ 一个必须知道的口径细节

**实际跑起来是 `403 passed, 3 skipped in 1.38s`。**

跳过的 3 个全在数据库重连那个文件，跳过条件是「**需要一个可连接的 PostgreSQL**」。

| 数字 | 含义 |
|---|---|
| **406** | **收集到的用例总数** |
| **403** | **无数据库环境下实际执行的** |

> **简历用 406 这个「收集数」口径没问题**（这是通行做法），**但被问到「全绿吗」时要能主动说清**：那 3 个是**有条件跳过的**数据库重连测试，**不是失败**。
>
> **答不清这一点，会显得数字是拍的。**

## 七、测试构成说明了什么

**分布本身就是信息**：编排器 67 个、检索 66 个，占了三分之一 —— **这两块正好是系统里最复杂、最容易出错的地方**（阶段编排与关卡、抓取与去重）。

**这不是严格的单元测试/集成测试分层**，更像是**按模块的行为测试**：每个用例都跑真实的类和真实的控制流，**只有出进程的那一下被换成脚本**。

> **被问「你们测试怎么分层的」，答这个比硬套测试金字塔诚实。**
