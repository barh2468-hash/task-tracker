import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as authApi from '../features/auth/api.js';
import { t } from '../features/language/LanguageContext.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { LoadingScreen } from './LoginPage.jsx';

export default function ResetPasswordPage() {
  useTranslation();
  const { session, authLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [message, setMessage] = useState('');

  if (authLoading) return <LoadingScreen />;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (password.length < 8) {
      setMessage(t('הסיסמה החדשה חייבת להכיל לפחות 8 תווים.'));
      return;
    }
    if (password !== confirmation) {
      setMessage(t('הסיסמאות אינן תואמות.'));
      return;
    }
    if (busy) return;

    setBusy(true);
    try {
      const { error } = await authApi.updatePassword(password);
      if (error) throw error;
      setUpdated(true);
      setPassword('');
      setConfirmation('');
    } catch {
      setMessage(t('לא ניתן לעדכן את הסיסמה. בקש קישור איפוס חדש ונסה שוב.'));
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="login loginScreen">
        <section className="card">
          <img src="/logo.png" alt={t('לוגו')} />
          <h1>{t('קישור לא תקין או שפג תוקפו')}</h1>
          <p className="muted">
            {t('כדי לשנות סיסמה יש לבקש קישור איפוס חדש ממסך ההתחברות.')}
          </p>
          <div className="authActions">
            <Link className="authPrimaryLink" to="/forgot-password">
              {t('בקשת קישור חדש')}
            </Link>
            <Link className="authTextLink" to="/login">
              {t('חזרה להתחברות')}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login loginScreen">
      <section className="card">
        <img src="/logo.png" alt={t('לוגו')} />
        <h1>{t('בחירת סיסמה חדשה')}</h1>
        {updated ? (
          <div className="form authResult" aria-live="polite">
            <p className="authMessage success">{t('הסיסמה עודכנה בהצלחה.')}</p>
            <Link className="authPrimaryLink" to="/app">
              {t('המשך למערכת')}
            </Link>
          </div>
        ) : (
          <form className="form" style={{ marginTop: 22 }} onSubmit={handleSubmit}>
            <p className="muted">{t('בחר סיסמה חדשה שאינה משמשת אותך בשירותים אחרים.')}</p>
            <label>
              {t('סיסמה חדשה')}
              <span className="loginPasswordField">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  placeholder={t('לפחות 8 תווים')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="loginPasswordToggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? t('הסתרת הסיסמה') : t('הצגת הסיסמה')}
                  title={showPassword ? t('הסתרת הסיסמה') : t('הצגת הסיסמה')}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </span>
            </label>
            <label>
              {t('אימות סיסמה חדשה')}
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                required
                placeholder={t('הקלד שוב את הסיסמה')}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="loginSubmit"
              disabled={busy || !password || !confirmation}
            >
              {busy ? t('מעדכן…') : t('עדכון סיסמה')}
            </button>
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
