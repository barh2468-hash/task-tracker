import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';
import { useAuth } from '../auth/useAuth.js';
import { createManagedClientUser } from '../../services/api/edgeFunctions.js';
import { normalizeClientUsername } from '../../../supabase/functions/_shared/client-login.js';

export default function CreateClientUser({ onCreated }) {
  useTranslation();
  const { isAdmin } = useAuth();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const [credentials, setCredentials] = useState(null);
  if (!isAdmin) return null;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setErrorKey('');
    const normalized = normalizeClientUsername(username);
    if (!normalized) {
      setErrorKey('clientLogin.invalidUsername');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await createManagedClientUser(normalized);
      if (error) {
        let key;
        try {
          key = (await error.context?.json())?.error;
        } catch {
          /* Use a translated fallback. */
        }
        setErrorKey(
          ['clientLogin.invalidUsername', 'clientLogin.exists'].includes(key)
            ? key
            : 'clientLogin.createError',
        );
        return;
      }
      if (!data?.ok || !data.profile || !data.password) throw new Error('Invalid server response');
      setCredentials({ username: data.username, password: data.password });
      setUsername('');
      onCreated(data.profile);
    } catch {
      setErrorKey('clientLogin.createError');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="userManagementInvitePanel clientUserCreatePanel">
      <h3>
        <UserPlus size={20} aria-hidden="true" />
        {t('clientLogin.createTitle')}
      </h3>
      {credentials ? (
        <div className="clientUserCredentials" role="status">
          <h4>{t('clientLogin.created')}</h4>
          <dl>
            <dt>{t('clientLogin.username')}</dt>
            <dd>
              <code dir="ltr">{credentials.username}</code>
            </dd>
            <dt>{t('clientLogin.password')}</dt>
            <dd>
              <code dir="ltr">{credentials.password}</code>
            </dd>
          </dl>
          <p>{t('clientLogin.credentialsHelp')}</p>
          <button type="button" className="secondary" onClick={() => setCredentials(null)}>
            {t('clientLogin.closeCredentials')}
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="muted">{t('clientLogin.createHelp')}</p>
          <label>
            {t('clientLogin.username')}
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={48}
              required
              disabled={busy}
              aria-describedby="client-username-help"
            />
          </label>
          <p id="client-username-help" className="muted">
            {t('clientLogin.usernameHelp')}
          </p>
          {errorKey && <p role="alert">{t(errorKey)}</p>}
          <button type="submit" disabled={busy || !username.trim()}>
            <UserPlus size={17} aria-hidden="true" />
            {t(busy ? 'clientLogin.creating' : 'clientLogin.create')}
          </button>
        </form>
      )}
    </section>
  );
}
