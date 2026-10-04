import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareLayoutSave, validateLayoutSource, filterSavedLayouts } from './savedLayouts.js';

const projectId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const source = () => ({ version: 1, draft: { projectId, project: 'פרויקט בדיקה', num: '03', date: '2026-10-04', infra: 'בזק', shape: 'rect', shaft: ['יציקה'], cover: ['ברזל'], walls: { rect: ['1', '3'] }, groups: [{ wall: '3', rows: '2', cols: '3', u: '1', v: '0.5', cables: [null, '4'] }] }, photos: [{ src: 'data:image/jpeg;base64,YQ==', w: 100, h: 80, label: 'תמונה 1' }] });
test('saved source preserves selected walls, sparse duct entries and photo captions', () => {
  const value = source();
  const prepared = prepareLayoutSave({ source: value, pdf: new Blob(['%PDF-1.7'], { type: 'application/pdf' }), preview: 'data:image/png;base64,YQ==', fileName: 'שוחה 3.pdf', userId, id });
  assert.equal(prepared.row.pdf_path, `${projectId}/${userId}/${id}/report.pdf`);
  assert.equal(prepared.row.source_path, `${projectId}/${userId}/${id}/source.json`);
  return prepared.sourceBlob.text().then(text => assert.deepEqual(JSON.parse(text), value));
});
test('source validation rejects impossible dates, remote images, malformed geometry and oversized files', () => {
  const invalidDate = source(); invalidDate.draft.date = '2026-02-31';
  assert.throws(() => validateLayoutSource(invalidDate));
  const externalPhoto = source(); externalPhoto.photos[0].src = 'https://example.com/photo.jpg';
  assert.throws(() => validateLayoutSource(externalPhoto));
  const invalidGroup = source(); invalidGroup.draft.groups[0].cables = 'not an array';
  assert.throws(() => validateLayoutSource(invalidGroup));
  const invalidDraft = source(); invalidDraft.draft.shaft = 'יציקה';
  assert.throws(() => validateLayoutSource(invalidDraft));
  assert.throws(() => prepareLayoutSave({ source: source(), pdf: new Blob([new Uint8Array(26 * 1024 * 1024)], { type: 'application/pdf' }), userId, id }));
});
test('saved-list filters combine project, worker and manhole search', () => {
  const rows = [{ project_id: projectId, created_by: userId, project_name: 'צפון', manhole_number: '03', infrastructure: 'בזק' }, { project_id: id, created_by: userId, project_name: 'דרום', manhole_number: '04', infrastructure: 'ביוב' }];
  assert.deepEqual(filterSavedLayouts(rows, { projectId, workerId: userId, search: 'בזק' }), [rows[0]]);
  assert.equal(filterSavedLayouts(rows, { projectId, search: '04' }).length, 0);
});
