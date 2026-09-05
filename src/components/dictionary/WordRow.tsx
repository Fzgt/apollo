import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { glossOf, zhDetailOf, type WordEntry } from '@/content/dictionary';
import { cn } from '@/lib/utils';

/**
 * 一张词卡，默认折叠。
 *
 * 正面只有两行：**英文词 + 一行中文**。中文直接看得到，扫一列卡片就能
 * 判断「这个词我记不记得住」，不用点开、也不用先读一段英文长句。
 *
 * 英文释义、完整中文、例句、变体全部收进折叠区——那是「想弄明白」时才要的东西，
 * 不该在「快速扫一遍」时占掉三行高度。这是 2026-09-06 改的：原来正面挂的是
 * 英文长释义，一屏只放得下六七个词。
 */
export function WordRow({ entry, expanded }: { entry: WordEntry; expanded: boolean }) {
  const [isOpen, setIsOpen] = useState(expanded);

  // 搜索时整列展开：命中可能只在英文释义或例句里，收起来会让人看不出为什么这条被搜到
  useEffect(() => setIsOpen(expanded), [expanded]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card transition-colors',
        isOpen ? 'border-foreground/20' : 'border-border'
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="group flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span
              className={cn(
                'text-sm font-semibold text-foreground transition-colors',
                !isOpen && 'group-hover:text-primary'
              )}
            >
              {entry.term}
            </span>
            {entry.pos && (
              <span className="text-[11px] italic text-muted-foreground">{entry.pos}</span>
            )}
          </span>
          {/* 中文贴在词下面而不是同一行：词长短差得多，同一行会让中文的起点参差不齐 */}
          <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
            {glossOf(entry)}
          </span>
        </span>

        <ChevronDown
          className={cn(
            'mt-[3px] size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
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
            <div className="border-t border-border/60 px-3.5 pb-3.5 pt-3">
              <p className="text-[13px] leading-relaxed text-foreground">{entry.en}</p>

              {/* 冒号前那半截已经在卡片正面了，这里只给解释，不重复念一遍标题 */}
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                {zhDetailOf(entry)}
              </p>

              {entry.example && (
                <p className="mt-3 border-l-2 border-border pl-3 text-[13px] italic leading-relaxed text-muted-foreground">
                  {entry.example}
                </p>
              )}

              {entry.also && entry.also.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
