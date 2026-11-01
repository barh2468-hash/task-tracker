import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';

export default function AppBrand() {
  useTranslation();
  return (
    <div className="brand">
      <img src="/logo.png" alt={t('לוגו')} />
      <div>
        <h1>{t('מערכת איתור תשתיות')}</h1>
        <p>{t('מעקב פרויקטים לעובדי שטח, שרטוט, GPR והיתרים')}</p>
      </div>
    </div>
  );
}
