import { slugify } from '@/lib/utils';

export interface HeadingEntry {
  /** 在原文里的行号，1 起。渲染端拿 AST 的行号来查这张表 */
  line: number;
  level: number;
  text: string;
  id: string;
}

/**
 * 从 markdown 原文算出每个标题的锚点 id。
 *
 * 这里必须是**纯函数**：目录和正文两边都调它，算出来的 id 要一模一样，
 * 否则目录点不动、也高亮不了当前章节。
 *
 * 之前的写法是在渲染过程中递增一个计数器来给重名标题编号，那是错的——
 * React 严格模式（以及并发渲染下任何一次重放）会把同一棵子树渲染两遍，
 * 计数器就被数了两次，正文里的 id 全部变成 `xxx-2`，而目录算的是 `xxx`，
 * 两边永远对不上。改成「按行号查一张预先算好的表」之后，渲染多少次都一样。
 */
export function scanHeadings(markdown: string): HeadingEntry[] {
  const entries: HeadingEntry[] = [];
  const seen = new Map<string, number>();
  let inFence = false;

  markdown.split('\n').forEach((rawLine, index) => {
    // 围栏代码块里以 # 开头的行是注释不是标题，markdown 解析器不会当标题，正则会
    if (/^\s*(```|~~~)/.test(rawLine)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const match = /^(#{1,4})\s+(.+)$/.exec(rawLine);
    if (!match) return;

    const text = match[2].trim();
    const base = slugify(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);

    entries.push({
      line: index + 1,
      level: match[1].length,
      text,
      id: n === 1 ? base : `${base}-${n}`,
    });
  });

  return entries;
}

/** 行号 → id。正文渲染时按 AST 给的行号直接查，不再自己数 */
export function headingIdByLine(markdown: string): Map<number, string> {
  return new Map(scanHeadings(markdown).map((h) => [h.line, h.id]));
}

/** 目录条目显示用的文本：把行内 markdown 标记剥掉 */
export function plainHeadingText(text: string): string {
  return text.replace(/`([^`]*)`/g, '$1').replace(/\*\*?([^*]*)\*?\*/g, '$1');
}
