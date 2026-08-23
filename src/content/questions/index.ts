/**
 * 题库的内容层（/questions 那个 tab）。
 *
 * 加一家公司：写一个 `<id>.ts` 导出 QuestionSource，挂进下面的数组。
 * 只收真的被问过的题——「预期追问」属于 `content/library` 的笔记，不进这里。
 */

import type { Question, QuestionBullet, QuestionSource } from './types';
import { beyz } from './beyz';

export type { Bilingual, Question, QuestionBullet, QuestionKind, QuestionSource } from './types';

export const questionSources: QuestionSource[] = [beyz];

/** 摊平成一维，搜索用 */
export interface FlatQuestion {
  source: QuestionSource;
  bullet: QuestionBullet;
  question: Question;
}

export const allQuestions: FlatQuestion[] = questionSources.flatMap((source) =>
  source.bullets.flatMap((bullet) =>
    bullet.questions.map((question) => ({ source, bullet, question }))
  )
);

export const questionCount = allQuestions.length;
