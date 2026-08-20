---
title: "③ 持久化与 resume"
tier: must
section: Periplus
icon: workflow
day: 10
level: S
status: done
---

# 崩了能续跑这条怎么讲

> 🔴 **必看**。⚠️ **④ scripted seam 那半边你 Day 1 已经学透了**：[#14 · 406 tests](/docs?section=periplus&item=n14-server-tests)（四个 seam、三种注入手法、为什么注入时钟）· [#15 · 一秒](/docs?section=periplus&item=n15-end-to-end)。**今天只讲 ③ 持久化与 resume。**

## 对应简历原句

> **Persisted run state, stage artifacts and a pgvector evidence cache in PostgreSQL under per-run token and time budgets. A run that dies mid-pipeline resumes from the last completed stage.**

## 30 秒口播稿（改一改就能用）

> 这个流水线跑一次要几分钟、要花钱。**进程挂在第四阶段，重跑意味着前三阶段的钱和时间全部白花。**
>
> 所以 run 的状态、每个阶段的产物、还有检索到的证据全部落在 PostgreSQL 里。**进程重启时会扫出所有还标着 running 的 run，从它「最后一个通过了 gate 的阶段」之后接着跑。**
>
> **关键在「通过了 gate」这个限定**：失败的产物我们也留着——供事后检查——**但它永远不是合法的续跑边界**。另外预算是整个 run 的天花板，**续跑时不会重置，而是把已经花掉的量带进来**——否则反复重启就能一次一个阶段地把配额刷穿。

## ⭐ 三个能体现深度的设计

### ① replay 边界必须是「过了 gate 的产物」

`artifacts.py` 文件头原话：

> *"Every stage attempt's produced artifact is retained, **whether or not it passed the stage's gate**... A rejected or superseded attempt stays retrievable for inspection; **it is simply never a valid replay boundary**."*

**保留失败产物是为了排查，允许从它续跑是另一回事。** 这两件事分开，是这个设计最容易被忽略的一半。

### ② 预算续跑时不重置（这条最值钱）

`budget.py` 文件头原话：

> *"A budget is a ceiling for the whole Run, **replays included**: a BudgetTracker built for a replay is **seeded with everything the run already spent**, not reset to zero. **Resuming a run repeatedly cannot be used to spend past a configured ceiling one stage at a time.**"*

> **这是个真正的安全性质**：如果续跑时预算归零，那「反复让它崩」就变成了绕过配额的手段。**能主动指出这一点，说明你想过「这个机制会怎么被滥用」——这比讲清楚它怎么工作高一个层次。**

**四个预算维度**（都是确定性的）：`max_queries` / `max_fetches` / `max_tokens` / `max_wall_clock_seconds`。

**检查的时机也讲究**（同一段注释）：预算检查发生在**一个阶段跑完之后、下一个阶段开始之前**，**从不在阶段内部打断它**——所以它「不能抢占正在飞的阶段，只能让它不算通过，或者不让下一次尝试开始」。

### ③ 崩在哪里决定了怎么恢复（`runs.py:219-251` 的三个分支）

| 情况 | 处理 | 为什么 |
|---|---|---|
| **一个 gate 都没过就死了** | 标成 **FAILED**，不重跑 | 注释原话：*"a fresh start would **silently pretend this attempt never happened** instead"* |
| **所有阶段都过了，死在记录成功的路上** | 直接标成 **SUCCEEDED** | *"rather than replaying a pipeline that already finished"* |
| **中间某个阶段之后崩的** | 从 `STAGE_ORDER[next_index]` 续跑 | 正常路径 |

> **第一种是最值得讲的**：**「无从恢复」和「重新开始」是两回事。** 直接重跑会让这次失败的尝试在记录里凭空消失，而那正是你排查问题时需要的东西。

## 四个必答

**Q：Stage 4 挂了怎么从 Stage 3 之后接着跑？**

> 「进程启动时扫数据库里所有还标着 `running` 的 run——**这个状态本身就是信号**，因为正常结束一定会调 `save_finished`。然后沿 `STAGE_ORDER` 走一遍，找**最靠后的、有 gate-passed 产物**的阶段，从它的下一个开始。」

**⚠️ 一个位置问题，答错很难看**：

> **resume 逻辑不在 orchestrator 里，在 API 层的 `RunStore`（`api/runs.py`）。** Hermes 只管「在给定起点上跑流水线」，**「上次跑到哪、该不该续」是持久化层的职责。**

**Q：run state 为什么不能只在内存？**

三条：**进程会挂**（这就是整个机制的前提）、**要能水平扩容**（另一个实例得看得到状态）、**用户要能刷新页面看进度**（前端轮询的是数据库不是内存）。

**Q：resume 的 stage 怎么保证幂等？**

**靠的不是「让阶段本身幂等」，是「让边界干净」**：只从通过 gate 的产物续跑，所以续跑的输入是确定的；而重跑的那个阶段会产生**新的 attempt 编号**，不覆盖旧的。

**⚠️ 有个很细的坑值得讲**（`runs.py:253-262`）：崩溃**可能发生在某个阶段中途**，所以要续跑的那个阶段可能**已经有过没通过 gate 的尝试记录了**。代码会**先填充占位的历史**，让 Hermes 的 attempt 计数器接着往下走，**而不是撞上一个产物库里已经存在的编号**。

> **能讲出这个细节，说明你真的处理过「崩在半路」而不只是「崩在阶段之间」。**

**Q：向量缓存里存的是什么，怎么失效？**

存的是**抓取到的证据段落 + 它的向量**（`retrieval/evidence_cache.py` + `storage/postgres_evidence.py`），目的是**同一段证据不重复抓、不重复算 embedding**。失效靠的是 [Day 9 那套新鲜度窗口](/docs?section=periplus&item=d9-evidence)——**缓存本身不设 TTL，是消费它的时候按 `as_of` 判断过没过期**。

> **这个区分值得说**：**缓存不负责判断「新不新鲜」，只负责「别重复干活」。** 新鲜度是业务语义，归 `evidence_is_stale` 管。


## Q6：pgvector 那几个选择（代码里核过）

```sql
CREATE INDEX IF NOT EXISTS evidence_cache_embedding_idx
    ON evidence_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

| 问 | 答 |
|---|---|
| **为什么余弦不是 L2？** | 语义相似度的惯例选择，**而且对向量长度不敏感**——两段话意思一样但长短不同时，余弦仍然判它们近。（向量做了 L2 归一化之后两者排序其实等价，但余弦的语义更直白。） |
| **`lists = 100` 怎么定的？** | ivfflat 把向量空间切成 `lists` 个簇，查询只扫最近的几个簇，**这是个吞吐/召回的旋钮**，100 是常见起点。⚠️ **代码里没写调优依据，照实说是默认值。** |
| **为什么 ivfflat 不是 HNSW？** | ⚠️ **代码里没有说明理由。** 我的理解：ivfflat **建索引快、占内存小**，适合这种写入频繁、行数中等的缓存；HNSW 查询更快但建索引慢、吃内存。**被问到就说这是权衡不是定论。** |

**但有一行注释值得引**（`postgres_evidence.py:71-72`）：

> *"a fresh database just gets a single-list index, which degrades to a full scan until enough rows accumulate. **That is a correct, if slow, index — never a wrong answer.**"*

> ⭐ **冷启动时 ivfflat 只有一个簇，等于全表扫描——慢，但答案永远是对的。** 这体现的是**「宁可慢也不能错」**，和 [Day 9 那条「宁可没有日期也不要猜一个」](/docs?section=periplus&item=d9-evidence) 是同一个价值观。

**还有一个 fail-soft 设计**：embedding 失败或数据库出错时，缓存**返回「没找到相似的」而不是抛异常**——所以 Postgres 抖一下只会导致重复抓一次页面，**不会让整个 run 挂掉**。


## Library 导航

**Hermes 那一节**（stage gate / budget / bounded retry / replay）是今天的主材料，尤其 **stage gate 拦什么**——它和 replay 边界是同一件事的两面。
