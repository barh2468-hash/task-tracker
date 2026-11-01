import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { articleDraft, articleSections, ARTICLE_SECTIONS, articleTranslations, localizeCaseContent } from './article.js';
import { heArticles, enArticles, elArticles, ptArticles } from './articleTranslations.js';
import { heTranslations, enTranslations, elTranslations, ptTranslations } from '../language/resources.js';

test('partial and legacy case studies show only supplied sections in reading order', () => {
  assert.deepEqual(articleSections({ summary: 'Legacy PDF only' }), []);
  const study = { outcome: 'תוצאה Ω', challenge: '  אתגר\nSecond line', solution: '  ', work_process: '' };
  assert.deepEqual(articleSections(study), [
    { key: 'challenge', text: study.challenge }, { key: 'outcome', text: study.outcome },
  ]);
  assert.deepEqual(Object.keys(articleDraft()), ['title', 'summary', ...ARTICLE_SECTIONS]);
});

test('case content switches whole fields without translating user names or changing identifiers', () => {
  const original = { id: 'case-1', title: 'כותרת', challenge: 'אתגר', client_name: 'Maya Ω', translations: { en: { title: 'Title', challenge: 'Challenge', id: 'other', file_path: 'private/other.pdf' } } };
  assert.equal(localizeCaseContent(original, 'he').title, 'כותרת');
  const english = localizeCaseContent(original, 'en');
  assert.equal(english.title, 'Title'); assert.equal(english.challenge, 'Challenge');
  assert.equal(english.id, 'case-1'); assert.equal(english.file_path, undefined);
  assert.equal(english.client_name, 'Maya Ω');
  assert.equal(localizeCaseContent(original, 'el').title, 'Title');
  assert.equal(localizeCaseContent({ ...original, translations: {} }, 'en').title, 'כותרת');
  assert.deepEqual(articleTranslations(original).en, { ...articleDraft(original.translations.en), client_name: '', technical_details: '' });
  assert.equal(original.title, 'כותרת');
});

for (const [language, dictionary, resources] of [
  ['he', heArticles, heTranslations], ['en', enArticles, enTranslations],
  ['el', elArticles, elTranslations], ['pt', ptArticles, ptTranslations],
]) {
  test(`native case study labels, editor and PDF states are localized in ${language}`, () => {
    assert.deepEqual(Object.keys(dictionary), Object.keys(heArticles));
    for (const [key, value] of Object.entries(dictionary)) {
      assert.equal(resources[key], value, key);
      if (language !== 'he') assert.doesNotMatch(value, /[\u0590-\u05ff]/, key);
      assert.deepEqual(value.match(/\{\{[^}]+\}\}/g), heArticles[key].match(/\{\{[^}]+\}\}/g), key);
    }
    for (const name of ['CaseStudyArticle.jsx', 'InlineCaseStudyPdf.jsx', 'CaseStudyGallery.jsx', 'ClientLibraryPreview.jsx', 'CaseStudies.jsx', 'DemoManagement.jsx']) {
      const source = readFileSync(new URL(name, import.meta.url), 'utf8');
      for (const [, key] of source.matchAll(/['"](caseStudy\.[A-Za-z]+)['"]/g)) assert.ok(dictionary[key], key);
    }
    for (const key of ARTICLE_SECTIONS) assert.ok(dictionary[`caseStudy.${key}`]);
  });
}
