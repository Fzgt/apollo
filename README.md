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

## 博客（/blog）

文章不写在这个仓库，写在 [Fzgt/Blog](https://github.com/Fzgt/Blog) 的 issues 里。
`/blog` 路由负责把它们搬过来，两条路接力：

1. **构建期快照** —— `npm run sync:blog` 把 issues 抓成 `public/data/blog/`（索引一份，正文按 issue 号一篇一份），
   随产物发布，首屏零等待、离线也有内容。部署流水线每次都会重跑，另外每 6 小时定时重建一次。
2. **运行期同步** —— 打开页面时浏览器再问一次 GitHub API（Blog 是公开仓库，不需要 token），
   拿到新写的文章就地替换，右上角也有手动「同步」按钮。

限流（未登录 60 次/小时）或断网时第 2 步静默失败，页面回落到快照并标一句数据截止时间。
所以：**在 Blog 仓库开个 issue，文章就会出现在站上，这边不用改任何代码。**

## 怎么改

- **本地**：编辑 `.md`，`git push`，GitHub Actions 自动构建上线（约一分钟）。
- **浏览器**：在仓库页面按 `.` 进 [github.dev](https://github.dev/Fzgt/apollo)，改完直接 commit。
- 每页底部有「在 GitHub 上编辑这一页」的直达链接。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:8080
npm run check      # lint + typecheck + build
npm run sync:blog  # 重新抓一份 Blog issues 快照
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
