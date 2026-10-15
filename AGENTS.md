# Project instructions

## Internationalization

- Use the existing i18n `t()` helper for all user-facing text. Never add untranslated Hebrew directly to JSX or UI messages.
- Add complete English and Greek translations for every new or changed translation key. Do not rely on partial-string replacement or Hebrew fallback to localize a feature.
- Cover labels, placeholders, accessibility labels, confirmations, errors, loading states, empty states, and exports.
- Use interpolation for dynamic values instead of concatenating translated fragments.
- Ensure components update when the selected language changes. Follow the existing `useTranslation()` and `useLanguage()` patterns.
- Use the selected language for date, time, and number formatting. Preserve the workflow's existing time zone and use `localeForLanguage()` where applicable.
- Support Hebrew RTL and English/Greek LTR layouts, including longer translated text on mobile.
- Preserve user-entered names, project names, and notes unchanged.
- Verify changed UI in Hebrew, English, and Greek, including relevant messages and accessibility labels.

Use `src/features/language/LanguageContext.jsx` and the translation resources in `src/features/language/resources.js`. Feature-specific translation files may be used when connected to those resources. The shared locale helper is `src/features/language/locale.js`.

Hebrew translation keys are allowed under the existing convention; untranslated Hebrew displayed directly to users is not.
