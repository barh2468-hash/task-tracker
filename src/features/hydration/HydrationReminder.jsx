import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { shouldShowHydrationReminder } from './model.js';
import './hydration.css';

export default function HydrationReminder({ email, name }) {
  useTranslation();
  const { language } = useLanguage();
  const [visible, setVisible] = useState(() => shouldShowHydrationReminder(email));
  const dialogRef = useRef(null);

  useEffect(() => {
    // A return from the background is another app entry. Route changes and
    // auth token refreshes intentionally do not trigger another reminder.
    const checkEntry = () => setVisible(shouldShowHydrationReminder(email));
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkEntry();
    };
    const onPageShow = (event) => {
      if (event.persisted) checkEntry();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [email]);

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <dialog
      ref={dialogRef}
      className="hydrationReminder"
      dir={language === 'he' ? 'rtl' : 'ltr'}
      aria-labelledby="hydration-title"
      aria-describedby="hydration-description"
      onCancel={(event) => {
        event.preventDefault();
        setVisible(false);
      }}
    >
      <div className="hydrationReminderHero">
        <img
          src="/hydration-football.svg"
          alt={t('hydration.imageAlt')}
          width="720"
          height="420"
        />
        <button
          type="button"
          className="hydrationReminderClose"
          aria-label={t('hydration.close')}
          onClick={() => setVisible(false)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="hydrationReminderContent">
        <p className="hydrationReminderEyebrow">{t('hydration.wednesday')}</p>
        <h2 id="hydration-title">{t('hydration.title', { name })}</h2>
        <p id="hydration-description">{t('hydration.description')}</p>
        <button type="button" className="hydrationReminderContinue" onClick={() => setVisible(false)}>
          {t('hydration.continue')}
        </button>
      </div>
    </dialog>
  );
}
