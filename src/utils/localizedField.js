import i18n from 'i18next';

// User-typed text (project names today) is stored in Hebrew, with
// translations next to it in a `<field>_translations` jsonb column:
//   { en: { text, source, manual }, el: {...}, pt: {...} }
// `source` is the Hebrew text a bulk translation was made from. Once the
// Hebrew changes, that translation is stale and the Hebrew is shown instead.
// Translations a manager typed in the edit form (`manual`) are always shown.

export const TRANSLATED_LANGUAGES = ['en', 'el', 'pt'];

function isFresh(entry, original) {
  return Boolean(entry?.text) && (entry.manual || entry.source === original);
}

export function localizedField(row, field, language = i18n.language) {
  const original = row?.[field];
  if (!original || language === 'he') return original;
  const entry = row[`${field}_translations`]?.[language];
  return isFresh(entry, original) ? entry.text : original;
}

// The translation texts to show in an edit form (stale ones left empty).
export function translationDraft(row, field) {
  const translations = row?.[`${field}_translations`] || {};
  return Object.fromEntries(TRANSLATED_LANGUAGES.map((language) => [
    language,
    isFresh(translations[language], row?.[field]) ? translations[language].text : '',
  ]));
}

// Merge what a manager typed in the edit form into the stored translations.
// - unchanged text keeps its entry (a bulk translation is dropped if the
//   Hebrew changed, since it no longer matches the name);
// - changed text becomes a manual translation;
// - an emptied field is removed, so the Hebrew name is shown.
export function mergeTranslationDraft(previous, previousOriginal, nextOriginal, draft) {
  const stored = previous || {};
  const shown = translationDraft({ value: previousOriginal, value_translations: stored }, 'value');
  const next = {};
  for (const language of TRANSLATED_LANGUAGES) {
    const text = String(draft?.[language] ?? '').trim();
    const entry = stored[language];
    if (!text) continue;
    if (text === shown[language] && entry) {
      if (entry.manual || nextOriginal === previousOriginal) next[language] = entry;
      continue;
    }
    next[language] = { text: text.slice(0, 300), source: nextOriginal, manual: true };
  }
  return next;
}
