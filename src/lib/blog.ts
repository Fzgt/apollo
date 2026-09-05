/**
 * 博客数据层：文章存在 Blog 仓库的 issues 里，这边只负责读。
 *
 * 只有一个来源——构建期快照 `public/data/blog/`（`scripts/sync-blog.mjs` 生成，
 * 随站点一起发布）。曾经还会在浏览器里直接打 GitHub API 补最新的几篇，但 Blog
 * 是私有仓库，前端没法带 token（带了就等于公开），GitHub 对无权限的私有仓库一律
 * 返回 404，那条路径只会稳定失败，已经去掉。
 *
 * 代价是写完新文章要重新跑一次同步脚本并部署，页面才看得到。
 *
 * 左侧的分类索引也在快照里（`categories`），构建期从 Blog 仓库的 README 解析。
 *
 * 语言：issues 里的原文是中文，`src/content/blog/<号>.en.md` 是译文，构建期合成
 * 两套快照（`index.json` 是英文优先的那份，`index.zh.json` 是纯中文那份）。
 */

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

/** README 里的一个分组。`numbers` 保持 README 里的顺序 */
export interface BlogCategory {
  name: string;
  /** 分类名后面「·」那半句，没有就是空串 */
  hint: string;
  numbers: number[];
}

export interface BlogIndex {
  repo: string;
  /** 快照的抓取时间 */
  syncedAt: string;
  posts: BlogPostMeta[];
  /** 快照里已经是英文的那些 issue 号，见 scripts/sync-blog.mjs */
  translated?: number[];
  /** 左侧索引的分组，来自 Blog 仓库 README */
  categories?: BlogCategory[];
}

/** 同一次会话里翻来翻去不重复请求。中英文各存一份，别互相顶掉 */
const bodyCache = new Map<string, string>();

function assetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

/** 哪些篇的 `<号>.json` 里装的是译文——那时中文正文要去读 `<号>.zh.json` */
const translatedNumbers = new Set<number>();

function rememberSnapshot(index: BlogIndex): void {
  translatedNumbers.clear();
  for (const number of index.translated ?? []) translatedNumbers.add(number);
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
  const index = (await res.json()) as BlogIndex;
  rememberSnapshot(index);
  return index;
}

/**
 * 正文。`<号>.json` 里装的是「这一篇对外显示的那份」——有译文就是英文，没有就是
 * 中文原文；被译文顶掉的那几篇另有一份 `<号>.zh.json` 留着中文。
 */
export async function loadPostBody(
  number: number,
  lang: Lang,
  signal?: AbortSignal
): Promise<string> {
  const key = `${lang}:${number}`;
  const cached = bodyCache.get(key);
  if (cached !== undefined) return cached;

  const file =
    lang === 'zh' && translatedNumbers.has(number)
      ? `data/blog/${number}.zh.json`
      : `data/blog/${number}.json`;

  const res = await fetch(assetUrl(file), { signal });
  if (!res.ok) {
    throw new Error(
      lang === 'zh'
        ? `这一篇还没进快照（#${number}）`
        : `This post is not in the snapshot yet (#${number})`
    );
  }

  const post = (await res.json()) as { body?: string };
  const body = post.body ?? '';
  bodyCache.set(key, body);
  return body;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
