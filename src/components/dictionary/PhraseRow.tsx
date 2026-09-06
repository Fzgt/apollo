import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Phrase } from "@/content/phrasebook";
import { cn } from "@/lib/utils";

/**
 * 速查表的一行:中文在左，该说的英文在右，两列对齐。
 *
 * 和生词本用同一套行式布局（见 WordRow 里的说明）。唯一破例是 `avoid`：
 * 中式直译说出口的代价比想不起词更大，所以那个 ✗ 必须留在行面上。
 */
export function PhraseRow({
  phrase,
  isOpen,
  onToggle,
}: {
  phrase: Phrase;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasDetail = Boolean(
    phrase.note || phrase.ex || phrase.say || phrase.alt?.length,
  );

  return (
    <div className={cn("transition-colors", isOpen && hasDetail && "bg-muted/30")}>
      <button
        type="button"
        onClick={() => hasDetail && onToggle()}
        aria-expanded={hasDetail ? isOpen : undefined}
        className={cn(
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5 text-left transition-colors sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]",
          hasDetail ? "hover:bg-muted/40" : "cursor-default",
        )}
      >
        <span className="col-start-1 row-start-1 text-[13px] leading-snug text-muted-foreground">
          {phrase.zh}
        </span>

        <span className="col-start-1 row-start-2 flex flex-wrap items-baseline gap-x-2 sm:col-start-2 sm:row-start-1">
          <span className="text-[13.5px] font-semibold leading-snug text-foreground">
            {phrase.en}
          </span>
          {phrase.avoid && (
            <span className="text-[11px] leading-snug text-rose-400/90">
              ✗ {phrase.avoid}
            </span>
          )}
        </span>

        <ChevronDown
          aria-hidden
          className={cn(
            "col-start-2 row-start-1 size-3.5 shrink-0 self-center transition-transform sm:col-start-3",
            hasDetail ? "text-muted-foreground/40" : "opacity-0",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && hasDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0.5">
              <div className="max-w-3xl border-l-2 border-primary/30 pl-3.5">
                {phrase.alt && phrase.alt.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {phrase.alt.map((word) => (
                      <span
                        key={word}
                        className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {word}
                      </span>
                    ))}
                  </span>
                )}
                {phrase.say && (
                  <p
                    className={cn(
                      "text-[12px] leading-relaxed text-primary/90",
                      phrase.alt?.length && "mt-2",
                    )}
                  >
                    读音：{phrase.say}
                  </p>
                )}
                {phrase.note && (
                  <p
                    className={cn(
                      "text-[12.5px] leading-relaxed text-muted-foreground",
                      (phrase.say || phrase.alt?.length) && "mt-1.5",
                    )}
                  >
                    {phrase.note}
                  </p>
                )}
                {phrase.ex && (
                  <p className="mt-2 text-[12.5px] italic leading-relaxed text-foreground/80">
                    {phrase.ex}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
