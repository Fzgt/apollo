/**
 * 博客数据层：文章存在 Blog 仓库的 issues 里，这边只负责读。
 *
 * 两个来源，先后接力：
 *   1. 构建期快照 `public/data/blog/`（scripts/sync-blog.mjs 生成）—— 首屏立刻有内容；
 *   2. GitHub API —— 打开页面时后台再拉一次，把新写的文章补上。
 *
 * 快照永远是兜底。GitHub 限流（未登录 60 次/小时）或断网时，第 2 步静默失败，
 * 页面照旧显示快照，只是在顶部标一句数据截止时间。
 */

import { BLOG_REPO } from '@/content/site';

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
  /** snapshot = 构建期快照，live = 刚从 GitHub 拉的 */
  source: 'snapshot' | 'live';
}

const EXCERPT_LENGTH = 140;
const MAX_HEADINGS = 8;
const PER_PAGE = 100;
const MAX_PAGES = 10;

/** 同一次会话里翻来翻去不重复请求 */
const bodyCache = new Map<number, string>();
let liveIndexCache: BlogIndex | null = null;

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
export async function loadSnapshotIndex(signal?: AbortSignal): Promise<BlogIndex> {
  const res = await fetch(assetUrl('data/blog/index.json'), { signal });
  if (!res.ok) {
    throw new Error(`Could not read the snapshot (${res.status})`);
  }
  const data = (await res.json()) as Omit<BlogIndex, 'source'>;
  return { ...data, source: 'snapshot' };
}

/**
 * 直接问 GitHub 要最新的。Blog 是公开仓库，不需要 token；
 * 未登录额度是每小时 60 次，这里一次请求就能拿满 100 篇，够用。
 */
export async function fetchLiveIndex(signal?: AbortSignal): Promise<BlogIndex> {
  const issues: GitHubIssue[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetch(
      `https://api.github.com/repos/${BLOG_REPO}/issues?state=all&per_page=${PER_PAGE}&page=${page}&sort=created&direction=desc`,
      { signal, headers: { Accept: 'application/vnd.github+json' } }
    );

    if (!res.ok) {
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
    posts: issues.map((issue) => ({
      number: issue.number,
      title: issue.title,
      labels: normalizeLabels(issue.labels),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
      excerpt: toExcerpt(issue.body ?? ''),
      headings: toHeadings(issue.body ?? ''),
    })),
  };

  liveIndexCache = index;
  return index;
}

export function getCachedLiveIndex(): BlogIndex | null {
  return liveIndexCache;
}

/** 正文：内存缓存 → 构建期快照文件 */
export async function loadPostBody(number: number, signal?: AbortSignal): Promise<string> {
  const cached = bodyCache.get(number);
  if (cached !== undefined) return cached;

  const res = await fetch(assetUrl(`data/blog/${number}.json`), { signal });
  if (!res.ok) {
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
