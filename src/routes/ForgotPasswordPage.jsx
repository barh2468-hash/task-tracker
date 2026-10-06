import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import * as authApi from '../features/auth/api.js';
import { t } from '../features/language/LanguageContext.jsx';

export default function ForgotPasswordPage() {
  useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || busy) return;

    setBusy(true);
    setMessage('');

    try {
      const redirectTo = new URL('/reset-password', window.location.origin).toString();
      const { error } = await authApi.requestPasswordReset(normalizedEmail, redirectTo);
      if (error) throw error;
      setSent(true);
    } catch {
      setMessage(t('לא ניתן לשלוח כרגע את קישור האיפוס. נסה שוב מאוחר יותר.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login loginScreen">
      <section className="card">
        <img src="/logo.png" alt={t('לוגו')} />
        <h1>{t('איפוס סיסמה')}</h1>
        {sent ? (
          <div className="form authResult" aria-live="polite">
            <p className="authMessage success">
              {t('אם קיימת כתובת כזו במערכת, נשלח אליה קישור לאיפוס הסיסמה.')}
            </p>
            <p className="muted">
              {t('הקישור תקף לזמן מוגבל. כדאי לבדוק גם בתיקיית הספאם.')}
            </p>
            <button type="button" className="secondary" onClick={() => setSent(false)}>
              {t('שליחת קישור נוסף')}
            </button>
            <Link className="authTextLink" to="/login">
              {t('חזרה להתחברות')}
            </Link>
          </div>
        ) : (
          <form className="form" style={{ marginTop: 22 }} onSubmit={handleSubmit}>
            <p className="muted">
              {t('הזן את כתובת המייל שלך ונשלח אליה קישור מאובטח לבחירת סיסמה חדשה.')}
            </p>
            <label>
              {t('מייל ארגוני')}
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button type="submit" className="loginSubmit" disabled={busy || !email.trim()}>
              {busy ? t('שולח…') : t('שליחת קישור לאיפוס')}
            </button>
            <Link className="authTextLink" to="/login">
              {t('חזרה להתחברות')}
            </Link>
            {message && (
              <p className="authMessage error" role="alert">
                {message}
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
