---
title: "Day 4 · 必看 · Docker、PM2 与 CI/CD"
section: Beyz · Day 2–4
icon: radio
day: 4
level: A
status: done
---

# Day 4 · 必看 · 容器化、进程管理与 CI/CD

> 🔴 **必看**。回答 ④ 的 **Q4**（Docker 和 PM2 是不是重复）和 **Q5**（CI 和 CD 分别是哪个文件、什么时机）。
>
> **`CI 和 CD 的区别` 是这一天最容易讲混、也最容易讲出彩的地方**——因为这两件事在这里恰好是**两个仓库、两个文件、两种触发条件**。

## 对应简历原句

> ...— **Dockerized, cron-triggered, deployed to EC2 under PM2 through GitHub Actions** — and of **the repo's first CI gate: lint, typecheck and build on every push**.

---

## 一、Dockerfile 逐行读

```dockerfile
FROM node:22.6.0                          # :1
RUN npm install -g pm2 pnpm               # :3
WORKDIR /usr/src/app                      # :5
COPY package.json pnpm-lock.yaml* ./      # :7   ⭐ 只先拷依赖清单
RUN pnpm install                          # :9   ⭐ 装依赖单独一层
COPY . .                                  # :11  ⭐ 再拷源码
RUN pnpm run build                        # :13
EXPOSE 3500                               # :15
CMD ["pm2-runtime", "start", "dist/src/main.js"]   # :17
```

### ⭐ `:7 / :9 / :11` 这个顺序是对的，而且要能讲清为什么

**这是 Docker layer cache 的教科书写法。**

Docker 镜像是**一层一层叠起来的**，每条指令一层。**构建时从上往下比对：某一层的输入没变就直接复用缓存，一旦有一层变了，它和它之后的所有层全部重建。**

**如果写成这样（常见错误）：**

```dockerfile
COPY . .              # ← 源码一改，这层就变
RUN pnpm install      # ← 于是每次都重装依赖
```

**改一个字母的源码，`pnpm install` 就要重跑一遍**，每次构建几分钟。

**而实际的写法**：先只拷 `package.json` 和锁文件 → 装依赖 → 再拷源码。**源码改动不影响依赖那一层的输入，缓存命中，`pnpm install` 直接跳过。**

> **只有依赖清单变了才重装依赖——这是 Dockerfile 里最值钱的一条规则。** 能主动讲这个，比会写 Dockerfile 高一档。

### 三个可以主动说的改进点

| 现状 | 问题 | 怎么改 |
|---|---|---|
| `FROM node:22.6.0` | 完整镜像约 **1 GB**，含编译工具链、Python、git 等运行时用不到的东西 | `node:22-slim` 或 `-alpine`，能降到几百 MB |
| **没有多阶段构建** | `pnpm install` 装了 devDependencies（`nest build` 需要），**构建完从没清掉**；源码也留在最终镜像里 | builder 阶段构建，最终阶段只 `COPY --from=builder dist/ + 生产依赖` |
| 没有非 root 用户 | 容器里以 root 跑 | `USER node` |

**镜像小不只是省空间**——**拉取更快（部署更快）、攻击面更小**。

---

## 二、Q4：Docker 里已经有了，为什么还要 PM2

**先看清楚用的是哪个命令，这一点很关键：**

```dockerfile
CMD ["pm2-runtime", "start", "dist/src/main.js"]
```

**是 `pm2-runtime`，不是 `pm2 start`。这个区别值得单独讲：**

| | 行为 | 在容器里的后果 |
|---|---|---|
| `pm2 start` | **守护进程模式**：把应用交给后台的 PM2 daemon，命令本身立刻返回 | **容器的 PID 1 退出 → 容器直接停止** |
| `pm2-runtime` | **前台模式**：自己作为 PID 1 一直待在前台 | ✅ 容器正常存活，日志走 stdout |

**「在容器里必须用 `pm2-runtime`」是个很好的细节题**——写错了容器起来就秒退，而且报错信息完全不指向这里。

### 那到底重不重复

**诚实答案：有相当程度的重复。**

`docker-compose.yml:13` 已经有 `restart: unless-stopped`——**容器挂了 Docker 会重启它**。这本身就覆盖了「进程守护」这个 PM2 最主要的卖点。

