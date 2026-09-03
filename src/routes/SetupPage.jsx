import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
export default function SetupPage() {
  useTranslation();
  return (
    <main className="login">
      <section className="card">
        <img src="/logo.png" alt={t('לוגו')} />
        <h1>{t('נדרש חיבור Supabase')}</h1>
        <p className="muted">
          {t('צור קובץ')}
          <b>.env.local</b>
          {t('בתיקיית הפרויקט והוסף את הפרטים מ-Supabase:')}
        </p>
        <pre className="setupCode">
          VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co{'\n'}
          VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
        </pre>
      </section>
    </main>
  );
}
