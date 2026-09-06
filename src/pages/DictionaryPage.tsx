import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Copy, Search, SearchX, Trash2, X } from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WordRow } from "@/components/dictionary/WordRow";
import { PhrasebookView } from "@/components/dictionary/PhrasebookView";
import { SideNav } from "@/components/dictionary/SideNav";
import {
  dictionary,
  dictionaryCount,
  dictionaryTags,
  isDefined,
  type WordEntry,
} from "@/content/dictionary";
import { TOPICS, phrasebookCount, phrasesOf, type TopicKey } from "@/content/phrasebook";
import {
  clearQueue,
  pruneDefined,
  queueAsText,
  queueSnapshot,
  queueServerSnapshot,
  removeWord,
  subscribeQueue,
} from "@/lib/word-queue";
import { fuzzyMatch } from "@/lib/fuzzy";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { UI } from "@/content/ui";

/** 词条命中：词条本身、英文释义、中文释义、例句各算一次，取最高分 */
function scoreEntry(entry: WordEntry, query: string): number {
  const term = fuzzyMatch(query, entry.term);
  const also = entry.also?.length
    ? fuzzyMatch(query, entry.also.join(" "))
    : null;
  const q = query.trim().toLowerCase();
  // 释义和例句只认精确子串：让整段正文参与模糊匹配会把词表全捞回来
  const body = `${entry.en} ${entry.zh} ${entry.example ?? ""}`
    .toLowerCase()
    .includes(q)
    ? 60
    : -Infinity;

  return Math.max(
    term?.score ?? -Infinity,
    (also?.score ?? -Infinity) - 20,
    body,
  );
}

export default function DictionaryPage() {
  const { t } = useLang();
  /*
   * 两份词表共用这一页，页签存在 URL 里而不是 state：速查表是面试当天要直接
   * 打开的东西，`?tab=phrases` 能收藏、能贴给自己，刷新也不会跳回生词本。
   */
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "phrases" ? "phrases" : "words";
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [topic, setTopic] = useState<TopicKey | null>(null);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const queue = useSyncExternalStore(
    subscribeQueue,
    queueSnapshot,
    queueServerSnapshot,
  );

  // 队列里那些已经补进词表的词,打开这一页时顺手摘掉——否则会一直挂在「等着补释义」
  useEffect(() => {
    pruneDefined(isDefined);
  }, []);

  const trimmed = query.trim();
  const shown = useMemo(() => {
    const pool = tag
      ? dictionary.filter((entry) => entry.tags?.includes(tag))
      : dictionary;
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

  /** 侧栏的分类计数 */
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of dictionary) {
      for (const name of entry.tags ?? []) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return counts;
  }, []);

  const ALL = "__all";

  const sections = [
    {
      title: t(UI.dictionary.collections),
      activeKey: tab,
      onSelect: (key: string) =>
        setParams(key === "phrases" ? { tab: "phrases" } : {}),
      items: [
        {
          key: "words",
          label: t(UI.dictionary.tabWords),
          count: dictionaryCount,
        },
        {
          key: "phrases",
          label: t(UI.dictionary.tabPhrases),
          count: phrasebookCount,
        },
      ],
    },
    tab === "words"
      ? {
          title: t(UI.dictionary.tags),
          activeKey: tag ?? ALL,
          onSelect: (key: string) => setTag(key === ALL ? null : key),
          items: [
            { key: ALL, label: t(UI.dictionary.all), count: dictionaryCount },
            ...dictionaryTags.map((name) => ({
              key: name,
              label: name,
              count: tagCounts.get(name) ?? 0,
            })),
          ],
        }
      : {
          title: t(UI.dictionary.topics),
          activeKey: topic ?? ALL,
          onSelect: (key: string) =>
            setTopic(key === ALL ? null : (key as TopicKey)),
          items: [
            { key: ALL, label: t(UI.dictionary.all), count: phrasebookCount },
            ...TOPICS.map(({ key, label }) => ({
              key,
              label: t(label),
              count: phrasesOf(key).length,
            })),
          ],
        },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20 md:pt-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <header className="border-b border-border py-4">
            <h1 className="text-2xl font-bold text-foreground">
              {t(UI.dictionary.title)}
            </h1>
            {tab === "words" ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t(UI.dictionary.introA)}{" "}
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[11px]">
                  w
                </kbd>{" "}
                {t(UI.dictionary.introB)}
              </p>
            ) : (
              <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
                {t(UI.phrasebook.intro)}
              </p>
            )}
          </header>

          <div className="flex gap-8 py-6 pb-16">
            {/* 左侧：上半截切词库，下半截筛分类 */}
            <aside className="hidden w-52 shrink-0 lg:block">
              <SideNav sections={sections} />
            </aside>

            <div className="min-w-0 flex-1">
              {/* 窄屏没有侧栏：词库回落成页签，分类回落成一行可横向滚动的胶囊 */}
              <div className="mb-4 space-y-2 lg:hidden">
                <div className="flex w-full gap-1 rounded-xl border border-border bg-muted/40 p-1">
                  {sections[0].items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => sections[0].onSelect(item.key)}
                      aria-current={tab === item.key ? "true" : undefined}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                        tab === item.key
                          ? "bg-card font-medium text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.label}
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
                  {sections[1].items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => sections[1].onSelect(item.key)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                        sections[1].activeKey === item.key
                          ? "border-primary/50 bg-primary/15 font-medium text-primary"
                          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "phrases" && <PhrasebookView topic={topic} />}

              {tab === "words" && (
                <>
                  {queue.length > 0 && (
                    <section className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-foreground">
                          {t(UI.dictionary.queueTitle)}
                          <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
                            {queue.length}
                          </span>
                        </h2>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={copyQueue}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                          >
                            {copied ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                            {t(copied ? UI.links.copied : UI.dictionary.copyList)}
                          </button>
                          <button
                            type="button"
                            onClick={clearQueue}
                            aria-label={t(UI.dictionary.clearQueue)}
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(UI.dictionary.queueBody)}
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
                              aria-label={t(UI.dictionary.remove(word.term))}
                              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t(UI.dictionary.searchPlaceholder)}
                      aria-label={t(UI.dictionary.searchPlaceholder)}
                      className="h-11 w-full rounded-xl border border-border bg-card pl-11 pr-24 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
                    />
                    <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      {trimmed && (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          aria-label={t(UI.common.clearSearch)}
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
                            "font-semibold",
                            trimmed || tag
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {shown.length}
                        </motion.span>
                        <span className="text-muted-foreground">
                          {trimmed || tag
                            ? `/ ${dictionaryCount}`
                            : t(UI.dictionary.unit)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {shown.length > 0 ? (
                    <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                      {shown.map((entry) => (
                        <WordRow
                          key={entry.term}
                          entry={entry}
                          isOpen={openTerm === entry.term}
                          onToggle={() =>
                            setOpenTerm((prev) =>
                              prev === entry.term ? null : entry.term,
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                      <SearchX className="size-6" />
                      <p className="text-sm">
                        {t(
                          dictionaryCount === 0
                            ? UI.dictionary.emptyDictionary
                            : UI.dictionary.emptyMatch,
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
