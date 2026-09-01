import { supabase } from '../supabase.js';

export function upsertPushSubscription(row) {
  return supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
}

export function deletePushSubscriptionByEndpoint(endpoint) {
  return supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
