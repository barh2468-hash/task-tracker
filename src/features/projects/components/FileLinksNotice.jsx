import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';

export default function FileLinksNotice({ loading, error, retry }) {
  useTranslation();
  return error ? <div role="alert">
    <p>{t('recovery.filesFailed')}</p>
    <button type="button" className="ghost smallBtn" onClick={retry} disabled={loading}>
      {t('recovery.retry')}
    </button>
  </div> : loading ? <p role="status">{t('recovery.filesLoading')}</p> : null;
}
