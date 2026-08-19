import { motion } from 'framer-motion';
import { ArrowRight, Check, Clock, ExternalLink } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import type { BlogPostMeta } from '@/lib/blog';

const MAX_SHOWN_LABELS = 2;

interface PostRowProps {
  post: BlogPostMeta;
  index: number;
  /** 只有首屏那几条做入场动画，翻页筛选时不该再抖一遍 */
  animateEntrance: boolean;
  isRead: boolean;
  onOpen: (number: number) => void;
  onToggleRead: (number: number) => void;
}

export function PostRow({
  post,
  index,
  animateEntrance,
  isRead,
  onOpen,
  onToggleRead,
}: PostRowProps) {
  const shownLabels = post.labels.slice(0, MAX_SHOWN_LABELS);
  const extraLabels = post.labels.length - shownLabels.length;
  const accent = post.labels[0]?.color;

  return (
    <motion.article
      layout="position"
      role="link"
      tabIndex={0}
      aria-label={`阅读 ${post.title}`}
      onClick={() => onOpen(post.number)}
      onKeyDown={(event) => {
        if (event.currentTarget === event.target && event.key === 'Enter') onOpen(post.number);
      }}
      initial={animateEntrance ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.995 }}
      transition={{
        opacity: { duration: 0.22, delay: animateEntrance ? index * 0.025 : 0 },
        y: { duration: 0.22, delay: animateEntrance ? index * 0.025 : 0 },
        x: { type: 'spring', stiffness: 420, damping: 34 },
        scale: { duration: 0.12 },
        layout: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      className={cn(
        'group relative flex min-h-16 cursor-pointer items-center gap-3 overflow-hidden border-b border-border px-3 py-2.5 outline-none last:border-b-0',
        'transition-[border-color,background-color,box-shadow,opacity] duration-200',
        'hover:z-10 hover:border-primary/25 hover:shadow-[0_8px_24px_-22px_hsl(var(--foreground))]',
        'focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
      )}
    >
      {/* 左侧竖条：默认藏着，悬停冒出来；读过的常亮 */}
      <span
        className={cn(
          'absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary opacity-0 transition-opacity duration-200',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          isRead && 'bg-success opacity-100'
        )}
        style={!isRead && accent ? { backgroundColor: `#${accent}` } : undefined}
      />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.055] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />

      <div
        className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold tabular-nums text-muted-foreground"
        style={accent ? { backgroundColor: `#${accent}38` } : undefined}
        title={`issue #${post.number}`}
      >
        {post.number}
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary',
              isRead && 'text-muted-foreground'
            )}
          >
            {post.title}
          </span>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
        </div>

        <div className="mt-0.5 flex min-w-0 items-center overflow-hidden text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{post.excerpt}</span>
          {shownLabels.length > 0 && (
            <div className="ml-2 hidden shrink-0 items-center gap-1.5 border-l border-border pl-2 md:flex">
              {shownLabels.map((label) => (
                <span
                  key={label.name}
                  className="inline-flex max-w-24 items-center gap-1 truncate rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  title={label.name}
                >
                  {label.color && (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `#${label.color}` }}
                    />
                  )}
                  {label.name}
                </span>
              ))}
              {extraLabels > 0 && (
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  +{extraLabels}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <span
        className="relative z-10 hidden w-20 shrink-0 items-center justify-end gap-1 text-[11px] text-muted-foreground sm:inline-flex"
        title={`写于 ${post.createdAt.slice(0, 10)}`}
      >
        <Clock className="size-3" />
        {timeAgo(post.createdAt)}
      </span>

      {/* 平时显示读没读，悬停换成操作 —— 小屏没有悬停，直接把按钮亮着 */}
      <div className="relative z-10 h-8 w-[4.5rem] shrink-0 sm:w-[8.5rem]">
        <span
          className={cn(
            'absolute inset-y-0 right-0 hidden items-center rounded-md px-2 text-[11px] font-medium transition-opacity duration-150 sm:inline-flex',
            'group-hover:pointer-events-none group-hover:opacity-0 group-focus-within:pointer-events-none group-focus-within:opacity-0',
            isRead
              ? 'bg-success/15 text-success'
              : 'text-muted-foreground'
          )}
        >
          {isRead ? '已读' : '未读'}
        </span>

        <div className="absolute inset-y-0 right-0 flex items-center gap-1 sm:pointer-events-none sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100">
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={(event) => {
              event.stopPropagation();
              onToggleRead(post.number);
            }}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs transition-colors',
              isRead
                ? 'bg-success/15 text-success'
                : 'hover:bg-muted'
            )}
            title={isRead ? '标记为未读' : '标记为已读'}
          >
            <Check className="size-3.5" />
            <span className="hidden xl:inline">{isRead ? '已读' : '标记已读'}</span>
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={(event) => {
              event.stopPropagation();
              window.open(post.url, '_blank', 'noopener,noreferrer');
            }}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="在 GitHub 上看原文"
            aria-label="在 GitHub 上看原文"
          >
            <ExternalLink className="size-3.5" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
