/**
 * Technical Dictionary（/words）的内容层。
 *
 * 词条见 `./entries`；本地那条「还没释义的生词队列」不在这里，
 * 它是浏览器状态，住在 `@/lib/word-queue`。
 */
import type { WordEntry as WordEntryType } from './types';
import { wordEntries } from './entries';

export type { WordEntry } from './types';

/** 字母序，跟纸质词典一样；收录日期只用来标「新」 */
export const dictionary = [...wordEntries].sort((a, b) =>
  a.term.localeCompare(b.term, 'en', { sensitivity: 'base' })
);

export const dictionaryCount = dictionary.length;

/**
 * 卡片正面那行中文。
 *
 * 显式写了 `gloss` 就用它；没写就取 `zh` 里第一个「：」之前的部分——
 * 词条本来就按「短词：解释」写，那半句正好是这个词的中文名。
 * 连冒号都没有的（`leak` 那种一词两义），才需要回 `entries.ts` 补 `gloss`。
 */
export function glossOf(entry: WordEntryType): string {
  if (entry.gloss) return entry.gloss;
  const head = splitZh(entry.zh)[0];
  return head && head.length <= 16 ? head : entry.zh;
}

/**
 * 展开后那段中文。
 *
 * 卡片正面已经写了「吸收、容纳」，展开区就没必要再念一遍——把冒号前那半截切掉，
 * 只留解释。切不动（没冒号、或者头太长没被当成 gloss 用）就原样给全句。
 */
export function zhDetailOf(entry: WordEntryType): string {
  if (entry.gloss) return entry.zh;
  const [head, rest] = splitZh(entry.zh);
  return head && rest && head.length <= 16 ? rest : entry.zh;
}

/** `'幂等：同一个操作…'` -> `['幂等', '同一个操作…']`；没有冒号时第二项是空串 */
function splitZh(zh: string): [string, string] {
  const idx = zh.search(/[：:]/);
  if (idx === -1) return [zh, ''];
  return [zh.slice(0, idx), zh.slice(idx + 1).trim()];
}

/** 出现过的标签，按词条数从多到少，供页面做筛选 */
export const dictionaryTags = [...new Set(dictionary.flatMap((entry) => entry.tags ?? []))].sort(
  (a, b) =>
    dictionary.filter((e) => e.tags?.includes(b)).length -
      dictionary.filter((e) => e.tags?.includes(a)).length || a.localeCompare(b)
);

/** 词条本身和它的变体都算「已收录」：队列里敲的是 relaying，词条挂的是 relay */
const known = new Set(
  dictionary.flatMap((entry) => [entry.term, ...(entry.also ?? [])].map((w) => w.toLowerCase()))
);

/**
 * 队列里这个词是不是已经收进单词本了。
 *
 * 首尾标点要剥掉：从正文里划词经常会连着句号一起带走（`permission surface.`），
 * 那和词条本身是同一个词，不该因为一个点就被当成新词。
 */
export function isDefined(term: string): boolean {
  const clean = term
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return clean.length > 0 && known.has(clean);
}
