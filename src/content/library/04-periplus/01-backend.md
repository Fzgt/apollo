---
title: 后端走查
section: Periplus
icon: workflow
---

# Periplus 后端 学习笔记(对齐简历 bullet)

> **简历上没有那句概括式的** *"Delivered a FastAPI/React app with generated OpenAPI types, PostgreSQL persistence and crash recovery"*,它早已被拆进两条更具体的 bullet:
>
> - **契约那条:** 六阶段流水线 —— research, verification, planning, writing, editing, illustration ——**编排器只认类型化的 stage 契约**,这份契约一路带到 React 客户端,客户端类型由 **OpenAPI schema 生成**。→ 本文第 3 节。
> - **持久化那条:** run 状态、stage artifact 与 pgvector 证据缓存落 PostgreSQL,受 **per-run token 与时间预算**约束,**死在半路的 run 从最后一个完成的 stage 续跑**。→ 本文第 4、5 节(预算部分在 AI 笔记第 4.3 节)。
>
> 复习时注意两处:一是简历强调的是**"编排器只认类型化契约"这个架构性质**,不只是"用了生成的类型";二是 crash recovery 被绑在"从最后完成的 stage 续跑"这个更强的承诺上,所以第 5 节要讲到"从哪续、怎么知道续到哪",不能停在"能恢复"。
>
>
> 这份文档只覆盖后端工程侧(API 层、存储层、类型生成、部署),不深入 AI 流水线本身的实现——Periplus 后端接了一条 **agentic workflow** 形态的 AI 流水线(Explorer→Auditor→Navigator→Chronicler→Editor→Illustrator,由 `Hermes` 编排器驱动;这六个是项目内部代号,真实类名依次是 `ResearchAgent` / `VerificationAgent` / `NavigationAgent` / `ContentAgent` / `EditorAgent` / `IllustrationAgent`,代号只出现在 docstring 与注释里),但那部分有另一份文档专门讲,这里只把它当一个"黑盒依赖"看待:API 层提交一个 `TripBrief`,拿到一个跑在后台 task 里的 `Run`,轮询状态。

---

## 1. 项目结构速览

```
server/periplus/
├── api/          FastAPI 路由、请求响应模型(本文档重点)
├── storage/      Postgres 持久化 + crash recovery(本文档重点)
├── orchestrator/ Hermes 编排器(略,AI 那份文档讲)
├── agents/       六个智能体(略)
├── llm/          模型调用封装(略)
├── retrieval/    检索/抓取(略)
web/src/
├── api/          消费生成的 OpenAPI 类型
├── routes/ components/  UI
```

技术栈:Python 3.11 + FastAPI + Pydantic v2 + **psycopg3(不是 SQLAlchemy)** + pgvector + React 19 + TanStack Query + openapi-typescript。

---

## 2. FastAPI 层:路由怎么组织的

这个后端的 API 面很小,只有 4 个端点,全部定义在一个文件 `server/periplus/api/app.py` 的 `create_app()` 工厂函数里(没有拆多个 router 文件,因为端点数量本来就少):

- `POST /trips` —— 提交一个行程 brief,返回 202 + `RunSummary`(异步任务已经开始,但还没跑完)
- `GET /runs` —— 列出所有 run(内存中正在跑的 + Postgres 里历史的,合并)
- `GET /runs/{run_id}` —— 查询单个 run 的状态/进度(前端轮询用这个)
- `GET /runs/{run_id}/result` —— 拿最终结果;如果 run 还在 `pending`/`running`,返回 409

**几个值得讲的点:**

- **工厂函数模式 + 依赖注入的"手动版"**:没有用 FastAPI 的 `Depends()`,而是用一个 `create_app(*, run_store=None)` 工厂函数,`run_store` 是测试注入的"缝"(seam)——测试传一个假的 `RunStore`(带 fake 的 Hermes 工厂),跳过真实 Postgres 和真实模型调用;生产环境不传,内部自己组装真正的 `PostgresRunPersistence` + `PostgresArtifactStore`。这是比 `Depends()` 更朴素但同样有效的依赖注入思路——本质都是"运行时把具体实现换掉,不改调用方代码"。
- **`lifespan`(而不是过时的 `@app.on_event("startup")`)**:用 `asynccontextmanager` 包一个 `lifespan`,在 `yield` 之前打开数据库连接池、建表、加载可选的 embedding 缓存;在 `finally` 里关闭。这是 FastAPI 现在推荐的启动/关闭钩子写法。
- **全异步**:所有路由函数都是 `async def`,Postgres 用 `psycopg` 的异步连接池(`AsyncConnectionPool`),不会阻塞事件循环。真正耗时的 AI 流水线跑在 `asyncio.create_task`(具体是 `asyncio.ensure_future`)里,`POST /trips` 立刻返回,不等流水线跑完——这是"长任务异步化 + 轮询"的标准套路,而不是同步阻塞请求或 WebSocket 推送。
- **Pydantic 的角色**:每个端点的入参/出参都是 Pydantic `BaseModel`(`TripBriefCreate`、`RunSummary`、`RunResultView`……,定义在 `api/schemas.py`)。FastAPI 用它们做:①请求体校验(类型、必填、自定义 validator)②自动生成 OpenAPI schema(这是第 3 节类型生成的基础)③序列化响应。

