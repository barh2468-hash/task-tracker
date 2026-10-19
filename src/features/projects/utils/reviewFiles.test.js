import assert from 'node:assert/strict';
import test from 'node:test';
import { appendReviewFiles, getReviewFileVersions } from './reviewFiles.js';

test('separate file selections accumulate and selecting the same file again does not duplicate it', () => {
  const first = { name: 'drawing.pdf', size: 30, lastModified: 1 };
  const second = { name: 'section.pdf', size: 40, lastModified: 2 };
  const original = [first];
  const selection = appendReviewFiles(original, [second, { ...first }]);
  assert.deepEqual(selection, [first, second]);
  assert.deepEqual(original, [first]);
  assert.deepEqual(appendReviewFiles(selection, []), selection);
  assert.deepEqual(appendReviewFiles([second], [first]), [second, first]);
});

test('files with the same name and different contents can both be selected', () => {
  const first = { name: 'drawing.pdf', size: 30, lastModified: 1 };
  const replacement = { ...first, size: 45, lastModified: 2 };
  assert.deepEqual(appendReviewFiles([first], [replacement]), [first, replacement]);
});

test('every PDF in the latest submission stays current and earlier submissions are superseded', () => {
  const files = [
    { id: 'old', created_at: '2026-10-18T12:00:00.123456Z' },
    { id: 'new-a', created_at: '2026-10-19T12:00:00.123456Z' },
    { id: 'new-b', created_at: '2026-10-19T12:00:00.123456Z' },
  ];
  assert.deepEqual(
    getReviewFileVersions(files).map(({ file, isSuperseded }) => [file.id, isSuperseded]),
    [
      ['new-a', false],
      ['new-b', false],
      ['old', true],
    ],
  );
  assert.equal(files[0].id, 'old');
});

test('new submissions only supersede files from the same project and drawing batch', () => {
  const files = [
    { id: 'project', project_id: 'a', created_at: '2026-10-17T12:00:00Z' },
    { id: 'batch-old', project_id: 'a', drawing_batch_id: 'b', created_at: '2026-10-18T12:00:00Z' },
    { id: 'batch-new', project_id: 'a', drawing_batch_id: 'b', created_at: '2026-10-19T12:00:00Z' },
    {
      id: 'other-batch',
      project_id: 'a',
      drawing_batch_id: 'c',
      created_at: '2026-10-17T12:00:00Z',
    },
    { id: 'other-project', project_id: 'd', created_at: '2026-10-17T12:00:00Z' },
  ];
  assert.deepEqual(
    getReviewFileVersions(files)
      .filter(({ isSuperseded }) => isSuperseded)
      .map(({ file }) => file.id),
    ['batch-old'],
  );
});

test('empty history and files with missing timestamps do not mark unknown versions as superseded', () => {
  assert.deepEqual(getReviewFileVersions([]), []);
  const files = [{ id: 'unknown' }, { id: 'current', created_at: '2026-10-19T12:00:00Z' }];
  assert.ok(getReviewFileVersions(files).every(({ isSuperseded }) => !isSuperseded));
});
