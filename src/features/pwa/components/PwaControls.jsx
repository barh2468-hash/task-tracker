import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { BellOff, BellRing, Download } from 'lucide-react';
import { useMessage } from '../../../context/MessageContext.jsx';
import { subscribePush, unsubscribePush, isPushSubscribed } from '../api.js';
import { useAuth } from '../../auth/useAuth.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
}

export default function PwaControls() {
  useTranslation();
  const { setMessage } = useMessage();
  const { profile } = useAuth();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setSubscribed(false);
    setInstalled(isStandalone());
    setInstallPrompt(window.__mayaInstallPrompt || null);
    setPushSupported(
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    );

    const onInstallPromptReady = () => {
      setInstallPrompt(window.__mayaInstallPrompt || null);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      window.__mayaInstallPrompt = undefined;
    };

    window.addEventListener('maya-install-prompt-ready', onInstallPromptReady);
    window.addEventListener('appinstalled', onInstalled);

    const refreshSubscription = () => {
      if (
        !profile?.id ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      )
        return;
      navigator.serviceWorker.ready
        .then(isPushSubscribed)
        .then((enabled) => {
          if (active) setSubscribed(enabled);
        })
        .catch(() => {
          if (active) setSubscribed(false);
        });
    };
    refreshSubscription();
    window.addEventListener('maya-push-subscription-changed', refreshSubscription);

    return () => {
      active = false;
      window.removeEventListener('maya-install-prompt-ready', onInstallPromptReady);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('maya-push-subscription-changed', refreshSubscription);
    };
  }, [profile?.id]);

  async function installApp() {
    if (installed) {
      setMessage(t('האפליקציה כבר מותקנת במכשיר הזה.'), 'info');
      return;
    }
    if (!installPrompt) {
      const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
      setMessage(
        isAppleMobile
          ? t('ב-iPhone: פתח את תפריט השיתוף ובחר ׳הוספה למסך הבית׳.')
          : t('פתח את תפריט הדפדפן ובחר ׳התקנת האפליקציה׳ או ׳הוספה למסך הבית׳.'),
        'info',
      );
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setMessage(t('האפליקציה הותקנה בהצלחה.'));
    }
    window.__mayaInstallPrompt = undefined;
    setInstallPrompt(null);
  }

  async function enablePush() {
    if (!pushSupported) {
      const isAppleMobile =
        /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setMessage(
        isAppleMobile && !isStandalone()
          ? t(
              'כדי לקבל התראות ב-iPhone, הוסיפו את האפליקציה למסך הבית, פתחו אותה משם והפעילו התראות.',
            )
          : t('המכשיר או הדפדפן הזה אינם תומכים בהתראות Push.'),
        'info',
      );
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(t('לא ניתנה הרשאה להתראות. אפשר לשנות זאת בהגדרות הדפדפן.'), 'error');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      await subscribePush(registration);

      setSubscribed(true);
      window.dispatchEvent(new Event('maya-push-subscription-changed'));
      setMessage(t('ההתראות הופעלו בהצלחה במכשיר הזה.'));
    } catch (error) {
      setMessage(error instanceof Error ? t(error.message) : t('הפעלת ההתראות נכשלה.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      await unsubscribePush(registration);
      setSubscribed(false);
      window.dispatchEvent(new Event('maya-push-subscription-changed'));
      setMessage(t('ההתראות כובו במכשיר הזה.'));
    } catch {
      setMessage(t('כיבוי ההתראות נכשל. נסה שוב.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pwaControls" aria-label={t('התקנה והתראות')}>
      <button className="pwaControlButton" onClick={installApp} disabled={installed}>
        <Download size={16} />
        <span>{installed ? t('האפליקציה מותקנת') : t('התקנת האפליקציה')}</span>
      </button>
      <button
        className={`pwaControlButton ${subscribed ? 'enabled' : ''}`}
        onClick={subscribed ? disablePush : enablePush}
        disabled={busy}
        aria-pressed={subscribed}
      >
        {subscribed ? <BellOff size={16} /> : <BellRing size={16} />}
        <span>{subscribed ? t('כיבוי התראות') : t('הפעלת התראות')}</span>
      </button>
    </section>
  );
}
