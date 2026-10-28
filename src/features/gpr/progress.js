import { GPR_STATUSES } from './model.js';

// Only change progress fields. Preserve original email, notes and requirement details.
export function progressPatch(order, change) {
  if (change.type === 'status' && GPR_STATUSES.includes(change.value)) {
    return { status: change.value };
  }
  if (
    change.type === 'requirement' &&
    typeof change.done === 'boolean' &&
    order.requirements?.some((item) => item.key === change.key)
  ) {
    return {
      requirements: order.requirements.map((item) =>
        item.key === change.key ? { ...item, done: change.done } : item,
      ),
    };
  }
  throw new Error('Invalid progress change');
}

export function requirementProgress(order) {
  const total = order.requirements?.length || 0;
  const done = (order.requirements || []).filter((item) => item.done).length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}
