import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  HTML_LANG,
  LANG_STORAGE_KEY,
  LangContext,
  readStoredLang,
  type Lang,
  type LangContextValue,
  type Text,
} from '@/lib/i18n';

/** 语言状态本身。取值与存储的规矩见 `@/lib/i18n` */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* 存不下就只在这一次会话里生效，不值得报错 */
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      toggleLang: () => setLang(lang === 'en' ? 'zh' : 'en'),
      t: (text: Text) => (lang === 'zh' ? (text.zh ?? text.en) : text.en),
    }),
    [lang, setLang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
