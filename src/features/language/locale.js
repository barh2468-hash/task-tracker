export function localeForLanguage(language) {
  return { he: 'he-IL', en: 'en-GB', el: 'el-GR', pt: 'pt-PT' }[language] || 'en-GB';
}
