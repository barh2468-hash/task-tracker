import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planImageLayout, wrapImageText } from './planImage.js';
import { createPlanRow, planColumns } from './localPlans.js';
const workbook = JSON.parse(readFileSync(new URL('./october-20-work-plan.json', import.meta.url), 'utf8'));

const measure = (value) => Array.from(value).length * 11;
const labels = Object.fromEntries(planColumns.map((key) => [key, key]));
test('long unbroken contact details and manual line breaks are preserved without clipping', () => {
  const value = 'https://example.com/' + 'x'.repeat(140) + '\nפגישה בשטח בבוקר';
  const lines = wrapImageText(value, 140, measure);
  assert.ok(lines.every((line) => measure(line) <= 140));
  assert.equal(lines.join('').replace(/\s/g, ''), value.replace(/\s/g, ''));
});

test('the full workbook fits the canvas bounds, including the final task and merged solo crews', () => {
  const layout = planImageLayout({ rows: workbook.rows, labels, rtl: true, measure });
  assert.equal(layout.cells.filter((cell) => cell.column === 'work').length, workbook.rows.length);
  assert.ok(layout.cells.some((cell) => cell.row === workbook.rows.length - 1));
  const solo = layout.cells.find((cell) => cell.column === 'leader' && cell.text === 'עידן');
  assert.equal(solo.span, 3);
  assert.equal(solo.width, 360);
  for (const cell of layout.cells) {
    assert.ok(cell.x >= 0 && cell.x + cell.width <= layout.width);
    assert.ok(cell.y >= 0 && cell.y + cell.height <= layout.bodyHeight);
    assert.ok(cell.lines.length * 28 + 24 <= cell.height);
    assert.ok(cell.lines.every((line) => measure(line) <= cell.width - 24));
  }
});

test('RTL and LTR keep their column order and a long assistant list expands its merged group', () => {
  const rows = [createPlanRow({ leader: 'Leader', helpers: 'Assistant '.repeat(45) }), createPlanRow({ leader: 'Leader', helpers: 'Assistant '.repeat(45) })];
  const rtl = planImageLayout({ rows, labels, rtl: true, measure });
  const ltr = planImageLayout({ rows, labels, rtl: false, measure });
  assert.equal(rtl.headers[0].x, 1830);
  assert.equal(ltr.headers[0].x, 0);
  const helpers = rtl.cells.find((cell) => cell.column === 'helpers');
  assert.equal(helpers.span, 2);
  assert.ok(helpers.height >= helpers.lines.length * 28 + 24);
});
