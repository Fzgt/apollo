/** 面试速查表的一条：一个中文场景，配上该说的英文 */
export interface Phrase {
  /** 中文那一头——查的时候先想到的就是这个 */
  zh: string;
  /** 首选说法。拿不准时说这个不会错 */
  en: string;
  /** 备选或近义；用法差别写进 note */
  alt?: string[];
  /** 什么时候换词、什么词别说。只在真有区别时写 */
  note?: string;
  /** 一句能直接念出口的例句 */
  ex?: string;
  /** 读音提示，只给会读错的词 */
  say?: string;
  /** 分组，见 `./index` 的 TOPICS */
  topic: TopicKey;
}

export type TopicKey =
  | "verb"
  | "net"
  | "render"
  | "react"
  | "perf"
  | "css"
  | "data"
  | "build"
  | "test"
  | "team"
  | "judge"
  | "frame";
