import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronsDownUp, Search, SearchX, X } from 'lucide-react';
import { QuestionRow } from '@/components/questions/QuestionRow';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { questionCount, questionSources, type Question } from '@/content/questions';
import { fuzzyMatch } from '@/lib/fuzzy';
import { cn } from '@/lib/utils';

interface Scored {
  question: Question;
  score: number;
  hitZh?: number[];
  hitEn?: number[];
}

/**
 * 一道题的命中：中文题干、英文题干、答案正文各算一次，取最高分。
 * 答案命中要打折——搜的是题目，答案只是兜底。
 */
function scoreQuestion(question: Question, query: string): Scored | null {
  const zh = fuzzyMatch(query, question.q.zh);
  const en = question.q.en ? fuzzyMatch(query, question.q.en) : null;
  // 正文只认精确子串：让它参与模糊匹配会把整个题库都捞回来
  const body = question.a.zh.toLowerCase().includes(query.trim().toLowerCase()) ? 140 : -Infinity;
  const keys = question.keywords?.length ? fuzzyMatch(query, question.keywords.join(' ')) : null;

  const best = Math.max(
    zh?.score ?? -Infinity,
    en?.score ?? -Infinity,
    (keys?.score ?? -Infinity) - 10,
    body - 60
  );

  if (!Number.isFinite(best)) return null;

  return {
    question,
    score: best,
    hitZh: zh?.indices,
    hitEn: en?.indices,
  };
}

export default function QuestionsPage() {
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const trimmed = query.trim();

  /** 分组结构原样保留，只把不匹配的题摘掉；空掉的 bullet 不显示 */
  const groups = useMemo(() => {
    return questionSources.map((source) => ({
      source,
      bullets: source.bullets
        .map((bullet) => {
          if (!trimmed) {
            return {
              bullet,
              rows: bullet.questions.map((question) => ({ question, score: 0 }) as Scored),
            };
          }
          // bullet 标题命中时，整组都算命中——「bullet 4」这种搜法要能用
          const groupHit = fuzzyMatch(trimmed, `${source.title} ${bullet.title}`);
          const rows = bullet.questions
            .map((question) => scoreQuestion(question, trimmed) ?? (groupHit ? ({ question, score: groupHit.score - 40 } as Scored) : null))
            .filter((row): row is Scored => row !== null)
            .sort((a, b) => b.score - a.score);
          return { bullet, rows };
        })
        .filter((entry) => entry.rows.length > 0 || !trimmed),
    })).filter((group) => group.bullets.length > 0);
  }, [trimmed]);

  const visibleCount = groups.reduce(
    (sum, group) => sum + group.bullets.reduce((n, entry) => n + entry.rows.length, 0),
    0
  );

  const isFiltered = trimmed.length > 0;

  // 搜到唯一一条时直接展开，省一次点击
  useEffect(() => {
    if (!isFiltered || visibleCount !== 1) return;
    const only = groups.flatMap((g) => g.bullets.flatMap((b) => b.rows))[0];
    if (only) setOpenIds(new Set([only.question.id]));
  }, [isFiltered, visibleCount, groups]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 pt-20 md:pt-24">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-4">
          {/* 搜索条放页面正中最上方：进来第一件事就是找题 */}
          <div className="pt-4 md:pt-6">
            <div className="relative mx-auto max-w-2xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜题目 —— 中英文都行，记得住几个字就够"
                aria-label="搜索题目"
                className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-24 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="清空搜索"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
                <span className="flex items-baseline gap-1 text-xs tabular-nums">
                  <motion.span
                    key={visibleCount}
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'font-semibold',
                      isFiltered ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {visibleCount}
                  </motion.span>
                  <span className="text-muted-foreground">
                    {isFiltered ? `/ ${questionCount}` : '题'}
                  </span>
                </span>
              </div>
            </div>

            <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between text-xs text-muted-foreground">
              <span>被问过的题和该怎么答。代码出处在「资料」，这里只管出口的那句话。</span>
              {openIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenIds(new Set())}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronsDownUp className="size-3.5" />
                  全部收起
                </button>
              )}
            </div>
          </div>

          <div className="space-y-10 py-8">
            {groups.map(({ source, bullets }) => (
              <section key={source.id}>
                <div className="mb-4 flex items-baseline gap-3">
                  <h2 className="text-xl font-bold text-foreground md:text-2xl">{source.title}</h2>
                  {source.subtitle && (
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      {source.subtitle}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  {bullets.map(({ bullet, rows }) => (
                    <div
                      key={bullet.id}
                      className="overflow-hidden rounded-xl border border-border bg-card"
                    >
                      <div className="border-b border-border bg-muted/30 px-4 py-3">
                        <h3 className="text-sm font-semibold text-foreground">{bullet.title}</h3>
                        {bullet.resume && (
                          <p className="mt-1.5 border-l-2 border-border pl-2.5 text-xs italic leading-relaxed text-muted-foreground">
                            {bullet.resume}
                          </p>
                        )}
                      </div>

                      {rows.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                          这条还没出过题
                        </p>
                      ) : (
                        rows.map((row) => (
                          <QuestionRow
                            key={row.question.id}
                            question={row.question}
                            isOpen={openIds.has(row.question.id)}
                            onToggle={() => toggle(row.question.id)}
                            hitZh={row.hitZh}
                            hitEn={row.hitEn}
                          />
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {isFiltered && visibleCount === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <SearchX className="size-6" />
                <p className="text-sm">没有匹配的题目</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
