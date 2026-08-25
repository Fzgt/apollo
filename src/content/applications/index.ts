/**
 * 投递答案库的内容层（/apply 那个 tab）。
 *
 * 加一组：写一个 `<id>.ts` 导出 ApplicationGroup，挂进下面的数组。
 * 通用题放 general，公司专属的自己一组、标 companySpecific。
 */

import type { ApplicationAnswer, ApplicationGroup } from './types';
import { general } from './general';
import { maincode } from './maincode';
import { sitemate } from './sitemate';

export type { ApplicationAnswer, ApplicationGroup } from './types';

export const applicationGroups: ApplicationGroup[] = [general, sitemate, maincode];

export interface FlatAnswer {
  group: ApplicationGroup;
  answer: ApplicationAnswer;
}

export const allAnswers: FlatAnswer[] = applicationGroups.flatMap((group) =>
  group.answers.map((answer) => ({ group, answer }))
);

export const answerCount = allAnswers.length;

/**
 * 题号。按库里的固定顺序编，一题一个号——搜索会按得分重排，号不跟着变，
 * 这样「第 3 题」在任何视图下都指同一条。往数组末尾加题不会打乱已有的号。
 */
export const answerNumbers = new Map<string, number>(
  allAnswers.map(({ answer }, index) => [answer.id, index + 1])
);
