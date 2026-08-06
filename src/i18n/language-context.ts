import { createContext } from 'react';
import { translations, type Language } from './translations';

export type Translations = typeof translations.zh;

export interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translations;
}

export const LANGUAGE_STORAGE_KEY = 'cc-switch-language';

export const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
