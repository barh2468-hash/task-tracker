import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterEnabledNotifications,
  notificationPreferenceCategory,
} from './notificationPreferences.js';

function client(preferences, error = null) {
  return {
    from(table) {
      assert.equal(table, 'notification_preferences');
      let ids;
      return {
        select() {
          return this;
        },
        in(_key, value) {
          ids = value;
          return this;
        },
        async eq(key, value) {
          assert.equal(key, 'enabled');
          assert.equal(value, false);
          return {
            data: preferences.filter((row) => row.enabled === false && ids.includes(row.user_id)),
            error,
          };
        },
      };
    },
  };
}

test('delivery respects each recipient and event choice without muting other events', async () => {
  const db = client([
    { user_id: 'a', category: 'work_started', enabled: false },
    { user_id: 'a', category: 'new_tasks', enabled: false },
    { user_id: 'b', category: 'chat', enabled: false },
  ]);
  const notices = [
    { recipient_id: 'a', type: 'work_started' },
    { recipient_id: 'a', type: 'work_ended' },
    { recipient_id: 'a', type: 'task_added' },
    { recipient_id: 'a', type: 'task_done' },
    { recipient_id: 'b', type: 'work_started' },
    { recipient_id: 'a', type: 'chat_message' },
    { recipient_id: 'b', type: 'chat_message' },
    { recipient_id: 'c', type: 'new_future_event' },
  ];
  assert.deepEqual(await filterEnabledNotifications(db, notices), [
    notices[1],
    notices[3],
    notices[4],
    notices[5],
    notices[7],
  ]);
});
test('alerts suppressed when created are not replayed after re-enabling the category', async () => {
  assert.deepEqual(
    await filterEnabledNotifications(client([]), [
      { recipient_id: 'a', type: 'work_started', delivery_enabled: false },
    ]),
    [],
  );
});
test('failed preference lookups stop delivery', async () => {
  await assert.rejects(
    filterEnabledNotifications(client([], new Error('offline')), [
      { recipient_id: 'a', type: 'task_done' },
    ]),
    /offline/,
  );
});
test('scheduled reminders, worker updates, reviews and documents use the expected switch', () => {
  for (const [type, category] of [
    ['attendance_reminder_first', 'attendance_reminders'],
    ['attendance_missing_escalation', 'attendance_reminders'],
    ['attendance_started', 'attendance_updates'],
    ['manager_project_status_changed', 'status_changes'],
    ['project_drafter_assigned', 'assignments'],
    ['drawing_document_uploaded', 'documents'],
    ['daily_drafting_ready', 'drawings'],
    ['continuation_review_update', 'continuation_reports'],
    ['vehicle_fine_due', 'vehicles'],
    ['gpr_email_order_received', 'gpr'],
    ['future', 'other'],
  ])
    assert.equal(notificationPreferenceCategory(type), category, type);
});
test('large recipient lists stay below the API row cap', async () => {
  const notices = Array.from({ length: 1100 }, (_, index) => ({
    recipient_id: String(index),
    type: 'work_started',
  }));
  assert.deepEqual(
    await filterEnabledNotifications(
      client([{ user_id: '1099', category: 'work_started', enabled: false }]),
      notices,
    ),
    notices.slice(0, -1),
  );
});
