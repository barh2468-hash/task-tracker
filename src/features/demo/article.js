export const ARTICLE_SECTIONS = ['challenge', 'work_process', 'solution', 'outcome'];

// Explicit allowlist: editing an article cannot change its project or storage path.
export function articleDraft(study = {}) {
  return Object.fromEntries(
    ['title', 'summary', ...ARTICLE_SECTIONS].map((key) => [key, study[key] ?? '']),
  );
}

export function articleSections(study) {
  return ARTICLE_SECTIONS.filter((key) => study[key]?.trim()).map((key) => ({
    key,
    text: study[key],
  }));
}

const CONTENT_FIELDS = ['title', 'summary', 'location', 'client_name', 'technical_details', ...ARTICLE_SECTIONS];

export function localizeCaseContent(record, language) {
  const translated = language === 'he' ? null : record.translations?.en;
  if (typeof translated?.title !== 'string' || !translated.title.trim()) return { ...record, content_language: 'he' };
  const content = Object.fromEntries(CONTENT_FIELDS.filter((key) => typeof translated[key] === 'string').map((key) => [key, translated[key]]));
  return { ...record, ...content, content_language: 'en' };
}

export function articleTranslations(draft) {
  if (!draft.translations?.en) return {};
  return { en: { ...articleDraft(draft.translations.en),
    client_name: draft.translations.en.client_name ?? '',
    technical_details: draft.translations.en.technical_details ?? '',
  } };
}