**Pydantic 校验的两个具体细节(测试里能看到):**
- `model_config = ConfigDict(extra="forbid")`:请求体里出现 schema 没定义的字段直接 422,不会静默丢弃——防御性设计。
- `id`、`created_at` 这些"服务器拥有"的字段根本没出现在 `TripBriefCreate` 里,所以客户端传了也会因为 `extra="forbid"` 被拒(422),不是"传了会被忽略"这种更弱的语义。
- 自定义 validator:`@field_validator("destination", mode="before")` 做 trim,`@model_validator(mode="after")` 做跨字段校验(`end_date` 不能早于 `start_date`)。

---

## 3. OpenAPI 类型生成:全栈类型安全怎么落地的(简历核心卖点)

这是简历里"generated OpenAPI types"这句话背后的具体机制,原理要讲清楚:

**FastAPI 免费提供什么:** 只要路由用 Pydantic model 标注了 `response_model` 和请求体类型,FastAPI 会在运行时自动反射出一份完整的 **OpenAPI 3 JSON schema**,挂在 `/openapi.json` 这个路径上——不需要额外写一行 schema 定义代码,这是 FastAPI 相对 Flask/Express 最大的卖点之一。

**Periplus 的具体流程(`web/package.json` 里的脚本):**

```json
"generate:api": "openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.generated.ts"
```

1. 本地把 FastAPI 服务跑起来(`uvicorn periplus.api.app:app`)
2. 跑 `npm run generate:api`,`openapi-typescript` 这个 CLI 工具去请求 `/openapi.json`,把里面的 JSON Schema **翻译成 TypeScript 的 `interface`/`type`**(不是运行时代码,纯类型),写到 `web/src/api/schema.generated.ts`(972 行,提交进仓库,不是 build 时临时生成的)
3. `web/src/api/contracts.ts` 从生成文件里按需 `export type` 挑出业务要用的类型(`TripBriefCreate`、`RunSummary`、`Run`、`Stage`……),给组件层一个更干净的导入面,同时把生成文件的实现细节(`components['schemas']['xxx']` 这种深路径)封装掉
4. `web/src/api/client.ts` 用这些类型标注 `fetch` 调用的参数和返回值,`web/src/api/queries.ts` 再包一层 TanStack Query 的 `useQuery`/`useMutation`

**本质和 tRPC 的区别值得讲清楚**(面试常问"为什么不用 tRPC"):
- tRPC 是**运行时**共享类型——前后端必须同一个 TS monorepo,client 直接 import server 的类型定义,天然强绑定。
- OpenAPI 类型生成是**契约驱动**——后端是 Python,前端是 TS,两种语言之间没法直接共享类型,只能靠一份中间的、语言无关的契约(OpenAPI JSON)作为"单一真相源",再单向"翻译"成目标语言的类型。这是**跨语言技术栈**(Python 后端 + TS 前端)做类型安全的标准解法。
- 代价:这份生成文件不是实时的,后端改了 schema、忘记重新跑 `generate:api`,前端类型就会过期(不像 tRPC 编译时就报错)。所以工程上通常会在 CI 里加一步"重新生成后 diff 是否为空"来防止漂移——Periplus 目前没有这一步(仓库里没有对应的 CI job),这是可以在面试时诚实提到的改进点。

**Vite 开发代理:** `vite.config.ts` 里配了 `/api` → `http://127.0.0.1:8000` 的反向代理(`rewrite` 去掉 `/api` 前缀),本地开发时前端直接打 `/api/trips` 这种相对路径,不需要处理 CORS。

---

## 4. PostgreSQL persistence:schema 设计与一致性

**没有用 ORM。** 依赖文件(`server/requirements.txt`)里是 `psycopg[binary]` + `psycopg_pool`,不是 SQLAlchemy/asyncpg + alembic。也没有独立的 migration 工具——每张表的建表 SQL 就写在对应模块顶部的 `_SCHEMA` 常量里,靠 `CREATE TABLE IF NOT EXISTS` 在 `open()`(即 FastAPI lifespan 启动时)幂等执行。这是"schema 小、演进慢、不值得引入 alembic"这类项目的合理取舍,面试时可以直接这么讲,不用往复杂了包装。

