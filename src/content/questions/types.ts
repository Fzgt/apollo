/**
 * 题库的形状：公司/项目 → 简历 bullet → 题目。
 *
 * 只收**真的被问过**的题（自己模拟也算），每题配一份「该怎么答」。
 * 和 `content/library` 那套笔记的分工：笔记讲代码出处和原理，
 * 题库讲「这句话出口时该长什么样」。
 */

/** 中英双份。面试听到的是英文，脑子里过的是中文，两个都得有 */
export interface Bilingual {
  zh: string;
  en?: string;
}

export type QuestionKind = 'main' | 'followup';

export interface Question {
  id: string;
  kind: QuestionKind;
  q: Bilingual;
  /** 答案正文，markdown */
  a: Bilingual;
  /** 面试时可以直接说出口的英文短句 */
  phrases?: string[];
  /** 搜索别名：题干里没出现、但会拿来搜的术语 */
  keywords?: string[];
  /** 首次被问到的日期 */
  asked?: string;
  /** 这题还没有可信答案，别背 */
  unresolved?: boolean;
}

/** 一条简历 bullet */
export interface QuestionBullet {
  id: string;
  title: string;
  /** 简历原文 */
  resume?: string;
  questions: Question[];
}

/** 一家公司 / 一个项目 */
export interface QuestionSource {
  id: string;
  title: string;
  subtitle?: string;
  bullets: QuestionBullet[];
}
