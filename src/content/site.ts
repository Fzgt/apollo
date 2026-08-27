/** 站点级常量。仓库换名或转私有时只改这里 */
export const SITE_NAME = 'Apollo';
export const SITE_TAGLINE = '非无其路惟无其心';
export const REPO_URL = 'https://github.com/Fzgt/apollo';
export const REPO_EDIT_BASE = `${REPO_URL}/edit/main`;
/** 在 GitHub 仓库页面按 `.` 进入的浏览器版 VS Code */
export const REPO_DEV_URL = 'https://github.dev/Fzgt/apollo';

/** 博客文章存在这个仓库的 issues 里，/blog 路由从这里同步 */
export const BLOG_REPO = 'Fzgt/Blog';
export const BLOG_REPO_URL = `https://github.com/${BLOG_REPO}`;
export const BLOG_ISSUES_URL = `${BLOG_REPO_URL}/issues`;

/** 单词本交件口：把本地攒的生词一次性开成一个 issue，等着被补释义 */
export const DICTIONARY_ISSUE_URL = `${REPO_URL}/issues/new?title=${encodeURIComponent(
  'Dictionary: new words'
)}&labels=dictionary`;
