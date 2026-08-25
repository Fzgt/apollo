import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck,
  FileText,
  Github,
  MessageCircleQuestion,
  Send,
} from 'lucide-react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { StatusBadge } from '@/components/notes/StatusBadge';
import { answerCount } from '@/content/applications';
import { allLibraryNotes } from '@/content/library';
import { allNotes } from '@/content/notes';
import { questionCount } from '@/content/questions';
import { REPO_DEV_URL, REPO_URL, SITE_NAME, SITE_TAGLINE } from '@/content/site';

function noteHref(sectionId: string, itemId: string) {
  return `/docs?section=${encodeURIComponent(sectionId)}&item=${encodeURIComponent(itemId)}`;
}

function stripDayPrefix(title: string) {
  return title.replace(/^Day \d+ · /, '');
}

/** 一行式条目：左侧竖线 + 向右淡出的底色 + 跟着指针推 3px，和题库/投递一套手法 */
function RowLink({
  to,
  title,
  meta,
  right,
}: {
  to: string;
  title: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ x: 3 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="group relative border-b border-border last:border-b-0"
    >
      <Link
        to={to}
        className="relative flex items-center gap-3 overflow-hidden py-2 pl-4 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.055] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="relative min-w-0 flex-1 truncate text-sm leading-6 text-foreground transition-colors group-hover:text-primary">
          {title}
        </span>
        {meta && (
          <span className="relative hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {meta}
          </span>
        )}
        {right}
      </Link>
    </motion.div>
  );
}

export default function HomePage() {
  /** 十四天已经跑完，这里要的是「还欠什么」，不是进度条 */
  const open = useMemo(() => allNotes.filter((note) => note.status !== 'done'), []);

  /** S 级＝面试里最可能被追到底的几页 */
  const critical = useMemo(() => allNotes.filter((note) => note.level === 'S'), []);

  const stats = [
    { label: '投递答案', value: answerCount, href: '/apply' },
    { label: '真题', value: questionCount, href: '/questions' },
    { label: '项目笔记', value: allLibraryNotes.length, href: '/library' },
    { label: '复习笔记', value: allNotes.length, href: '/docs' },
  ];

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
              网申和面试的底料都在这里：现搜现粘的表单答案、真的被问过的题、六段经历各自的讲法，
              以及一份随时能发出去的简历。本地写 Markdown，push 上线。
            </p>

            {/* 库存：从内容层直接算，加一篇就变一个数 */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((stat) => (
                <Link
                  key={stat.label}
                  to={stat.href}
                  className="rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="text-2xl font-semibold tabular-nums text-foreground">
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{stat.label}</div>
                </Link>
              ))}
            </div>
          </motion.header>

          {/* 今天要用的 */}
          <section className="mt-12 grid gap-3 sm:grid-cols-3">
            <Link
              to="/apply"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <Send className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 flex items-center gap-1 font-medium text-foreground">
                填表单
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                搜关键词，右侧图标一键复制，不用展开。
              </p>
            </Link>
            <Link
              to="/questions"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <MessageCircleQuestion className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 flex items-center gap-1 font-medium text-foreground">
                面试前
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                只收真的被问过的题，中英双语，含追问。
              </p>
            </Link>
            <Link
              to="/resume"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 flex items-center gap-1 font-medium text-foreground">
                要发简历
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                网页版对着 PDF 重排，原件在页内下载。
              </p>
            </Link>
          </section>

          {/* 还没结的 */}
          {open.length > 0 && (
            <section className="mt-12">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-foreground">还没结的</h2>
                <span className="text-sm text-muted-foreground">{open.length} 页</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {open.map((note) => (
                  <RowLink
                    key={`${note.sectionId}-${note.itemId}`}
                    to={noteHref(note.sectionId, note.itemId)}
                    title={stripDayPrefix(note.title)}
                    meta={note.section}
                    right={
                      <StatusBadge status={note.status} className="relative shrink-0 border-0 bg-transparent px-0" />
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* S 级 */}
          <section className="mt-12">
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">会被追到底的</h2>
              <span className="text-sm text-muted-foreground">S 级 {critical.length} 页</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {critical.map((note) => (
                <RowLink
                  key={`${note.sectionId}-${note.itemId}`}
                  to={noteHref(note.sectionId, note.itemId)}
                  title={stripDayPrefix(note.title)}
                  meta={note.section}
                />
              ))}
            </div>
          </section>

          {/* 十四天存档 */}
          <section className="mt-12">
            <Link
              to="/docs?section=overview&item=plan"
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <CalendarCheck className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-foreground">十四天复习计划</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  十四天的日程已经走完，{allNotes.length} 篇留在「计划」里；上面两张清单都是从它里挑的。
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </section>

          {/* 怎么维护 */}
          <section className="mb-20 mt-12 rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold text-foreground">怎么维护这个站</h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground">1.</span> 笔记是{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  src/content/&lt;集合&gt;/&lt;分组&gt;/&lt;笔记&gt;.md
                </code>
                ，丢一个 .md 进去导航自动出现，文件名的数字前缀决定顺序。
              </li>
              <li>
                <span className="text-foreground">2.</span> 题库和投递答案是 TS 数据 ——{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">content/questions</code> 与{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">content/applications</code>
                ，加一组写一个文件挂进数组。
              </li>
              <li>
                <span className="text-foreground">3.</span> push 后 Vercel 自动上线；上面的四个数和
                「还没结的」都是算出来的，不用手改。
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
                在浏览器里改（或在仓库页面按{' '}
                <kbd className="rounded border border-border px-1 text-xs">.</kbd>）。
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
            </a>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
