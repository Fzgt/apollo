#!/usr/bin/env node
/**
 * 构建期生成 public/llms.txt —— 给 AI 读的纯文本目录。
 *
 * 站点是单页应用，Claude 之类的抓取工具不跑 JS，打开首页只看得到
 * 「这个站需要 JavaScript」。所以这里列一份目录，每条直接指向不用 JS 就能读的地方：
 *   - 笔记、题解：GitHub 上的原始 Markdown（raw.githubusercontent.com，仓库公开）；
 *   - 博客：仓库里的 public/data/blog/<号>.json 快照（正文是 Markdown 字段）。
 *
 * 链接一律走 raw.githubusercontent.com，不指回本站：Claude 那边对本站的
 * robots 判定有缓存，放行了也照样报「整站被拦」，GitHub raw 没有 robots 这一关。
 * 同理这份文件本身也提交进仓库，raw 地址就能读到它。内容变了要重跑再提交。
 *
 * 用法：node scripts/gen-llms.mjs（build 前自动跑）
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const CONTENT = join(ROOT, 'src/content')
const RAW = 'https://raw.githubusercontent.com/Fzgt/apollo/main/'

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
}

function titleOf(file) {
  const text = readFileSync(file, 'utf8')
  const fm = text.match(/^---\n([\s\S]*?)\n---/)
  const t = fm?.[1].match(/^title:\s*(.+)$/m)?.[1]
  if (t) return t.trim().replace(/^['"]|['"]$/g, '')
  return text.match(/^#\s+(.+)$/m)?.[1].trim() ?? relative(CONTENT, file)
}

const groups = new Map()
for (const file of walk(CONTENT)) {
  if (!file.endsWith('.md') || file.endsWith('.en.md')) continue
  const rel = relative(CONTENT, file)
  const [top, sub] = rel.split('/')
  // blog 下的 .md 是译文，正文走下面的博客快照
  if (top === 'blog') continue
  const key = sub && sub !== rel.split('/').pop() ? `${top}/${sub}` : top
  if (!groups.has(key)) groups.set(key, [])
  const en = file.replace(/\.md$/, '.en.md')
  const line = `- [${titleOf(file)}](${RAW}${relative(ROOT, file)})` +
    (existsSync(en) ? ` · [English](${RAW}${relative(ROOT, en)})` : '')
  groups.get(key).push(line)
}

const out = [
  '# Apollo',
  '',
  '> 简历、面试与技术笔记站（Chris Sun）。站点是单页应用，抓取工具读不到页面内容，',
  '> 请直接打开下面的链接 —— 每条都是不需要 JavaScript 的原文。',
  '',
]
for (const [key, lines] of groups) out.push(`## ${key}`, '', ...lines, '')

const blogDir = join(ROOT, 'public/data/blog')
const indexFile = existsSync(join(blogDir, 'index.zh.json')) ? 'index.zh.json' : 'index.json'
if (existsSync(join(blogDir, indexFile))) {
  const { posts } = JSON.parse(readFileSync(join(blogDir, indexFile), 'utf8'))
  out.push('## blog', '', '> JSON 快照，正文在 `body` 字段（Markdown）。', '')
  for (const p of posts) {
    const zh = existsSync(join(blogDir, `${p.number}.zh.json`))
    out.push(`- [#${p.number} ${p.title}](${RAW}public/data/blog/${p.number}${zh ? '.zh' : ''}.json)` +
      (zh ? ` · [English](${RAW}public/data/blog/${p.number}.json)` : ''))
  }
  out.push('')
}

writeFileSync(join(ROOT, 'public/llms.txt'), out.join('\n'))
console.log(`llms.txt: ${[...groups.values()].flat().length} 篇笔记 + 博客`)
