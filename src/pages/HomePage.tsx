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
import { QuickLinkRow } from '@/components/home/QuickLinkRow';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { StatusBadge } from '@/components/notes/StatusBadge';
import { answerCount } from '@/content/applications';
import { allLibraryNotes } from '@/content/library';
import { quickLinkGroups } from '@/content/links';
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
    { label: 'Form answers', value: answerCount, href: '/apply' },
    { label: 'Real questions', value: questionCount, href: '/questions' },
    { label: 'Project notes', value: allLibraryNotes.length, href: '/library' },
    { label: 'Revision notes', value: allNotes.length, href: '/docs' },
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
              Everything the applications and interviews run on: form answers to search and paste,
              questions that were really asked, how each of the six roles is told, and a resume ready
              to send. Written locally in Markdown, live on push.
            </p>

            {/* 常用：给别人的那几行字。整行即复制按钮 */}
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {quickLinkGroups.map((group) => (
                <div key={group.title} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
                    <span className="text-sm font-medium text-foreground">{group.title}</span>
                    <span className="text-xs text-muted-foreground">{group.hint}</span>
                  </div>
                  {group.links.map((link) => (
                    <QuickLinkRow key={link.value} link={link} />
                  ))}
                </div>
              ))}
            </div>

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
                Filling a form
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Search a keyword and copy from the icon on the right — no need to expand.
              </p>
            </Link>
            <Link
              to="/questions"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <MessageCircleQuestion className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 flex items-center gap-1 font-medium text-foreground">
                Before an interview
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Only questions that were really asked, in both languages, follow-ups included.
              </p>
            </Link>
            <Link
              to="/resume"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 flex items-center gap-1 font-medium text-foreground">
                Sending the resume
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The web version is laid out against the PDF; the original is on the page.
              </p>
            </Link>
          </section>

          {/* 还没结的 */}
          {open.length > 0 && (
            <section className="mt-12">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-foreground">Still open</h2>
                <span className="text-sm text-muted-foreground">{open.length} pages</span>
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
              <h2 className="text-lg font-semibold text-foreground">Where they will dig in</h2>
              <span className="text-sm text-muted-foreground">{critical.length} level-S pages</span>
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
                <h3 className="font-medium text-foreground">The fourteen-day revision plan</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  The fourteen days are done; {allNotes.length} pages remain under Plan, and both
                  lists above are drawn from them.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </section>

          {/* 怎么维护 */}
          <section className="mb-20 mt-12 rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold text-foreground">How to maintain this site</h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground">1.</span> Notes live at{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  src/content/&lt;collection&gt;/&lt;section&gt;/&lt;note&gt;.md
                </code>
                . Drop a .md in and it appears in the navigation; the numeric filename prefix
                sets the order.
              </li>
              <li>
                <span className="text-foreground">2.</span> Questions and form answers are TS data ——{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">content/questions</code> and{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">content/applications</code>
                . Add a group by writing one file and hanging it off the array.
              </li>
              <li>
                <span className="text-foreground">3.</span> Vercel deploys on push; the four numbers
                above and the "Still open" list are all computed, never edited by hand.
              </li>
              <li>
                <span className="text-foreground">4.</span> Away from the computer, edit in the
                browser with{' '}
                <a
                  href={REPO_DEV_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4"
                >
                  github.dev
                </a>{' '}
                (or press{' '}
                <kbd className="rounded border border-border px-1 text-xs">.</kbd> on the repository
                page).
              </li>
            </ol>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github className="h-4 w-4" />
              {REPO_URL.replace('https://github.com/', '')}
            </a>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