**三张表,分别对应三个 Postgres 封装类(都在 `periplus/storage/` 下):**

| 类 | 表 | 作用 |
|---|---|---|
| `PostgresRunPersistence`(`storage/postgres.py`) | `runs` | 记录每个 run 的 brief、状态、最终结果(JSONB)——crash recovery 的"这个 run 有没有跑完"的信号来源 |
| `PostgresArtifactStore`(`storage/postgres_artifacts.py`) | `artifacts` | 记录每个 run 每个 stage 每次 attempt 产出的 artifact(JSONB)+ 是否"通过 gate"(`passed` 字段)——crash recovery 的"跑到哪一步了"的信号来源 |
| `PostgresEvidenceCache`(`storage/postgres_evidence.py`) | `evidence_cache` | pgvector 语义缓存,跨 run 复用已抓取过的网页(和 crash recovery 无关,是检索层的性能优化,可选组件、失败会静默降级) |

**`runs` 表结构**(简化):
```sql
CREATE TABLE runs (
    run_id TEXT PRIMARY KEY,
    destination TEXT NOT NULL,
    status TEXT NOT NULL,          -- pending/running/succeeded/failed/cancelled
    brief JSONB NOT NULL,          -- 整个 TripBrief 序列化存
    result JSONB,                  -- 整个 Run 结果序列化存(完成后才有)
    error TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
```

**"宽表 + JSONB"而不是拆多张关系表**是这里的设计选择:整个 `TripBrief`/`Run`(嵌套的 Pydantic 模型)直接 `model_dump(mode="json")` 后用 `psycopg.types.json.Jsonb` 塞进一列。好处是模型改字段不用写 migration;代价是没法对内部字段做 SQL 层面的查询/索引(比如"按目的地筛选历史 run"要么全表扫 JSONB,要么额外加冗余列——这里就加了一列冗余的 `destination TEXT` 专门支持这种查询,这是个值得注意的细节)。

**一致性怎么保证的:**
- 写入用 **`INSERT ... ON CONFLICT (run_id) DO UPDATE`**(upsert),不是先 SELECT 再判断插入还是更新——避免竞态。
- `save_started` 用 `ON CONFLICT DO NOTHING`:一个 run 只应该"开始"一次,如果并发的 `save_finished` 已经先写完了,不应该被 `save_started` 的迟到写入覆盖状态。
- 每次数据库操作是单条 SQL 语句,`async with self._pool.connection() as conn: await conn.execute(...)`——psycopg3 在这种单语句场景下自动跑在隐式事务里,commit/rollback 由 context manager 管理,没有手写跨语句的显式事务(因为这里从没有"一次要保证多条 SQL 同时成功"的场景)。
- **连接池健壮性**(这是测试专门覆盖的一个坑,值得讲):`AsyncConnectionPool` 默认不会检测"服务器单方面断开了但连接池以为还活着"的连接(比如 Neon 这类 serverless Postgres 会在空闲一段时间后自动挂起计算实例,底层 socket 被悄悄关掉)。代码里显式传了 `check=AsyncConnectionPool.check_connection`,池子在把连接借出去之前会先 ping 一下,ping 失败就换一个新连接,而不是把死连接交出去导致业务查询直接报错。`server/tests/test_postgres_reconnect.py` 专门写了一个测试,手动 `socket.shutdown(SHUT_RDWR)` 掐断连接底层 fd 来复现这个问题,证明加了 `check=` 之后能自动重连。

---

## 5. Crash Recovery:具体机制(简历这条承诺的核心,必须讲清楚)

**先说清楚它解决的问题:** FastAPI 进程内,每个 run 由一个 `asyncio.Task` 驱动。进程一旦重启/崩溃,这个 Task 直接消失——**内存状态永远救不回来**。Crash recovery 要解决的是:重启后,怎么知道"上次死的时候有哪些 run 卡在半路",以及**从哪里继续,而不是从头重跑**(从头重跑意味着重新调用 LLM、重新抓网页,是真实的金钱和时间成本,这也是为什么这条要单独写进简历)。

**机制本质:一个基于"阶段 + 门禁(gate)"的检查点(checkpoint)方案**,不是 Postgres 自带的什么高级功能,是应用层设计出来的两级记录:

**第一级——`runs` 表只回答"这个 run 是否跑完了":**
- run 提交时立刻写一行 `status='running'`(`save_started`,在真正开始跑流水线的同时 fire-and-forget 地写)
- run 结束时(不管成功失败)upsert 同一行,写终态(`save_finished`)
- 如果进程崩溃,`save_finished` 永远不会被调用,于是这行永远停在 `status='running'`——**这就是崩溃的信号**:重启后一个新进程看到一行"running"但自己完全没提交过这个 run,只可能是上个进程死在半路。

**第二级——`artifacts` 表回答"跑到哪一步了":**
- Periplus 的流水线是分阶段的(Stage: research → verify → plan → write → edit → illustrate),每个阶段跑完会产出一个 artifact,并且要通过一次"gate"(校验)才算这个阶段真正成立
- `artifacts` 表按 `(run_id, stage, attempt)` 为主键记录每次尝试产出的 artifact(JSONB),外加一个 `passed BOOLEAN` 标记这次尝试是否通过了 gate
- 这张表的写入是 `PostgresArtifactStore` 包一层内存态的 `InMemoryArtifactStore`:同步方法(`put`/`mark_passed`)先写内存(编排器 Hermes 的调用路径是同步的,不能因为等一次网络 IO 卡住主流程),然后 `asyncio.ensure_future` 异步"回声"写一份到 Postgres,不等它完成——这是显式接受的权衡:如果进程恰好死在"内存已写、Postgres 回声还没落盘"的窗口,重启后会把这次 attempt 当成没发生过,顶多重跑这一个 stage,**不会静默污染已经通过 gate 的历史数据**。

**重启时的恢复流程**(`RunStore._resume_crashed_runs` / `_resume_one`,在 `server/periplus/api/runs.py`):

1. FastAPI `lifespan` 启动时调用 `store.open()`
2. 遍历 `runs` 表里所有 `status == RUNNING` 的行——这些就是"上次崩溃时卡住的 run"
3. 对每一行,调用 `PostgresArtifactStore.preload(run_id)`,把这个 run 在 `artifacts` 表里的所有历史记录读回内存态的 `InMemoryArtifactStore`(重建编排器需要的运行时状态)
4. 按流水线的固定阶段顺序(`STAGE_ORDER`)从头找,找到**最后一个 `latest_passed()` 不为空的 stage**——也就是"最远的、已经通过 gate 的阶段"
5. 三种情况:
   - 一个 gate 都没通过 → 判定 `FAILED`,理由写成 `"crashed before any stage passed its gate"`,不去猜测重跑(因为连第一步产出都不可信)
   - 所有阶段都已经通过 → 说明进程是死在"最后一步做完、还没来得及写终态"的窗口,直接标记 `SUCCEEDED`,不重新跑
   - 卡在中间某个阶段 → 从**下一个**未完成的阶段继续,调用编排器的 `hermes.replay(run, from_stage=resume_from)`,把上一次已经持久化、已通过 gate 的 artifact 当作这一步的输入直接复用,而不是把整条流水线从 research 阶段重跑
6. 新起一个 `asyncio.Task` 跑这个 replay,和正常提交的 run 走同一套 `RunEntry`/轮询逻辑,对前端 API 完全透明

**一句话总结这套机制的性质:** 这不是数据库自带的"crash recovery"(比如 Postgres 自己的 WAL/redo log 那种事务持久性),而是**应用层的、基于阶段边界的检查点重放机制**——用 Postgres 的持久性(JSONB + 事务性 upsert)作为"这一步做没做完"的存证,再由编排器按存证从正确的断点重放。这是"crash recovery"这个词在这个项目里真正对应的实现,测试(`TestRunStoreResume` in `server/tests/test_api.py`)专门验证了"从已通过 gate 的阶段恢复、不重跑该阶段"和"没有任何阶段通过时标记为失败"两种路径。

---

## 6. Docker / CI 现状(扫盲级)

- **没有 Dockerfile,没有 docker-compose。** 仓库里搜不到任何容器化配置,本地跑法就是 `.venv` + `pip install -r requirements.txt` + `uvicorn periplus.api.app:app`,数据库是本地/远程一个裸 Postgres URL(`.env` 里的 `PERIPLUS_DATABASE_URL`)。
- **`.github/workflows/pages.yml`** 是仓库里唯一的 CI/CD workflow,而且只做一件事:把前端 `web/` 构建成静态 demo(`npm run build:demo`,基于 mock 数据的演示模式,`vite.config.ts` 里 `mode === 'demo'` 会切换成假数据而不是真的打后端 API),发布到 GitHub Pages。
- **没有针对后端的 CI**(没有跑 `pytest`/`ruff` 的 workflow),测试和 lint 目前都是本地手动跑(README 里写的是本地命令)。这是可以在面试里诚实提到的"目前还没做"的部分,不用回避。