**PM2 在这里还剩什么：**

| PM2 能力 | 在这个部署里 |
|---|---|
| 崩溃重启 | ⚠️ **和 Docker 的 restart policy 重复** |
| 日志管理（格式化、轮转） | ✅ 还有点用 |
| **cluster 模式**（多核多进程） | ❌ **没配**，只跑单进程 |
| 零停机 reload | ❌ 容器化部署里靠滚动更新，用不上 |
| 进程监控面板 | ❌ 容器里没人去看 |

**而且重复是有代价的**：多一层进程意味着**信号传递可能出问题**（`docker stop` 发 SIGTERM，得 PM2 正确转发给应用，应用才能优雅退出），故障排查也多一层。

> **面试答法**：「用的是 `pm2-runtime` 不是 `pm2 start`——后者会守护化然后立刻返回，容器 PID 1 一退容器就停了。**至于重不重复：是有重复的。** compose 里已经有 `restart: unless-stopped`，崩溃重启这块 Docker 已经管了，而 PM2 的 cluster 模式我们没配。**容器化的标准做法是一个容器一个进程、重启交给编排层**，如果重做我会去掉 PM2 直接 `CMD ["node", "dist/src/main.js"]`，日志交给 Docker 收。当时留着主要是沿用了裸机部署的习惯。」
>
> **这一问的加分点不在于选了什么，而在于你知道它是不是必要的。**

---

## 三、⚠️ docker-compose 里有个真问题

```yaml
# docker-compose.yml:10-12
volumes:
  - .:/usr/src/app              # ← 把宿主机当前目录挂到容器里
  - /usr/src/app/node_modules   # ← 匿名卷保住镜像里的 node_modules
```

**第一行是开发环境用的「热重载挂载」——把宿主机源码盖到容器里，改代码不用重新构建镜像。**

**但它出现在生产的 compose 文件里，会产生一个直接后果：**

```
镜像构建时     RUN pnpm run build   →  dist/ 生成在镜像层里
容器启动时     挂载 . 到 /usr/src/app  →  宿主机目录盖住了镜像的内容
                                        →  镜像里那个 dist/ 被藏起来了
CMD            pm2-runtime start dist/src/main.js
                                        →  找的是宿主机目录里的 dist/
```

**而 `dist` 是被 gitignore 的**（`.gitignore` 第 2 行 `/dist`），也在 `.dockerignore` 里。**所以 EC2 上 `git pull` 之后那个目录里不会有 `dist/`。**

第二行那个匿名卷 `- /usr/src/app/node_modules` 恰恰说明作者知道「挂载会盖住镜像内容」这件事——**他给 node_modules 打了补丁，但没给 dist 打。**

> **要诚实的地方**：这份配置确实在生产上跑起来了，那说明 EC2 那个目录里存在一份 `dist/`——很可能是某次手动 `pnpm build` 留下的。**而「部署依赖宿主机上一份没人管、也不在版本控制里的产物」本身就是问题**：换台机器、清一次目录，部署就起不来了。
>
> **怎么改**：生产 compose 里**去掉这两行 volumes**，让容器用镜像里自己构建的 `dist`。要热重载就单独维护一个 `docker-compose.dev.yml`。

**这个发现很值得在面试里主动讲**——它证明你能批判性地读自己的基础设施，而不只是「配好了能跑就行」。

---

## 四、Q5：CI 和 CD 分别是哪个、什么时机

**这两件事在这里是两个仓库、两个文件、两种触发条件，切得很干净。**

### CD —— `beyz-server/.github/workflows/deploy.yml`

```yaml
name: Deploy beyz-server to EC2
on:
  push:
    branches: [ main ]        # ← 只有 main
steps:
  - Checkout code
  - Configure AWS credentials
  - Deploy to EC2:
      ssh ... 'cd /home/ec2-user/beyz-server
               git pull origin main
               docker-compose up -d --build'
```

**这是 CD（持续部署）**：main 上一有提交就自动上生产。

**四个可以说的点：**

