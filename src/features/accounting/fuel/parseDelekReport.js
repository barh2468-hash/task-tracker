// Reads the monthly Delek (חברת הדלק הישראלית) summary PDF.
//
// Layout it relies on (stable across months):
//  - page 1: "סה"כ לחיוב" and the bank charge date ("בתאריך dd/mm/yy")
//  - page 2: "דוח ריכוז חודשי מספר <invoice>"
//  - last pages: "דוח ריכוז רכבים לפי מחלקות" — one row per vehicle
//  - months with car washes: a separate Shtipomat tax invoice on page 1
//    ("חשבונית מס מספר") and a "דוח רחיצות שטיפומט" page. Page 1's "סה"כ
//    לחיוב" is fuel + that invoice, so the fuel total is page 2's "סה"כ לתשלום".

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

const WASH_REF_PATTERN = /^\d{7,9}$/;

/**
 * Shtipomat car-wash invoice (page 1) + wash report. Returns null for a month
 * without washes; throws if only one of the two parts is present.
 */
function parseWash(lines) {
  const invoiceMatch = lines.map((line) => line.text.match(/חשבונית מס מספר:?\s*(\d{5,})/)).find(Boolean);
  const titleLine = lines.find((line) => line.text.includes('דוח רחיצות שטיפומט'));
  if (!invoiceMatch && !titleLine) return null;
  if (!invoiceMatch || !titleLine) {
    throw new Error('נמצא רק חלק מנתוני השטיפות (חשבונית שטיפומט או דוח רחיצות). יש להעלות את הדוח המלא.');
  }

  const firstDecimal = (predicate) => {
    const line = lines.find(predicate);
    return line ? decimals(line.tokens)[0] ?? null : null;
  };
  const taxableCents = firstDecimal((l) => l.text.includes('סה"כ חייב במע"מ'));
  const exemptCents = firstDecimal((l) => l.text.includes('סה"כ פטור ממע"מ')) ?? 0;
  const vatCents = firstDecimal((l) => l.text.includes('..........') && l.text.includes('מע"מ') && !l.text.includes('סה"כ'));
  const invoiceTotalCents = firstDecimal((l) => l.text.includes('סה"כ חשבונית'));

  const rows = [];
  let reportTotalCents = null;
  let reportCount = null;
  for (const line of lines.filter((l) => l.pageIndex >= titleLine.pageIndex)) {
    const plateMatch = line.text.match(PLATE_PATTERN);
    const nums = decimals(line.tokens);
    if (plateMatch && nums.length >= 1 && line.tokens.some((token) => WASH_REF_PATTERN.test(token))) {
      rows.push({ plate: plateMatch[0], plateDigits: plateMatch[0].replace(/\D/g, ''), exVatCents: nums[0] });
    } else if (line.text.includes('רחיצות') && /סה"כ:/.test(line.text) && !plateMatch && nums.length) {
      reportTotalCents = nums[0];
      const count = line.tokens.find((token) => /^\d{1,4}$/.test(token));
      reportCount = count ? Number(count) : null;
    }
  }

  const missing = [];
  if (taxableCents === null) missing.push('סה"כ חייב במע"מ');
  if (vatCents === null) missing.push('מע"מ');
  if (invoiceTotalCents === null) missing.push('סה"כ חשבונית');
  if (reportTotalCents === null) missing.push('סה"כ דוח רחיצות');
  if (!rows.length) missing.push('שורות רחיצה');
  if (missing.length) throw new Error(`לא ניתן לקרוא את נתוני השטיפות — לא נמצא: ${missing.join(', ')}.`);

  return { invoiceNumber: invoiceMatch[1], taxableCents, exemptCents, vatCents, invoiceTotalCents, reportTotalCents, reportCount, rows };
}

/** pages: string[][][] (page -> line -> tokens). Throws a Hebrew message if the layout is not recognised. */
export function parseDelekPages(pages) {
  const lines = pages.flatMap((page, pageIndex) => page.map((tokens) => ({ pageIndex, tokens, text: tokens.join(' ') })));

  const dueLine = lines.find((line) => line.text.includes('סה"כ לחיוב'));
  const chargeTotalCents = dueLine ? decimals(dueLine.tokens)[0] : null;

  const chargeMatch = lines.map((line) => line.text.match(/בתאריך\s+(\d{2})\/(\d{2})\/(\d{2})\b/)).find(Boolean);
  const chargeDate = chargeMatch ? { year: 2000 + Number(chargeMatch[3]), month: Number(chargeMatch[2]), day: Number(chargeMatch[1]) } : null;

  const invoiceMatch = lines.map((line) => (line.text.includes('ריכוז חודשי') ? line.text.match(/מספר\s+(\d{5,})/) : null)).find(Boolean);
  const invoiceNumber = invoiceMatch ? invoiceMatch[1] : null;

  const payLine = lines.find((line) => line.text.includes('סה"כ לתשלום'));
  const pageTwoTotalCents = payLine ? decimals(payLine.tokens)[0] : null;
  const fuelTotalCents = pageTwoTotalCents ?? chargeTotalCents;

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

  const wash = parseWash(lines);

  const missing = [];
  if (chargeTotalCents === null) missing.push('סה"כ לחיוב');
  if (!chargeDate) missing.push('תאריך החיוב');
  if (!invoiceNumber) missing.push('מספר חשבונית הריכוז');
  if (!period) missing.push('חודש הדוח');
  if (!vehicles.length) missing.push('טבלת ריכוז רכבים לפי מחלקות');
  if (missing.length) throw new Error(`הקובץ לא זוהה כדוח ריכוז של דלק — לא נמצא: ${missing.join(', ')}.`);

  return { chargeTotalCents, fuelTotalCents, chargeDate, invoiceNumber, period, vehicles, wash };
}
