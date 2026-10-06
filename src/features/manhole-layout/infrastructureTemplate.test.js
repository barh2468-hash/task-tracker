import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('./maya-sheets.html', import.meta.url), 'utf8');
const templateFunction = html.match(/function applyInfrastructureTemplate\(draft,infra\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(templateFunction, 'The editor must define its infrastructure templates');
const applyTemplate = runInNewContext(`(${templateFunction})`);
const bezeqFunction = html.match(/function isBezeq\(draft=S\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(bezeqFunction);
const isBezeq = runInNewContext(`(${bezeqFunction})`);
const paintFunction = html.match(/function paintChips\(\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(paintFunction);

function paintDraft(draft) {
  const fields = new Map();
  const field = id => {
    if (!fields.has(id)) fields.set(id, { children: [], firstChild: {}, hidden: false });
    return fields.get(id);
  };
  field('coverShapeChips').children = ['round', 'rect', 'rect3'].map(k => ({ dataset: { k }, setAttribute() {} }));
  const context = { S: draft, $: field, lastBz: true, lastShapeForGroups: draft.shape, renderGroups() {}, renderWallChips() {} };
  runInNewContext(`${templateFunction}\n${bezeqFunction}\n${paintFunction}\npaintChips();`, context);
  return fields;
}

test('switching from a customized drainage or Bezeq template to sewage keeps entered data and chooses round geometry', () => {
  const draft = { infra: 'בזק', label: 'בזק', shape: 'rect', coverShape: 'rect3', projectId: 'project', num: '09', depth: '2.5', notes1: 'keep notes', groups: [{ cables: ['4'] }], walls: { square: ['0'] } };
  const groups = draft.groups;
  applyTemplate(draft, 'ביוב');
  assert.equal(draft.infra, 'ביוב'); assert.equal(draft.shape, 'round'); assert.equal(draft.coverShape, 'round');
  assert.equal(draft.projectId, 'project'); assert.equal(draft.num, '09'); assert.equal(draft.depth, '2.5'); assert.equal(draft.notes1, 'keep notes'); assert.equal(draft.groups, groups);
  assert.equal(isBezeq(draft), false);
});
test('repainting an old sewage draft with a Bezeq filename cannot restore rectangular geometry', () => {
  const draft = { infra: 'ביוב', label: 'בזק', shape: 'rect', coverShape: 'rect3', shaft: ['יציקה'], cover: ['ברזל'], depth: '2.5', groups: [] };
  const fields = paintDraft(draft);
  assert.equal(draft.shape, 'round'); assert.equal(draft.coverShape, 'round'); assert.equal(draft.label, 'בזק'); assert.equal(draft.depth, '2.5');
  assert.equal(fields.get('tplGrid').hidden, true); assert.equal(fields.get('shapeLbl').textContent, 'צורת השוחה: עגולה');
  assert.equal(fields.get('w-diam').hidden, false); assert.equal(fields.get('w-len').hidden, true);
  assert.equal(fields.get('coverShapeChips').children[0].hidden, false); assert.equal(fields.get('coverShapeChips').children[1].hidden, true);
  paintDraft(draft); assert.equal(draft.shape, 'round');
});
test('a Bezeq filename does not override drainage, while Bezeq infrastructure still selects its templates', () => {
  const draft = { infra: 'ניקוז', label: 'בזק', shape: 'square', coverShape: 'round', shaft: [], cover: [], groups: [] };
  const fields = paintDraft(draft);
  assert.equal(draft.shape, 'square'); assert.equal(draft.coverShape, 'round'); assert.equal(fields.get('tplGrid').hidden, true);
  assert.equal(isBezeq({ infra: 'בזק', label: 'ביוב' }), true);
  assert.equal(isBezeq({ infra: '', label: 'בזק' }), true);
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
