---
title: "Day 4 · 部署与 CI/CD"
tier: must
section: Beyz · Day 2–4
icon: radio
day: 4
level: A
status: done
---

# Day 4 · 必看 · 部署这条怎么答赢

> 🔴 **必看**。同样按**面试官会问什么**组织，每问三段式：**① 我当时怎么做的 → ② 通用原理 → ③ 生产级会怎么做**。
>
> **这一篇的机会点很明确**：`Dockerized / EC2 / PM2 / GitHub Actions` 这几个词会让面试官顺手问下去，而**这几个问题的标准答案里，恰好有好几个我当时做得不对**——主动说出来是这条 bullet 最大的价值。

## 对应简历原句

> ...— **Dockerized, cron-triggered, deployed to EC2 under PM2 through GitHub Actions** — and of **the repo's first CI gate: lint, typecheck and build on every push**.

---

## Q：CI 和 CD 分别是什么，你这两个是哪个

**这是这条 bullet 最该答满的一问**，因为它在这个项目里恰好切得很干净：**两个仓库、两个文件、两种触发条件。**

#### ① 事实

| | **CI** | **CD** |
|---|---|---|
| 文件 | `beyz-web/.github/workflows/ci.yml` | `beyz-server/.github/workflows/deploy.yml` |
| 触发 | **`branches: ["**"]` —— 所有分支** | **`branches: [main]` —— 只有 main** |
| 做什么 | lint / typecheck / build，**两个 job 并行** | SSH 进 EC2 → `git pull` → `docker-compose up -d --build` |
| 产出 | 一个红叉或绿勾 | **生产环境变了** |
| 失败的后果 | 你知道该修了 | **线上可能挂了** |

> **`branches: ["**"]` 是 CI 的关键**：不是只管 main。**在合并之前就发现问题才叫 gate**，只在 main 上跑就太晚了。

#### ② 原理

**CI 和 CD 是两种不同性质的自动化，混在一起讲是最常见的错误：**

- **CI（持续集成）= 收敛**。目标是让「主干随时可发布」，手段是**每次改动都验证一遍**。它不改变任何环境。
- **CD（持续交付/部署）= 发散**。目标是让「可发布的东西真的发出去」，手段是自动化发布流程。它**改变生产环境**。

**正确的关系是串行的：CI 是 CD 的前置门。** 没有 gate 的 CD 不是 CD，是自动化的事故。

### ③ ⚠️ 我当时最大的问题：这两者没连起来

**`deploy.yml` 里没有任何 lint / typecheck / build / test 步骤。**

```
main 上推一个编译不过的提交
  → deploy.yml 立刻触发
    → SSH 上 EC2，git pull，docker-compose up --build
      → 构建在生产机上失败
        → 旧容器可能已经被停了
```

**而 CI 那道门在另一个仓库（`beyz-web`），管不到 `beyz-server` 的部署。**

**生产级会怎么做：**

| 做法 | 解决什么 |
|---|---|
| **deploy job 加 `needs:` 依赖一个 CI job** | 过了才往下走。**最小改动，最大收益** |
| **改成「构建产物 → 推镜像仓库 → 拉取部署」** | 不在生产机上构建（见下一问） |
| **加健康检查 + 自动回滚** | 现在 `up -d` 返回就算成功，不验证服务真起来了 |
| **保护分支 + PR 必须过 CI 才能合入** | 从源头保证 main 永远是绿的 |

> **答法**：「CI 是 web 那个仓的 `ci.yml`，所有分支每次 push 都跑 lint、typecheck、build，不部署；CD 是 server 仓的 `deploy.yml`，只在 main 触发，SSH 进 EC2 重建容器。**但这两者当时并没有连起来**——deploy 前面没有任何 gate。**正确做法是让 deploy job `needs` 一个 CI job，或者干脆用保护分支要求 PR 过 CI 才能合入 main。**」

---

## Q：为什么在生产机上构建？

**面试官读到 `docker-compose up -d --build` 大概率会问这个。**

#### ① 事实

