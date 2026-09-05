import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Phrase } from "@/content/phrasebook";
import { cn } from "@/lib/utils";

/**
 * 速查表的一行，默认折叠。
 *
 * 正面严格两行——中文、英文——所以同一行的卡片天生等高，扫的时候视线不用上下跳。
 * 同义词、用法、读音、例句全在折叠区：定住某一条之后它们是全部价值，扫的时候是噪音。
 *
 * 唯一破例是 `avoid`：中式直译说出口的代价比想不起词更大，所以那个 ✗ 必须在卡面上，
 * 挂在英文右边、不占新的一行。
 */
export function PhraseRow({
  phrase,
  expanded,
}: {
  phrase: Phrase;
  expanded: boolean;
}) {
  const [isOpen, setIsOpen] = useState(expanded);
  const hasDetail = Boolean(
    phrase.note || phrase.ex || phrase.say || phrase.alt?.length,
  );

  // 搜索时整列展开：命中可能落在 note 或例句里，收着会让人看不出为什么这条被搜到
  useEffect(() => setIsOpen(expanded), [expanded]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        isOpen && hasDetail ? "border-foreground/20" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => hasDetail && setIsOpen((open) => !open)}
        aria-expanded={hasDetail ? isOpen : undefined}
        className={cn(
          "flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition-colors",
          hasDetail ? "hover:bg-muted/40" : "cursor-default",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs leading-snug text-muted-foreground">
            {phrase.zh}
          </span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13.5px] font-semibold leading-snug text-foreground">
              {phrase.en}
            </span>
            {phrase.avoid && (
              <span className="text-[11px] leading-snug text-rose-400/90">
                ✗ {phrase.avoid}
              </span>
            )}
          </span>
        </span>
        {hasDetail && (
          <ChevronDown
            aria-hidden
            className={cn(
              "mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        )}
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
            <div className="border-t border-border/60 px-3.5 pb-3 pt-2.5">
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
                <p className="mt-2 border-l-2 border-border pl-2.5 text-[12.5px] italic leading-relaxed text-foreground/80">
                  {phrase.ex}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