1. **`set -e`（`:29`）** —— 远程脚本里任何一条命令失败就中止，不会「pull 失败了还继续 up」
2. **构建发生在生产机上** —— `docker-compose up --build` 是在 EC2 上跑的。**部署期间生产机的 CPU 被构建吃满**，而且构建失败时旧容器可能已经停了
3. **没有健康检查、没有回滚** —— `up -d` 返回就算成功，不验证服务真的起来了
4. **AWS 凭证那一步其实没用到** —— 整个部署走的是 SSH，没有任何 `aws` 命令。**这一步是可以删的**

### CI —— `beyz-web/.github/workflows/ci.yml`

```yaml
name: CI Pipeline
on:
  push:
    branches: ["**"]          # ← ⭐ 所有分支
jobs:
  Lint-and-typecheck-job:     # ← 两个 job 并行
    - pnpm lint
    - pnpm typecheck
  Build-job:
    - actions/cache（.next/cache + pnpm store）
    - pnpm build
```

**这是 CI（持续集成）**：每次推送都过一遍关卡，**但它不部署任何东西**。

**三个可以说的点：**

1. **`branches: ["**"]` 是关键** —— 不是只管 main。**在合并之前就发现问题，才叫 gate**；只在 main 上跑就太晚了
2. **两个 job 并行** —— lint+typecheck 和 build 互不依赖，并行跑省一半时间
3. **build job 需要十几个 secret** —— 因为 Next.js 在构建期就会校验环境变量。**这是个真实的痛点**：CI 要跑 build 就得把一堆生产密钥配进去

### 一张表说清区别

| | CI（`beyz-web/ci.yml`） | CD（`beyz-server/deploy.yml`） |
|---|---|---|
| **目的** | 拦住坏代码 | 把好代码送上线 |
| **触发** | **所有分支**的每次 push | **只有 main** 的 push |
| **做什么** | lint / typecheck / build | SSH → git pull → 重建容器 |
| **产出** | 一个红叉或绿勾 | 生产环境变了 |
| **失败的后果** | 你知道该修了 | **线上可能挂了** |

### ⚠️ 最该主动说的一句：中间没有连起来

**`deploy.yml` 里没有任何 lint / typecheck / build / test 步骤。**

```
main 上推一个编译不过的提交
  → deploy.yml 立刻触发
    → SSH 上 EC2，git pull，docker-compose up --build
      → 构建在生产机上失败
        → 旧容器可能已经被停了
```

**CI 那道门在另一个仓库（`beyz-web`），管不到 `beyz-server` 的部署。**

**正确做法**：deploy 的 job 前面加一个 `needs:` 依赖的 CI job，或者在 workflow 里先跑一遍 lint + build，**过了才 SSH**。

> **答法**：「CI 是 `beyz-web` 的 `ci.yml`，触发条件是**所有分支**的每次 push，跑 lint、typecheck、build 三件事，不部署；CD 是 `beyz-server` 的 `deploy.yml`，只在 main 上触发，SSH 进 EC2 拉代码重建容器。**要说清楚的是这两者当时并没有连起来**——deploy 前面没有任何 gate，main 上一个编译不过的提交会直接触发部署然后在生产机上构建失败。正确做法是让 deploy job `needs` 一个 CI job，过了才往下走。」

---

## 五、预期追问速查

| 问题 | 要点 |
|---|---|
| Dockerfile 为什么先拷 package.json？ | **layer cache**：依赖清单没变就复用缓存，源码改动不触发重装 |
| 镜像能怎么优化？ | `-slim`/`-alpine` 基础镜像、**多阶段构建**去掉 devDeps 和源码、非 root 用户 |
| `pm2-runtime` 和 `pm2 start` 差在哪？ | 后者守护化后立刻返回，**容器 PID 1 退出容器就停** |
| Docker + PM2 重复吗？ | **重复**。compose 已有 `restart: unless-stopped`，cluster 又没配。标准做法是一个容器一个进程 |
| compose 那两行 volumes？ | 生产里挂宿主机目录会**盖住镜像构建出的 `dist/`**，而 dist 是 gitignore 的。该删 |
| CI 和 CD 分别在哪？ | CI = `beyz-web/ci.yml`，**所有分支**；CD = `beyz-server/deploy.yml`，**只有 main** |
| 它们连起来了吗？ | ⚠️ **没有**。deploy 前面没有 gate，坏提交会直接部署 |
| 部署失败怎么回滚？ | ⚠️ **没有回滚机制**，也没有健康检查。`up -d` 返回就算成功 |
