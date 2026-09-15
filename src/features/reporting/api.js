import { statuses } from '../../services/supabase.js';
import * as statusHistoryApi from '../../services/api/statusHistory.js';

async function getProjectStatusChangesBetween(start, end) {
  const { data, error } = await statusHistoryApi.getStatusChangesBetween(
    start.toISOString(),
    end.toISOString(),
    statuses,
  );
  if (error) throw error;
  return (data || []).filter(
    (change) => change.old_status && change.old_status !== change.new_status,
  );
}

export function getRecentProjectStatusChanges(hours = 24) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return getProjectStatusChangesBetween(start, end);
}

export async function getProjectStatusChangesForDate(dateValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return [];
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return getProjectStatusChangesBetween(start, end);
}
