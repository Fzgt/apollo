import { useMemo, useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Github, Search, SearchX, Trash2, X } from 'lucide-react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { dictionary, dictionaryCount, dictionaryTags, type WordEntry } from '@/content/dictionary';
import {
  captureWord,
  clearQueue,
  queueAsText,
  queueSnapshot,
  queueServerSnapshot,
  removeWord,
  subscribeQueue,
} from '@/lib/word-queue';
import { DICTIONARY_ISSUE_URL } from '@/content/site';
import { fuzzyMatch } from '@/lib/fuzzy';
import { cn } from '@/lib/utils';

/** 词条命中：词条本身、英文释义、中文释义、例句各算一次，取最高分 */
function scoreEntry(entry: WordEntry, query: string): number {
  const term = fuzzyMatch(query, entry.term);
  const also = entry.also?.length ? fuzzyMatch(query, entry.also.join(' ')) : null;
  const q = query.trim().toLowerCase();
  // 释义和例句只认精确子串：让整段正文参与模糊匹配会把词表全捞回来
  const body = `${entry.en} ${entry.zh} ${entry.example ?? ''}`.toLowerCase().includes(q)
    ? 60
    : -Infinity;

  return Math.max(term?.score ?? -Infinity, (also?.score ?? -Infinity) - 20, body);
}

export default function DictionaryPage() {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const queue = useSyncExternalStore(subscribeQueue, queueSnapshot, queueServerSnapshot);

  const trimmed = query.trim();
  const shown = useMemo(() => {
    const pool = tag ? dictionary.filter((entry) => entry.tags?.includes(tag)) : dictionary;
    if (!trimmed) return pool;
    return pool
      .map((entry) => ({ entry, score: scoreEntry(entry, trimmed) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.entry);
  }, [trimmed, tag]);

  const copyQueue = async () => {
    try {
      await navigator.clipboard.writeText(queueAsText(queue));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板被拒（非 https、没授权）：词还在队列里，手抄也拿得走 */
    }
  };

  const issueHref = `${DICTIONARY_ISSUE_URL}&body=${encodeURIComponent(queueAsText(queue))}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 md:pt-24">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6">
          <header className="py-4 sm:py-6">
            <h1 className="text-2xl font-bold text-foreground">Technical Dictionary</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Words this site made me look up. The rest of Apollo is English only — this page is the
              one place Chinese is allowed, because that is what it is for.
            </p>
          </header>

          {/* 敲词。页面里这一个和全站那个 `w` 小框写进同一条队列 */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              captureWord(draft, '/words');
              setDraft('');
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a word you did not know — or press w anywhere on the site"
              aria-label="Add a word"
              className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-4 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-foreground/30"
            >
              Add
            </button>
          </form>

          {queue.length > 0 && (
            <section className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Waiting for definitions
                  <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                    {queue.length}
                  </span>
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={copyQueue}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? 'Copied' : 'Copy list'}
                  </button>
                  <a
                    href={issueHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                  >
                    <Github className="size-3.5" />
                    Open issue
                  </a>
                  <button
                    type="button"
                    onClick={clearQueue}
                    aria-label="Clear the queue"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                These live in this browser only. Hand the list over and they come back below, in both
                languages.
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {queue.map((word) => (
                  <span
                    key={word.term.toLowerCase()}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-3 pr-1.5 text-xs text-foreground"
                  >
                    {word.term}
                    <button
                      type="button"
                      onClick={() => removeWord(word.term)}
                      aria-label={`Remove ${word.term}`}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}

          <div className="relative mt-8">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the dictionary"
              aria-label="Search the dictionary"
              className="h-11 w-full rounded-xl border border-border bg-card pl-11 pr-24 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {trimmed && (
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
                  key={shown.length}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'font-semibold',
                    trimmed || tag ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {shown.length}
                </motion.span>
                <span className="text-muted-foreground">
                  {trimmed || tag ? `/ ${dictionaryCount}` : 'words'}
                </span>
              </span>
            </div>
          </div>

          {dictionaryTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dictionaryTags.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTag(tag === name ? null : name)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    tag === name
                      ? 'border-primary/50 bg-primary/15 font-medium text-primary'
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3 py-6 pb-16">
            {shown.map((entry) => (
              <article
                key={entry.term}
                className="rounded-xl border border-border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h2 className="text-base font-semibold text-foreground">{entry.term}</h2>
                  {entry.pos && (
                    <span className="text-xs italic text-muted-foreground">{entry.pos}</span>
                  )}
                  {entry.also?.map((word) => (
                    <span
                      key={word}
                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {word}
                    </span>
                  ))}
                </div>

                <p className="mt-2 text-sm leading-relaxed text-foreground">{entry.en}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{entry.zh}</p>

                {entry.example && (
                  <p className="mt-3 border-l-2 border-border pl-3 text-sm italic leading-relaxed text-muted-foreground">
                    {entry.example}
                  </p>
                )}
              </article>
            ))}

            {shown.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <SearchX className="size-6" />
                <p className="text-sm">
                  {dictionaryCount === 0
                    ? 'No words yet — press w while reading to start'
                    : 'Nothing matches that'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
