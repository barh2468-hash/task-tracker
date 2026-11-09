import { supportedLanguages } from './languages.js';

const JOHNNY_USER_ID = 'ab110d9f-1202-4e92-878a-ec5d0b2a8c86';

export function languagePreferenceForUser(userId) {
  return userId === JOHNNY_USER_ID
    ? { key: `maya-language:user:${userId}`, defaultLanguage: 'en' }
    : { key: 'maya-language', defaultLanguage: 'he' };
}

export function readLanguagePreference(storage, userId) {
  const { key, defaultLanguage } = languagePreferenceForUser(userId);
  const saved = storage.getItem(key);
  return supportedLanguages.includes(saved) ? saved : defaultLanguage;
}
