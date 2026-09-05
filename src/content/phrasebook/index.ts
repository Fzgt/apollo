/**
 * 面试速查表（/words 的第二个页签）的内容层。
 *
 * 词条见 `./entries`；这里只管分组顺序和「怎么被搜到」。
 */
import type { Phrase, TopicKey } from "./types";
import { phrases } from "./entries";
import type { Text } from "@/lib/i18n";

export type { Phrase, TopicKey } from "./types";

/** 分组顺序 = 面试里被问到的先后：先讲做过什么，再往下钻，最后才是句式 */
export const TOPICS: Array<{ key: TopicKey; label: Text }> = [
  { key: "verb", label: { en: "Verbs", zh: "动作" } },
  { key: "react", label: { en: "React", zh: "React" } },
  { key: "perf", label: { en: "Performance", zh: "性能" } },
  { key: "render", label: { en: "Browser", zh: "浏览器渲染" } },
  { key: "net", label: { en: "Network", zh: "网络请求" } },
  { key: "css", label: { en: "CSS", zh: "CSS 布局" } },
  { key: "data", label: { en: "Data", zh: "数据状态" } },
  { key: "build", label: { en: "Shipping", zh: "工程上线" } },
  { key: "test", label: { en: "Quality", zh: "测试质量" } },
  { key: "team", label: { en: "Team", zh: "协作项目" } },
  { key: "judge", label: { en: "Judgement", zh: "评价取舍" } },
  { key: "frame", label: { en: "Sentences", zh: "句式" } },
];

export const phrasebook = phrases;

export const phrasebookCount = phrases.length;

export function phrasesOf(topic: TopicKey): Phrase[] {
  return phrases.filter((phrase) => phrase.topic === topic);
}

/**
 * 搜索命中的那一段文本。
 *
 * 中文和英文都要能搜到：想不起 resolve 的时候搜的是「解析」，
 * 记得词但不确定用法时搜的是 downside。note 和例句一起进，
 * 因为「怎么说 40% 提升」这种问题，答案在例句里。
 */
export function haystackOf(phrase: Phrase): string {
  return [
    phrase.zh,
    phrase.en,
    ...(phrase.alt ?? []),
    phrase.note ?? "",
    phrase.ex ?? "",
  ]
    .join(" ")
    .toLowerCase();
}
