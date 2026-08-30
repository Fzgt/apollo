import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronsDownUp, ChevronsUpDown, Search, SearchX, Shuffle, X } from 'lucide-react';
import { QuestionRow } from '@/components/questions/QuestionRow';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { questionCount, questionSources, type Question } from '@/content/questions';
import { fuzzyMatch } from '@/lib/fuzzy';
import { cn } from '@/lib/utils';
import { useLang } from '@/lib/i18n';
import { UI } from '@/content/ui';

interface Scored {
  question: Question;
  score: number;
  hitZh?: number[];
  hitEn?: number[];
}

/** 侧边栏和正文共用的一个格子：某家公司下的某条 bullet */
interface Slot {
  key: string;
  sourceId: string;
  sourceTitle: string;
  sourceSubtitle?: string;
  bulletId: string;
  bulletTitle: string;
  resume?: string;
  rows: Scored[];
  total: number;
}

/**
 * 一道题的命中：中文题干、英文题干、搜索别名、答案正文各算一次，取最高分。
 * 别名打小折，正文打大折——搜的是题目，正文只是兜底。
 */
function scoreQuestion(question: Question, query: string): Scored | null {
  const zh = fuzzyMatch(query, question.q.zh);
  const en = question.q.en ? fuzzyMatch(query, question.q.en) : null;
  const keys = question.keywords?.length ? fuzzyMatch(query, question.keywords.join(' ')) : null;
  // 正文只认精确子串：让它参与模糊匹配会把整个题库都捞回来。中英两份都要搜——
  // 站上显示的是英文，只搜中文那份会让人搜到一条自己在屏幕上找不到的命中
  const needle = query.trim().toLowerCase();
  const body = `${question.a.zh} ${question.a.en ?? ''}`.toLowerCase().includes(needle)
    ? 140
    : -Infinity;

  const best = Math.max(
    zh?.score ?? -Infinity,
    en?.score ?? -Infinity,
    (keys?.score ?? -Infinity) - 10,
    body - 60
  );

  if (!Number.isFinite(best)) return null;

  return { question, score: best, hitZh: zh?.indices, hitEn: en?.indices };
}

