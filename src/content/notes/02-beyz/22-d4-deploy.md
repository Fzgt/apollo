---
title: "Day 4 · 部署与 CI/CD"
tier: must
section: Beyz · Day 2–4
icon: radio
day: 4
level: A
status: done
---

# Day 4 · 部署这条怎么答赢

> 🔴 **必看**。`Dockerized / EC2 / PM2 / GitHub Actions` 这几个词会让面试官顺手问下去，而**这几问的标准答案里恰好有好几个我当时做得不对**——**主动说出来是这条 bullet 最大的价值。**

## Q：CI 和 CD 分别是什么，你这两个是哪个

**这一问最该答满**，因为在这个项目里切得很干净：**两个仓库、两个文件、两种触发条件。**

| | **CI** | **CD** |
|---|---|---|
| 文件 | `beyz-web/.github/workflows/ci.yml` | `beyz-server/.github/workflows/deploy.yml` |
| 触发 | **`branches: ["**"]` 所有分支** | **`branches: [main]` 只有 main** |
| 做什么 | lint / typecheck / build，两 job 并行 | SSH 进 EC2 → `git pull` → `docker-compose up -d --build` |
| 产出 | 一个红叉或绿勾 | **生产环境变了** |
| 失败后果 | 你知道该修了 | **线上可能挂了** |

> **`branches: ["**"]` 是 CI 的关键**——**在合并之前就发现问题才叫 gate**，只在 main 上跑就太晚了。

**原理**：**CI = 收敛**（让主干随时可发布，不改变任何环境）；**CD = 发散**（把可发布的东西真的发出去，改变生产）。**正确关系是串行的：CI 是 CD 的前置门。没有 gate 的 CD 不是 CD，是自动化的事故。**

**⚠️ 我当时最大的问题：这两者没连起来**

`deploy.yml` 里**没有任何 lint / typecheck / build / test 步骤**，而 CI 那道门在另一个仓库，管不到 server 的部署。

```
main 上推一个编译不过的提交 → deploy.yml 立刻触发
  → SSH 上 EC2 构建 → 失败 → 旧容器可能已经停了
```

**生产级**：deploy job 加 `needs:` 依赖一个 CI job（**最小改动最大收益**）；或用**保护分支要求 PR 过 CI 才能合入 main**；再加健康检查和自动回滚。

## Q：为什么在生产机上构建

**面试官读到 `docker-compose up -d --build` 大概率会问。**

**这是反模式**，四条：**抢生产资源**（构建期 CPU 吃满，正在服务的请求跟着变慢）、**构建失败即部署中断**（旧容器可能已停）、**不可复现**（生产机的缓存、Node 版本、磁盘都不受控）、**回滚困难**（没有不可变产物）。

**生产级——「构建一次，到处部署」**：

```
CI 里构建镜像 → 用 commit sha 打 tag → 推 ECR/GHCR → 生产机只 docker pull
```

买到三样：生产机不构建（秒级完成）、**产物不可变**（`app:a1b2c3` 永远是那份代码，**回滚就是拉旧 tag**）、同一个镜像可以先上 staging 验证再上生产。

## Q：Docker 里已经有了，为什么还要 PM2

**先讲一个能加分的细节**：用的是 `pm2-runtime` 不是 `pm2 start`。

| | 行为 | 容器里的后果 |
|---|---|---|
| `pm2 start` | 守护化，命令立刻返回 | **PID 1 退出 → 容器直接停止** |
| `pm2-runtime` | 自己作为 PID 1 待前台 | ✅ 正常存活，日志走 stdout |

**写错了容器起来就秒退，而且报错完全不指向这里。**

**诚实答案：确实重复。** `docker-compose.yml:13` 已有 `restart: unless-stopped`——崩溃重启 Docker 已经管了；PM2 的 **cluster 模式没配**；零停机 reload 在容器化里靠滚动更新。**而且重复有代价**：多一层进程意味着信号传递可能出问题（`docker stop` 发 SIGTERM，得 PM2 正确转发才能优雅退出）。

> 「重做的话我会去掉 PM2，直接 `CMD ["node", "dist/src/main.js"]`，重启交给编排层，日志交给 Docker 收。当时留着是沿用了裸机部署的习惯。」**这一问的加分点不在你选了什么，在于你知道它是不是必要的。**

## Q：Dockerfile 你会怎么写

**做对的一条：layer cache**

```dockerfile
COPY package.json pnpm-lock.yaml* ./    # :7  只先拷依赖清单
RUN pnpm install                        # :9  装依赖单独一层
COPY . .                                # :11 再拷源码
```

Docker 一条指令一层，**某层输入没变就复用缓存，一旦有一层变了，它和之后所有层全部重建**。写反了（`COPY . .` 在前）**改一个字母就要重跑 `pnpm install`**。

> **「只有依赖清单变了才重装依赖」——这是 Dockerfile 最值钱的一条规则。**

**该改的四条**：`node:22.6.0` 完整镜像约 1 GB → 换 `-slim`/`-alpine`；**没有多阶段构建**（devDeps 和源码全留在最终镜像里）→ builder 阶段构建、最终阶段只 `COPY --from=builder`；以 root 运行 → `USER node`；没有 healthcheck。**镜像小不只是省空间——拉取更快、攻击面更小。**

## ⚠️ 一个必须主动说的真问题

```yaml
# docker-compose.yml:10-12
volumes:
  - .:/usr/src/app              # ← 开发环境的热重载挂载，出现在了生产配置里
  - /usr/src/app/node_modules   # ← 匿名卷保住镜像里的 node_modules
```

**宿主机目录盖住镜像内容 → 镜像里 `RUN pnpm run build` 产出的 `dist/` 被藏起来**，而 `dist` 是 gitignore 的（也在 `.dockerignore` 里），EC2 上 `git pull` 之后不该有它。

**第二行那个匿名卷恰恰说明作者知道「挂载会盖住镜像内容」——给 node_modules 打了补丁，但没给 dist 打。**

> 「这份配置确实跑起来了，那说明 EC2 上存在一份 `dist/`，很可能是某次手动构建留下的。**而『部署依赖宿主机上一份没人管、也不在版本控制里的产物』本身就是问题**——换台机器、清一次目录就起不来。生产 compose 应该去掉这两行，要热重载就单独维护一个 dev compose。」
>
> **这个发现值得主动讲**：它证明你能批判性地读自己的基础设施，而不只是「配好了能跑就行」。
