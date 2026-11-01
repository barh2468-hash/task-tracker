import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { articleDraft, articleTranslations } from './article.js';

const source = transformSync(
  readFileSync(new URL('./api.js', import.meta.url), 'utf8')
    .replace(/^import .*?;\s*/gm, '')
    .replaceAll('export ', ''),
  { loader: 'js' },
).code;
function fixture({ insertError = false, signedError = false } = {}) {
  const calls = [];
  const query = {
    select(...args) {
      calls.push(['select', ...args]);
      return this;
    },
    insert(payload) {
      calls.push(['insert', payload]);
      return this;
    },
    update(payload) {
      calls.push(['update', payload]);
      return this;
    },
    eq(...args) {
      calls.push(['eq', ...args]);
      return this;
    },
    single() {
      return this;
    },
    delete() {
      calls.push(['delete']);
      return this;
    },
    then(resolve) {
      return Promise.resolve({
        data: { file_path: 'approved/file.pdf' },
        error: insertError ? new Error('insert failed') : null,
      }).then(resolve);
    },
  };
  const client = {
    from(name) {
      calls.push(['from', name]);
      return query;
    },
    storage: {
      from: (bucket) => ({
        upload: async (...args) => {
          calls.push(['upload', bucket, ...args]);
          return { data: {} };
        },
        remove: async (...args) => {
          calls.push(['remove', ...args]);
          return { data: {} };
        },
        createSignedUrl: async (...args) => {
          calls.push(['sign', ...args]);
          return {
            data: { signedUrl: 'signed' },
            error: signedError ? new Error('revoked') : null,
          };
        },
      }),
    },
  };
  return {
    calls,
    ...new Function(
      'supabase',
      'articleDraft',
      'articleTranslations',
      `${source}; return { validateCaseStudy, uploadCaseStudy, saveCaseStudyArticle, openCaseStudy, deleteCaseStudy };`,
    )(client, articleDraft, articleTranslations),
  };
}

test('PDF uploads reject wrong signatures, empty files and size violations before storage', async () => {
  const f = fixture();
  for (const file of [
    new File(['bad'], 'bad.pdf'),
    new File(['%PDF-1.7'], 'bad.txt'),
    new File([], 'empty.pdf'),
    { name: 'large.pdf', size: 20971521 },
  ]) {
    await assert.rejects(
      f.uploadCaseStudy('project', { title: 'Case', summary: '', file }),
      /demo.pdfInvalid/,
    );
  }
  assert.deepEqual(f.calls, []);
});

test('article editing preserves customer text and cannot change project or PDF paths', async () => {
  const f = fixture();
  await f.saveCaseStudyArticle('case-id', { title: '  Case Ω  ', challenge: 'שורה ראשונה\nSecond line', file_path: 'other/secret.pdf', project_id: 'other' });
  const payload = f.calls.find(([kind]) => kind === 'update')[1];
  assert.equal(payload.title, 'Case Ω');
  assert.equal(payload.challenge, 'שורה ראשונה\nSecond line');
  assert.equal(payload.file_path, undefined);
  assert.equal(payload.project_id, undefined);
  assert.ok(f.calls.some((call) => call[0] === 'eq' && call[1] === 'id' && call[2] === 'case-id'));
});

test('saving bilingual article content keeps both versions and rejects translated access fields', async () => {
  const f = fixture();
  await f.saveCaseStudyArticle('case-id', {
    title: 'כותרת', challenge: 'אתגר', client_name: 'Maya Ω',
    translations: { en: { title: 'Title', challenge: 'Challenge', client_name: 'Maya Ω', project_id: 'different-project', file_path: 'other/private.pdf' } },
  });
  const payload = f.calls.find(([kind]) => kind === 'update')[1];
  assert.equal(payload.title, 'כותרת'); assert.equal(payload.challenge, 'אתגר');
  assert.equal(payload.translations.en.title, 'Title'); assert.equal(payload.translations.en.challenge, 'Challenge');
  assert.equal(payload.client_name, 'Maya Ω');
  assert.equal(payload.translations.en.file_path, undefined);
  assert.equal(payload.translations.en.project_id, undefined);
});

test('failed metadata save cleans up the uploaded PDF and reports failure', async () => {
  const f = fixture({ insertError: true });
  await assert.rejects(
    f.uploadCaseStudy('project', {
      title: 'Case',
      summary: '',
      file: new File(['%PDF-1.7'], 'case.pdf'),
    }),
    /insert failed/,
  );
  assert.equal(f.calls.filter(([kind]) => kind === 'remove').length, 1);
});

test('opening a PDF rechecks accessible metadata and signs for only one minute', async () => {
  const f = fixture();
  assert.equal(await f.openCaseStudy('case-id'), 'signed');
  assert.deepEqual(f.calls[0], ['from', 'demo_case_studies']);
  assert.ok(f.calls.some((call) => call[0] === 'eq' && call[1] === 'id' && call[2] === 'case-id'));
  assert.deepEqual(f.calls.at(-1), ['sign', 'approved/file.pdf', 60]);
  const revoked = fixture({ signedError: true });
  await assert.rejects(revoked.openCaseStudy('case-id'), /revoked/);
});