export default function QuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const trimmed = query.trim();
  const isFiltered = trimmed.length > 0;

  /** 所有格子。搜索时每个格子只留命中的题，用来在侧边栏标数 */
  const slots = useMemo<Slot[]>(
    () =>
      questionSources.flatMap((source) =>
        source.bullets.map((bullet) => {
          const rows = !isFiltered
            ? bullet.questions.map((question) => ({ question, score: 0 }) as Scored)
            : (() => {
                // bullet 标题命中时整组都算命中——「bullet 4」这种搜法要能用
                const groupHit = fuzzyMatch(trimmed, `${source.title} ${bullet.title}`);
                return bullet.questions
                  .map(
                    (question) =>
                      scoreQuestion(question, trimmed) ??
                      (groupHit ? ({ question, score: groupHit.score - 40 } as Scored) : null)
                  )
                  .filter((row): row is Scored => row !== null)
                  .sort((a, b) => b.score - a.score);
              })();

          return {
            key: `${source.id}/${bullet.id}`,
            sourceId: source.id,
            sourceTitle: source.title,
            sourceSubtitle: source.subtitle,
            bulletId: bullet.id,
            bulletTitle: bullet.title,
            resume: bullet.resume,
            rows,
            total: bullet.questions.length,
          };
        })
      ),
    [isFiltered, trimmed]
  );

  const paramKey = searchParams.get('b');
  const activeKey = slots.some((slot) => slot.key === paramKey) ? paramKey! : slots[0]?.key;

  const selectSlot = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('b', key);
    next.delete('q');
    setOpenIds(new Set());
    setSearchParams(next, { replace: true });
  };

  /**
   * 不搜索时只看选中的那条 bullet；一旦搜索就跨 bullet 出结果——
   * 否则搜到的东西在别的 bullet 下，屏幕上只会是一片空。
   */
  const shown = isFiltered
    ? slots.filter((slot) => slot.rows.length > 0)
    : slots.filter((slot) => slot.key === activeKey);

  const hitCount = slots.reduce((sum, slot) => sum + slot.rows.length, 0);

  // 搜到唯一一条时直接展开，省一次点击
  useEffect(() => {
    if (!isFiltered || hitCount !== 1) return;
    const only = slots.flatMap((slot) => slot.rows)[0];
    if (only) setOpenIds(new Set([only.question.id]));
  }, [isFiltered, hitCount, slots]);

  const revealQuestion = (id: string, scroll = true) => {
    setOpenIds(new Set([id]));
    const next = new URLSearchParams(searchParams);
    next.set('q', id);
    setSearchParams(next, { replace: true });
    if (scroll) {
      window.requestAnimationFrame(() =>
        document.getElementById(`question-${id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      );
    }
  };

  const toggle = (id: string) => {
    if (!openIds.has(id)) {
      revealQuestion(id, false);
      return;
    }
    if (openIds.size > 1) {
      const remaining = new Set(openIds);
      remaining.delete(id);
      setOpenIds(remaining);
      return;
    }
    setOpenIds(new Set());
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  // 刷新或分享带 q 参数的链接时，回到原来那道题。
  useEffect(() => {
    const id = searchParams.get('q');
    if (!id || !slots.some((slot) => slot.rows.some((row) => row.question.id === id))) return;
    setOpenIds((current) => (current.has(id) ? current : new Set([id])));
  }, [searchParams, slots]);

  const collapseAll = () => {
    setOpenIds(new Set());
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const expandSlot = (slot: Slot) => {
    setOpenIds(new Set(slot.rows.map((row) => row.question.id)));
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const pickRandom = (slot: Slot) => {
    if (slot.rows.length === 0) return;
    const candidates = slot.rows.filter((row) => !openIds.has(row.question.id));
    const pool = candidates.length > 0 ? candidates : slot.rows;
    const row = pool[Math.floor(Math.random() * pool.length)];
    revealQuestion(row.question.id);
  };

  /** 侧边栏一格。桌面竖排、手机横排滑动，样式差在容器上 */
  const slotButton = (slot: Slot, variant: 'aside' | 'chip') => {
    const active = !isFiltered && slot.key === activeKey;
    const badge = isFiltered ? slot.rows.length : slot.total;

    return (
      <button
        key={slot.key}
        type="button"
        onClick={() => {
          setQuery('');
          selectSlot(slot.key);
        }}
        title={slot.bulletTitle}
        className={cn(
          'flex items-center gap-2 text-left transition-colors',
          variant === 'aside'
            ? 'w-full rounded-lg px-3 py-2.5 text-sm'
            : 'shrink-0 rounded-full border px-3 py-1.5 text-xs',
          active
            ? variant === 'aside'
              ? 'bg-primary/10 font-medium text-primary'
              : 'border-primary/50 bg-primary/15 font-medium text-primary'
            : variant === 'aside'
              ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
              : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
          isFiltered && badge === 0 && 'opacity-40'
        )}
      >
        <span className={cn('min-w-0 flex-1', variant === 'chip' && 'whitespace-nowrap')}>
          {slot.bulletTitle}
        </span>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 text-[11px] tabular-nums',
            isFiltered && badge > 0
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {badge}
        </span>
      </button>
    );
  };

  const grouped = questionSources.map((source) => ({
    source,
    slots: slots.filter((slot) => slot.sourceId === source.id),
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 md:pt-24">
        <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-4">
          <div className="flex gap-8 py-4 sm:py-6">
            {/*
              侧边栏钉死在视口上。sticky 不够：正文比侧栏矮、或者滚到页脚时，
              sticky 的容器一到底侧栏就被顶着走。这里外层只占宽度，
              真正的栏是 fixed —— 不写 left，横向位置仍取占位块的静态位置，
              所以容器居中不受影响。
            */}
            <div className="hidden w-64 shrink-0 lg:block lg:w-72">
              <aside className="fixed top-[7.5rem] h-[calc(100vh-9rem)] w-64 overflow-y-auto overscroll-contain pr-1 lg:w-72">
                <nav className="space-y-5 pb-4">
                  {grouped.map(({ source, slots: own }) => (
                    <div key={source.id}>
                      <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                        {source.title}
                      </p>
                      <div className="space-y-0.5">
                        {own.map((slot) => slotButton(slot, 'aside'))}
                      </div>
                    </div>
                  ))}
                </nav>
              </aside>
            </div>

            <main className="min-w-0 flex-1">
              {/* 小屏没有侧栏，bullet 横着排一行 */}
              <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
                {slots.map((slot) => slotButton(slot, 'chip'))}
              </div>

              <div className="relative mx-auto max-w-2xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t(UI.questions.searchPlaceholder)}
                  aria-label={t(UI.questions.searchLabel)}
                  className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-24 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
                />
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  {isFiltered && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label={t(UI.common.clearSearch)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                  <span className="flex items-baseline gap-1 text-xs tabular-nums">
                    <motion.span
                      key={isFiltered ? hitCount : questionCount}
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'font-semibold',
                        isFiltered ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {isFiltered ? hitCount : questionCount}
                    </motion.span>
                    <span className="text-muted-foreground">
                      {isFiltered ? `/ ${questionCount}` : t(UI.questions.unit)}
                    </span>
                  </span>
                </div>
              </div>

              <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">
                  {t(isFiltered ? UI.questions.hintFiltered : UI.questions.hint)}
                </span>
                {openIds.size > 0 && (
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronsDownUp className="size-3.5" />
                    {t(UI.common.collapseAll)}
                  </button>
                )}
              </div>

              <div className="space-y-4 py-6">
                {shown.map((slot) => (
                  <div
                    key={slot.key}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <div className="border-b border-border bg-muted/30 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-sm font-semibold text-foreground">
                            {slot.bulletTitle}
                          </h2>
                          <span className="text-xs text-muted-foreground">{slot.sourceTitle}</span>
                        </div>
                        {slot.rows.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => pickRandom(slot)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                            >
                              <Shuffle className="size-3.5" />
                              {t(UI.questions.random)}
                            </button>
                            <button
                              type="button"
                              onClick={() => expandSlot(slot)}
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <ChevronsUpDown className="size-3.5" />
                              {t(UI.questions.expandGroup)}
                            </button>
                          </div>
                        )}
                      </div>
                      {slot.resume && (
                        <p className="mt-1.5 border-l-2 border-border pl-2.5 text-xs italic leading-relaxed text-muted-foreground">
                          {slot.resume}
                        </p>
                      )}
                    </div>

                    {slot.rows.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                        {t(UI.questions.empty)}
                      </p>
                    ) : (
                      slot.rows.map((row) => (
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

                {isFiltered && hitCount === 0 && (
                  <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                    <SearchX className="size-6" />
                    <p className="text-sm">{t(UI.questions.noMatches)}</p>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
