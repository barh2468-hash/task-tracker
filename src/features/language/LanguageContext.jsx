import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { elTranslations, enTranslations, heTranslations } from './resources.js';

const LanguageContext = createContext(null);

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      he: { translation: heTranslations },
      en: { translation: enTranslations },
      el: { translation: elTranslations },
    },
    lng: localStorage.getItem('maya-language') || 'he',
    fallbackLng: 'he',
    keySeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const translationEntries = {
  en: Object.entries(enTranslations).sort(([left], [right]) => right.length - left.length),
  el: Object.entries(elTranslations).sort(([left], [right]) => right.length - left.length),
};
const resolvedTemplateCache = new Map();

export function t(key, options) {
  if (typeof key !== 'string') return key;
  if (i18n.language === 'he') return i18n.t(key, { ...options, defaultValue: key });
  if (i18n.exists(key, { lng: i18n.language })) return i18n.t(key, options);

  const cacheKey = `${i18n.language}\u0000${key}`;
  let result = resolvedTemplateCache.get(cacheKey);
  if (!result) {
    result = key;
    for (const [hebrew, localized] of translationEntries[i18n.language] || []) {
      if (result.includes(hebrew)) result = result.replaceAll(hebrew, localized);
    }
    resolvedTemplateCache.set(cacheKey, result);
  }
  return i18n.t(result, { ...options, defaultValue: result });
}

function applyDocumentLanguage(language) {
  localStorage.setItem('maya-language', language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  document.body.classList.toggle('language-en', language !== 'he');
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() =>
    ['he', 'en', 'el'].includes(localStorage.getItem('maya-language'))
      ? localStorage.getItem('maya-language')
      : 'he',
  );

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const changeLanguage = useCallback(async (nextLanguage) => {
    if (!['he', 'en', 'el'].includes(nextLanguage) || nextLanguage === i18n.language) return;
    await i18n.changeLanguage(nextLanguage);
    applyDocumentLanguage(nextLanguage);
    setLanguage(nextLanguage);
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage: changeLanguage }),
    [changeLanguage, language],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
