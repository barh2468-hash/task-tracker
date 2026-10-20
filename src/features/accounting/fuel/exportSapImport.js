// SAP "journal entry from Excel" import: one H row, then L rows. SAP accepts
// ONE header record per file, so every journal entry is its own file.
// Columns A..R as in the supplier's sample (no header row in the import file).

const COLUMNS = 18;
const HEADERS_EN = ['Record Type', 'Series', 'Posting Date', 'Due Date', 'Document Date', 'Remarks', 'Indicator Code', 'Project Code', 'Transaction Code', 'Reference 1', 'Reference 2', 'Reference 3', 'VAT Date', 'Account Type', 'Account Code/BP Code', 'Debit Amount', 'Credit Amount', 'Row Details'];

const amount = (cents) => (cents / 100).toFixed(2);

export function entriesToRows(entries) {
  const rows = [];
  for (const entry of entries) {
    const h = new Array(COLUMNS).fill('');
    h[0] = 'H';
    h[2] = entry.posting;
    h[3] = entry.due;
    h[4] = entry.document;
    h[5] = entry.remarks;
    h[10] = entry.ref2;
    h[12] = entry.vat;
    rows.push(h);
    for (const line of entry.lines) {
      const l = new Array(COLUMNS).fill('');
      l[0] = 'L';
      l[13] = line.type;
      l[14] = line.code;
      if (line.debit !== undefined) l[15] = amount(line.debit);
      if (line.credit !== undefined) l[16] = amount(line.credit);
      rows.push(l);
    }
  }
  return rows;
}

/** Excel's "Unicode Text": UTF-16 LE with BOM, tab separated, CRLF. */
export function rowsToUnicodeText(rows) {
  const text = `${rows.map((row) => row.join('\t')).join('\r\n')}\r\n`;
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[3 + i * 2] = code >> 8;
  }
  return bytes;
}

export async function rowsToXlsxBytes(rows) {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default || xlsxModule;
  const toTextSheet = (aoa) => {
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    // Every cell as text so dates and account codes are never coerced.
    Object.keys(sheet).forEach((key) => {
      if (key[0] === '!') return;
      sheet[key] = { t: 's', v: String(sheet[key].v) };
    });
    return sheet;
  };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, toTextSheet(rows), 'לייבוא');
  XLSX.utils.book_append_sheet(book, toTextSheet([HEADERS_EN, ...rows]), 'עם כותרות');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
}

export function downloadBytes(bytes, fileName, mime) {
  const url = URL.createObjectURL(bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal uncompressed ZIP. files: [{ name (ASCII), bytes }] */
export function makeZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.bytes.length, true);
    local.setUint32(22, file.bytes.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, file.bytes);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, file.bytes.length, true);
    entry.setUint32(24, file.bytes.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + file.bytes.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
