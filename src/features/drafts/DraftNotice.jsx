import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { t } from '../language/LanguageContext.jsx';
import './drafts.css';

export default function DraftNotice({ draft, disabled = false, onDiscard }) {
  useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  async function discard() {
    setDiscarding(true);
    try {
      if (await draft.clear()) onDiscard?.();
      setConfirming(false);
    } finally {
      setDiscarding(false);
    }
  }
  return (
    <div className={`formDraftNotice${draft.status === 'error' ? ' formDraftError' : ''}`}>
      <div role="status" aria-live="polite">
        {confirming ? t('למחוק את הטיוטה ולהתחיל מחדש?') : draft.status === 'loading' ? t('בודק טיוטה שמורה...')
          : draft.status === 'error' ? t('לא ניתן לשמור את הטיוטה במכשיר. יש לשמור את הטופס לפני יציאה.')
            : draft.recovery ? t('נמצאה טיוטה שלא הושלמה. להמשיך מהמקום שבו עצרת?')
              : t('הטיוטה נשמרת אוטומטית במכשיר זה.')}
      </div>
      <div className="formDraftButtons">
        {confirming ? <>
          <button type="button" className="ghost tinyBtn" disabled={disabled || discarding} onClick={() => setConfirming(false)}>{t('שמירת הטיוטה')}</button>
          <button type="button" className="smallBtn danger" disabled={disabled || discarding} onClick={discard}>{t('כן, מחיקת הטיוטה')}</button>
        </> : <>
          {draft.recovery && <button type="button" className="smallBtn" disabled={disabled} onClick={draft.resume}>{t('המשך טיוטה')}</button>}
          {draft.hasDraft && <button type="button" className="ghost tinyBtn" disabled={disabled} onClick={() => setConfirming(true)}>{t('מחיקת טיוטה')}</button>}
        </>}
      </div>
    </div>
  );
}
