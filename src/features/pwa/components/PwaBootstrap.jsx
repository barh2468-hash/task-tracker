import { useEffect } from 'react';

export default function PwaBootstrap() {
  useEffect(() => {
    const onInstallPrompt = (event) => {
      event.preventDefault();
      window.__mayaInstallPrompt = event;
      window.dispatchEvent(new Event('maya-install-prompt-ready'));
    };
    const onInstalled = () => {
      window.__mayaInstallPrompt = undefined;
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('beforeinstallprompt', onInstallPrompt);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    // register() already performs an update check. Calling update() again here
    // caused duplicate checks (especially under React StrictMode) and occasional
    // update work while the authentication screen was opening.
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((error) => console.warn('PWA registration failed:', error));

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return null;
}
