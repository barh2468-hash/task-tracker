import assert from 'node:assert/strict';
import test from 'node:test';
import { localizedField, mergeTranslationDraft, translationDraft } from './localizedField.js';

const project = {
  name: 'כביש 531 - קטע צפוני',
  name_translations: {
    en: { text: 'Road 531 - Northern Section', source: 'כביש 531 - קטע צפוני', manual: false },
    el: { text: 'Δρόμος 531', source: 'שם ישן', manual: false },
    pt: { text: 'Estrada 531 (manual)', source: 'שם ישן', manual: true },
  },
};

test('shows fresh and manual translations, falls back to Hebrew for stale or missing ones', () => {
  assert.equal(localizedField(project, 'name', 'he'), project.name);
  assert.equal(localizedField(project, 'name', 'en'), 'Road 531 - Northern Section');
  assert.equal(localizedField(project, 'name', 'el'), project.name);
  assert.equal(localizedField(project, 'name', 'pt'), 'Estrada 531 (manual)');
  assert.equal(localizedField({ name: 'בלי תרגום' }, 'name', 'en'), 'בלי תרגום');
  assert.equal(localizedField(null, 'name', 'en'), undefined);
});

test('edit form draft hides stale translations', () => {
  assert.deepEqual(translationDraft(project, 'name'), {
    en: 'Road 531 - Northern Section', el: '', pt: 'Estrada 531 (manual)',
  });
});

test('merging the edit form draft', () => {
  const stored = project.name_translations;
  const draft = translationDraft(project, 'name');

  // Nothing touched, same name: fresh/manual entries kept, stale one dropped.
  assert.deepEqual(mergeTranslationDraft(stored, project.name, project.name, draft), {
    en: stored.en, pt: stored.pt,
  });

  // Renamed: automatic translation dropped for re-translation, manual kept.
  assert.deepEqual(mergeTranslationDraft(stored, project.name, 'שם חדש', draft), { pt: stored.pt });

  // Typed text becomes manual; cleared text is removed.
  const merged = mergeTranslationDraft(stored, project.name, project.name, { ...draft, en: 'Route 531 North', pt: '' });
  assert.deepEqual(merged, { en: { text: 'Route 531 North', source: project.name, manual: true } });
});
