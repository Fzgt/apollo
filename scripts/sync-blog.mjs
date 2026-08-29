#!/usr/bin/env node
/**
 * 把 Blog 仓库的 issues 拉成静态快照，供 /blog 路由直接读。
 *
 * 站点是纯静态的（无后端），所以数据有两条路：
 *   1. 构建期 —— 这个脚本生成 public/data/blog/*.json，随产物发布，首屏零等待；
 *   2. 运行期 —— 浏览器再打一次 GitHub API 拿最新的，见 src/lib/blog.ts。
 *
 * 快照是兜底：GitHub API 挂了、限流了、或者断网，页面照样有内容。
 *
 * 正文单独拆文件，是因为全部 issue 正文加起来 120 KB+（gzip 后），
 * 塞进索引会让列表页白等一个大请求；点开哪篇才拉哪篇。
 *
 * 英文层在这里合进快照：`src/content/blog/<issue 号>.en.md` 有译文的，
 * 标题和正文直接换成英文版（原文留在 GitHub，一个字不动）。
 * 放构建期是为了不让译文进 JS bundle —— 五十篇正文十几万字，
 * 塞进列表页的首屏包就白费了上面拆文件的功夫。
 *
 * 用法：node scripts/sync-blog.mjs
 * 可选环境变量：GITHUB_TOKEN（提高限流额度）、BLOG_REPO（默认 Fzgt/Blog）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'blog');
const INDEX_FILE = path.join(OUT_DIR, 'index.json');
const EN_DIR = path.join(ROOT, 'src', 'content', 'blog');
const REPO = process.env.BLOG_REPO ?? 'Fzgt/Blog';
const PER_PAGE = 100;
const MAX_PAGES = 10;
const EXCERPT_LENGTH = 140;
const MAX_HEADINGS = 8;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** 读 `src/content/blog/*.en.md`：frontmatter 只认一个 title，其余是正文 */
async function loadTranslations() {
  const translations = new Map();

  let files;
  try {
    files = await fs.readdir(EN_DIR);
  } catch {
    return translations; // 目录不在就是没有译文，不是错误
  }

  for (const file of files) {
    const matched = file.match(/^(\d+)\.en\.md$/);
    if (!matched) continue;

    const raw = await fs.readFile(path.join(EN_DIR, file), 'utf8');
    const head = raw.match(FRONTMATTER_RE);
    const body = head ? raw.slice(head[0].length) : raw;

    let title;
    for (const line of (head?.[1] ?? '').split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx === -1 || line.slice(0, idx).trim() !== 'title') continue;
      title = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '') || undefined;
    }

    translations.set(Number(matched[1]), { title, body });
  }

  return translations;
}

/** GitHub 的 issues 接口会把 PR 也算进去，靠 pull_request 字段剔掉 */
function isRealIssue(issue) {
  return !issue.pull_request;
}

/** 摘要只要人能读的那一层：标题、代码块、链接语法都去掉 */
function toExcerpt(body) {
  const text = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 正文里夹着 GitHub 写的裸 HTML（截图、<kbd>、<br>），摘要不该显示标签源码
    .replace(/<\/?(?:img|br|kbd)\b[^>]*>/gi, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
}

/** 二级标题当目录用：列表页第二行显示这个，而不是正文原文 */
function toHeadings(body) {
  const text = (body ?? '').replace(/```[\s\S]*?```/g, '\n');
  const headings = [];

  for (const match of text.matchAll(/^\s{0,3}##\s+(.+?)\s*#*\s*$/gm)) {
    const clean = match[1]
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean) headings.push(clean);
    if (headings.length >= MAX_HEADINGS) break;
  }

  return headings;
}

function toIndexEntry(issue, translation) {
  return {
    number: issue.number,
    title: translation?.title || issue.title,
    labels: (issue.labels ?? []).map((label) => ({
      name: typeof label === 'string' ? label : label.name,
      color: typeof label === 'string' ? '' : (label.color ?? ''),
    })),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
    excerpt: toExcerpt(translation?.body ?? issue.body),
    headings: toHeadings(translation?.body ?? issue.body),
  };
}

async function fetchPage(page) {
  const url = `https://api.github.com/repos/${REPO}/issues?state=all&per_page=${PER_PAGE}&page=${page}&sort=created&direction=desc`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'apollo-blog-sync',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}

async function main() {
  const translations = await loadTranslations();
  const issues = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await fetchPage(page);
    issues.push(...batch.filter(isRealIssue));
    if (batch.length < PER_PAGE) break;
  }

  issues.sort((a, b) => b.number - a.number);

  // 整个目录重写，避免删掉的 issue 留下孤儿文件
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const index = {
    repo: REPO,
    syncedAt: new Date().toISOString(),
    // 运行期从 GitHub 拉到的是中文原文，靠这份号码单知道哪些该让快照说了算
    translated: issues.map((i) => i.number).filter((n) => translations.has(n)),
    posts: issues.map((issue) => toIndexEntry(issue, translations.get(issue.number))),
  };
  await fs.writeFile(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  for (const issue of issues) {
    const translation = translations.get(issue.number);
    const post = {
      number: issue.number,
      title: translation?.title || issue.title,
      body: translation?.body ?? issue.body ?? '',
      updatedAt: issue.updated_at,
    };
    await fs.writeFile(
      path.join(OUT_DIR, `${issue.number}.json`),
      `${JSON.stringify(post, null, 2)}\n`,
      'utf8'
    );
  }

  const indexKb = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1);
  console.log(
    `synced ${issues.length} posts from ${REPO} -> public/data/blog/ ` +
      `(index ${indexKb} KB, ${index.translated.length} translated)`
  );
}

main().catch((error) => {
  console.error(`[sync-blog] 失败：${error.message}`);
  process.exit(1);
});
