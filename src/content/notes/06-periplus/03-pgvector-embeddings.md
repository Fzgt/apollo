---
title: "③ pgvector 证据缓存与本地向量"
tier: must
section: Periplus
icon: microscope
day: 10
level: S
status: done
---

# ③ pgvector 证据缓存与本地向量

> **简历原句**
>
> **Cached evidence embeddings in pgvector** on an **ivfflat cosine index**, generated **locally by MiniLM**.
>
> ---
>
> 证据向量缓存在 pgvector 里，走 ivfflat 余弦索引，向量由本地的 MiniLM 生成。

## 这条要讲清什么

一句话：**同一段证据不重复抓、不重复算向量**，而且**算向量这件事不花钱、不出网**。缓存是按"意思像不像"命中的，不是按 URL。

## 第一层：必须答顺

### 1. 缓存的键是什么？为什么不按 URL？

按 **embedding 相似度**。同一件事会散在不同站点、不同 URL、不同标题下；按 URL 只能挡住"抓过完全相同的那一页"，挡不住"这段话我已经有了"。

**「embedding（向量）」是什么**：把一段文字变成一串数字，**意思相近的文字，数字也相近**。于是"有没有和这段话意思差不多的东西"变成了一个可以用数据库回答的问题。

表结构（`postgres_evidence.py`）：

```sql
CREATE TABLE IF NOT EXISTS evidence_cache (
    canonical_key TEXT PRIMARY KEY,
    url          TEXT NOT NULL,
    title        TEXT,
    text         TEXT NOT NULL,
    source_kind  TEXT NOT NULL,
    published_at DATE,
    fetched_at   TIMESTAMPTZ NOT NULL,
    query        TEXT,
    embedding    vector(384) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`vector(384)`** 就是 pgvector 提供的列类型，384 是 MiniLM 的输出维度。

### 2. "locally by MiniLM" 是什么意思？为什么重要？

用的是 `all-MiniLM-L6-v2`，**跑在 CPU 上，约 80MB，384 维**，走 sentence-transformers，**不调任何付费 embedding API**。

这条和 [④ scripted seam](/docs?section=periplus&item=scripted-seams) 是同一个立场的两面：**整个系统能在没有 API key、没有网络的情况下跑完**。向量如果要联网算，那句话就不成立了。

顺带一个成本口径：research 阶段可能抓几十个页面，每个都要算向量。走 API 就是每次运行都在为"我可能已经有了"付钱。

### 3. 查询长什么样？"cosine" 体现在哪？

```sql
SELECT url, title, text, source_kind, published_at, fetched_at,
       embedding <=> %s AS distance
FROM evidence_cache
ORDER BY embedding <=> %s
LIMIT 1
```

**`<=>` 是 pgvector 的余弦距离运算符。**取回最近的一条，然后在 Python 里换算并卡阈值：

```python
similarity = 1.0 - distance
if similarity < self.similarity_threshold:   # 默认 0.90
    return None
```

**为什么用余弦不用欧氏距离**：余弦是语义相似度的惯例选择，**而且对向量长度不敏感**——两段话意思一样但长短不同时，余弦仍然判它们近。

**为什么阈值是 0.90 而不是取最近的就用**：`ORDER BY ... LIMIT 1` 永远会返回某一行，哪怕库里最像的那条其实毫不相干。**阈值是把"最近邻"变成"够像"的那一步**，少了它就会拿错误的缓存冒充证据。

### 4. `ivfflat` 和 `lists = 100` 是什么？

```sql
CREATE INDEX IF NOT EXISTS evidence_cache_embedding_idx
    ON evidence_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

ivfflat 是一种**近似最近邻（ANN）索引**：把向量空间切成若干个簇，查询时只扫最近的几个簇，而不是全表比一遍。

| 问 | 答 |
|---|---|
| **`lists = 100` 怎么定的** | 切成 100 个簇。这是「查得快」和「找得全」之间的旋钮，100 是常见起点。⚠️ **代码里没有写调优依据，被问到就照实说是默认值，没有实测过** |
| **为什么 ivfflat 不用 HNSW** | ⚠️ **代码里没有给理由。**我的理解：ivfflat 建索引快、占内存小，适合这种写入频繁、行数中等的缓存；HNSW 查询更快但建索引慢、吃内存。**说清这是权衡，不是定论** |

