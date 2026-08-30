/**
 * 全站语言开关的类型、存储与读取。
 *
 * 站里的内容本来就是两份：笔记有 `.md` / `.en.md`，题库有 `beyz.ts` / `beyz.en.ts`，
 * 博客有 issues 原文与 `blog/<号>.en.md`。以前界面钉死在英文、内容一律取英文版，
 * 中文只在没译文时兜底。这一层把「取哪一份」交给用户：导航栏一个按钮，全站跟着换。
 *
 * 选择存在 localStorage，不进 URL —— 语言是跨路由的偏好，不是某一页的视图状态，
 * 塞进 query 会让站里每个链接都要带一个参数。默认英文：站是照着面试英文材料建的。
 *
 * 只有这三样不跟着切，它们是「一份原件」而不是「同一段话的两种写法」：
 * 网申答案（要原样粘进英文表单）、题库里的 bullet 标题与简历原文、/cv 分享页。
 *
 * Provider 在 `@/components/layout/LangProvider`，这里只留不带 JSX 的部分。
 */

import { createContext, useContext } from 'react';

export type Lang = 'en' | 'zh';

/** 一句话的两份写法。zh 缺就落回 en——空字比一句外语糟得多 */
export interface Text {
  en: string;
  zh?: string;
}

export const LANG_STORAGE_KEY = 'apollo:lang';
export const DEFAULT_LANG: Lang = 'en';

/** `<html lang>` 要跟着换：影响断行、字体回退和读屏器发音 */
export const HTML_LANG: Record<Lang, string> = { en: 'en', zh: 'zh-CN' };

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'zh';
}

export function readStoredLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    // 隐私模式下 localStorage 会抛，语言开关不值得为此崩掉整站
    return DEFAULT_LANG;
  }
}

export interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** 取当前语言那一份 */
  t: (text: Text) => string;
}

export const LangContext = createContext<LangContextValue | null>(null);

export function useLang(): LangContextValue {
  const value = useContext(LangContext);
  if (!value) throw new Error('useLang 必须在 LangProvider 里用');
  return value;
}
