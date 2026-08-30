/**
 * 博客数据层：文章存在 Blog 仓库的 issues 里，这边只负责读。
 *
 * 两个来源，先后接力：
 *   1. 构建期快照 `public/data/blog/`（scripts/sync-blog.mjs 生成）—— 首屏立刻有内容；
 *   2. GitHub API —— 打开页面时后台再拉一次，把新写的文章补上。
 *
 * 快照永远是兜底。GitHub 限流（未登录 60 次/小时）或断网时，第 2 步静默失败，
 * 页面照旧显示快照，只是在顶部标一句数据截止时间。
 *
 * 语言：issues 里的原文是中文，`src/content/blog/<号>.en.md` 是译文，构建期合成
 * 两套快照（`index.json` / `index.zh.json`）。所以取数的方向按语言正好相反——
 * 英文以快照为准（GitHub 那边只有中文），中文以 GitHub 为准（那才是原文），
 * 拉不到再退回中文快照。
 */

import { BLOG_REPO } from '@/content/site';
import type { Lang } from '@/lib/i18n';

export interface BlogLabel {
  name: string;
  /** GitHub 上的标签色，六位十六进制、不带 # */
  color: string;
}

export interface BlogPostMeta {
  number: number;
  title: string;
  labels: BlogLabel[];
  createdAt: string;
  updatedAt: string;
  /** 对应 issue 的 GitHub 地址 */
  url: string;
  excerpt: string;
  /** 正文里的二级标题，列表页当目录显示；没有就是空数组 */
  headings: string[];
}

export interface BlogIndex {
  repo: string;
  /** 数据抓取时间 */
  syncedAt: string;
  posts: BlogPostMeta[];
  /** 快照里已经是英文的那些 issue 号，见 scripts/sync-blog.mjs */
  translated?: number[];
  /** snapshot = 构建期快照，live = 刚从 GitHub 拉的 */
  source: 'snapshot' | 'live';
}

const EXCERPT_LENGTH = 140;
const MAX_HEADINGS = 8;
const PER_PAGE = 100;
const MAX_PAGES = 10;

/** 同一次会话里翻来翻去不重复请求。存的一律是 GitHub 上的中文原文 */
const bodyCache = new Map<number, string>();
const liveIndexCache: Partial<Record<Lang, BlogIndex>> = {};

function assetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

