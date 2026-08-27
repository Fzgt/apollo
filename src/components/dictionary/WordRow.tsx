import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { WordEntry } from '@/content/dictionary';
import { cn } from '@/lib/utils';

/**
 * 一条词条，默认折叠。
 *
 * 收起时只留「词 + 英文释义」，中文和例句要点开——这不是省地方省出来的，
 * 是 `types.ts` 里那句「先读英文，读不懂再看中文」的执行：中文一伸手就够得着，
 * 但不会在眼睛还没试过英文之前先撞上来。顺带把一屏能看到的词数翻了一倍。
 */
export function WordRow({ entry, expanded }: { entry: WordEntry; expanded: boolean }) {
  const [isOpen, setIsOpen] = useState(expanded);

  // 搜索时整列展开：命中可能只在中文释义或例句里，收起来会让人看不出为什么这条被搜到
  useEffect(() => setIsOpen(expanded), [expanded]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="group flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
      >
        <ChevronRight
          className={cn(
            'mt-[3px] size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-90'
          )}
        />

        {/* 词和释义排在同一段里流下去，不各占一行——一行的高度换回来的是一屏多两三个词 */}
        <span
          className={cn(
            'min-w-0 flex-1 text-sm leading-relaxed',
            !isOpen && 'line-clamp-2'
          )}
        >
          <span
            className={cn(
              'font-semibold text-foreground transition-colors',
              !isOpen && 'group-hover:text-primary'
            )}
          >
            {entry.term}
          </span>
          {entry.pos && (
            <span className="ml-1.5 text-[11px] italic text-muted-foreground">{entry.pos}</span>
          )}
          {/* 分隔用中点不用破折号：好几条释义里本来就有破折号，两种撞在一起读不出层次 */}
          <span className="text-muted-foreground"> · {entry.en}</span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 px-3.5 pb-3.5 pl-[2.1rem] pt-3">
              {entry.also && entry.also.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
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

              <p className="text-sm leading-relaxed text-foreground">{entry.zh}</p>

              {entry.example && (
                <p className="mt-3 border-l-2 border-border pl-3 text-sm italic leading-relaxed text-muted-foreground">
                  {entry.example}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
