import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('./maya-sheets.html', import.meta.url), 'utf8');
const geometry = html.slice(html.indexOf('function shaftGeom('), html.indexOf('function isBezeq('));
const drawing = html.slice(html.indexOf('function shaftText(){'), html.indexOf('// ---------- PDF ----------'));
function render(draft) {
  const arcs = [], labels = [], rotations = [];
  const context = new Proxy({
    measureText: (value) => ({ width: String(value).length * 4 }),
    arc: (x, y, r) => arcs.push({ x, y, r }),
    fillText: (value) => labels.push(value),
    rotate: (value) => rotations.push(value),
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  const canvas = { dataset: {}, getContext: () => context };
  runInNewContext(`${geometry}\n${drawing}\ndraw(canvas,2);`, {
    S: { shape: 'round', coverShape: 'round', shaft: [], cover: [], groups: [], ...draft },
    W: 842, H: 595, SERIF: 'serif', SHAFT: ['יציקה'], COVER: ['ברזל'], logoImg: {}, canvas,
  });
  return { arcs, labels, rotations, canvas };
}
test('drawing completes the full sheet with north rotation before central geometry', () => {
  for (const angle of ['0', '90', '270']) {
    const drawing = render({ northAngle: angle });
    assert.ok(drawing.rotations.some((value) => Math.abs(value - Number(angle) * Math.PI / 180) < 1e-10));
    assert.ok(drawing.arcs.some((arc) => arc.r === 90.5), 'central shaft must still be drawn');
  }
});
test('pipe distance switches between the named adjacent walls, preserving measured face width', () => {
  const draft = { shape: 'rect', len: '2', wid: '1', depth: '1', faceWidths: { 1: '1.5' }, groups: [{ wall: '1', rows: '1', cols: '1', u: '0.2', v: '0.2', cables: [] }] };
  const start = render(draft);
  const end = render({ ...draft, groups: [{ ...draft.groups[0], measureFrom: 'end' }] });
  const pipe = (result) => result.arcs.find((arc) => arc.r > 4 && arc.r < 10);
  assert.ok(pipe(end).x > pipe(start).x);
  assert.ok(start.labels.some((label) => String(label).includes('קיר 4')));
  assert.ok(end.labels.some((label) => String(label).includes('קיר 2')));
  assert.ok(end.labels.includes('רוחב פאה 1: 1.5'));
  assert.equal(JSON.parse(end.canvas.dataset.liveWalls)[0].width, 1.5);
});
