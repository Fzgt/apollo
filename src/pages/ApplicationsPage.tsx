import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronsDownUp, Search, SearchX, X } from 'lucide-react';
import { ApplicationRow } from '@/components/applications/ApplicationRow';
import { SiteFooter } from '@/components/layout/SiteFooter';
import {
  answerCount,
  answerNumbers,
  applicationGroups,
  type ApplicationAnswer,
} from '@/content/applications';
import { fuzzyMatch } from '@/lib/fuzzy';
import { cn } from '@/lib/utils';

interface Scored {
  answer: ApplicationAnswer;
  score: number;
  hits?: number[];
}

/**
 * 一条答案的命中：题干、别名、正文各算一次，取最高分。
 * 别名打小折，正文打大折——搜的是题目，正文只是兜底。
 */
function scoreAnswer(answer: ApplicationAnswer, query: string): Scored | null {
  const q = fuzzyMatch(query, answer.q);
  const keys = answer.keywords?.length ? fuzzyMatch(query, answer.keywords.join(' ')) : null;
  const note = answer.note ? fuzzyMatch(query, answer.note) : null;
  // 正文只认精确子串：让它参与模糊匹配会把整个库都捞回来
  const body = answer.a.toLowerCase().includes(query.trim().toLowerCase()) ? 140 : -Infinity;

  const best = Math.max(
    q?.score ?? -Infinity,
    (keys?.score ?? -Infinity) - 10,
    (note?.score ?? -Infinity) - 30,
    body - 60
  );

  if (!Number.isFinite(best)) return null;

  return { answer, score: best, hits: q?.indices };
}

export default function ApplicationsPage() {
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const trimmed = query.trim();
  const isFiltered = trimmed.length > 0;

  /** 不搜索时全列；搜索时每组只留命中的，空组不显示 */
  const shown = useMemo(
    () =>
      applicationGroups
        .map((group) => {
          const rows = !isFiltered
            ? group.answers.map((answer) => ({ answer, score: 0 }) as Scored)
            : (() => {
                // 组名命中时整组都算命中——按公司名搜要能把那家的题一次捞全
                const groupHit = fuzzyMatch(trimmed, `${group.title} ${group.subtitle ?? ''}`);
                return group.answers
                  .map(
                    (answer) =>
                      scoreAnswer(answer, trimmed) ??
                      (groupHit ? ({ answer, score: groupHit.score - 40 } as Scored) : null)
                  )
                  .filter((row): row is Scored => row !== null)
                  .sort((a, b) => b.score - a.score);
              })();

          return { group, rows };
        })
        .filter(({ rows }) => rows.length > 0),
    [isFiltered, trimmed]
  );

  const hitCount = shown.reduce((sum, { rows }) => sum + rows.length, 0);

  // 搜到唯一一条时直接展开，省一次点击
  useEffect(() => {
    if (!isFiltered || hitCount !== 1) return;
    const only = shown.flatMap(({ rows }) => rows)[0];
    if (only) setOpenIds(new Set([only.answer.id]));
  }, [isFiltered, hitCount, shown]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 md:pt-24">
        <div className="container mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search — company, question or keyword"
              aria-label="Search form answers"
              className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-24 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
              <span className="flex items-baseline gap-1 text-xs tabular-nums">
                <motion.span
                  key={isFiltered ? hitCount : answerCount}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'font-semibold',
                    isFiltered ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {isFiltered ? hitCount : answerCount}
                </motion.span>
                <span className="text-muted-foreground">
                  {isFiltered ? `/ ${answerCount}` : 'answers'}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">
              Answers already pasted into application forms. Copy from the icon on the right; expand a row only to check it.
            </span>
            {openIds.size > 0 && (
              <button
                type="button"
                onClick={() => setOpenIds(new Set())}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronsDownUp className="size-3.5" />
                Collapse all
              </button>
            )}
          </div>

          <div className="space-y-4 py-6">
            {shown.map(({ group, rows }) => (
              <div key={group.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-baseline gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
                  {group.subtitle && (
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {group.subtitle}
                    </span>
                  )}
                  {group.companySpecific && (
                    <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      This company only
                    </span>
                  )}
                </div>

                {rows.map((row) => (
                  <ApplicationRow
                    key={row.answer.id}
                    answer={row.answer}
                    number={answerNumbers.get(row.answer.id) ?? 0}
                    isOpen={openIds.has(row.answer.id)}
                    onToggle={() => toggle(row.answer.id)}
                    hits={row.hits}
                  />
                ))}
              </div>
            ))}

            {isFiltered && hitCount === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <SearchX className="size-6" />
                <p className="text-sm">No matching answers</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
