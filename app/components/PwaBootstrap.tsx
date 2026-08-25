"use client";

import { useEffect } from "react";

interface MayaInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __mayaInstallPrompt?: MayaInstallPromptEvent;
  }
}

export default function PwaBootstrap() {
  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__mayaInstallPrompt = event as MayaInstallPromptEvent;
      window.dispatchEvent(new Event("maya-install-prompt-ready"));
    };
    const onInstalled = () => {
      window.__mayaInstallPrompt = undefined;
    };

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("beforeinstallprompt", onInstallPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((registration) => registration.update())
      .catch((error) => console.warn("PWA registration failed:", error));

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
