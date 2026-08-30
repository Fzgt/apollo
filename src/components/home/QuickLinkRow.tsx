import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import type { QuickLink } from '@/content/links';
import { cn } from '@/lib/utils';
import { useLang } from '@/lib/i18n';
import { UI } from '@/content/ui';

/**
 * 整行就是复制按钮——常用链接的唯一用途是进剪贴板，不该先让人瞄准一个小图标。
 * 右侧那个箭头才是「打开」，两件事分开。
 */
export function QuickLinkRow({ link }: { link: QuickLink }) {
  const [copied, setCopied] = useState(false);
  const valueRef = useRef<HTMLSpanElement>(null);
  const { t } = useLang();
  const label = t(link.label);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      setCopied(true);
    } catch {
      // 剪贴板被拒（非安全上下文/没授权）：把原文选中让人手动复制，别假装成功
      const node = valueRef.current;
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  return (
    <div className="group relative flex items-center border-b border-border last:border-b-0">
      <motion.button
        type="button"
        onClick={copy}
        whileHover={{ x: 3 }}
        whileTap={{ scale: 0.995 }}
        transition={{ x: { type: 'spring', stiffness: 420, damping: 34 }, scale: { duration: 0.12 } }}
        aria-label={copied ? t(UI.links.copied) : t(UI.links.copy(label))}
        className={cn(
          'relative flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden py-2 pl-4 pr-1.5 text-left outline-none',
          'transition-[box-shadow] duration-200 hover:z-10 hover:shadow-[0_8px_24px_-22px_hsl(var(--foreground))]',
          'focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
        )}
      >
        {/* 左侧竖线 + 向右淡出的底色：和题库、投递一套手法 */}
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.055] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <span className="relative w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
        <span
          ref={valueRef}
          className="relative min-w-0 flex-1 truncate font-mono text-[11px] leading-6 text-foreground transition-colors group-hover:text-primary"
        >
          {link.value}
        </span>
        <span
          className={cn(
            'relative shrink-0 transition-colors',
            copied ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </span>
      </motion.button>

      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} →`}
        className="relative mr-2 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowUpRight className="size-3.5" />
      </a>
    </div>
  );
}
