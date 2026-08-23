/**
 * 题库的模糊匹配。中英混排的题目用普通 `includes` 搜不动：
 * 记得住「催款 幂等」这两个词，记不住它们中间隔了什么。
 *
 * 规则：needle 的字符按顺序在 haystack 里出现即算命中（子序列），
 * 连续命中和词首命中加分，跨度越大分越低。整段子串命中给一笔大额加分，
 * 保证「精确输入」永远排在「碎片命中」前面。
 */

export interface FuzzyHit {
  score: number;
  /** 命中的字符下标，用于高亮 */
  indices: number[];
}

// 子序列匹配对拉丁字母太宽松："race" 能在两百字的段落里挨个找到 r/a/c/e。
// 所以命中必须挤在一起——跨度超过这个上限就不算命中。
const spanLimit = (needleLength: number) => needleLength * 3 + 10;

const CONSECUTIVE_BONUS = 8;
const BOUNDARY_BONUS = 6;
const GAP_PENALTY = 1;
const EXACT_BONUS = 200;

/** 词首：开头、空白之后、或者中英/中数交界处 */
function isBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1];
  return /[\s\-_/·、，。（）()[\]]/.test(prev);
}

export function fuzzyMatch(needle: string, haystack: string): FuzzyHit | null {
  const q = needle.trim().toLowerCase();
  if (!q) return { score: 0, indices: [] };

  const text = haystack.toLowerCase();

  const exact = text.indexOf(q);
  if (exact !== -1) {
    const indices = Array.from({ length: q.length }, (_, i) => exact + i);
    return {
      score: EXACT_BONUS + (isBoundary(text, exact) ? BOUNDARY_BONUS : 0) - exact * 0.05,
      indices,
    };
  }

  const indices: number[] = [];
  let score = 0;
  let cursor = 0;
  let lastHit = -1;
  let firstHit = -1;

  for (const ch of q) {
    // 空格只当分隔符，不参与匹配
    if (ch === ' ') continue;

    const found = text.indexOf(ch, cursor);
    if (found === -1) return null;

    if (found === lastHit + 1) score += CONSECUTIVE_BONUS;
    if (isBoundary(text, found)) score += BOUNDARY_BONUS;
    if (lastHit !== -1) score -= Math.min(found - lastHit - 1, 12) * GAP_PENALTY;

    if (firstHit === -1) firstHit = found;
    indices.push(found);
    lastHit = found;
    cursor = found + 1;
  }

  if (indices.length === 0) return null;
  if (lastHit - firstHit > spanLimit(indices.length)) return null;
  if (score <= 0) return null;

  return { score, indices };
}

/** 把命中下标切成 [文本, 是否高亮] 的片段，交给渲染层 */
export function splitByIndices(text: string, indices: number[]): Array<[string, boolean]> {
  if (indices.length === 0) return [[text, false]];

  const flags = new Set(indices);
  const parts: Array<[string, boolean]> = [];
  let buffer = '';
  let bufferHit = flags.has(0);

  for (let i = 0; i < text.length; i += 1) {
    const hit = flags.has(i);
    if (hit !== bufferHit) {
      if (buffer) parts.push([buffer, bufferHit]);
      buffer = '';
      bufferHit = hit;
    }
    buffer += text[i];
  }
  if (buffer) parts.push([buffer, bufferHit]);

  return parts;
}
