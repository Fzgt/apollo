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

## 先把词说清

**embedding（向量 / 嵌入）**：把一段文字变成一串数字，**意思相近的文字数字也相近**。于是「有没有和这段话意思差不多的东西」**变成了一个可以用数据库回答的问题**。

**pgvector**：PostgreSQL 的一个扩展，**给数据库加了一个 `vector` 列类型和一组距离运算符**。

**MiniLM**：一个约 80MB、输出 **384 维**向量的小模型。**跑在 CPU 上就够。**

**cosine similarity（余弦相似度）**：把两个向量看成两个方向，**比的是夹角**，**对向量长度不敏感**。

**欧氏距离（Euclidean distance）**：直线距离，**受长度影响**。

**ANN（Approximate Nearest Neighbour，近似最近邻）**：不全表比一遍，**牺牲一点召回换速度**。

**ivfflat**：一种 ANN 索引——**把向量空间切成若干个簇（list），查询时只扫最近的几个簇**。

**HNSW**：另一种 ANN 索引，**查询更快但建索引慢、吃内存**。

**fail soft（优雅降级）**：出错时返回一个安全的默认值，**而不是抛异常炸掉调用方**。

## 这条要讲清什么

一句话：**同一段证据不重复抓、不重复算向量，而且算向量这件事不花钱、不出网。缓存是按「意思像不像」命中的，不是按 URL。**

## 缓存的键是什么，为什么不按 URL

**按向量相似度。**同一件事会散在不同站点、不同 URL、不同标题下；**按 URL 只能挡住「抓过完全相同的那一页」，挡不住「这段话我已经有了」。**

表里存的是规范化的键、URL、标题、正文、来源类型、发布日期、抓取时间、当时的查询词，**还有那一列 384 维的向量**。

## 本地生成向量是什么意思，为什么重要

用 **sentence-transformers 跑 MiniLM，在本地 CPU 上算，不调任何付费的向量接口。**

**这条和[脚本化接缝](/docs?section=periplus&item=scripted-seams)那条是同一个立场的两面：整个系统能在没有 API key、没有网络的情况下跑完。向量如果要联网算，那句话就不成立了。**

**顺带一个成本口径**：检索阶段可能抓几十个页面，每个都要算向量。**走接口就是每次运行都在为「我可能已经有了」付钱。**

## 查询长什么样，余弦体现在哪

```sql
SELECT url, title, text, source_kind, published_at, fetched_at,
       embedding <=> %s AS distance     -- ← <=> 是 pgvector 的「余弦距离」运算符
FROM evidence_cache
ORDER BY embedding <=> %s
LIMIT 1
```

取距离最近的一条，然后**在应用层把距离换算成相似度并卡一个阈值，默认是 0.9**。

**为什么用余弦不用欧氏距离**：余弦是语义相似度的惯例选择，**而且对向量长度不敏感**——两段话意思一样但长短不同时，余弦仍然判它们近。

**为什么要卡阈值而不是取最近的就用**：`LIMIT 1` **永远会返回某一行，哪怕库里最像的那条其实毫不相干**。**阈值是把「最近邻」变成「够像」的那一步，少了它就会拿错误的缓存冒充证据。**

**这一句是这条最该讲的，因为它是个正确性问题不是性能问题。**

## ivfflat 和那个簇数是什么

```sql
CREATE INDEX IF NOT EXISTS evidence_cache_embedding_idx
    ON evidence_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**`lists = 100`** 就是切成一百个簇。

**这个数怎么定的，要诚实答**：100 是常见起点，**代码里没有写调优依据，被问到就说是默认值、没有实测过**。

**为什么用 ivfflat 不用 HNSW，代码里也没有给理由。**可以这样答：我的理解是 **ivfflat 建索引快、占内存小，适合这种写入频繁、行数中等的缓存；HNSW 查询更快但建索引慢、吃内存**；**说清这是权衡，不是定论**。

**不知道就说不知道，在这两处尤其成立**——它们都是可以查证的实现细节，**编一个理由被追一层就崩**。

## 空库怎么办

**这是这条最好的一个细节，注释直接写了：**

```python
#: ivfflat needs training data to build useful lists; an empty or near-empty table (every
#: fresh database) just gets a single-list index, which degrades to a full scan until
#: enough rows accumulate. That is a correct, if slow, index — never a wrong answer.
```

**宁可慢也不能错**，这个价值观和[证据判断那条里「宁可没有日期也不要猜一个」](/docs?section=periplus&item=evidence-judgment)是同一个。**这两处放在一起讲，比单说一个有说服力。**

## 数据库挂了会怎样

```python
except Exception:  # noqa: BLE001 - a cache outage must degrade, never crash a run
    return None