/** 摘要只要人能读的那一层，规则和 scripts/sync-blog.mjs 保持一致 */
function toExcerpt(body: string): string {
  const text = body
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

/** 二级标题当目录用，规则和 scripts/sync-blog.mjs 保持一致 */
function toHeadings(body: string): string[] {
  const text = body.replace(/```[\s\S]*?```/g, '\n');
  const headings: string[] = [];

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

/**
 * 英文层不在这一层做，构建期就合进快照了（scripts/sync-blog.mjs）。
 * 这里只负责：运行期从 GitHub 拉到的是中文原文，凡是快照里已有译文的，
 * 标题、摘要、目录一律以快照为准，别让实时同步把英文冲回中文。
 */
const snapshotPosts = new Map<number, BlogPostMeta>();
const translatedNumbers = new Set<number>();
let snapshotLoaded = false;

/** 只记英文快照的正文元信息：中文那边不需要覆盖，GitHub 给的就是原文 */
function rememberSnapshot(index: BlogIndex, lang: Lang): void {
  translatedNumbers.clear();
  for (const number of index.translated ?? []) translatedNumbers.add(number);

  if (lang === 'en') {
    snapshotPosts.clear();
    for (const post of index.posts) snapshotPosts.set(post.number, post);
    snapshotLoaded = true;
  }
}

function preferSnapshotMeta(post: BlogPostMeta): BlogPostMeta {
  if (!translatedNumbers.has(post.number)) return post;

  const snapshot = snapshotPosts.get(post.number);
  if (!snapshot) return post;

  // 标签、时间、链接还是以 GitHub 最新的为准，只有文字部分用译文
  return {
    ...post,
    title: snapshot.title,
    excerpt: snapshot.excerpt,
    headings: snapshot.headings,
  };
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: Array<{ name?: string; color?: string } | string>;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
}

function normalizeLabels(labels: GitHubIssue['labels']): BlogLabel[] {
  return labels.map((label) =>
    typeof label === 'string'
      ? { name: label, color: '' }
      : { name: label.name ?? '', color: label.color ?? '' }
  );
}

/** 构建期快照：随站点一起发布，离线也在 */
export async function loadSnapshotIndex(lang: Lang, signal?: AbortSignal): Promise<BlogIndex> {
  // 一篇译文都没有时构建不出中文索引，那时中文快照就是 index.json 本身
  const file = lang === 'zh' ? 'data/blog/index.zh.json' : 'data/blog/index.json';
  let res = await fetch(assetUrl(file), { signal });
  if (!res.ok && lang === 'zh') {
    res = await fetch(assetUrl('data/blog/index.json'), { signal });
  }
  if (!res.ok) {
    throw new Error(
      lang === 'zh' ? `读不到构建期快照（${res.status}）` : `Could not read the snapshot (${res.status})`
    );
  }
  const data = (await res.json()) as Omit<BlogIndex, 'source'>;
  const index: BlogIndex = { ...data, source: 'snapshot' };
  rememberSnapshot(index, lang);
  return index;
}

/**
 * 直接问 GitHub 要最新的。Blog 是公开仓库，不需要 token；
 * 未登录额度是每小时 60 次，这里一次请求就能拿满 100 篇，够用。
 */
export async function fetchLiveIndex(lang: Lang, signal?: AbortSignal): Promise<BlogIndex> {
  const issues: GitHubIssue[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetch(
      `https://api.github.com/repos/${BLOG_REPO}/issues?state=all&per_page=${PER_PAGE}&page=${page}&sort=created&direction=desc`,
      { signal, headers: { Accept: 'application/vnd.github+json' } }
    );

    if (!res.ok) {
      if (lang === 'zh') {
        throw new Error(
          res.status === 403 ? 'GitHub 限流了，先看快照' : `GitHub 返回 ${res.status}`
        );
      }
      throw new Error(
        res.status === 403
          ? 'GitHub rate-limited us — showing the snapshot'
          : `GitHub returned ${res.status}`
      );
    }

    const batch = (await res.json()) as GitHubIssue[];
    issues.push(...batch.filter((issue) => !issue.pull_request));
    if (batch.length < PER_PAGE) break;
  }

  issues.sort((a, b) => b.number - a.number);

  // 正文顺手收进缓存：列表接口本来就带正文，点开时就不用再请求了
  for (const issue of issues) {
    bodyCache.set(issue.number, issue.body ?? '');
  }

  const index: BlogIndex = {
    repo: BLOG_REPO,
    syncedAt: new Date().toISOString(),
    source: 'live',
    posts: issues.map((issue) => {
      const live: BlogPostMeta = {
        number: issue.number,
        title: issue.title,
        labels: normalizeLabels(issue.labels),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        url: issue.html_url,
        excerpt: toExcerpt(issue.body ?? ''),
        headings: toHeadings(issue.body ?? ''),
      };
      // 中文模式下 GitHub 拿到的就是要显示的原文，不能让英文快照顶掉
      return lang === 'en' ? preferSnapshotMeta(live) : live;
    }),
  };

  liveIndexCache[lang] = index;
  return index;
}

export function getCachedLiveIndex(lang: Lang): BlogIndex | null {
  return liveIndexCache[lang] ?? null;
}

/**
 * 正文。两种语言的取数方向相反：
 *
 * 英文 —— 有译文的那几篇要跳过内存缓存：缓存里是实时同步顺手收下的中文原文，
 * 英文正文只在快照文件里。快照还没读到时一律先信快照，免得竞态下闪一下中文。
 *
 * 中文 —— 缓存里那份就是原文，直接用；没有就读快照。被译文顶掉的篇另有一份
 * `<号>.zh.json`，其余篇的 `<号>.json` 本来就是中文。
 */
export async function loadPostBody(
  number: number,
  lang: Lang,
  signal?: AbortSignal
): Promise<string> {
  if (lang === 'zh') {
    const cached = bodyCache.get(number);
    if (cached !== undefined) return cached;

    const file = translatedNumbers.has(number)
      ? `data/blog/${number}.zh.json`
      : `data/blog/${number}.json`;
    const res = await fetch(assetUrl(file), { signal });
    if (!res.ok) {
      throw new Error(`这一篇还没进快照（#${number}）`);
    }
    const post = (await res.json()) as { body?: string };
    const body = post.body ?? '';
    bodyCache.set(number, body);
    return body;
  }

  const preferSnapshot = !snapshotLoaded || translatedNumbers.has(number);

  if (!preferSnapshot) {
    const cached = bodyCache.get(number);
    if (cached !== undefined) return cached;
  }

  const res = await fetch(assetUrl(`data/blog/${number}.json`), { signal });
  if (!res.ok) {
    // 构建之后才开的 issue 不在快照里，退回实时同步收下的那份
    const cached = bodyCache.get(number);
    if (cached !== undefined) return cached;
    throw new Error(`This post is not in the snapshot yet (#${number})`);
  }

  const post = (await res.json()) as { body?: string };
  const body = post.body ?? '';
  bodyCache.set(number, body);
  return body;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
