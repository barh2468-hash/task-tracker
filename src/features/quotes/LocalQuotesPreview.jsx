import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import QuotesWorkspace from './QuotesWorkspace.jsx';
import { useMemo } from 'react';
import { createConnectionPreview } from './connectionPreview.js';

export default function LocalQuotesPreview() {
  useTranslation();
  const { language, setLanguage } = useLanguage();
  const mode = new URLSearchParams(window.location.search).get('connection-preview');
  const remote = useMemo(
    () => (mode ? createConnectionPreview(mode === 'connected') : undefined),
    [mode],
  );
  return (
    <main className="quotesPreview">
      <header className="quotesPreviewHeader">
        <div className="quotesPreviewBrand">
          <img src="/logo-transparent.png" alt={t('קבוצת מאיה')} />
          <div>
            <strong>{t('קבוצת מאיה')}</strong>
            <p>{t('quotes.local')}</p>
          </div>
        </div>
        <label>
          {t('quotes.language')}
          <select
            aria-label={t('quotes.language')}
            value={language}
            onChange={(event) => void setLanguage(event.target.value)}
          >
            {['he', 'en', 'el', 'pt'].map((code) => (
              <option key={code} value={code} lang={code}>
                {t(`languageName.${code}`)}
              </option>
            ))}
          </select>
        </label>
      </header>
      {mode && <p className="quotesLocalNotice">{t('quotes.sampleHelp')}</p>}
      <QuotesWorkspace scope="preview" preview defaultOwner="Peleg" remote={remote} />
    </main>
  );
}
