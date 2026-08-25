/**
 * 投递答案库的形状（/apply 那个 tab）。
 *
 * 和题库的分工：题库是面试时**说出口**的话，这里是网申表单里**粘贴进去**的字。
 * 所以 `a` 是纯文本、不是 markdown —— 渲染层原样显示、原样复制，
 * 中间不许有任何加工，粘出去是什么样，这里看到的就是什么样。
 *
 * 规矩一条：`a` 里**不许出现待填的方括号或占位符**。
 * 答案要么是成品，要么就别收进来——留个空等人填，迟早有一天会原样粘进申请表。
 */

export interface ApplicationAnswer {
  id: string;
  /** 表单里的原题，照抄，别改写 */
  q: string;
  /** 中文旁注：这题实际在问什么、答案里哪句是关键 */
  note?: string;
  /** 粘贴用的正文，纯文本 */
  a: string;
  /** 搜索别名：题干里没出现、但会拿来搜的词 */
  keywords?: string[];
  /** 第一次用在哪次投递 */
  used?: string;
}

/** 一组答案：通用题，或者某家公司的专属题 */
export interface ApplicationGroup {
  id: string;
  title: string;
  subtitle?: string;
  /** 公司专属组标 true：这些答案换一家公司就作废 */
  companySpecific?: boolean;
  answers: ApplicationAnswer[];
}
