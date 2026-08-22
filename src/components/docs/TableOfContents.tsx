import { useState, useEffect, useMemo } from 'react';
import { cn, scrollToAnchor, slugify } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  className?: string;
}

export function TableOfContents({ content, className }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  // Extract headings from markdown content
  const headings = useMemo(() => {
    const items: TocItem[] = [];
    // 和 MarkdownRenderer 保持同一套去重规则：同名标题按出现次数补后缀。
    // 两处必须扫到完全一样的标题集合，否则计数错位、id 就对不上：
    //   1. 渲染端 1–4 级都参与计数，所以这里也扫到 4 级，只是目录只收前三级；
    //   2. 围栏代码块里以 # 开头的行（shell 注释、Dockerfile 注释）不是标题，
    //      markdown 解析器不会把它们当标题，正则会——所以要跳过围栏内部。
    const slugSeen = new Map<string, number>();
    let inFence = false;

    for (const line of content.split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const match = /^(#{1,4})\s+(.+)$/.exec(line);
      if (!match) continue;

      const level = match[1].length;
      const raw = match[2].trim();
      // id 用原文算（slugify 本来就会把 ` 和 * 去掉），显示用剥掉行内标记的版本，
      // 否则目录里会出现 `video: true` 这样带反引号和星号的条目。
      const text = raw.replace(/`([^`]*)`/g, '$1').replace(/\*\*?([^*]*)\*?\*/g, '$1');
      const base = slugify(raw);
      const n = (slugSeen.get(base) ?? 0) + 1;
      slugSeen.set(base, n);

      if (level <= 3) {
        items.push({ id: n === 1 ? base : `${base}-${n}`, text, level });
      }
    }

    return items;
  }, [content]);

  // Track scroll position to highlight active heading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0,
      }
    );

    // Observe all headings
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleClick = (id: string) => scrollToAnchor(id);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={cn('text-sm', className)}>
      <h4 className="mb-4 font-semibold text-foreground">{'本页目录'}</h4>
      {/* 长文的目录会比视口还高。不给它自己的滚动条的话，sticky 容器整个被撑出
          屏幕，后半截永远够不着——那正是「目录坏了」的样子。 */}
      <ul className="max-h-[calc(100vh-13rem)] space-y-2 overflow-y-auto overscroll-contain pr-2">
        {headings.map((heading) => (
          <li
            key={heading.id}
            style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
          >
            <button
              onClick={() => handleClick(heading.id)}
              className={cn(
                'text-left w-full py-1 transition-colors duration-200 hover:text-foreground',
                activeId === heading.id
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