`deploy.yml` 的做法是：SSH 进 EC2 → `git pull` → **在那台机器上构建镜像**。

### ② 原理：为什么这是反模式

| 问题 | 说明 |
|---|---|
| **抢生产资源** | 构建期间生产机 CPU 被吃满，**正在服务的请求跟着变慢** |
| **构建失败 = 部署中断** | 旧容器可能已经停了，而新的没起来 |
| **不可复现** | 生产机上的构建缓存、Node 版本、磁盘状态都是不受控的。**「在我机器上能构建」变成了「在生产机上能构建」** |
| **回滚困难** | 没有不可变的产物，回滚意味着 checkout 旧代码再构建一遍 |

### ③ 生产级会怎么做

**标准做法是「构建一次，到处部署」：**

```
CI 环境里构建镜像
  → 打上 commit sha 的 tag
    → 推到镜像仓库（ECR / GHCR）
      → 生产机只做 docker pull + 换容器
```

**这样买到三样：**

- **生产机不构建**，只拉取和启动，秒级完成
- **产物不可变**：`app:a1b2c3` 这个镜像永远是那份代码，**回滚就是重新拉一个旧 tag**
- **同一个镜像可以先上 staging 再上生产**，验证过的是同一个二进制

> **能说出「构建一次，到处部署」和「用 commit sha 打 tag 让回滚变成拉旧镜像」，这一问就赢了。**

---

## Q：Docker 里已经有进程管理了，为什么还要 PM2

#### ① 事实

```dockerfile
CMD ["pm2-runtime", "start", "dist/src/main.js"]
```

**先讲一个能加分的细节**：用的是 `pm2-runtime` 不是 `pm2 start`。

| | 行为 | 在容器里的后果 |
|---|---|---|
| `pm2 start` | **守护化**：交给后台 daemon，命令立刻返回 | **PID 1 退出 → 容器直接停止** |
| `pm2-runtime` | **前台**：自己作为 PID 1 待着，日志走 stdout | ✅ 容器正常存活 |

**写错了容器起来就秒退，而且报错完全不指向这里。**

#### ② 原理

**容器化的核心约定是「一个容器一个进程」**，重启、日志、编排全部交给外层。PM2 是**裸机时代**的进程管理器——它解决的问题（守护、重启、日志、多核）在容器时代分别被 orchestrator、日志驱动、副本数接管了。

### ③ 诚实的答案：确实重复

`docker-compose.yml:13` 已经有 `restart: unless-stopped`——**崩溃重启 Docker 已经管了**。

| PM2 能力 | 在这个部署里 |
|---|---|
| 崩溃重启 | ⚠️ **和 Docker 的 restart policy 重复** |
| 日志格式化 | ✅ 还有点用 |
| **cluster 多核** | ❌ **没配**，只跑单进程 |
| 零停机 reload | ❌ 容器化靠滚动更新，用不上 |

**而且重复有代价**：多一层进程意味着**信号传递可能出问题**（`docker stop` 发 SIGTERM，得 PM2 正确转发给应用才能优雅退出），排障也多一层。

> **答法**：「用的是 `pm2-runtime` 不是 `pm2 start`，后者守护化后立刻返回，容器 PID 1 一退容器就停了。**至于重不重复——是重复的。** compose 里已经有 `restart: unless-stopped`，而 PM2 的 cluster 我们没配。**重做的话我会去掉 PM2，直接 `CMD ["node", "dist/src/main.js"]`，重启交给编排层，日志交给 Docker 收。** 当时留着是沿用了裸机部署的习惯。」
>
> **这一问的加分点不在你选了什么，在于你知道它是不是必要的。**

---

## Q：Dockerfile 你会怎么写

**这是可以主动展示的一问**——因为有一条我当时做对了，还有几条明显能改。

### ① 做对的一条：layer cache

```dockerfile
COPY package.json pnpm-lock.yaml* ./    # :7  ⭐ 只先拷依赖清单
RUN pnpm install                        # :9  ⭐ 装依赖单独一层
COPY . .                                # :11 ⭐ 再拷源码
RUN pnpm run build
```