### 5. 空库怎么办？

这是这条最好的一个细节，注释直接写了（`postgres_evidence.py:70-72`）：

> *"ivfflat needs training data to build useful lists; an empty or near-empty table (every fresh database) just gets a single-list index, which degrades to a full scan until enough rows accumulate. **That is a correct, if slow, index — never a wrong answer.**"*

空库上的 ivfflat 只会得到一个单簇的索引，等于全表扫描——**慢，但不会给错答案**。

> ⭐ **「宁可慢也不能错」** 和 [⑥ 那条「宁可没有日期也不要猜一个」](/docs?section=periplus&item=evidence-judgment) 是同一个价值观。这两处放在一起讲，比单说一个有说服力。

### 6. 数据库挂了会怎样？

**缓存整体是 best-effort 的**：算向量失败或数据库出错时，返回「没找到相似的」，而不是抛异常。

```python
except Exception:  # a cache outage must degrade, never crash a run
    return None
```

所以 **PostgreSQL 抖一下只会导致重复抓一次页面，不会让整个 run 挂掉**。连接池另外配了 `check=AsyncConnectionPool.check_connection`：取连接前先 ping，坏了就换一条——反正下游已经吞异常了，与其付一次注定失败的往返再白白 miss，不如先 ping。

## 第二层：概念补充

### 缓存怎么失效？

**不设过期时间。**失效是在消费的时候按日期判断的，走 [⑥ 那套新鲜度窗口](/docs?section=periplus&item=evidence-judgment)。

> ⭐ **这个区分值得主动说**：缓存不负责判断「新不新鲜」，只负责「别重复干活」。**新鲜度是业务语义，归判断过期的那个函数管。**

### 为什么只拿前 2000 字算向量？

```python
MAX_REPRESENTATIVE_CHARS = 2_000
MAX_STORED_CHARS = 24_000
```

两个理由，注释都写了：**MiniLM 本身只关注大约前 256 个 token**，再多喂给它也不会改变判断；而**把每个抓到的页面全文无限期存下来，会让这张缓存表变成库里最大的表，却换不来任何匹配收益**。

存 24000 字是给下游用的正文，算向量只用前 2000 字——**两个上限服务两个不同目的**，别说成一个。

### 为什么整个进程共用一个实例？

注释说得很直白：**这个缓存的价值完全来自"被很多次运行查到"，而不是"每次运行重建一次"**。`open`/`close` 括住连接池的生命周期，一个实例活整个进程。

## 30 秒回答

> research 阶段会抓很多页面，同一件事经常散在不同 URL 下，所以证据缓存不按 URL 命中，按语义命中。每段证据存一条 384 维向量，向量由 `all-MiniLM-L6-v2` 在本地 CPU 上算，不调任何付费 embedding API——这样整个系统才能在没有 key、没有网络的情况下跑完。查询用 pgvector 的余弦距离运算符取最近的一条，再卡 0.90 的相似度阈值，因为 LIMIT 1 永远会返回一行，阈值才是把「最近邻」变成「够像」的那一步。索引是 ivfflat 余弦，lists 100。空库上它退化成全表扫描，注释里那句我很喜欢：那是一个正确但慢的索引，绝不会给出错的答案。整个缓存是 best-effort 的，数据库出问题就当没命中，只多抓一次页面，不会让运行挂掉。

## 自检

1. 能否说清为什么按语义命中而不是按 URL？
2. 能否解释 `<=>` 是什么，以及为什么必须再卡一个相似度阈值？
3. 能否说出余弦相对欧氏距离的好处（对长度不敏感）？
4. 能否老实说出 `lists = 100` 和 ivfflat 是默认取值，没有实测依据？
5. 能否讲空库那句「正确但慢的索引，绝不给错答案」，并把它和新鲜度那条串起来？
6. 能否区分 2000 字（算向量）和 24000 字（存正文）两个上限？
7. 能否说明缓存不管过期，新鲜度归谁管？
