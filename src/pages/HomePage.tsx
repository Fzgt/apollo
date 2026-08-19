import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Calculator, Github, ListChecks } from 'lucide-react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { StatusBadge } from '@/components/notes/StatusBadge';
import { STATUS_META } from '@/components/notes/status';
import { allNotes, dayNotes, noteSections } from '@/content/notes';
import { REPO_DEV_URL, REPO_URL, SITE_NAME, SITE_TAGLINE } from '@/content/site';
import { cn } from '@/lib/utils';

const LEVEL_TONE: Record<string, string> = {
  S: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  A: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  B: 'border-border bg-muted/50 text-muted-foreground',
};

function noteHref(sectionId: string, itemId: string) {
  return `/docs?section=${encodeURIComponent(sectionId)}&item=${encodeURIComponent(itemId)}`;
}

export default function HomePage() {
  const progress = useMemo(() => {
    const done = dayNotes.filter((note) => note.status === 'done').length;
    const doing = dayNotes.filter((note) => note.status === 'doing').length;
    return {
      done,
      doing,
      total: dayNotes.length,
      percent: dayNotes.length ? Math.round((done / dayNotes.length) * 100) : 0,
    };
  }, []);

  const cheatsheet = noteSections.find((section) => section.id === 'cheatsheet');

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-24 md:pt-32">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6">
          {/* Hero */}
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-sm font-medium text-muted-foreground">{SITE_TAGLINE}</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              {SITE_NAME}
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              对应简历 v40 的十四天复习。22 条 bullet、20 个数字口径、5 个项目仓库。
              每一页都是一份待回答的问题清单——本地写 Markdown，push 上线。
            </p>

            {/* 进度 */}
            <div className="mt-8 rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">复习进度</span>
                <span className="text-sm text-muted-foreground">
                  <span className="text-2xl font-semibold text-foreground">{progress.done}</span>
                  {' / '}
                  {progress.total} 天完成
                  {progress.doing > 0 && `，${progress.doing} 天进行中`}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.header>

          {/* 十四天 */}
          <section className="mt-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">十四天</h2>
              <Link
                to="/docs?section=overview&item=plan"
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                看总纲
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dayNotes.map((note, index) => (
                <motion.div
                  key={`${note.sectionId}-${note.itemId}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                >
                  <Link
                    to={noteHref(note.sectionId, note.itemId)}
                    className={cn(
                      'group flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50',
                      note.status === 'doing' ? 'border-amber-500/40' : 'border-border'
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Day {note.day}
                      </span>
                      {note.level && note.level !== '—' && (
                        <span
                          className={cn(
                            'rounded border px-1.5 py-0.5 text-[11px] font-medium',
                            LEVEL_TONE[note.level] ?? LEVEL_TONE.B
                          )}
                        >
                          {note.level}
                        </span>
                      )}
                    </div>
                    <span className="flex-1 font-medium leading-snug text-foreground">
                      {note.title.replace(/^Day \d+ · /, '')}
                    </span>
                    <div className="mt-3 flex items-center justify-between">
                      <StatusBadge status={note.status} />
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 快捷入口 */}
          <section className="mt-12 grid gap-3 sm:grid-cols-3">
            <Link
              to="/docs?section=numbers&item=day01"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <Calculator className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 font-medium text-foreground">数字口径审计</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                20 个数字，逐个回答「你怎么测的」。答不住就改到 v41。
              </p>
            </Link>
            <Link
              to="/docs?section=overview&item=standards"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 font-medium text-foreground">每日产出标准</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                四项产出、讲述链路、完成标准。判断一天算不算过。
              </p>
            </Link>
            <Link
              to={
                cheatsheet?.items[0]
                  ? noteHref(cheatsheet.id, cheatsheet.items[0].itemId)
                  : '/docs'
              }
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 font-medium text-foreground">速查</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                幂等四实现、跨项目追问、面试前一页。
              </p>
            </Link>
          </section>

          {/* 怎么用 */}
          <section className="mb-20 mt-12 rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold text-foreground">怎么维护这个站</h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground">1.</span> 本地编辑{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  src/content/notes/&lt;分组&gt;/&lt;笔记&gt;.md
                </code>
                ，push 后 Cloudflare 自动上线。
              </li>
              <li>
                <span className="text-foreground">2.</span> 新增一页＝丢一个 .md
                进对应目录，导航自动出现；文件名的数字前缀决定顺序。
              </li>
              <li>
                <span className="text-foreground">3.</span> 改 frontmatter 里的{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">status</code>（
                {Object.entries(STATUS_META)
                  .map(([key, meta]) => `${key}=${meta.label}`)
                  .join(' · ')}
                ），上面的进度条跟着动。
              </li>
              <li>
                <span className="text-foreground">4.</span> 人不在电脑前，用{' '}
                <a
                  href={REPO_DEV_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4"
                >
                  github.dev
                </a>{' '}
                在浏览器里改（或在仓库页面按 <kbd className="rounded border border-border px-1 text-xs">.</kbd>）。
              </li>
            </ol>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github className="h-4 w-4" />
              仓库：{REPO_URL.replace('https://github.com/', '')}
              <span className="text-xs">· 共 {allNotes.length} 篇</span>
            </a>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
