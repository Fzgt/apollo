---
title: "五轮怎么跑"
tier: must
section: 模拟面试
icon: mic-2
day: 14
level: —
status: done
---

# 模拟面试这一天怎么用

> 🔴 **必看**。**这一天不学新东西**，只做一件事：**把纸上的东西变成嘴上的东西**。
>
> ⚠️ 材料全部就位：[跨项目追问](/docs?section=cheatsheet&item=crosscut)（Round 3 四题已填好）· [幂等的四种实现](/docs?section=cheatsheet&item=idempotency) · [数字口径总表](/docs?section=cheatsheet&item=numbers) · [面试前一页](/docs?section=cheatsheet&item=onepager)（**只有你能填的部分留着**）· [Library 的行为面笔记](/library?section=interview&item=behavioral)。

## ⚠️ 一件比五轮都重要的事

**你所有材料都是中文写的，而你在悉尼投岗——面试是英文的。**

「exactly-once 在跨系统场景下不存在」讲成中文很顺；临场翻成 *"exactly-once doesn't exist across system boundaries — what you can have is at-least-once plus idempotent consumption"* 是另一回事。

> ⭐ **Round 1 和 Round 2 建议直接用英文练。** 中文练顺了不代表英文能讲——**术语的英文表达没过一遍嘴，当场一定卡。**

## Round 0 · 行为面（最先练，别跳）

**材料**：[Library 的行为面笔记](/library?section=interview&item=behavioral)（258 行）。里面标着 `【只有你能填】` 的地方**必须自己填**。

出声练三样：

1. **30 秒自我介绍**（中英各一遍）
2. **时间线四个坑**：2022–2024 的空档、两段都不到一年、Beyz 和开学重叠、毕业到现在
3. **「为什么转 AI」三步**

> ⭐ **你的复习计划自己写了：「技术准备再厚，前十分钟垮了就没有后面。」** 这一轮排在最前面是有道理的。

## Round 1 · 22 条，每条 30 秒

**目标**：让**非技术的 recruiter** 也听得懂。**先讲用户问题和结果，别堆 API 名。**

**22 条 = Beyz 4 + BioMap 4 + 百度 5 + Periplus 5 + WinterFell 4。**

**每条的 30 秒草稿在哪**：

| 项目 | 去哪拿草稿 |
|---|---|
| Beyz ① | [① 数据流全图](/docs?section=beyz&item=d2-pipeline) 顶部 |
| 百度 ③ ④ | [③ 提现](/docs?section=baidu&item=d6-withdraw) · [④ Webpack](/docs?section=baidu&item=d6-webpack) 顶部 |
| 百度 ② ⑤ | [②⑤ 虚拟列表与生产白屏](/docs?section=baidu&item=d7-speak) 顶部（两段） |
| Periplus ① ② ③ ⑤ | 各自必看篇顶部 |
| WinterFell ① ② ③ ④ | [①④ 渲染管线与那次冻结](/docs?section=winterfell&item=d12-render) 顶部（四段） |
| BioMap | [③ TanStack Query](/docs?section=biomap&item=d5-query) 的「先立住」那段 |

> **没有草稿的几条自己写**——写不出 30 秒版，说明那条你还没真的想清楚。

## Round 2 · 随机抽 8 条，每条 3 分钟

**统一结构**：`Problem → Why → Solution → Decision → Result → Reflection`

⭐ **Reflection 那一格是这一轮的重点**，也是最容易跳过的。**每条都要有一句「现在做我会怎么改」**——这些我在必看篇里都写好了：

| 条目 | Reflection |
|---|---|
| Beyz ① | **没有自动重连**，`Close` 只改状态没有退避重试 |
| Beyz ② | 迟到的响应**只挡住了状态没挡住内容**，该上 AbortController |
| Beyz ③ | 乱序没处理，该存 event 时间戳做版本比较 |
| Beyz ④ | **CI 和 CD 没连起来**，deploy 前面没有 gate |
| 百度 ③ | 配额判定该在服务端，前端那层只用来提前反馈 |
| 百度 ④ | 简历那句的**因果错配**还在（拆分不减体积） |
| Periplus ⑤ | 只覆盖两个阶段、**没有 hold-out set** |
| WinterFell ② | GPU 变瓶颈时该改**分块 instancing** |

> **主动交代短板不是减分，是这些 bullet 最大的加分项**——它证明你现在的标准高于当时的产出，**而面试官招的是现在的你**。

## Round 3 · 跨项目追问

**四题全部填好了** → [跨项目追问](/docs?section=cheatsheet&item=crosscut)，外加 [幂等的四种实现](/docs?section=cheatsheet&item=idempotency)。

**这一轮的价值**：**用两个不同项目的实例回答同一个抽象问题**。答好了能一次证明「我理解的不是某个库，是这个问题本身」。

**五题里最该背熟的两条归纳：**

> **幂等分三层**：客户端最弱只减少无效请求；应用层写绝对值结果收敛；**数据层约束最强，跟并发和顺序完全无关**。
>
> **取舍先问「这里错了代价有多大」**：金融和事实性内容里错误代价高于慢和贵；实时交互里过期的代价高于丢失。**同一个人做出相反取舍不是不一致，是代价不一样。**

## Round 4 · 录音回放

**录下 Round 1 和 Round 2，放出来听。** 标三样：

- **卡壳超过 3 秒的地方** → 那条还没内化
- **过度解释**（讲了三分钟还没到 Result）→ 结构没搭稳
- **证据不足**（说了个数字但答不出怎么测的）→ 回去翻那条的「数字」笔记

## 当日产出

**填完 [面试前一页](/docs?section=cheatsheet&item=onepager)** —— 自我介绍和「为什么转 AI」那两格**只有你能填**，其余几格（S 级钩子、数字速记、必须主动交代的局限、反问）已经有骨架了。

> **那一页的规矩是「只放你自己写的东西，别抄笔记」**——面试前 30 分钟要能扫完。
