import { getCurrentUser } from '../../services/api/auth.js';
import { upsertPushSubscription, deletePushSubscriptionByEndpoint } from '../../services/api/pushSubscriptions.js';

const VAPID_PUBLIC_KEY = 'BIIiOUgtTG4I6C-krp8Rkauc_4OCWH_o6Jt3Gng3IwPkcqQF4YPuxGxjcooG4TX1jWzgeoOAI_60G5PwbPyAqf4';

// Web Push keys are base64url; atob/PushManager need standard base64 bytes.
function applicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function subscribePush(registration) {
  const user = await getCurrentUser();
  if (!user) throw new Error('יש להתחבר מחדש למערכת.');

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(VAPID_PUBLIC_KEY),
  });
  const json = subscription.toJSON();
  const { error } = await upsertPushSubscription({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  return subscription;
}

export async function unsubscribePush(registration) {
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await deletePushSubscriptionByEndpoint(subscription.endpoint);
    await subscription.unsubscribe();
  }
}
