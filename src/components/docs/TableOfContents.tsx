import { useState, useEffect, useMemo } from 'react';
import { cn, scrollToAnchor } from '@/lib/utils';
import { plainHeadingText, scanHeadings } from '@/lib/headings';

interface TableOfContentsProps {
  content: string;
  className?: string;
}

export function TableOfContents({ content, className }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  // 标题与 id 都由 scanHeadings 算，和 MarkdownRenderer 用的是同一个纯函数——
  // 两边必须逐字一致，否则 getElementById 找不到元素，高亮和跳转都失效。
  const headings = useMemo(
    () =>
      scanHeadings(content)
        .filter((h) => h.level <= 3)
        .map((h) => ({ id: h.id, text: plainHeadingText(h.text), level: h.level })),
    [content]
  );

  // 当前读到哪一节：每次滚动**现查**元素，不缓存节点。
  //
  // 原来用的是 IntersectionObserver：effect 里一次性 observe 28 个标题元素。
  // 问题是正文那棵子树在首屏之后会被整个替换掉，观察器盯着的是一批已经
  // 脱离文档的旧节点（实测 isConnected=false），于是回调永远不触发，
  // 目录从头到尾不高亮。顺带它还有个毛病：判定带只有约 100px 高，
  // 快速滚动一帧跨过去就整节跳过了。
  //
  // 现在改成滚动时按 id 重新取元素、比较位置，重挂载多少次都不受影响。
  useEffect(() => {
    if (headings.length === 0) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      // 略低于固定导航栏：标题滚到这条线以上就算「已经读到」
      const line = 100;
      let current = headings[0].id;

      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top > line) break;
        current = heading.id;
      }

      setActiveId(current);
    };

    // rAF 节流：一帧最多读一次布局，避免滚动时反复触发同步布局
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
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
