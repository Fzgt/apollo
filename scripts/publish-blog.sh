#!/usr/bin/env bash
#
# 把 Blog 仓库的 issues 同步进快照并发布上线。
#
# Blog 的 issue 改完之后，光 push apollo 是不够的——`public/data/blog/*.json`
# 是提交在仓库里的静态快照，`npm run build` 不会去拉 GitHub。必须先跑同步脚本。
# 这个脚本把「同步 → 提交 → 推送」串成一步，Vercel 收到 push 自动构建。
#
# 用法：在任何目录下执行 `~/Desktop/projects/github/apollo/scripts/publish-blog.sh`
# 可选：加参数当作 commit message 的补充说明。
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# Blog 是私有仓库，同步脚本取图必须带 token；复用 gh 的登录态
if ! command -v gh >/dev/null 2>&1; then
  echo "需要 gh CLI（同步私有仓库的图片要 token）" >&2
  exit 1
fi
export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"

# Vite 8 要 Node 22，系统默认那个不满足
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null
fi

# 同步前先确认工作区里没有别的未提交改动，避免把它们裹进这次提交
if [ -n "$(git status --porcelain -- ':!public/data/blog')" ]; then
  echo "工作区有 public/data/blog 之外的未提交改动，先处理掉再同步：" >&2
  git status --short -- ':!public/data/blog' >&2
  exit 1
fi

echo "▸ 同步 Blog issues …"
node scripts/sync-blog.mjs

# index.json 里的 syncedAt 每次同步都会变，只有它变说明内容其实没动。
# 这种情况把改动丢掉，保持工作区干净，也别推一个空内容的提交。
UNTRACKED="$(git status --porcelain -- public/data/blog | grep '^??' || true)"
REAL_DIFF="$(git diff -U0 -- public/data/blog \
  | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -v '"syncedAt"' || true)"

if [ -z "$UNTRACKED" ] && [ -z "$REAL_DIFF" ]; then
  git checkout -- public/data/blog
  echo "✓ 内容没有变化，无需发布"
  exit 0
fi

echo "▸ 变更文件："
git status --short -- public/data/blog

MSG="docs: 同步博客快照"
[ $# -gt 0 ] && MSG="$MSG —— $*"

git add public/data/blog
git commit -q -m "$MSG"
git push -q origin main

echo "✓ 已推送，Vercel 构建中：https://apollo-five-omega.vercel.app/blog"
