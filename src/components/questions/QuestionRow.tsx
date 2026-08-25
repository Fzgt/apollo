import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Quote } from 'lucide-react';
import type { Question } from '@/content/questions';
import { splitByIndices } from '@/lib/fuzzy';
import { cn } from '@/lib/utils';

const MarkdownRenderer = lazy(() =>
  import('@/components/docs/MarkdownRenderer').then((m) => ({ default: m.MarkdownRenderer }))
);

interface QuestionRowProps {
  question: Question;
  isOpen: boolean;
  onToggle: () => void;
  /** 搜索命中的字符下标，用于高亮；没搜索时是空数组 */
  hitZh?: number[];
  hitEn?: number[];
}

/** 把命中的字符描出来，其余原样 */
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

export function QuestionRow({ question, isOpen, onToggle, hitZh, hitEn }: QuestionRowProps) {
  const { q, a, phrases, kind, unresolved, asked } = question;

  return (
    <motion.div
      id={`question-${question.id}`}
      layout="position"
      transition={{ layout: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] } }}
      className={cn(
        'group relative border-b border-border last:border-b-0',
        isOpen && 'bg-muted/25'
      )}
    >
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
          'relative flex w-full items-start gap-3 overflow-hidden px-4 py-3 text-left outline-none',
          'transition-[border-color,box-shadow] duration-200',
          'hover:z-10 hover:shadow-[0_8px_24px_-22px_hsl(var(--foreground))]',
          'focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
        )}
      >
        {/* 左侧那条竖线 + 一层向右淡出的底色：高亮跟着指针走，不是死板的整块变灰 */}
        <span
          className={cn(
            'absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary transition-opacity duration-200',
            'group-hover:opacity-100',
            isOpen ? 'opacity-100' : 'opacity-0'
          )}
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.055] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <ChevronRight
          className={cn(
            'relative mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-90 text-primary'
          )}
        />

        <span className="relative min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium',
                kind === 'main'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {kind === 'main' ? '主问' : '追问'}
            </span>
            {unresolved && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                <AlertTriangle className="size-3" />
                待补
              </span>
            )}
            {asked && (
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                {asked}
              </span>
            )}
          </span>

          <span
            className={cn(
              'mt-1 block text-sm font-medium leading-relaxed text-foreground transition-colors',
              !isOpen && 'group-hover:text-primary'
            )}
          >
            <Highlighted text={q.zh} indices={hitZh} />
          </span>

          {q.en && (
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              <Highlighted text={q.en} indices={hitEn} />
            </span>
          )}
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 px-4 pb-5 pl-11 pt-4">
              <Suspense
                fallback={<p className="text-sm text-muted-foreground">渲染中…</p>}
              >
                <MarkdownRenderer content={a.zh} className="max-w-none" />
              </Suspense>

              {a.en && (
                <Suspense fallback={null}>
                  <div className="mt-4 border-t border-dashed border-border pt-4">
                    <MarkdownRenderer content={a.en} className="max-w-none" />
                  </div>
                </Suspense>
              )}

              {phrases && phrases.length > 0 && (
                <div className="mt-4 rounded-lg border border-border bg-card/60 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Quote className="size-3" />
                    可以直接说出口的英文
                  </p>
                  <ul className="space-y-1.5">
                    {phrases.map((phrase) => (
                      <li key={phrase} className="text-sm leading-relaxed text-foreground/90">
                        “{phrase}”
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
