import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { elTranslations, enTranslations, heTranslations, ptTranslations } from './resources.js';
import { supportedLanguages } from './languages.js';
import { languagePreferenceForUser, readLanguagePreference } from './accountLanguage.js';

const LanguageContext = createContext(null);

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      he: { translation: heTranslations },
      en: { translation: enTranslations },
      el: { translation: elTranslations },
      pt: { translation: ptTranslations },
    },
    lng: localStorage.getItem('maya-language') || 'he',
    fallbackLng: 'he',
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
} else {
  // Full translation keys may contain literal colons, including after hot updates.
  i18n.options.nsSeparator = false;
  // Vite preserves the i18next singleton during hot updates. Register the
  // latest dictionaries too, so open tabs see newly added or changed keys.
  for (const [language, translations] of Object.entries({
    he: heTranslations,
    en: enTranslations,
    el: elTranslations,
    pt: ptTranslations,
  })) {
    i18n.addResourceBundle(language, 'translation', translations, true, true);
  }
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
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  document.body.classList.toggle('language-en', language !== 'he');
}

export function LanguageProvider({ children }) {
  const languageUserRef = useRef(null);
  const [language, setLanguage] = useState(() =>
    supportedLanguages.includes(localStorage.getItem('maya-language'))
      ? localStorage.getItem('maya-language')
      : 'he',
  );

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const changeLanguage = useCallback(async (nextLanguage) => {
    if (!supportedLanguages.includes(nextLanguage)) return;
    const {key}=languagePreferenceForUser(languageUserRef.current);
    localStorage.setItem(key,nextLanguage);
    await i18n.changeLanguage(nextLanguage);
    applyDocumentLanguage(nextLanguage);
    setLanguage(nextLanguage);
  }, []);

  const activateAccountLanguage = useCallback(async (userId) => {
    languageUserRef.current = userId;
    const nextLanguage = readLanguagePreference(localStorage,userId);
    await i18n.changeLanguage(nextLanguage);
    if (languageUserRef.current !== userId) return;
    applyDocumentLanguage(nextLanguage);
    setLanguage(nextLanguage);
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage: changeLanguage, activateAccountLanguage }),
    [changeLanguage, language, activateAccountLanguage],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
