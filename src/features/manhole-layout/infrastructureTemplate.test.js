import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('./maya-sheets.html', import.meta.url), 'utf8');
const templateFunction = html.match(/function applyInfrastructureTemplate\(draft,infra\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(templateFunction, 'The editor must define its infrastructure templates');
const applyTemplate = runInNewContext(`(${templateFunction})`);

test('switching from a customized drainage or Bezeq template to sewage keeps entered data and chooses round geometry', () => {
  const draft = { infra: 'בזק', shape: 'rect', coverShape: 'rect3', projectId: 'project', num: '09', depth: '2.5', notes1: 'keep notes', groups: [{ cables: ['4'] }], walls: { square: ['0'] } };
  const groups = draft.groups;
  applyTemplate(draft, 'ביוב');
  assert.equal(draft.infra, 'ביוב'); assert.equal(draft.shape, 'round'); assert.equal(draft.coverShape, 'round');
  assert.equal(draft.projectId, 'project'); assert.equal(draft.num, '09'); assert.equal(draft.depth, '2.5'); assert.equal(draft.notes1, 'keep notes'); assert.equal(draft.groups, groups);
});
test('drainage restores all four square faces even when a saved square template had disabled faces', () => {
  const draft = { shape: 'round', coverShape: 'rect', walls: { square: [], rect: ['1'] }, len: '1.8' };
  applyTemplate(draft, 'ניקוז');
  assert.equal(draft.shape, 'square'); assert.equal(draft.coverShape, 'round'); assert.equal(draft.len, '1.8');
  assert.equal(JSON.stringify(draft.walls.square), '["0","1","2","3"]'); assert.deepEqual(draft.walls.rect, ['1']);
  draft.walls.square = []; applyTemplate(draft, 'ניקוז');
  assert.equal(JSON.stringify(draft.walls.square), '["0","1","2","3"]');
});
test('other infrastructures retain manual geometry and the chips call the template function', () => {
  const draft = { shape: 'square', coverShape: 'sq2' };
  applyTemplate(draft, 'מים');
  assert.equal(draft.shape, 'square'); assert.equal(draft.coverShape, 'sq2'); assert.equal(draft.infra, 'מים');
  assert.match(html, /if\(key==='infra'\)\{applyInfrastructureTemplate\(S,o\);renderGroups\(\);\}/);
});
