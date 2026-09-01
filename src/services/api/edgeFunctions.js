import { supabase } from '../supabase.js';

function invoke(name, body) {
  return supabase.functions.invoke(name, { body });
}

export function sendPushNotification(body) {
  return invoke('send-push-notification', body);
}

export function notifyStatusChange(body) {
  return invoke('notify-status-change', body);
}

export function notifyProjectAssigned(body) {
  return invoke('notify-project-assigned', body);
}

export function notifyProjectReview(body) {
  return invoke('notify-project-review', body);
}

export function notifyTaskDone(body) {
  return invoke('notify-task-done', body);
}

export function dailyManagerSummary(body) {
  return invoke('daily-manager-summary', body);
}
