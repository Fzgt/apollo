<div align="center">

# Apollo

**简历、面试与技术笔记站。内容全部是 Markdown，本地写、push 上线。**

[![线上](https://img.shields.io/badge/线上-apollo--five--omega.vercel.app-000000?style=flat-square&logo=vercel&logoColor=white)](https://apollo-five-omega.vercel.app/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646cff?style=flat-square)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-06b6d4?style=flat-square)](https://tailwindcss.com)

[**打开站点 →**](https://apollo-five-omega.vercel.app/)

</div>

---

| 我想…            | 做什么                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| 加一页复习笔记   | 丢一个 `.md` 进 `src/content/notes/<NN>-<分组>/`，见 [内容在哪](#内容在哪) |
| 加一页资料       | 丢一个 `.md` 进 `src/content/library/<NN>-<分组>/`，见 [内容在哪](#内容在哪) |
| 加一篇博客       | 去 [Fzgt/Blog](https://github.com/Fzgt/Blog) 开个 issue，见 [博客](#博客blog) |
| 加一道算法题     | 写进本机题解目录，再跑 `npm run sync:algorithms`，见 [算法](#算法algorithms) |
| 改一页现有笔记   | 页面底部「在 GitHub 上编辑这一页」，见 [怎么改](#怎么改)                  |
| 本地跑起来       | `npm install && npm run dev`，见 [本地开发](#本地开发)                    |

---

## 内容在哪

站里有三套 Markdown 内容，规则一样，各占一个 tab：

```
src/content/notes/<NN>-<分组>/<NN>-<笔记>.md      # 复习（/docs）——十四天复习计划，带进度和 Day 标签
src/content/library/<NN>-<分组>/<NN>-<笔记>.md    # 资料（/library）——简历走查笔记，不带进度
src/content/algorithms/<NN>-<分类>/<NNN>-<题>.md  # 算法（/algorithms）——脚本生成，别手改
```

目录名去掉数字前缀就是分组 id，文件名去掉数字前缀就是页面 id，数字前缀只决定顺序。

> [!TIP]
> **加一页笔记 = 丢一个 `.md` 进对应目录**，侧边栏和上一页/下一页自动出现，不用改任何 TypeScript。

### frontmatter

```yaml
---
title: Day 2 · Beyz ① 实时 interview copilot
section: Beyz · Day 2–4
icon: radio
day: 2
level: S
status: todo
---
```

| 字段      | 说明                                                        |
| --------- | ----------------------------------------------------------- |
| `title`   | 页面标题，也是侧边栏条目名                                   |
| `section` | 分组显示名，取组内第一篇的值                                 |
| `icon`    | lucide 图标名，见 `src/content/notes/navigation.tsx`         |
| `day`     | 第几天；`0` = 总览，`99` = 速查                              |
| `level`   | `S` / `A` / `B` / `前置` / `—`                               |
| `status`  | `todo` \| `doing` \| `done`，驱动首页进度条                  |

资料那套只用 `title` / `section` / `icon` 三个字段 —— `day`、`level`、`status` 是复习计划才有的东西。

加新图标：在 `src/content/notes/navigation.tsx` 的 `ICONS` 里补一行。

---

## 博客（/blog）

文章不写在这个仓库，写在 [Fzgt/Blog](https://github.com/Fzgt/Blog) 的 issues 里。
`/blog` 路由负责把它们搬过来，两条路接力：

1. **构建期快照** —— `npm run sync:blog` 把 issues 抓成 `public/data/blog/`（索引一份，正文按 issue 号一篇一份），
   随产物发布，首屏零等待、离线也有内容。Vercel 每次构建都会重跑一遍，抓失败就用仓库里已提交的那份。
2. **运行期同步** —— 打开页面时浏览器再问一次 GitHub API（Blog 是公开仓库，不需要 token），
   拿到新写的文章就地替换，右上角也有手动「同步」按钮。

限流（未登录 60 次/小时）或断网时第 2 步静默失败，页面回落到快照并标一句数据截止时间。

> [!TIP]
> 所以：**在 Blog 仓库开个 issue，文章就会出现在站上，这边不用改任何代码。**

列表是 Argus 里 `JobRow` 那套密集行：整行可点、悬停出左侧色条和操作按钮、读过的行标绿。
「已读」只存在浏览器 `localStorage`（`apollo:blog:read`）——站是静态的，没有账号，换台机器就重新算。

---

## 怎么改

- **本地**：编辑 `.md`，`git push`，Vercel 自动构建上线（约一分钟）。
- **浏览器**：在仓库页面按 `.` 进 [github.dev](https://github.dev/Fzgt/apollo)，改完直接 commit。
- 每页底部有「在 GitHub 上编辑这一页」的直达链接。

---

## 本地开发

```bash
npm install
npm run dev
```

| 命令                | 作用                              |
| ------------------- | --------------------------------- |
| `npm run dev`       | http://localhost:8080             |
| `npm run check`     | lint + typecheck + build          |
| `npm run sync:blog` | 重新抓一份 Blog issues 快照       |
| `npm run sync:algorithms` | 重新生成算法题解那一套内容  |

---

## 算法（/algorithms）

题解写在本机的 `Algorithm/既然巅峰留不住，那就重走来时路`：13 个分类目录，一题一个 `.ts`/`.js`，
少数几题另有一份写思路的 `.md`（带截图）。Vercel 的构建机上没有这个目录，所以内容是
**生成进仓库再提交**的——跟博客快照一个路子，源在别处，仓库里存一份。

```bash
npm run sync:algorithms   # 源目录可用 ALGO_SRC 覆盖
```

脚本（`scripts/sync-algorithms.mjs`）做四件事：按 `lc<题号>` 把同一题的思路笔记、多份写法
合成一篇；截图搬进 `public/algorithms/` 并改写正文里的相对路径；标题从文件名还原成
「70. 爬楼梯」；没题号的（冒泡/选择/快排）走脚本里的别名表。

> [!WARNING]
> `src/content/algorithms/` 下的 `.md` 全是生成物，手改会被下一次同步覆盖。要改就改源目录里的题解。

这一套没有英文版：题解正文是代码，`bilingual={false}` 关掉了「还没翻译」那条提示。

---

## 技术栈

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion · React Router。

笔记通过 `import.meta.glob` 在构建期全部内联进 bundle，所以换页零延迟、搜索是全文的。

<details>
<summary><b>部署细节</b> —— Vercel、SPA 回退、响应头</summary>

<br>

部署：Vercel，连着 `main` 分支，push 即构建。配置全在 `vercel.json` 里：

- **构建**：先跑一次 `scripts/sync-blog.mjs` 刷新博客快照（失败不阻断，回落到仓库里已提交的那份），再 `npm run build`。
- **SPA 回退**：所有未命中静态文件的请求 rewrite 到 `index.html`，`/docs`、`/library`、`/blog`、`/algorithms` 刷新才不会 404。
- **响应头**：`nosniff`、`Referrer-Policy`、`Permissions-Policy`，以及 `X-Robots-Tag: noindex, nofollow`。

站挂在根路径，所以 `vite.config.ts` 的 `base` 是 `/`；真要换回子路径部署，把 `VITE_BASE` 传进构建，
router 的 `basename` 跟着 `import.meta.env.BASE_URL` 走，不用另外改。

</details>

---

## 注意

> [!WARNING]
> 站点整体挂了 `noindex, nofollow` —— 这是私人笔记，不该被搜索引擎收录。
> 三道防线：页面里的 `noindex` meta、`public/robots.txt`（根路径部署，对爬虫有效）、
> 以及 `vercel.json` 里给所有响应加的 `X-Robots-Tag`。
> robots.txt 唯一放行的是 `Claude-User` —— 在 Claude 里贴链接让它读笔记用，不是搜索爬虫。
