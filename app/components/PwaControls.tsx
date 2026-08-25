"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = "BIIiOUgtTG4I6C-krp8Rkauc_4OCWH_o6Jt3Gng3IwPkcqQF4YPuxGxjcooG4TX1jWzgeoOAI_60G5PwbPyAqf4";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function PwaControls({ onMessage }: { onMessage: (message: string) => void }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setPushSupported(
      "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window,
    );

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setSubscribed(Boolean(subscription)))
        .catch(() => setSubscribed(false));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (installed) {
      onMessage("האפליקציה כבר מותקנת במכשיר הזה.");
      return;
    }
    if (!installPrompt) {
      const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
      onMessage(
        isAppleMobile
          ? "ב-iPhone: פתח את תפריט השיתוף ובחר ׳הוספה למסך הבית׳."
          : "פתח את תפריט הדפדפן ובחר ׳התקנת האפליקציה׳ או ׳הוספה למסך הבית׳.",
      );
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      onMessage("האפליקציה הותקנה בהצלחה.");
    }
    setInstallPrompt(null);
  }

  async function enablePush() {
    if (!pushSupported) {
      onMessage("המכשיר או הדפדפן הזה אינם תומכים בהתראות Push.");
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        onMessage("לא ניתנה הרשאה להתראות. אפשר לשנות זאת בהגדרות הדפדפן.");
        return;
      }

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("יש להתחבר מחדש למערכת.");

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;

      setSubscribed(true);
      onMessage("ההתראות הופעלו בהצלחה במכשיר הזה.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "הפעלת ההתראות נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      onMessage("ההתראות כובו במכשיר הזה.");
    } catch {
      onMessage("כיבוי ההתראות נכשל. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pwaControls" aria-label="התקנה והתראות">
      <button className="pwaControlButton" onClick={installApp} disabled={installed}>
        <Download size={16} />
        <span>{installed ? "האפליקציה מותקנת" : "התקנת האפליקציה"}</span>
      </button>
      <button
        className={`pwaControlButton ${subscribed ? "enabled" : ""}`}
        onClick={subscribed ? disablePush : enablePush}
        disabled={busy || !pushSupported}
      >
        {subscribed ? <BellOff size={16} /> : <BellRing size={16} />}
        <span>{subscribed ? "כיבוי התראות" : "הפעלת התראות"}</span>
      </button>
    </section>
  );
}
