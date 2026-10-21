import { planColumns } from './localPlans.js';
import { getWorkerCellGroups } from './rowGroups.js';

const widths = [170, 190, 560, 145, 255, 260, 320, 100];
const padding = 12;
const lineHeight = 28;
const font = '20px Arial, sans-serif';

// Background directory refreshes replace objects even when the visible plan is unchanged.
export function planImageInputKey({ rows, workers = [], labels, title, footer, rtl }) {
  return JSON.stringify({
    rows: rows.map((row) => Object.fromEntries(planColumns.map((column) => [column, row[column]]))),
    workers: workers.map(({ id, full_name }) => ({ id, full_name })),
    labels, title, footer, rtl,
  });
}

export function wrapImageText(text, width, measure) {
  const lines = [];
  for (const paragraph of String(text || '').replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function planImageLayout({ rows, workers = [], labels, rtl, measure, measureHeader = measure }) {
  const width = widths.reduce((sum, value) => sum + value, 0);
  const groups = getWorkerCellGroups(rows, workers);
  const cells = [];
  const heights = rows.map(() => 46);
  const headers = planColumns.map((column, index) => ({ column, width: widths[index], lines: wrapImageText(labels[column], widths[index] - padding * 2, measureHeader) }));
  const headerHeight = Math.max(...headers.map((header) => header.lines.length * lineHeight + padding * 2));
  rows.forEach((row, index) => {
    planColumns.forEach((column, columnIndex) => {
      const group = groups[index][column];
      if (group && group.start !== index) return;
      if (column === 'helpers' && group.solo) return;
      const cellWidth = widths[columnIndex] + (column === 'leader' && group.solo ? widths[1] : 0);
      const lines = wrapImageText(row[column], cellWidth - padding * 2, measure);
      const span = group?.span || 1;
      cells.push({ column, row: index, span, width: cellWidth, lines, text: row[column] });
      if (span === 1) heights[index] = Math.max(heights[index], lines.length * lineHeight + padding * 2);
    });
  });
  for (const cell of cells.filter((cell) => cell.span > 1)) {
    const available = heights.slice(cell.row, cell.row + cell.span).reduce((sum, height) => sum + height, 0);
    heights[cell.row + cell.span - 1] += Math.max(0, cell.lines.length * lineHeight + padding * 2 - available);
  }
  const positions = [0];
  heights.forEach((height) => positions.push(positions.at(-1) + height));
  const xForColumn = (column) => {
    const before = widths.slice(0, planColumns.indexOf(column)).reduce((sum, value) => sum + value, 0);
    return rtl ? width - before - widths[planColumns.indexOf(column)] : before;
  };
  return {
    width, headerHeight, bodyHeight: positions.at(-1),
    headers: headers.map((header) => ({ ...header, x: xForColumn(header.column) })),
    cells: cells.map((cell) => ({ ...cell,
      x: xForColumn(cell.column) - (rtl && cell.width !== widths[planColumns.indexOf(cell.column)] ? widths[1] : 0),
      y: positions[cell.row], height: positions[cell.row + cell.span] - positions[cell.row],
    })),
  };
}

function textDirection(text, rtl) {
  const first = String(text).match(/[A-Za-z\u0370-\u03ff\u0590-\u08ff]/)?.[0];
  return first ? /[\u0590-\u08ff]/.test(first) ? 'rtl' : 'ltr' : rtl ? 'rtl' : 'ltr';
}

export async function renderPlanImage({ rows, workers, labels, title, footer, rtl }) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.font = font;
  const layout = planImageLayout({ rows, workers, labels, rtl,
    measure: (value) => { context.font = font; return context.measureText(value).width; },
    measureHeader: (value) => { context.font = `bold ${font}`; return context.measureText(value).width; },
  });
  const titleHeight = 68;
  const footerHeight = 44;
  const height = titleHeight + layout.headerHeight + layout.bodyHeight + footerHeight;
  const scale = Math.min(1.5, Math.sqrt(16000000 / (layout.width * height)), 16000 / height);
  if (scale < 1) throw new Error('size');
  canvas.width = Math.ceil(layout.width * scale);
  canvas.height = Math.ceil(height * scale);
  context.scale(scale, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, layout.width, height);
  context.textBaseline = 'middle';
  context.lineWidth = 1;

  function text(lines, x, y, width, cellHeight, { center = false, bold = false, direction } = {}) {
    context.font = bold ? `bold ${font}` : font;
    context.fillStyle = '#20364f';
    context.direction = direction || (rtl ? 'rtl' : 'ltr');
    context.textAlign = center ? 'center' : context.direction === 'rtl' ? 'right' : 'left';
    const anchor = center ? x + width / 2 : context.direction === 'rtl' ? x + width - padding : x + padding;
    const top = y + (cellHeight - lines.length * lineHeight) / 2 + lineHeight / 2;
    lines.forEach((line, index) => context.fillText(line, anchor, top + index * lineHeight));
  }

  context.fillStyle = '#f9cb9c';
  context.fillRect(0, 0, layout.width, titleHeight);
  text([title], 0, 0, layout.width, titleHeight, { center: true, bold: true });
  for (const header of layout.headers) {
    context.fillStyle = '#c8dcf0';
    context.fillRect(header.x, titleHeight, header.width, layout.headerHeight);
    context.strokeStyle = '#afc3d7';
    context.strokeRect(header.x + 0.5, titleHeight + 0.5, header.width - 1, layout.headerHeight - 1);
    text(header.lines, header.x, titleHeight, header.width, layout.headerHeight, { center: true, bold: true });
  }
  for (const cell of layout.cells) {
    const top = titleHeight + layout.headerHeight + cell.y;
    context.strokeStyle = '#c4d2e0';
    context.strokeRect(cell.x + 0.5, top + 0.5, cell.width - 1, cell.height - 1);
    text(cell.lines, cell.x, top, cell.width, cell.height, {
      center: ['leader', 'helpers', 'start', 'vehicle'].includes(cell.column), direction: textDirection(cell.text, rtl),
    });
  }
  text([footer], 0, height - footerHeight, layout.width, footerHeight, { center: true });
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('encode')), 'image/png'));
  return { blob, width: layout.width, height };
}
