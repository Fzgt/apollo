import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, Copy } from 'lucide-react';
import type { ApplicationAnswer } from '@/content/applications';
import { splitByIndices } from '@/lib/fuzzy';
import { cn } from '@/lib/utils';
import { useLang } from '@/lib/i18n';
import { UI } from '@/content/ui';

interface ApplicationRowProps {
  answer: ApplicationAnswer;
  /** 库里的固定题号，跟他口头说「第几题」用的是同一个数 */
  number: number;
  isOpen: boolean;
  onToggle: () => void;
  /** 搜索命中的字符下标，用于高亮 */
  hits?: number[];
}

function Highlighted({ text, indices }: { text: string; indices?: number[] }) {
  if (!indices || indices.length === 0) return <>{text}</>;
  return (
    <>
      {splitByIndices(text, indices).map(([chunk, hit], i) =>
        hit ? (
          <mark key={i} className="rounded-sm bg-primary/25 px-0.5 text-foreground">
            {chunk}
          </mark>
        ) : (
          <span key={i}>{chunk}</span>
        )
      )}
    </>
  );
}

/**
 * 一条投递答案。
 *
 * 行做得比题库矮：网申时是「搜到 → 复制 → 换下一题」，
 * 一屏能扫过的条数比每条的信息量重要，所以题干只占一行、多了截断。
 * 复制按钮不必展开就能按——展开是为了核对，不是复制的前提。
 */
export function ApplicationRow({ answer, number, isOpen, onToggle, hits }: ApplicationRowProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useLang();

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer.a);
      setCopied(true);
    } catch {
      // 剪贴板被拒（非安全上下文/没授权）：展开让人手动选，别假装成功
      if (!isOpen) onToggle();
    }
  };

  return (
    <motion.div
      layout="position"
      transition={{ layout: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] } }}
      className={cn(
        'group relative border-b border-border last:border-b-0',
        isOpen && 'bg-muted/25'
      )}
    >
      <div className="relative flex items-center">
        <motion.button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.995 }}
          transition={{
            x: { type: 'spring', stiffness: 420, damping: 34 },
            scale: { duration: 0.12 },
          }}
          className={cn(
            'relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-2 pl-3 pr-2 text-left outline-none',
            'transition-[border-color,box-shadow] duration-200',
            'hover:z-10 hover:shadow-[0_8px_24px_-22px_hsl(var(--foreground))]',
            'focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
          )}
        >
          {/* 左侧竖线 + 向右淡出的底色：高亮跟着指针走，和题库一套手法 */}
          <span
            className={cn(
              'absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity duration-200',
              'group-hover:opacity-100',
              isOpen ? 'opacity-100' : 'opacity-0'
            )}
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.055] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <span className="relative w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground/60">
            {number}
          </span>

          <ChevronRight
            className={cn(
              'relative size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-90 text-primary'
            )}
          />

          <span
            className={cn(
              'relative min-w-0 flex-1 truncate text-sm leading-6 text-foreground transition-colors',
              !isOpen && 'group-hover:text-primary'
            )}
          >
            <Highlighted text={answer.q} indices={hits} />
          </span>

          {answer.used && (
            <span className="relative hidden shrink-0 text-[11px] tabular-nums text-muted-foreground/70 sm:block">
              {answer.used}
            </span>
          )}
        </motion.button>

        <button
          type="button"
          onClick={copy}
          aria-label={t(copied ? UI.links.copied : UI.applications.copyAnswer)}
          className={cn(
            'relative z-10 mr-2 shrink-0 rounded-md p-1.5 transition-colors',
            copied
              ? 'text-primary'
              : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground'
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 px-4 pb-4 pl-10 pt-3">
              {answer.note && (
                <p className="mb-3 border-l-2 border-border pl-2.5 text-xs leading-relaxed text-muted-foreground">
                  {answer.note}
                </p>
              )}
              {/*
                答案是纯文本，不过 markdown。粘出去是什么样，这里就得是什么样——
                渲染器一插手，星号和换行就跟剪贴板里的对不上了。
              */}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {answer.a}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