**Docker 镜像一条指令一层，构建时从上往下比对：某层输入没变就复用缓存，一旦有一层变了，它和之后所有层全部重建。**

**写反了（常见错误）：**

```dockerfile
COPY . .              # ← 源码一改这层就变
RUN pnpm install      # ← 于是每次都重装依赖
```

**改一个字母就要重跑一遍 `pnpm install`。**

> **「只有依赖清单变了才重装依赖」——这是 Dockerfile 最值钱的一条规则。**

### ② 生产级会怎么改

| 现状 | 问题 | 改法 |
|---|---|---|
| `FROM node:22.6.0` | 完整镜像约 **1 GB**，带编译工具链、Python、git | `node:22-slim` / `-alpine`，降到几百 MB |
| **没有多阶段构建** | devDependencies（`nest build` 要用）和源码**全留在最终镜像里** | builder 阶段构建，最终阶段只 `COPY --from=builder` 产物 + 生产依赖 |
| 以 root 运行 | 攻击面 | `USER node` |
| 没有 healthcheck | 编排层不知道服务是否真的可用 | `HEALTHCHECK` 或编排层的探针 |

**镜像小不只是省空间**——**拉取更快（部署更快）、攻击面更小**。

---

## ⚠️ 一个必须主动说的真问题

```yaml
# docker-compose.yml:10-12
volumes:
  - .:/usr/src/app              # ← 把宿主机目录挂进容器
  - /usr/src/app/node_modules   # ← 匿名卷保住镜像里的 node_modules
```

**第一行是开发环境的热重载挂载，但它出现在生产的 compose 文件里：**

```
镜像构建时  RUN pnpm run build      → dist/ 生成在镜像层里
容器启动时  挂载 . 到 /usr/src/app  → 宿主机目录盖住镜像内容
                                    → 镜像里那个 dist/ 被藏起来了
CMD        pm2-runtime start dist/src/main.js
                                    → 找的是宿主机目录里的 dist/
```

**而 `dist` 是 gitignore 的**（`.gitignore` 第 2 行），也在 `.dockerignore` 里。**EC2 上 `git pull` 之后那个目录里不该有 `dist/`。**

**第二行那个匿名卷恰恰说明作者知道「挂载会盖住镜像内容」——给 node_modules 打了补丁，但没给 dist 打。**

> **诚实的说法**：「这份配置确实跑起来了，那说明 EC2 上存在一份 `dist/`，很可能是某次手动构建留下的。**而『部署依赖宿主机上一份没人管、也不在版本控制里的产物』本身就是问题**——换台机器、清一次目录，部署就起不来。生产 compose 里应该去掉这两行 volumes，要热重载就单独维护一个 `docker-compose.dev.yml`。」
>
> **这个发现值得主动讲**：它证明你能**批判性地读自己的基础设施**，而不只是「配好了能跑就行」。

---

## 一页速查

| 面试官问 | 赢的答法骨架 |
|---|---|
| CI 和 CD 分别是什么 | CI = 收敛、不改环境、**所有分支**；CD = 改生产、**只有 main**。⚠️ **我这两者没连起来** → `needs:` / 保护分支 |
| 为什么在生产机构建 | 抢资源、失败即中断、不可复现、难回滚 → **构建一次到处部署，commit sha 打 tag，回滚=拉旧镜像** |
| Docker + PM2 重复吗 | **重复**。先讲 `pm2-runtime` vs `pm2 start` 的坑，再承认重复 → 去掉 PM2 交给编排层 |
| Dockerfile 怎么写 | **layer cache 做对了**（先拷依赖清单）→ 该补多阶段构建、slim 基础镜像、非 root、healthcheck |
| compose 那两行 volumes | **生产里会盖掉镜像构建的 `dist/`** → 该删，热重载单独一份 dev compose |
| 怎么回滚 | ⚠️ **现在没有回滚机制也没有健康检查** → 不可变镜像 + tag 回退 |
