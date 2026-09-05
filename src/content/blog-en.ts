import type { Lang } from '@/lib/i18n';

/**
 * 博客的英文层。
 *
 * 原文写在 `Fzgt/Blog` 的 issues 里，那边一个字都不动；翻译放在
 * `src/content/blog/<issue 号>.en.md`，frontmatter 只有一个 `title`。
 * 和 `content/notes` 的 `.md` / `.en.md` 是同一个规矩：站点只讲英文，
 * 还没翻的那一篇回落中文原文——空页面比一页中文糟得多。
 *
 * 译文由 `scripts/sync-blog.mjs` 在构建期合进 `public/data/blog/` 快照，
 * **不从这里 import 正文**——五十篇塞进 bundle 会把列表页的首屏包撑一倍。
 * 这个文件只留标签这一件运行期的小事。
 *
 * 新开一个 issue 站上就自动多一篇，但它是中文的，直到这里补上同号的 `.en.md`
 * 并重新构建一次。
 */

/** GitHub 上的标签是中文的，改不了（那是原仓库的数据），只在显示时换个名字 */
const LABEL_EN: Record<string, string> = {
  知识体系: 'Fundamentals',
  性能优化: 'Performance',
  前端工程化: 'Tooling',
};

/** 中文模式下原样显示 GitHub 上的标签——那本来就是中文 */
export function labelText(name: string, lang: Lang): string {
  return lang === 'zh' ? name : (LABEL_EN[name] ?? name);
}

/**
 * 左侧索引的分类名同理：分组写在 Blog 仓库的 README 里，是中文，
 * 这里只管显示时换个说法。README 加了新分组而这里没补，就回落中文。
 */
const CATEGORY_EN: Record<string, string> = {
  'React 原理': 'React internals',
  Hooks: 'Hooks',
  服务端渲染: 'Server rendering',
  数据层与状态: 'Data & state',
  性能优化: 'Performance',
  网络与协议: 'Network & protocols',
  语言与异步: 'Language & async',
  构建与工程化: 'Build & tooling',
  'AI 工程': 'AI engineering',
  项目笔记: 'Project notes',
  面试与清单: 'Checklists',
  Vue: 'Vue',
  待定: 'Unfiled',
};

export function categoryText(name: string, lang: Lang): string {
  return lang === 'zh' ? name : (CATEGORY_EN[name] ?? name);
}