```

**缓存整体是尽力而为（best-effort）的**：算向量失败或者数据库出错时，**返回「没找到相似的」，而不是抛异常**。

**所以 PostgreSQL 抖一下只会导致重复抓一次页面，不会让整个运行挂掉。**

连接池另外配了**取连接前先 ping** 的检查，坏了就换一条。**理由是：反正下游已经吞异常了，与其付一次注定失败的往返再白白 miss，不如先 ping。**

## 概念补充

**缓存怎么失效。** **不设过期时间（no TTL）。**失效是在**消费的时候**按日期判断的，走[新鲜度窗口](/docs?section=periplus&item=evidence-judgment)那一套。**这个区分值得主动说：缓存不负责判断新不新鲜，只负责别重复干活；新鲜度是业务语义，归判断过期的那个函数管。**

**为什么只拿前 2,000 字算向量。** **两个理由，注释都写了**：那个向量模型本身**只关注大约前 256 个 token**，再多喂给它也不会改变判断；而把每个抓到的页面全文无限期存下来，**会让这张缓存表变成库里最大的表，却换不来任何匹配收益**。

**注意两个上限服务两个不同目的，别说成一个**：**存 24,000 字是给下游用的正文，算向量只用前 2,000 字。**

**为什么整个进程共用一个实例。** 注释说得很直白：**这个缓存的价值完全来自被很多次运行查到，而不是每次运行重建一次。**打开和关闭括住连接池的生命周期，**一个实例活整个进程**。

## 英文怎么说

**一句最该背的是空库那条注释**：**that is a correct, if slow, index — never a wrong answer**。**它同时展示了取舍判断和价值排序。**

**术语对照**：向量 embedding ／ 向量检索 vector search ／ 余弦相似度 cosine similarity ／ 近似最近邻 approximate nearest neighbour (ANN) ／ 索引退化成全表扫描 degrades to a full scan ／ 优雅失败 fail soft ／ 相似度阈值 similarity threshold ／ 尽力而为 best-effort ／ 连接池 connection pool ／ 簇 list ／ 过期时间 TTL。

## 30 秒回答

> 检索阶段会抓很多页面，同一件事经常散在不同 URL 下，所以证据缓存不按 URL 命中，按语义命中。每段证据存一条 384 维向量，向量由 MiniLM 在本地 CPU 上算，不调任何付费接口——这样整个系统才能在没有 key、没有网络的情况下跑完。查询用 pgvector 的 `<=>` 余弦距离运算符取最近的一条，再卡 0.9 的相似度阈值，因为 LIMIT 1 永远会返回一行，阈值才是把「最近邻」变成「够像」的那一步。索引是 ivfflat 余弦，一百个簇。空库上它退化成全表扫描，注释里那句我很喜欢：那是一个正确但慢的索引，绝不会给出错的答案。整个缓存是尽力而为的，数据库出问题就当没命中，只多抓一次页面，不会让运行挂掉。

## 自检

1. 能否说清为什么按语义命中而不是按 URL？
2. 能否解释 `<=>` 是什么，以及为什么必须再卡一个相似度阈值？
3. 能否说出余弦相对欧氏距离的好处？
4. 能否老实说出 `lists = 100` 和索引类型是默认取值，没有实测依据？
5. 能否讲空库那句「正确但慢的索引」，并把它和新鲜度那条串起来？
6. 能否区分 2,000 字算向量和 24,000 字存正文这两个上限？
7. 能否说明缓存不管过期、新鲜度归谁管？
