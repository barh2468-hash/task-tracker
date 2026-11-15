import { useRef, useState } from 'react';
import { t } from '../language/LanguageContext.jsx';
import { importExampleRows, readImportFile } from './import.js';
import { downloadCsv } from './export.js';
import { FormActions } from './forms.jsx';

export default function ImportQuotes({ state, onImport, onClose, busy, formatNumber }) {
  const [rows, setRows] = useState([]),
    [reading, setReading] = useState(false),
    [error, setError] = useState(''),
    [source, setSource] = useState('sap');
  const generation = useRef(0);
  const [readDone, setReadDone] = useState(false);
  async function read(file) {
    const request = ++generation.current;
    setRows([]);
    setReadDone(false);
    setError('');
    if (!file) {
      setReading(false);
      return;
    }
    setReading(true);
    try {
      const result = await readImportFile(file, state);
      if (request === generation.current) {
        setRows(result);
        setReadDone(true);
      }
    } catch (error) {
      if (request === generation.current) setError(`quotes.error.${error.code || 'generic'}`);
    } finally {
      if (request === generation.current) setReading(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onImport(rows, source);
      }}
    >
      <p className="quotesMuted">{t('quotes.importHelp')}</p>
      <p className="quotesMuted">{t('quotes.importPreserve')}</p>
      <div className="quotesFormGrid">
        <label>
          {t('quotes.source')}
          <select
            aria-label={t('quotes.source')}
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="sap">{t('quotes.source.sap')}</option>
            <option value="excel">{t('quotes.source.excel')}</option>
          </select>
        </label>
        <label>
          {t('quotes.file')}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => void read(event.target.files?.[0])}
          />
        </label>
      </div>
      <button
        type="button"
        className="secondary"
        onClick={() => downloadCsv('quotation-import-example.csv', importExampleRows())}
      >
        {t('quotes.template')}
      </button>
      {reading && <p role="status">{t('quotes.reading')}</p>}
      {readDone && !rows.length && <p role="status">{t('quotes.importEmpty')}</p>}
      {error && (
        <p className="quotesError" role="alert">
          {t(error)}
        </p>
      )}
      {!!rows.length && (
        <div className="quotesImportRows">
          {rows.map((row) => (
            <article key={row.row}>
              <strong>
                {t('quotes.row')} {formatNumber(row.row)} · <bdi>{row.number}</bdi>
              </strong>
              <p dir="auto">
                {row.client} · {row.title}
              </p>
              <span className="quotesBadge">
                {t(row.existingId ? 'quotes.updateRow' : 'quotes.newRow')}
              </span>
              {row.warning && <p className="quotesWarning">{t(`quotes.${row.warning}`)}</p>}
              {row.error && <p className="quotesError">{t(`quotes.error.${row.error}`)}</p>}
            </article>
          ))}
        </div>
      )}
      <FormActions
        onClose={onClose}
        busy={busy || reading}
        submitDisabled={!rows.length || rows.some((row) => row.error)}
        label="quotes.confirmImport"
      />
    </form>
  );
}
