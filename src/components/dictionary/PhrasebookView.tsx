import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, SearchX, X } from "lucide-react";
import { PhraseRow } from "./PhraseRow";
import {
  TOPICS,
  haystackOf,
  phrasebook,
  phrasebookCount,
  type Phrase,
  type TopicKey,
} from "@/content/phrasebook";
import { fuzzyMatch } from "@/lib/fuzzy";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { UI } from "@/content/ui";

/**
 * 命中打分。
 *
 * 中文那一头只认子串——「解析」两个字要么在要么不在，模糊匹配到中文上会把
 * 半张表捞回来。英文那头才走模糊：拼错一个字母不该搜不到。
 * note 和例句参与匹配但压到最低分，它们是「找得到」，不是「就是它」。
 */
function scorePhrase(phrase: Phrase, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  if (phrase.zh.toLowerCase().includes(q)) return 300;

  const en = fuzzyMatch(q, phrase.en);
  const alt = phrase.alt?.length ? fuzzyMatch(q, phrase.alt.join(" ")) : null;
  const body = haystackOf(phrase).includes(q) ? 60 : -Infinity;

  return Math.max(en?.score ?? -Infinity, (alt?.score ?? -Infinity) - 20, body);
}

/**
 * 面试速查表：中文在左，该说的英文在右。
 *
 * 跟生词本共用 /words 这一页，但方向是反的，所以没做成同一个列表——
 * 生词本按字母排（读到不认识的词回来查），这里按话题排（面试聊到哪一块，
 * 整块的词一起过一遍）。
 */
export function PhrasebookView() {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<TopicKey | null>(null);

  const trimmed = query.trim();

  const hits = useMemo(() => {
    if (!trimmed) return null;
    return phrasebook
      .map((phrase) => ({ phrase, score: scorePhrase(phrase, trimmed) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.phrase);
  }, [trimmed]);

  const groups = useMemo(
    () =>
      TOPICS.filter(({ key }) => !topic || key === topic).map((entry) => ({
        ...entry,
        items: phrasebook.filter((phrase) => phrase.topic === entry.key),
      })),
    [topic],
  );

  const shownCount = hits
    ? hits.length
    : groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div>
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(UI.phrasebook.searchPlaceholder)}
          aria-label={t(UI.phrasebook.searchPlaceholder)}
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
              key={shownCount}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "font-semibold",
                trimmed || topic ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {shownCount}
            </motion.span>
            <span className="text-muted-foreground">
              {trimmed || topic
                ? `/ ${phrasebookCount}`
                : t(UI.phrasebook.unit)}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {TOPICS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTopic(topic === key ? null : key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              topic === key
                ? "border-primary/50 bg-primary/15 font-medium text-primary"
                : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {hits ? (
        hits.length > 0 ? (
          <div className="grid grid-cols-1 items-start gap-2 py-4 pb-16 sm:grid-cols-2 xl:grid-cols-3">
            {hits.map((phrase) => (
              <PhraseRow
                key={`${phrase.topic}-${phrase.zh}`}
                phrase={phrase}
                expanded
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <SearchX className="size-6" />
            <p className="text-sm">{t(UI.phrasebook.emptyMatch)}</p>
          </div>
        )
      ) : (
        <div className="pb-16">
          {groups.map((group) => (
            <section key={group.key} className="pt-6">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
                {t(group.label)}
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {group.items.length}
                </span>
              </h2>
              <div className="mt-2 grid grid-cols-1 items-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((phrase) => (
                  <PhraseRow
                    key={`${phrase.topic}-${phrase.zh}`}
                    phrase={phrase}
                    expanded={false}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
