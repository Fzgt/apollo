import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REPO_URL } from '@/content/site';

const BUILD_DATE = new Date(__BUILD_TIME__);

/** 「08-27 15:42」——同年不写年份，年份换了才写全 */
function formatStamp(date: Date) {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('zh-CN', {
    year: sameYear ? undefined : 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** 「3 分钟前」——判断新旧靠这个比绝对时间快 */
function formatRelative(date: Date) {
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return rtf.format(Math.round(minutes / 60), 'hour');
  return rtf.format(Math.round(minutes / (60 * 24)), 'day');
}

/**
 * 右上角的「更新于」。显示的是**这份产物被构建出来的时间**，不是浏览器当前时间——
 * 所以刷新页面时它若没变，说明看到的还是同一份缓存/同一次部署。
 * 时间戳在构建时钉进 bundle（vite.config.ts 的 define），时区换算交给浏览器。
 */
export function BuildStamp({ className }: { className?: string }) {
  // 相对时间会随页面开着变旧，每分钟自己走一格
  const [relative, setRelative] = useState(() => formatRelative(BUILD_DATE));
  useEffect(() => {
    const timer = setInterval(() => setRelative(formatRelative(BUILD_DATE)), 60_000);
    return () => clearInterval(timer);
  }, []);

  const absolute = formatStamp(BUILD_DATE);
  const title = [
    `Built ${absolute} (${relative})`,
    __COMMIT_SHA__ ? `commit ${__COMMIT_SHA__}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const content = (
    <>
      <History className="size-3.5 shrink-0" />
      <span className="whitespace-nowrap tabular-nums">Updated {absolute}</span>
    </>
  );

  const classes = cn(
    'flex items-center gap-1.5 text-xs text-muted-foreground transition-colors',
    className
  );

  // 有 hash 就顺手连到那次提交，省得回仓库翻
  if (__COMMIT_SHA__) {
    return (
      <a
        href={`${REPO_URL}/commit/${__COMMIT_SHA__}`}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        className={cn(classes, 'hover:text-foreground')}
      >
        {content}
      </a>
    );
  }

  return (
    <span title={title} className={classes}>
      {content}
    </span>
  );
}
