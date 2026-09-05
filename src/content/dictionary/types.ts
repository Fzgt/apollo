/** 单词本的一条词条 */
export interface WordEntry {
  /** 词条本身，小写；缩写保持原样（RAG、TTFB） */
  term: string;
  /** 词性或形态提示：`noun`、`verb`、`adj.`、`abbr.` */
  pos?: string;
  /** 英文释义。收进折叠区——先看懂这个词指哪件事，再回来读英文 */
  en: string;
  /** 中文释义。全站唯一刻意保留中文的地方 */
  zh: string;
  /**
   * 卡片正面那行中文，四到八个字。
   * 不填就从 `zh` 的第一个「：」之前自动取——绝大多数词条本来就是
   * 「短词：解释」这个写法，所以只有拆不干净的词才需要显式写。
   */
  gloss?: string;
  /** 例句尽量取自站内笔记：读到的语境和背的语境是同一个 */
  example?: string;
  /** 同一个词在别处的常见变体或近义词 */
  also?: string[];
  /** 用来筛：ai / frontend / backend / graphics / interview / general */
  tags?: string[];
  /** 收录日期，YYYY-MM-DD */
  added: string;
}
