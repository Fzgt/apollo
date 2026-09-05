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
 * 中文那一份另存一套：`index.zh.json` 和有译文那些篇的 `<号>.zh.json`。
 * 站点切到中文时才去读它，英文模式下一个字节都不多下。没有这一套的话，
 * 中文模式就只能指望运行期的 GitHub 请求 —— 未登录额度每小时 60 次，
 * 一限流整页中文就没了。
 *
 * 分类来自 Blog 仓库 README 里的分组（`## 分类名` + 底下那串 issue 链接），
 * 顺序照抄，博客页左侧的索引直接用它——README 是唯一的一份分类清单，
 * 这边只是把它解析成数据，不另维护一套。
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
const INDEX_ZH_FILE = path.join(OUT_DIR, 'index.zh.json');
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

function githubHeaders(accept) {
  const headers = { Accept: accept, 'User-Agent': 'apollo-blog-sync' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * 从 README 解析分类。段落形如：
 *
 *   ## React 原理 · 调度、协调、渲染流程、合成事件
 *   - [标题](https://github.com/Fzgt/Blog/issues/22)
 *
 * `·` 前面是分类名，后面是那一行副标题；没写副标题就只有名字。
 * 空分类（一条链接都没有）直接丢掉。
 */
function parseCategories(readme) {
  const categories = [];
  const sectionRe = /^##\s+(.+?)\s*$/gm;
  const matches = [...readme.matchAll(sectionRe)];

  for (let i = 0; i < matches.length; i += 1) {
    const heading = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : readme.length;
    const block = readme.slice(start, end);

    const numbers = [];
    for (const link of block.matchAll(/\/issues\/(\d+)/g)) {
      const number = Number(link[1]);
      if (!numbers.includes(number)) numbers.push(number);
    }
    if (numbers.length === 0) continue;

    const [name, ...rest] = heading.split('·');
    categories.push({
      name: name.trim(),
      hint: rest.join('·').trim(),
      numbers,
    });
  }

  return categories;
}

async function fetchReadme() {
  const url = `https://api.github.com/repos/${REPO}/readme`;
  const res = await fetch(url, { headers: githubHeaders('application/vnd.github.raw') });
  if (!res.ok) {
    // 分类只是锦上添花，README 读不到就当没有分类，不该让整次同步失败
    console.warn(`[sync-blog] 读不到 README（${res.status}），这次不带分类`);
    return [];
  }
  return parseCategories(await res.text());
}

async function fetchPage(page) {
  const url = `https://api.github.com/repos/${REPO}/issues?state=all&per_page=${PER_PAGE}&page=${page}&sort=created&direction=desc`;
  const res = await fetch(url, { headers: githubHeaders('application/vnd.github+json') });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}

async function main() {
  const translations = await loadTranslations();
  const categories = await fetchReadme();
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

  const syncedAt = new Date().toISOString();
  // 运行期从 GitHub 拉到的是中文原文，靠这份号码单知道哪些该让快照说了算
  const translated = issues.map((i) => i.number).filter((n) => translations.has(n));

  // README 里可能还留着已删掉的 issue，也可能新写的还没进 README——两边取交集
  const existing = new Set(issues.map((issue) => issue.number));
  const knownCategories = categories
    .map((category) => ({ ...category, numbers: category.numbers.filter((n) => existing.has(n)) }))
    .filter((category) => category.numbers.length > 0);

  const categorized = new Set(knownCategories.flatMap((category) => category.numbers));
  const uncategorized = issues.map((i) => i.number).filter((n) => !categorized.has(n));

  const index = {
    repo: REPO,
    syncedAt,
    translated,
    categories: knownCategories,
    posts: issues.map((issue) => toIndexEntry(issue, translations.get(issue.number))),
  };
  await fs.writeFile(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  // 中文索引：一律按 issue 原文算，不掺译文
  const indexZh = {
    repo: REPO,
    syncedAt,
    translated,
    categories: knownCategories,
    posts: issues.map((issue) => toIndexEntry(issue, undefined)),
  };
  await fs.writeFile(INDEX_ZH_FILE, `${JSON.stringify(indexZh, null, 2)}\n`, 'utf8');

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

    // 只有被译文顶掉的那些篇需要另存中文正文；没译文的 `<号>.json` 本来就是中文
    if (!translation) continue;
    await fs.writeFile(
      path.join(OUT_DIR, `${issue.number}.zh.json`),
      `${JSON.stringify(
        { number: issue.number, title: issue.title, body: issue.body ?? '', updatedAt: issue.updated_at },
        null,
        2
      )}\n`,
      'utf8'
    );
  }

  const indexKb = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1);
  console.log(
    `synced ${issues.length} posts from ${REPO} -> public/data/blog/ ` +
      `(index ${indexKb} KB, ${translated.length} translated, zh snapshot alongside, ` +
      `${knownCategories.length} categories from README)`
  );
  if (uncategorized.length > 0) {
    console.warn(
      `[sync-blog] README 里没收录：${uncategorized.map((n) => `#${n}`).join('、')}——` +
        `这些篇只在「全部」里出现`
    );
  }
}

main().catch((error) => {
  console.error(`[sync-blog] 失败：${error.message}`);
  process.exit(1);
});
