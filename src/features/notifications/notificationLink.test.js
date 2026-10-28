import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationLink } from './notificationLink.js';

test('email notifications open the GPR work even after it is linked to a project', () => {
  assert.deepEqual(
    notificationLink({
      type: 'gpr_email_order_received',
      gpr_order_id: 'gpr-123',
      project_id: 'project-456',
    }),
    { path: '/app/gpr?order=gpr-123', label: 'gpr.openOrder' },
  );
});

test('notification URLs use encoded record IDs, never email content or URLs', () => {
  const target = notificationLink({
    type: 'gpr_email_order_received',
    gpr_order_id: 'a&other=b',
    title: 'https://example.com',
    web_url: 'https://example.com',
  });
  assert.equal(target.path, '/app/gpr?order=a%26other%3Db');
});

test('existing project notifications and non-actionable items retain their behavior', () => {
  assert.deepEqual(notificationLink({ type: 'project_review_approved', project_id: 'p-1' }), {
    path: '/app/projects?project=p-1',
    label: 'פתח פרויקט',
  });
  assert.equal(notificationLink({ type: 'gpr_email_order_received' }), null);
  assert.equal(notificationLink({ type: 'other', gpr_order_id: 'gpr-1' }), null);
  assert.equal(notificationLink({ type: 'other' }), null);
});
