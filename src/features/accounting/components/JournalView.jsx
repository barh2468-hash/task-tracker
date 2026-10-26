import { useState } from 'react';
import { CheckCircle2, Download, XCircle } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { money } from '../fuel/journalCommon.js';
import { downloadBytes, entriesToRows, makeZip, rowsToUnicodeText, rowsToXlsxBytes } from '../fuel/exportSapImport.js';

const cellStyle = { padding: '8px 12px', borderBottom: '1px solid #e3ebf1', textAlign: 'right', fontSize: 13 };
const numStyle = { ...cellStyle, direction: 'ltr', fontVariantNumeric: 'tabular-nums' };

const JOURNAL_LABELS = {
  fuel: { heading: 'דלק', invoice: 'חשבונית ריכוז דלק', total: 'סה"כ ריכוז דלק', file: 'fuel' },
  wash: { heading: 'שטיפומט — שטיפות', invoice: 'חשבונית שטיפומט', total: 'סה"כ חשבונית שטיפומט', file: 'wash' },
  toll: { heading: 'כביש 6 — חשבונית מס', invoice: 'חשבונית מס', total: 'סה"כ כולל מע"מ', file: 'toll' },
};

// Several invoices of the same kind can be open at once (journal.fileTag keeps their files apart).
const fileTagOf = (journal) => (journal.fileTag ? `_${journal.fileTag}` : '');

function UnmappedRow({ vehicle, onSave }) {
  const [card, setCard] = useState('');
  return (
    <tr>
      <td style={cellStyle}>{vehicle.plate}</td>
      <td style={cellStyle}>
        <input
          value={card}
          onChange={(event) => setCard(event.target.value.replace(/\D/g, ''))}
          placeholder={t('קוד כרטיס')}
          style={{ width: 130 }}
          inputMode="numeric"
        />
      </td>
      <td style={cellStyle}>
        <button type="button" className="secondary" disabled={!card} onClick={() => onSave(vehicle.plateDigits, card)}>
          {t('שמירה')}
        </button>
      </td>
    </tr>
  );
}

// SAP accepts a single header record per file: one file per journal entry.
function fileBase(journal, entry, index) {
  const stamp = `${journal.period.year}-${String(journal.period.month).padStart(2, '0')}`;
  return `${JOURNAL_LABELS[journal.kind].file}${fileTagOf(journal)}_${String(index + 1).padStart(2, '0')}_step${entry.step}_${entry.key}_${stamp}`;
}

async function downloadEntry(journal, entry, index, format) {
  const rows = entriesToRows([entry]);
  const name = fileBase(journal, entry, index);
  if (format === 'txt') {
    downloadBytes(rowsToUnicodeText(rows), `${name}.txt`, 'text/plain;charset=utf-16le');
  } else {
    downloadBytes(await rowsToXlsxBytes(rows), `${name}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
}

function downloadZip(journal) {
  const files = journal.entries.map((entry, index) => ({
    name: `${fileBase(journal, entry, index)}.txt`,
    bytes: rowsToUnicodeText(entriesToRows([entry])),
  }));
  const stamp = `${journal.period.year}-${String(journal.period.month).padStart(2, '0')}`;
  downloadBytes(makeZip(files), `${JOURNAL_LABELS[journal.kind].file}${fileTagOf(journal)}-sap-import-${stamp}.zip`);
}

export default function JournalView({ journal, fileName, onSaveCard }) {
  const labels = JOURNAL_LABELS[journal.kind];
  return (
    <>
      <h3 style={{ margin: '8px 0 0' }}>{t(labels.heading)}</h3>

      <section className="equipmentMetrics" aria-label={t('סיכום הדוח')}>
        <div className="equipmentMetric blue">
          <div>
            <strong>{String(journal.period.month).padStart(2, '0')}/{journal.period.year}</strong>
            <span>{t('חודש הדוח')} · {fileName}</span>
          </div>
        </div>
        <div className="equipmentMetric teal">
          <div>
            <strong>{journal.invoiceNumber}</strong>
            <span>{t(labels.invoice)}</span>
          </div>
        </div>
        <div className="equipmentMetric purple">
          <div>
            <strong>{money(journal.totalCents)}</strong>
            <span>{t(labels.total)}</span>
          </div>
        </div>
        <div className="equipmentMetric orange">
          <div>
            <strong>{money(journal.gapCents)}</strong>
            <span>{t('פער מע"מ שנכנס לרכב האחרון')} ({journal.lastPlate})</span>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h4 style={{ marginTop: 0 }}>{t('בדיקות')}</h4>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {journal.checks.map((check) => (
            <li key={check.label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: check.ok ? '#087c66' : '#9f2920' }}>
              {check.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>{check.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {journal.unmappedPlates.length > 0 && (
        <section className="card" style={{ padding: 18 }}>
          <h4 style={{ marginTop: 0 }}>{t('רכבים ללא כרטיס — יש להזין קוד כרטיס')}</h4>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {journal.unmappedPlates.map((vehicle) => (
                <UnmappedRow key={vehicle.plateDigits} vehicle={vehicle} onSave={onSaveCard} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card" style={{ padding: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="equipmentExportButton" disabled={!journal.ok} onClick={() => downloadZip(journal)}>
          <Download size={16} /> {t('הורדת כל קבצי היבוא (ZIP)')} — {t(labels.heading)}
        </button>
        <small>{t('כל פקודה היא קובץ נפרד — סאפ מקבל כותרת אחת בלבד בכל קובץ. יש לייבא אותם בזה אחר זה.')}</small>
        {!journal.ok && <small>{t('אפשר להוריד רק כשכל הבדיקות עוברות.')}</small>}
      </section>

      {journal.entries.map((entry, index) => (
        <section className="card" key={entry.key} style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#edf4f8', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <span>
              <b>{index + 1}. {t('שלב')} {entry.step} · {entry.title}</b>
              <small style={{ display: 'block', color: '#52677d' }}>
                {t('אסמכתא')} 2: {entry.ref2}{entry.ref3 ? ` · ${t('אסמכתא')} 3 (${t('הקצאה')}): ${entry.ref3}` : ''} · {entry.remarks} · {entry.posting} → {entry.due}
              </small>
            </span>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button type="button" className="secondary" disabled={!journal.ok} onClick={() => downloadEntry(journal, entry, index, 'txt')}>TXT</button>
              <button type="button" className="secondary" disabled={!journal.ok} onClick={() => downloadEntry(journal, entry, index, 'xlsx')}>Excel</button>
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['סוג', 'קוד', 'חשבון', 'חובה', 'זכות'].map((head) => (
                    <th key={head} style={{ ...cellStyle, background: '#f8fbfd' }}>{t(head)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line, lineIndex) => (
                  <tr key={`${line.code}-${lineIndex}`}>
                    <td style={cellStyle}>{line.type}</td>
                    <td style={cellStyle}>{line.code || '—'}</td>
                    <td style={cellStyle}>{line.name}</td>
                    <td style={numStyle}>{line.debit !== undefined ? money(line.debit) : ''}</td>
                    <td style={numStyle}>{line.credit !== undefined ? money(line.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
