import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Phrase } from "@/content/phrasebook";
import { cn } from "@/lib/utils";

/**
 * 速查表的一行，默认折叠。
 *
 * 正面是「中文 → 英文」两行，因为查的动作永远是这个方向：想不起 resolve 的时候，
 * 脑子里只有「解析」。用法差别、读音、例句收进折叠区——扫的时候它们是噪音，
 * 定住某一条之后它们才是全部价值。
 */
export function PhraseRow({
  phrase,
  expanded,
}: {
  phrase: Phrase;
  expanded: boolean;
}) {
  const [isOpen, setIsOpen] = useState(expanded);
  const hasDetail = Boolean(phrase.note || phrase.ex || phrase.say);

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
          "flex w-full flex-col items-start gap-1 px-3.5 py-2.5 text-left transition-colors",
          hasDetail ? "hover:bg-muted/40" : "cursor-default",
        )}
      >
        <span className="text-xs leading-snug text-muted-foreground">
          {phrase.zh}
        </span>
        <span className="text-[13.5px] font-semibold leading-snug text-foreground">
          {phrase.en}
        </span>
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
              {phrase.say && (
                <p className="text-[12px] leading-relaxed text-primary/90">
                  读音：{phrase.say}
                </p>
              )}
              {phrase.note && (
                <p
                  className={cn(
                    "text-[12.5px] leading-relaxed text-muted-foreground",
                    phrase.say && "mt-1.5",
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
