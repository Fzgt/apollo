/**
 * 题库的内容层（/questions 那个 tab）。
 *
 * 加一家公司：写一个 `<id>.ts` 导出 QuestionSource，挂进下面的数组。
 * 只收真的被问过的题——「预期追问」属于 `content/library` 的笔记，不进这里。
 */

import type { Question, QuestionBullet, QuestionSource } from './types';
import { beyz } from './beyz';
import { beyzAnswersEn } from './beyz.en';

export type { Bilingual, Question, QuestionBullet, QuestionKind, QuestionSource } from './types';

/**
 * 把英文答案挂回题库。
 *
 * 答案正文按语言分文件存（`beyz.ts` 中文、`beyz.en.ts` 英文），和 `content/notes`
 * 那套 `.md` / `.en.md` 同一个规矩：翻译进度不该去搅动原文那一份。
 * 某题还没有英文，站上自动落回中文，不留空。
 */
function withEnglishAnswers(
  source: QuestionSource,
  answers: Record<string, string>
): QuestionSource {
  return {
    ...source,
    bullets: source.bullets.map((bullet) => ({
      ...bullet,
      questions: bullet.questions.map((question) =>
        answers[question.id]
          ? { ...question, a: { ...question.a, en: answers[question.id] } }
          : question
      ),
    })),
  };
}

export const questionSources: QuestionSource[] = [withEnglishAnswers(beyz, beyzAnswersEn)];

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
