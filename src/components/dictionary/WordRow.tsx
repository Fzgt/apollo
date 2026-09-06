import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { glossOf, zhDetailOf, type WordEntry } from "@/content/dictionary";
import { cn } from "@/lib/utils";

/**
 * 词表里的一行。
 *
 * 原来是一张独立的卡，三列网格铺开——问题是展开时那一整行网格被撑高，旁边两张卡
 * 跟着往下跳，而且释义被塞进三分之一的宽度里，一句话断成五行。
 *
 * 改成单列列表：词、词性、中文对齐成固定的两列，扫的时候视线走一条直线；
 * 展开的正文占满整行宽度，只把下面的行往下推，不再横向影响任何东西。
 */
export function WordRow({
  entry,
  isOpen,
  onToggle,
}: {
  entry: WordEntry;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn("transition-colors", isOpen && "bg-muted/30")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]"
      >
        <span className="col-start-1 row-start-1 flex flex-wrap items-baseline gap-x-1.5">
          <span
            className={cn(
              "text-sm font-semibold text-foreground transition-colors",
              !isOpen && "group-hover:text-primary",
            )}
          >
            {entry.term}
          </span>
          {entry.pos && (
            <span className="text-[11px] italic text-muted-foreground/80">
              {entry.pos}
            </span>
          )}
        </span>

        {/* 中文单独成一列：词长短差得多，让它从同一个 x 开始才扫得快 */}
        <span className="col-start-1 row-start-2 text-[13px] leading-snug text-muted-foreground sm:col-start-2 sm:row-start-1">
          {glossOf(entry)}
        </span>

        <ChevronDown
          aria-hidden
          className={cn(
            "col-start-2 row-start-1 size-3.5 shrink-0 self-center text-muted-foreground/40 transition-transform duration-200 sm:col-start-3",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0.5">
              <div className="max-w-3xl border-l-2 border-primary/30 pl-3.5">
                <p className="text-[13px] leading-relaxed text-foreground">
                  {entry.en}
                </p>

                {/* 冒号前那半截已经在行首了，这里只给解释，不重复念一遍标题 */}
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {zhDetailOf(entry)}
                </p>

                {entry.example && (
                  <p className="mt-2.5 text-[13px] italic leading-relaxed text-muted-foreground/90">
                    {entry.example}
                  </p>
                )}

                {entry.also && entry.also.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {entry.also.map((word) => (
                      <span
                        key={word}
                        className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
