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
