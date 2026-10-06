import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  KeyRound,
  Mail,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/useAuth.js';
import { t } from '../features/language/LanguageContext.jsx';
import { useMessage } from '../context/MessageContext.jsx';
import {
  inviteManagedUser,
  listManagedUsers,
  sendManagedUserPasswordReset,
  setManagedUserStatus,
  updateManagedUser,
} from '../services/api/edgeFunctions.js';
import { roleLabel } from '../services/supabase.js';
import '../styles/user-management.css';

const roleOptions = Object.keys(roleLabel);
const emptyInvite = { fullName: '', email: '', role: 'field_worker' };
const accountStatusLabel = {
  active: 'פעיל',
  inactive: 'לא פעיל',
  invited: 'הוזמן',
};

function sortProfiles(rows) {
  return [...rows].sort((left, right) =>
    (left.full_name || left.email || '').localeCompare(right.full_name || right.email || '', 'he'),
  );
}

async function functionErrorMessage(error, fallback) {
  try {
    const payload = await error?.context?.json();
    if (payload?.error) return payload.error;
  } catch {
    // The generic SDK error below is still useful when no JSON body is available.
  }
  return error?.message || fallback;
}

export default function UserManagementPage() {
  useTranslation();
  const { isAdmin, profile: signedInProfile } = useAuth();
  const { setMessage } = useMessage();
  const [profiles, setProfiles] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState(emptyInvite);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    setLoading(true);
    listManagedUsers()
      .then(({ data, error: loadError }) => {
        if (loadError) throw loadError;
        if (!active) return;
        const rows = data?.profiles || [];
        setProfiles(sortProfiles(rows));
        setDrafts(Object.fromEntries(rows.map((profile) => [profile.id, {
          email: profile.email || '',
          role: profile.role,
        }])));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || t('טעינת המשתמשים נכשלה.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const filteredProfiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return profiles;
    return profiles.filter((profile) =>
      [
        profile.full_name,
        profile.email,
        roleLabel[profile.role],
        profile.role,
        accountStatusLabel[profile.account_status],
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalized)),
    );
  }, [profiles, query]);

  function startEditing(profile) {
    setDrafts((current) => ({
      ...current,
      [profile.id]: { email: profile.email || '', role: profile.role },
    }));
    setEditingId(profile.id);
    setError('');
  }

  function cancelEditing(profile) {
    setDrafts((current) => ({
      ...current,
      [profile.id]: { email: profile.email || '', role: profile.role },
    }));
    setEditingId('');
    setError('');
  }

  async function saveUser(event, profile) {
    event.preventDefault();
    const draft = drafts[profile.id] || {};
    const email = draft.email?.trim().toLocaleLowerCase('en-US') || '';
    const role = draft.role || profile.role;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('יש להזין כתובת דוא״ל תקינה.'));
      return;
    }
    if (!roleOptions.includes(role)) {
      setError(t('יש לבחור תפקיד תקין.'));
      return;
    }
    if (email === (profile.email || '').toLocaleLowerCase('en-US') && role === profile.role) {
      setEditingId('');
      return;
    }

    setBusyId(profile.id);
    setError('');
    try {
      const { data, error: updateError } = await updateManagedUser({
        userId: profile.id,
        email,
        role,
      });
      if (updateError) throw updateError;
      const updated = data?.profile;
      if (!updated) throw new Error(t('השרת לא החזיר את המשתמש המעודכן.'));
      setProfiles((current) => sortProfiles(
        current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
      ));
      setDrafts((current) => ({
        ...current,
        [updated.id]: { email: updated.email || email, role: updated.role || role },
      }));
      setEditingId('');
      setMessage(t('פרטי המשתמש עודכנו בהצלחה.'));
    } catch (updateError) {
      setError(await functionErrorMessage(updateError, t('עדכון המשתמש נכשל.')));
    } finally {
      setBusyId('');
    }
  }

  async function sendPasswordReset(profile) {
    setBusyId(profile.id);
    setError('');
    try {
      const redirectTo = new URL('/reset-password', window.location.origin).toString();
      const { error: resetError } = await sendManagedUserPasswordReset({
        userId: profile.id,
        redirectTo,
      });
      if (resetError) throw resetError;
      setMessage(t('קישור לאיפוס הסיסמה נשלח בהצלחה.'));
    } catch (resetError) {
      setError(await functionErrorMessage(resetError, t('שליחת קישור האיפוס נכשלה.')));
    } finally {
      setBusyId('');
    }
  }

  async function toggleUserStatus(profile) {
    const activating = profile.account_status === 'inactive';
    if (!activating && !window.confirm(t('להשבית את החשבון הזה? המשתמש לא יוכל להתחבר עד להפעלה מחדש.'))) {
      return;
    }

    setBusyId(profile.id);
    setError('');
    try {
      const { data, error: statusError } = await setManagedUserStatus({
        userId: profile.id,
        active: activating,
      });
      if (statusError) throw statusError;
      const accountStatus = data?.accountStatus;
      if (!accountStatusLabel[accountStatus]) {
        throw new Error(t('השרת לא החזיר את מצב החשבון המעודכן.'));
      }
      setProfiles((current) => current.map((row) =>
        row.id === profile.id ? { ...row, account_status: accountStatus } : row,
      ));
      setMessage(activating ? t('החשבון הופעל מחדש.') : t('החשבון הושבת.'));
    } catch (statusError) {
      setError(await functionErrorMessage(statusError, t('עדכון מצב החשבון נכשל.')));
    } finally {
      setBusyId('');
    }
  }

  async function submitInvite(event) {
    event.preventDefault();
    const email = inviteDraft.email.trim().toLocaleLowerCase('en-US');
    const fullName = inviteDraft.fullName.trim();
    if (!fullName) {
      setError(t('יש להזין שם מלא.'));
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('יש להזין כתובת דוא״ל תקינה.'));
      return;
    }

    setInviting(true);
    setError('');
    try {
      const redirectTo = new URL('/reset-password', window.location.origin).toString();
      const { data, error: inviteError } = await inviteManagedUser({
        email,
        fullName,
        role: inviteDraft.role,
        redirectTo,
      });
      if (inviteError) throw inviteError;
      const created = data?.profile;
      if (!created) throw new Error(t('השרת לא החזיר את המשתמש החדש.'));
      setProfiles((current) => sortProfiles([...current, created]));
      setDrafts((current) => ({
        ...current,
        [created.id]: { email: created.email || email, role: created.role },
      }));
      setInviteDraft(emptyInvite);
      setInviteOpen(false);
      setMessage(t('ההזמנה נשלחה והמשתמש נוסף לרשימה.'));
    } catch (inviteError) {
      setError(await functionErrorMessage(inviteError, t('שליחת ההזמנה נכשלה.')));
    } finally {
      setInviting(false);
    }
  }

  function closeInvite() {
    if (inviting) return;
    setInviteDraft(emptyInvite);
    setInviteOpen(false);
    setError('');
  }

  function updateDraft(userId, field, value) {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...current[userId], [field]: value },
    }));
  }

  function updateInvite(field, value) {
    setInviteDraft((current) => ({ ...current, [field]: value }));
  }

  if (!isAdmin) return <Navigate to="/app" replace />;

  return (
    <div className="userManagementPage">
      <section className="userManagementIntro">
        <span className="userManagementIntroIcon"><ShieldCheck size={26} aria-hidden="true" /></span>
        <div>
          <h2>{t('ניהול משתמשים')}</h2>
          <p>{t('מנהל ראשי יכול להזמין משתמשים, לעדכן כתובות דוא״ל ותפקידים ולשלוח קישורים לאיפוס סיסמה.')}</p>
        </div>
      </section>

      <div className="userManagementToolbar">
        <label className="userManagementSearch">
          <Search size={18} aria-hidden="true" />
          <span className="visuallyHidden">{t('חיפוש משתמש')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('חיפוש לפי שם, דוא״ל או תפקיד')}
          />
        </label>
        <button
          type="button"
          className="userManagementInviteButton"
          onClick={() => {
            setInviteOpen((open) => !open);
            setError('');
          }}
          disabled={inviting || Boolean(busyId)}
          aria-expanded={inviteOpen}
        >
          {inviteOpen ? <X size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
          {inviteOpen ? t('סגירת ההזמנה') : t('הזמנת משתמש')}
        </button>
      </div>

      {inviteOpen && (
        <form className="userManagementInvitePanel" onSubmit={submitInvite}>
          <div className="userManagementInviteHeading">
            <span><UserPlus size={20} aria-hidden="true" /></span>
            <div>
              <h3>{t('הזמנת משתמש חדש')}</h3>
              <p>{t('המשתמש יקבל קישור מאובטח לבחירת סיסמה.')}</p>
            </div>
          </div>
          <div className="userManagementInviteFields">
            <label>
              <span>{t('שם מלא')}</span>
              <input
                type="text"
                autoComplete="name"
                value={inviteDraft.fullName}
                onChange={(event) => updateInvite('fullName', event.target.value)}
                disabled={inviting}
                maxLength={120}
                required
              />
            </label>
            <label>
              <span>{t('כתובת דוא״ל')}</span>
              <input
                type="email"
                autoComplete="off"
                value={inviteDraft.email}
                onChange={(event) => updateInvite('email', event.target.value)}
                disabled={inviting}
                dir="ltr"
                required
              />
            </label>
            <label>
              <span>{t('תפקיד')}</span>
              <select
                value={inviteDraft.role}
                onChange={(event) => updateInvite('role', event.target.value)}
                disabled={inviting}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{t(roleLabel[role])}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="userManagementInviteActions">
            <button type="button" className="secondary" onClick={closeInvite} disabled={inviting}>
              {t('ביטול')}
            </button>
            <button type="submit" disabled={inviting}>
              <UserPlus size={17} aria-hidden="true" />
              {inviting ? t('שולח…') : t('שליחת הזמנה')}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="userManagementError" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="userManagementState">{t('טוען משתמשים...')}</div>
      ) : filteredProfiles.length === 0 ? (
        <div className="userManagementState">{t('לא נמצאו משתמשים מתאימים.')}</div>
      ) : (
        <div className="userManagementList">
          {filteredProfiles.map((profile) => {
            const draft = drafts[profile.id] || { email: profile.email || '', role: profile.role };
            const unchanged = draft.email.trim().toLocaleLowerCase('en-US') ===
                (profile.email || '').toLocaleLowerCase('en-US') && draft.role === profile.role;
            const busy = busyId === profile.id;
            const editing = editingId === profile.id;
            const editingSelf = signedInProfile?.id === profile.id;
            return (
              <form
                className={`userManagementCard${editing ? ' editing' : ''}`}
                key={profile.id}
                onSubmit={(event) => saveUser(event, profile)}
              >
                <div className="userManagementIdentity">
                  <span><UserRound size={20} aria-hidden="true" /></span>
                  <div>
                    <strong>{profile.full_name || t('משתמש ללא שם')}</strong>
                    <div className="userManagementIdentityMeta">
                      <span className={`userManagementStatus ${profile.account_status || 'inactive'}`}>
                        {t(accountStatusLabel[profile.account_status] || 'לא פעיל')}
                      </span>
                      {editingSelf && <span className="userManagementSelfBadge">{t('החשבון שלך')}</span>}
                    </div>
                  </div>
                </div>
                {editing ? (
                  <label className="userManagementEmail">
                    <span><Mail size={16} aria-hidden="true" /> {t('כתובת דוא״ל')}</span>
                    <input
                      type="email"
                      autoComplete="off"
                      value={draft.email}
                      onChange={(event) => updateDraft(profile.id, 'email', event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape' && !busy) cancelEditing(profile);
                      }}
                      disabled={busy}
                      required
                      dir="ltr"
                    />
                  </label>
                ) : (
                  <div className="userManagementEmailSummary">
                    <span><Mail size={16} aria-hidden="true" /> {t('כתובת דוא״ל')}</span>
                    <bdi dir="ltr">{profile.email || '—'}</bdi>
                  </div>
                )}
                {editing ? (
                  <label className="userManagementRoleEditor">
                    <span>{t('תפקיד')}</span>
                    <select
                      value={draft.role}
                      onChange={(event) => updateDraft(profile.id, 'role', event.target.value)}
                      disabled={busy || editingSelf}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{t(roleLabel[role])}</option>
                      ))}
                    </select>
                    {editingSelf && <small>{t('לא ניתן לשנות את התפקיד של החשבון שלך.')}</small>}
                  </label>
                ) : (
                  <div className="userManagementRoleSummary">
                    <span>{t('תפקיד')}</span>
                    <strong>{t(roleLabel[profile.role] || profile.role)}</strong>
                  </div>
                )}
                {editing ? (
                  <div className="userManagementEditActions">
                    <button type="button" className="secondary" onClick={() => cancelEditing(profile)} disabled={busy}>
                      <X size={17} aria-hidden="true" /> {t('ביטול')}
                    </button>
                    <button type="submit" disabled={busy || unchanged}>
                      <Save size={17} aria-hidden="true" />
                      {busy ? t('שומר...') : t('שמירת שינויים')}
                    </button>
                  </div>
                ) : (
                  <div className="userManagementRowActions">
                    <button
                      type="button"
                      className={`secondary userManagementStatusButton ${profile.account_status === 'inactive' ? 'activate' : 'deactivate'}`}
                      onClick={() => toggleUserStatus(profile)}
                      disabled={Boolean(busyId) || editingSelf}
                      title={editingSelf ? t('לא ניתן להשבית את החשבון שלך.') : undefined}
                    >
                      {profile.account_status === 'inactive'
                        ? <UserRoundCheck size={15} aria-hidden="true" />
                        : <UserRoundX size={15} aria-hidden="true" />}
                      {profile.account_status === 'inactive' ? t('הפעלה') : t('השבתה')}
                    </button>
                    <button
                      type="button"
                      className="secondary userManagementResetButton"
                      onClick={() => sendPasswordReset(profile)}
                      disabled={Boolean(busyId) || !profile.email || profile.account_status !== 'active'}
                    >
                      <KeyRound size={15} aria-hidden="true" />
                      {busy ? t('שולח…') : t('איפוס סיסמה')}
                    </button>
                    <button
                      type="button"
                      className="secondary userManagementEditButton"
                      onClick={() => startEditing(profile)}
                      disabled={Boolean(busyId)}
                    >
                      <Pencil size={15} aria-hidden="true" /> {t('עריכה')}
                    </button>
                  </div>
                )}
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
