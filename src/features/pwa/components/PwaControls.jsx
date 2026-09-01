import { useEffect, useState } from 'react';
import { BellOff, BellRing, Download } from 'lucide-react';
import { useMessage } from '../../../context/MessageContext.jsx';
import { subscribePush, unsubscribePush } from '../api.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean(navigator.standalone);
}

export default function PwaControls() {
  const { setMessage } = useMessage();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setInstallPrompt(window.__mayaInstallPrompt || null);
    setPushSupported(
      'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window,
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

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setSubscribed(Boolean(subscription)))
        .catch(() => setSubscribed(false));
    }

    return () => {
      window.removeEventListener('maya-install-prompt-ready', onInstallPromptReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installApp() {
    if (installed) {
      setMessage('האפליקציה כבר מותקנת במכשיר הזה.');
      return;
    }
    if (!installPrompt) {
      const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
      setMessage(
        isAppleMobile
          ? 'ב-iPhone: פתח את תפריט השיתוף ובחר ׳הוספה למסך הבית׳.'
          : 'פתח את תפריט הדפדפן ובחר ׳התקנת האפליקציה׳ או ׳הוספה למסך הבית׳.',
      );
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setMessage('האפליקציה הותקנה בהצלחה.');
    }
    window.__mayaInstallPrompt = undefined;
    setInstallPrompt(null);
  }

  async function enablePush() {
    if (!pushSupported) {
      setMessage('המכשיר או הדפדפן הזה אינם תומכים בהתראות Push.');
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage('לא ניתנה הרשאה להתראות. אפשר לשנות זאת בהגדרות הדפדפן.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      await subscribePush(registration);

      setSubscribed(true);
      setMessage('ההתראות הופעלו בהצלחה במכשיר הזה.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'הפעלת ההתראות נכשלה.');
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
      setMessage('ההתראות כובו במכשיר הזה.');
    } catch {
      setMessage('כיבוי ההתראות נכשל. נסה שוב.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pwaControls" aria-label="התקנה והתראות">
      <button className="pwaControlButton" onClick={installApp} disabled={installed}>
        <Download size={16} />
        <span>{installed ? 'האפליקציה מותקנת' : 'התקנת האפליקציה'}</span>
      </button>
      <button
        className={`pwaControlButton ${subscribed ? 'enabled' : ''}`}
        onClick={subscribed ? disablePush : enablePush}
        disabled={busy || !pushSupported}
      >
        {subscribed ? <BellOff size={16} /> : <BellRing size={16} />}
        <span>{subscribed ? 'כיבוי התראות' : 'הפעלת התראות'}</span>
      </button>
    </section>
  );
}
