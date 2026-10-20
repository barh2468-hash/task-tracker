// Reads the monthly Delek (חברת הדלק הישראלית) summary PDF.
//
// Layout it relies on (stable across months):
//  - page 1: "סה"כ לחיוב" and the bank charge date ("בתאריך dd/mm/yy")
//  - page 2: "דוח ריכוז חודשי מספר <invoice>"
//  - last pages: "דוח ריכוז רכבים לפי מחלקות" — one row per vehicle

const PLATE_PATTERN = /\b\d{2,3}-\d{2,3}-\d{2,3}\b/;
const DECIMAL_PATTERN = /^-?\d{1,3}(?:,\d{3})*\.\d{2}$|^-?\d+\.\d{2}$/;

export function toCents(text) {
  return Math.round(Number(String(text).replace(/,/g, '')) * 100);
}

/** pdf.js text items -> one string-token array per visual line, per page. */
export async function extractPdfLines(file) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    const byY = new Map();
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: item.transform[4], text: item.str.trim() });
    }
    pages.push(
      [...byY.keys()]
        .sort((a, b) => b - a)
        .map((y) => byY.get(y).sort((a, b) => a.x - b.x).map((item) => item.text)),
    );
  }
  return pages;
}

function decimals(tokens) {
  return tokens.filter((token) => DECIMAL_PATTERN.test(token)).map(toCents);
}

/** pages: string[][][] (page -> line -> tokens). Throws a Hebrew message if the layout is not recognised. */
export function parseDelekPages(pages) {
  const lines = pages.flatMap((page, pageIndex) => page.map((tokens) => ({ pageIndex, tokens, text: tokens.join(' ') })));

  const dueLine = lines.find((line) => line.text.includes('סה"כ לחיוב'));
  const totalDueCents = dueLine ? decimals(dueLine.tokens)[0] : null;

  const chargeMatch = lines.map((line) => line.text.match(/בתאריך\s+(\d{2})\/(\d{2})\/(\d{2})\b/)).find(Boolean);
  const chargeDate = chargeMatch ? { year: 2000 + Number(chargeMatch[3]), month: Number(chargeMatch[2]), day: Number(chargeMatch[1]) } : null;

  const invoiceMatch = lines.map((line) => (line.text.includes('ריכוז חודשי') ? line.text.match(/מספר\s+(\d{5,})/) : null)).find(Boolean);
  const invoiceNumber = invoiceMatch ? invoiceMatch[1] : null;

  const payLine = lines.find((line) => line.text.includes('סה"כ לתשלום'));
  const pageTwoTotalCents = payLine ? decimals(payLine.tokens)[0] : null;

  const tablePages = new Set(
    lines.filter((line) => line.text.includes('ריכוז רכבים לפי מחלקות')).map((line) => line.pageIndex),
  );
  const tableLines = lines.filter((line) => tablePages.has(line.pageIndex));
  const titleLine = tableLines.find((line) => line.text.includes('ריכוז רכבים לפי מחלקות'));
  const monthMatch = titleLine ? titleLine.text.match(/(\d{2})\/(\d{4})/) : null;
  const period = monthMatch ? { month: Number(monthMatch[1]), year: Number(monthMatch[2]) } : null;

  const vehicles = [];
  for (const line of tableLines) {
    const plateMatch = line.text.match(PLATE_PATTERN);
    const nums = decimals(line.tokens);
    if (!plateMatch || nums.length < 6) continue;
    vehicles.push({
      plate: plateMatch[0],
      plateDigits: plateMatch[0].replace(/\D/g, ''),
      exVatCents: nums[1],
      inclVatCents: nums[nums.length - 3],
      liters: nums[nums.length - 1] / 100,
    });
  }

  const missing = [];
  if (totalDueCents === null) missing.push('סה"כ לחיוב');
  if (!chargeDate) missing.push('תאריך החיוב');
  if (!invoiceNumber) missing.push('מספר חשבונית הריכוז');
  if (!period) missing.push('חודש הדוח');
  if (!vehicles.length) missing.push('טבלת ריכוז רכבים לפי מחלקות');
  if (missing.length) throw new Error(`הקובץ לא זוהה כדוח ריכוז של דלק — לא נמצא: ${missing.join(', ')}.`);

  return { totalDueCents, pageTwoTotalCents, chargeDate, invoiceNumber, period, vehicles };
}
