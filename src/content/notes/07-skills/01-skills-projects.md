---
title: "Go 与 Django 两个教学项目"
tier: must
section: 技能栏
icon: wrench
day: 13
level: A
status: done
---

# 技能栏里那三个词怎么撑住

> 🔴 **必看**。⚠️ **主材料是 [Library 的技能栏笔记](/library?section=skills&item=day13)**（338 行，三条的讲法、逐条追问带答案、对照表、四个裸词的口径）。**这一篇给口径底线 + 当天怎么过 + 一张我核实过的支撑表。**

## ⚠️ 口径底线（先立这个，比什么都重要）

**`concept-tracker` 和 `job-tracker` 是自建的教学项目。**

| ✅ 可以说 | ❌ 绝不能说 |
|---|---|
| 「这是我为了学 Go / Django 自己写的项目」 | 说成工作经历 |
| 「Go 那边 16 个测试 `-race` 全绿，Django 27 个 0.045 秒」 | **编任何性能数字** |
| 「写它们就是为了让技能栏对得上代码」 | 暗示有真实用户或规模 |

> ⭐ **主动说明「这是为了让技能栏对得上代码而写的」是加分项**——它把「简历上列了个没做过的词」变成了「我知道差距在哪并且补了」。

## 当天怎么过（四步）

1. **两个项目各跑起来点一遍**：`make api` / `make web`（两个 Makefile 目标一样）
2. **各跑一次测试**：`make test-go` / `make test-py`。⭐ **实测数字：Go 16 个 Test 函数、Django 27 个 test 方法**——**除了这两个数不要报别的**
3. **按 Library 第 1、4 节各练一遍 90 秒讲法**
4. ⭐ **Library 第 6 节那张对照表必须能默写**——Go 手写 SQL vs Django ORM。**追问选型时这张表比任何背下来的答案都有说服力**

## 三条的一句话定位

| 技能 | 项目 | 一句话 |
|---|---|---|
| **Angular** | 两个项目的前端都是 Angular 22 | 两个都用，所以这个词有双份支撑 |
| **Go** | `concept-tracker/server` | **手写 SQL**——知道每条查询长什么样，代价是自己管映射和 N+1 |
| **Django** | `job-tracker/server` | **ORM**——写得快、迁移自动，代价是不看生成的 SQL 就不知道它干了什么 |

> **被问「为什么一个手写 SQL 一个用 ORM」时，正确答法不是「各有优劣」，是「我故意用两种方式做同一类系统，就是为了体会这个取舍」。**

## ⭐ 技能栏支撑表（我逐个核过代码）

**这张表是防止你在技能栏上翻车的护栏。**

| 词 | 支撑 | 被追问时怎么答 |
|---|---|---|
| **Playwright** | ✅ WinterFell 的 bench harness（`bench/*.mjs` 五个探针） | 直接讲那套探针怎么量 draw call 和管线编译 |
| **Vitest** | ✅ **Periplus 的 web（`vitest run`）和 Prometheus 都在用** | 有支撑，可以讲 |
| **Jest** | ⚠️ **只有 `@testing-library/jest-dom`——那是个匹配器库，不是 Jest 本身** | **这个词是零支撑的**。被问到就说「实际用的是 Vitest，API 兼容 Jest」 |
| **AWS** | ✅ **Beyz 的邮件服务部署在 EC2** | 讲 GitHub Actions → SSH → EC2 → docker-compose 那条链（[④ 部署与 CI/CD](/docs?section=beyz&item=service-cicd)） |
| **Jenkins** | ❌ 本机零代码 | 概念层：和 GitHub Actions 的区别是**自托管 vs 托管**、插件生态更老更全、**但要自己维护 agent** |
| **MongoDB** | ❌ 本机零代码 | 概念层：文档模型适合 schema 多变、嵌套读多写少；**和我实际用的 PostgreSQL 的区别是没有强 schema 和事务保证**（虽然新版有多文档事务） |
| **Cloudflare** | ❌ 本机零代码 | 概念层：CDN + 边缘计算 + DNS；**Workers 是跑在边缘的 serverless，冷启动比 Lambda 快但运行时受限** |

### 三个裸词的答题规矩（Library 第 9 节）

> **答到「知道它解决什么问题、什么时候选它、和我用过的东西差在哪」为止。**
>
> ⭐ **被追问细节就说：「这条我是了解层面，实际做过的是 X。」——不要装成用过。**

**这句话本身就是加分项**：面试官问技能栏往往就是在测你会不会虚报，**干脆利落地划清界限比含糊其辞强十倍**。

## Library 导航

| 读什么 | 为什么 |
|---|---|
| **第 1、4 节** | Angular/Go 和 Angular/Django 的 90 秒讲法 |
| **第 2、3、5 节** | 逐条追问带答案——**答不上的标出来第二天补** |
| ⭐ **第 6 节对照表** | **必须能默写**：Go 手写 SQL vs Django ORM |
| **第 9 节** | 四个裸词的最低限度答法 |
