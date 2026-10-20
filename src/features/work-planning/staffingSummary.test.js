import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getStaffingSummary, planWorkerNames } from './staffingSummary.js';

const workers = [{ id: 'raz', full_name: 'רז ינאי' }, { id: 'idan', full_name: 'עידן שטיינברג' }];

test('counts a worker once across leader, assistant and follow-up tasks, including registered name aliases', () => {
  const rows = [{ leader: 'רז', helpers: 'עידן שטיינברג' }, { leader: 'רז ינאי', helpers: 'עידן' }];
  const summary = getStaffingSummary(rows, ['רז', 'עידן'], workers);
  assert.equal(summary.uniqueCount, 2);
  assert.equal(summary.total, 2);
  assert.equal(summary.assigned, 2);
  assert.equal(summary.complete, true);
});

test('splits multiple names in one cell and preserves original name spelling', () => {
  const rows = [{ leader: 'נמרוד, אושר, אופק', helpers: 'עוזר א; עוזר ב\nעוזר ג' }];
  assert.deepEqual(planWorkerNames(rows), ['נמרוד', 'אושר', 'אופק', 'עוזר א', 'עוזר ב', 'עוזר ג']);
  assert.equal(getStaffingSummary([...rows, ...rows], planWorkerNames(rows)).uniqueCount, 6);
});

test('removing an employee from the plan does not shrink the comparison roster', () => {
  const roster = ['רז', 'עידן'];
  const summary = getStaffingSummary([{ leader: 'רז' }], roster, workers);
  assert.equal(summary.total, 2);
  assert.equal(summary.assigned, 1);
  assert.deepEqual(summary.missing.map((entry) => entry.name), ['עידן']);
  assert.equal(summary.complete, false);
  assert.equal(getStaffingSummary([], roster, workers).missing.length, 2);
});

test('counts absence rows and reports additional workers without covering a missing employee', () => {
  const rows = [{ leader: 'רז', work: 'חופש' }, { leader: 'עובד נוסף' }];
  const summary = getStaffingSummary(rows, ['רז', 'עידן'], workers);
  assert.equal(summary.uniqueCount, 2);
  assert.equal(summary.assigned, 1);
  assert.deepEqual(summary.additional.map((entry) => entry.name), ['עובד נוסף']);
});

test('ambiguous first names are flagged instead of being merged with different workers', () => {
  const directory = [{ id: 'bar1', full_name: 'בר חדידא' }, { id: 'bar2', full_name: 'בר מרחב' }];
  const summary = getStaffingSummary([{ leader: 'בר', helpers: 'בר חדידא, בר מרחב' }], ['בר'], directory);
  assert.equal(summary.uniqueCount, 3);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.review.map((entry) => entry.name), ['בר']);
  assert.equal(getStaffingSummary([{ leader: 'בר חדידא', helpers: 'בר מרחב' }], directory.map((worker) => worker.full_name), directory).uniqueCount, 2);
});

test('the original workbook roster has 28 unique names from the two worker columns', () => {
  const workbook = JSON.parse(readFileSync(new URL('./october-20-work-plan.json', import.meta.url), 'utf8'));
  const roster = planWorkerNames(workbook.rows);
  const summary = getStaffingSummary(workbook.rows, roster);
  assert.equal(summary.uniqueCount, 28);
  assert.equal(summary.total, 28);
  assert.equal(summary.complete, true);
  assert.ok(!roster.includes('בוריס'));
});

test('choosing one explicit full name clarifies an ambiguous short name from the source roster', () => {
  const directory = [{ id: 'bar1', full_name: 'בר חדידא' }, { id: 'bar2', full_name: 'בר מרחב' }];
  const clarified = getStaffingSummary([{ leader: 'בר חדידא' }], ['בר'], directory);
  assert.equal(clarified.complete, true);
  assert.equal(clarified.uniqueCount, 1);
  assert.equal(clarified.review.length, 0);
  const twoPeople = getStaffingSummary([{ leader: 'בר חדידא', helpers: 'בר מרחב' }], ['בר'], directory);
  assert.equal(twoPeople.complete, false);
  assert.equal(twoPeople.uniqueCount, 2);
  assert.equal(twoPeople.review.length, 1);
  const separateRosterEntry = getStaffingSummary([{ leader: 'בר חדידא' }], ['בר', 'בר חדידא'], directory);
  assert.equal(separateRosterEntry.total, 2);
  assert.equal(separateRosterEntry.complete, false);
});
