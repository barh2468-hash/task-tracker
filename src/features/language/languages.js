// Show native language names so users can always recognize their language.
export const languageOptions = [
  { code: 'he', labelKey: 'languageName.he' },
  { code: 'en', labelKey: 'languageName.en' },
  { code: 'el', labelKey: 'languageName.el' },
  { code: 'pt', labelKey: 'languageName.pt' },
];

export const supportedLanguages = languageOptions.map(({ code }) => code);

export const languageNames = {
  'languageName.he': 'עברית',
  'languageName.en': 'English',
  'languageName.el': 'Ελληνικά',
  'languageName.pt': 'Português',
};
