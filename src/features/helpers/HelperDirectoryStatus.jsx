import { useTranslation } from 'react-i18next';
import { t } from '../language/LanguageContext.jsx';

export default function HelperDirectoryStatus({ directory }) {
  useTranslation();
  if (directory.loading) return <p className="muted" role="status">{t('helpers.loading')}</p>;
  if (directory.error) return <div role="alert"><p>{t('helpers.directoryError')}</p>
    <button type="button" className="ghost smallBtn" onClick={directory.reload}>{t('helpers.retry')}</button></div>;
  if (directory.cached) return <p className="muted" role="status">{t('helpers.cached')}</p>;
  if (!directory.helpers.length) return <p className="muted">{t('helpers.noActive')}</p>;
  return null;
}