---

## 7. 后端测试速览

- `server/tests/test_api.py`:覆盖 `RunStore`(提交、查询、崩溃恢复三条路径)和 FastAPI 路由本身(用 `fastapi.testclient.TestClient` + `create_app(run_store=...)` 注入假 Hermes 工厂和假持久化,完全不碰真实 Postgres/网络/LLM)。恢复逻辑的三个分支(从最远通过的阶段恢复 / 全部通过直接标记成功 / 没有阶段通过标记失败)都有专门的测试类 `TestRunStoreResume`。
- `server/tests/test_postgres_reconnect.py`:唯一"在线"的测试文件,只有环境变量里配了真实可达的 `PERIPLUS_DATABASE_URL`/`DATABASE_URL` 才会跑(`pytest.mark.skipif`),否则自动跳过,保证 CI 没数据库也能过。专门复现"连接池借出一个已被服务端悄悄断开的连接"这个坑,验证 `check=AsyncConnectionPool.check_connection` 修复有效。

---

## 预期面试追问

1. **为什么不用 SQLAlchemy/asyncpg,而是直接用 psycopg3 写裸 SQL?** —— 表结构简单(3 张表、都是 JSONB 宽表),ORM 的映射层和 migration 工具带来的复杂度收益不明显;裸 SQL + 手写 `_SCHEMA` 常量对这个规模来说更直接可控。能不能说出这个取舍就是"合理"还是"偷懒",取决于你怎么讲。
2. **Crash recovery 具体保证的是什么级别的一致性?能不能做到 exactly-once?** —— 不能。`artifacts` 表的写入是 fire-and-forget 的异步"回声",进程可能死在"内存已更新、Postgres 还没落盘"的窗口,顶多导致重跑一个 stage,不会污染已通过 gate 的数据(at-least-once,幂等地重放最坏情况下的一个 stage)。
3. **如果两个 FastAPI 进程同时跑起来(比如水平扩容),会不会有两个进程同时去"恢复"同一个卡住的 run?** —— 当前实现没有分布式锁/领导选举,`_resume_crashed_runs` 在 `lifespan` 启动时无条件跑,多实例场景下确实有竞态风险(可以顺着这个问题聊怎么加 `SELECT ... FOR UPDATE SKIP LOCKED` 或者用一个"谁先把状态从 RUNNING 改成 RESUMING 谁负责"的乐观锁方案)。
4. **OpenAPI 生成的类型文件如果和后端 schema 不同步了怎么办?现在有没有防漂移机制?** —— 目前是手动跑 `npm run generate:api`,没有 CI 校验"重新生成后 diff 是否为空"。可以聊怎么加一步 CI job 去堵这个口子。
5. **为什么用 202 而不是 200/201 处理 `POST /trips`?为什么要设计成轮询而不是 WebSocket/SSE 推送进度?** —— 202 Accepted 明确表达"请求已接受但还没处理完",配合轮询模型语义准确;轮询实现更简单、前端用 TanStack Query 的 `refetchInterval` 几行代码搞定,代价是有 1 秒延迟和多余请求,是复杂度和实时性的权衡。
6. **`runs` 表里 `brief`/`result` 整个用 JSONB 存,而不是拆成规范化的关系表,好处坏处分别是什么?** —— 好处:模型加字段不用写 migration,和 Pydantic 模型的序列化天然对齐;坏处:没法用 SQL 直接查询/索引内部字段(这里靠加一列冗余 `destination` 应对最常见的查询需求,不是通用方案)。
7. **`RunStore.list()` 里内存态和持久化态是怎么合并的,谁的优先级更高?为什么这么设计?** —— 先把 Postgres 里读到的记录放进一个 dict,再用当前进程内存里的 `_entries` 覆盖同 key 的项(`merged.update(self._entries)`),因为同一进程刚提交、还没来得及异步写库的 run,内存态一定比可能还没落盘的持久化态更新更准确。
8. **`PostgresEvidenceCache`(pgvector)和另外两个 Postgres 组件的定位有什么本质不同?** —— 前两个(`runs`/`artifacts`)是"必须可靠"的持久化,失败要让启动报错;evidence cache 是纯粹的性能优化型缓存,任何环节失败(embedding 出错、数据库不可达)都静默降级成"当作没缓存",绝不能让一次网络抓取失败演变成整个 run 失败——这是"核心数据 vs 旁路缓存"两种不同可靠性等级的典型设计对比,面试时可以用来展示你分得清"什么必须强一致,什么可以优雅降级"。
