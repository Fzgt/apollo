import { useEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** 高度跟着内容长，答案写多长都不用滚动条 */
export function AutoTextarea({ className, value, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={cn(
        'w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[0.95rem] leading-7',
        'text-foreground placeholder:text-muted-foreground/50',
        'hover:border-border/70 focus:border-primary/60 focus:bg-background focus:outline-none',
        'transition-colors',
        className
      )}
      {...props}
    />
  );
}
