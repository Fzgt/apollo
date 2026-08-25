/**
 * 投递答案库的内容层（/apply 那个 tab）。
 *
 * 加一组：写一个 `<id>.ts` 导出 ApplicationGroup，挂进下面的数组。
 * 通用题放 general，公司专属的自己一组、标 companySpecific。
 */

import type { ApplicationAnswer, ApplicationGroup } from './types';
import { general } from './general';
import { sitemate } from './sitemate';

export type { ApplicationAnswer, ApplicationGroup } from './types';

export const applicationGroups: ApplicationGroup[] = [general, sitemate];

export interface FlatAnswer {
  group: ApplicationGroup;
  answer: ApplicationAnswer;
}

export const allAnswers: FlatAnswer[] = applicationGroups.flatMap((group) =>
  group.answers.map((answer) => ({ group, answer }))
);

export const answerCount = allAnswers.length;
