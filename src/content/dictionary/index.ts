/**
 * Technical Dictionary（/words）的内容层。
 *
 * 词条见 `./entries`；本地那条「还没释义的生词队列」不在这里，
 * 它是浏览器状态，住在 `@/lib/word-queue`。
 */
import { wordEntries } from './entries';

export type { WordEntry } from './types';

/** 字母序，跟纸质词典一样；收录日期只用来标「新」 */
export const dictionary = [...wordEntries].sort((a, b) =>
  a.term.localeCompare(b.term, 'en', { sensitivity: 'base' })
);

export const dictionaryCount = dictionary.length;

/** 出现过的标签，按词条数从多到少，供页面做筛选 */
export const dictionaryTags = [...new Set(dictionary.flatMap((entry) => entry.tags ?? []))].sort(
  (a, b) =>
    dictionary.filter((e) => e.tags?.includes(b)).length -
      dictionary.filter((e) => e.tags?.includes(a)).length || a.localeCompare(b)
);

const known = new Set(dictionary.map((entry) => entry.term.toLowerCase()));

/** 队列里这个词是不是已经收进单词本了 */
export function isDefined(term: string): boolean {
  return known.has(term.trim().toLowerCase());
}
