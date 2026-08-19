# Apollo

两周简历面试复习笔记站。内容全部是 Markdown，本地写、push 上线。

线上：<https://fzgt.github.io/apollo/>

## 内容在哪

```
src/content/notes/<NN>-<分组>/<NN>-<笔记>.md
```

目录名去掉数字前缀就是分组 id，文件名去掉数字前缀就是页面 id，数字前缀只决定顺序。
**加一页笔记 = 丢一个 `.md` 进对应目录**，侧边栏和上一页/下一页自动出现，不用改任何 TypeScript。

### frontmatter

```yaml
---
title: Day 2 · Beyz ① 实时 interview copilot   # 页面标题，也是侧边栏条目名
section: Beyz · Day 2–4                        # 分组显示名，取组内第一篇的值
icon: radio                                    # lucide 图标名，见 src/content/notes/navigation.tsx
day: 2                                         # 第几天；0 = 总览，99 = 速查
level: S                                       # S / A / B / 前置 / —
status: todo                                   # todo | doing | done，驱动首页进度条
---
```

加新图标：在 `src/content/notes/navigation.tsx` 的 `ICONS` 里补一行。

## 怎么改

- **本地**：编辑 `.md`，`git push`，GitHub Actions 自动构建上线（约一分钟）。
- **浏览器**：在仓库页面按 `.` 进 [github.dev](https://github.dev/Fzgt/apollo)，改完直接 commit。
- 每页底部有「在 GitHub 上编辑这一页」的直达链接。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:8080
npm run check    # lint + typecheck + build
```

## 技术栈

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion · React Router。
笔记通过 `import.meta.glob` 在构建期全部内联进 bundle，所以换页零延迟、搜索是全文的。

部署：GitHub Pages，走 `.github/workflows/deploy.yml`（lint → typecheck → build → 发布）。
站挂在 `/apollo/` 子路径下，所以 `vite.config.ts` 的 `base` 和 router 的 `basename` 必须一致；
Pages 没有 SPA 回退，构建后会把 `index.html` 复制成 `404.html` 兜住深链接。
换自定义域名时把 `VITE_BASE=/` 传进构建即可。`wrangler.toml` 留着，想回 Cloudflare 随时能用。

## 注意

站点整体挂了 `noindex, nofollow` —— 这是私人笔记，不该被搜索引擎收录。
注意 `robots.txt` 在 `fzgt.github.io/apollo/robots.txt` 这个位置对爬虫无效（只有域名根目录的才算数），
子路径部署下真正起作用的是页面里的 `noindex` meta。

## 在页面上直接填写

站是静态的，没有服务端，所以填写内容不走仓库，走一个单独的 Cloudflare Worker + Neon：

- markdown 里的「项 / 填写」表和 `待填` 占位是**题目骨架**，仍然走 git；
- 填进去的**答案**存 Neon，页面上按 `<section>/<item>::<标题 slug>#<块序号>` 对上。
  往笔记中间插一段不会让已填好的答案错位，改标题才会。
- 没配 `VITE_API_BASE` 时整站自动退回只读，和现在没区别。

### 一次性设置

```bash
npx wrangler login
npx wrangler secret put DATABASE_URL  --config wrangler.api.toml   # Neon 连接串
npx wrangler secret put EDIT_PASSWORD --config wrangler.api.toml   # 解锁编辑的口令
npx wrangler secret put EDIT_SECRET   --config wrangler.api.toml   # 随便一串随机字符
npm run api:deploy
```

三个值都从终端的隐藏输入进 Cloudflare，不进仓库、不进命令行历史。
部署完拿到 `https://apollo-api.<你的子域>.workers.dev`，填到仓库
**Settings → Secrets and variables → Actions → Variables** 里，名字 `API_BASE`，
再随便推一次触发构建。

`blocks` 表第一次写入时自动建，不用手动初始化。

### 用法

右上角那把锁 → 输口令 → 表格和 `待填` 全变成输入框。
打字停 600ms 自动存；断网时改动先落本机 localStorage，联网后再改一次就同步。
再点一次锁回只读。
