---
title: "#15 · about a second end to end"
section: Day 1 · 数字口径
icon: calculator
day: 1
level: 前置
status: done
---

# #15 · `about a second end to end`

> **材料说明**：Periplus 在本机，这条**已当场重跑核准**。
>
> 这条最有意思的地方在于：**这个数字不是性能指标，是架构正确性的证据**。看懂这一点，这条 bullet 就从「我们测试跑得快」变成「我们的依赖隔离做对了」。

## 对应简历原句

Periplus 第 4 条 bullet（v40）：

> Put a scripted seam behind every external dependency — model provider, search, page fetch and clock — so the whole system runs with no API keys and no network: 406 server tests, **about a second end to end**.

（seam 的技术细节见 [#14](/docs?section=numbers&item=n14-server-tests)，这一篇只管这个时间数字。）

---

## 一、先定掉一个歧义：`end to end` 指什么

原句 `406 server tests, about a second end to end` 里，`end to end` 有两种读法：

| 读法 | 指什么 |
|---|---|
| ✅ **A** | **整个测试套件**从头跑到尾约一秒 |
| ❌ B | 一次六阶段流水线**跑完**约一秒 |

**正确的是 A。** 从语法看它跟在 `406 server tests` 后面，修饰的是那 406 个测试。

**但 `end to end` 这个词在工程语境里通常指「端到端流程」，很容易被听成 B。** 面试官如果按 B 理解，会问「一秒就跑完六个阶段？那模型调用呢？」——**你得能立刻分辨他问的是哪个。**

**想更清楚可以改成** `406 server tests in about a second`——把 `end to end` 换成 `in`，歧义就没了。

---

## 二、实测数据（已核准）

```bash
cd server && uv run pytest
```

```
403 passed, 3 skipped in 1.38s
```

用 `time` 包住整条命令：

```
1.26s user  0.21s system  82% cpu  1.768s total
```

**两个数字都对，但含义不同——这正是审计要问的。**

---

## 三、按「审什么」逐条过

### ① 什么命令

`cd server && uv run pytest`。

README 里给的等价写法是 `.venv/bin/python -m pytest`。

`pyproject.toml` 里已经配好了默认参数，所以不用带任何 flag：

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
addopts = "-q"
asyncio_mode = "auto"
```

### ② 串行还是并行

**串行，单进程。**

证据：`requirements-dev.txt` 里只有 `pytest>=8.3` 和 `pytest-asyncio>=0.24`，**没有装 `pytest-xdist`**（并行插件）。

> **这一点反而是加分的**：1.38 秒是**单进程串行**跑完 403 个用例，不是靠开 8 个进程堆出来的。**没有并行还这么快，说明快的原因是没有 IO，不是有并发。**

（`asyncio_mode = "auto"` 是异步测试的自动识别，和并行无关，别讲混了。）

### ③ 是否含 collection

**这是两个数字的差别所在：**

| 数字 | 含什么 | 不含什么 |
|---|---|---|
| **1.38s**（pytest 自报的 `in 1.38s`） | **含** collection（收集用例）+ 执行 | 不含解释器启动、模块 import、`uv` 自身开销 |
| **1.77s**（`time` 量的 wall clock） | 含**全部**——从敲回车到回到提示符 | — |

**简历写 `about a second` 用哪个都说得通**（1.38 和 1.77 都能叫「about a second」），**但被问到时要能说清报的是哪个**。

**推荐口径**：报 pytest 自报的 1.38s，因为它是可比的（换台机器 `uv` 的启动开销不一样，但套件本身的执行时间可比）。

### ④ 哪台机器

这台 MacBook Pro（16 GB 内存）。

**并且要主动补一句**：这个数字**对机器不敏感**——因为它是纯 CPU 计算、没有任何 IO 等待。换台机器可能变成 0.9 秒或 2 秒，但**不会变成 30 秒**。

> **这个「不敏感」本身就是论点**：如果套件里还残留任何一个真实网络调用，机器和网络环境一变，时间会跳一个数量级。**稳定在秒级，说明 IO 真的清干净了。**

---

## 四、为什么能这么快（技术归因）

**逐条拆开，每一条都对应 [#14](/docs?section=numbers&item=n14-server-tests) 里的一个 seam：**

| 省掉了什么 | 靠哪个 seam | 如果没有会慢多少 |
|---|---|---|
| **网络往返** | `httpx.MockTransport` | 每次抓页几百毫秒，几十个页面就是十几秒 |
| **真实 sleep** | `FakeClock` | `fetch.py` 里 `DEFAULT_PER_HOST_DELAY = 1.0`，光每 host 延迟就够喝一壶；超时用例更是要等满 |
| **模型调用** | `ScriptedClient` | 一次 LLM 调用几秒起，**这一项就能把套件拖到分钟级** |
| **向量模型加载** | `ScriptedEmbeddings` | 加载 `sentence_transformers` 模型权重要几秒到几十秒 |
| **数据库往返** | 3 个 PG 用例被 skip | 连接 + 建表 + 清理 |

**最后一项特别值得注意**：`ScriptedEmbeddings` 用「哈希技巧」（把词哈希到固定的桶里再 L2 归一化）造出确定性向量，**整个测试过程根本不 import `sentence_transformers`**。这不只是快，也让测试不依赖模型权重文件的存在。

---

## 五、这个数字真正的意义

**它不是在说「我们测试跑得快」，而是在说「我们的依赖隔离是完整的」。**

理由很简单：**这四类 IO，只要漏掉任何一个，时间就会立刻跳一个数量级。**

- 漏一个网络调用 → 几秒到几十秒
- 漏一个真实 sleep → 按秒累加
- 漏一个模型调用 → 分钟级

> **所以「一秒」是个证明，不是个成绩。** 它证明的是：**没有任何一条测试路径偷偷溜出了进程。**
>
> **这是这条 bullet 最漂亮的讲法**，也是把 [#14](/docs?section=numbers&item=n14-server-tests) 和 [#15](/docs?section=numbers&item=n15-end-to-end) 串成一个论点的方式：#14 说结构（四个 seam），#15 说这个结构真的没漏。

---

## 六、这是 20 条里唯一能被当场验证的数字

其他 19 条要么在公司内网、要么需要特定环境、要么是别人系统里的口径。

**这一条不一样：面试官 clone 仓库、装依赖、跑一条命令，一秒后就能自己看到结果。不需要 API key，不需要网络。**

**主动提出这一点，效果比数字本身大得多：**

> 「这个仓库是公开的，`cd server && python -m pytest` 就能跑，不需要任何 key 也不需要联网——您现在就能验证。」

**一个能被当场验证的数字，会让面试官对你其他所有数字的信任度一起上升。**

---

## 七、一句话答法

> 说的是整个服务端测试套件，`cd server && uv run pytest`，实测 `403 passed, 3 skipped in 1.38s`，用 time 包住整条命令是 1.77 秒——差的那部分是解释器启动和 import。单进程串行，没装 xdist。之所以这么快，是因为四类 IO 全被 seam 换掉了：没有网络往返、没有真实 sleep、没有模型调用、连向量模型都是哈希技巧造的确定性实现，不 import sentence_transformers。**这个数字与其说是性能指标，不如说是隔离完整性的证据——这四类 IO 漏掉任何一个，时间都会跳一个数量级。** 而且这条是可以当场验证的，不需要 key 也不需要网。
