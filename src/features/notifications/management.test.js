import test from 'node:test';
import assert from 'node:assert/strict';
import { filterNotifications, notificationCategory } from './management.js';
import {
  heNotifications,
  enNotifications,
  elNotifications,
  ptNotifications,
} from './translations.js';
import { heTranslations, enTranslations, elTranslations } from '../language/resources.js';

const rows = [
  {
    id: 'task',
    type: 'task_added',
    is_read: false,
    title: 'Check cable',
    projects: { name: 'Central Station' },
    profiles: { full_name: 'Alex' },
    project_id: 'p',
  },
  { id: 'work', type: 'work_ended', is_read: true, title: 'Work complete', project_id: 'p' },
  {
    id: 'gpr',
    type: 'gpr_email_order_received',
    is_read: false,
    gpr_work_orders: { title: 'תחנה מקורית', order_number: '1234' },
  },
  { id: 'other', type: 'future_type', is_read: false, title: 'Notice' },
];
const defaults = { status: 'all', category: 'all', search: '' };
const translator = (key, options) =>
  key === 'gpr.notificationTitleNamed' ? `New order: ${options.name}` : key;

test('combined filters include linked names and translated content without changing original data', () => {
  const before = structuredClone(rows);
  const filter = (options) =>
    filterNotifications(rows, { ...defaults, ...options }, translator, 'en-GB').map(
      (item) => item.id,
    );
  assert.deepEqual(filter({ status: 'unread', category: 'tasks', search: ' CENTRAL ' }), ['task']);
  assert.deepEqual(filter({ search: 'alex' }), ['task']);
  assert.deepEqual(filter({ search: 'New order:' }), ['gpr']);
  assert.deepEqual(filter({ search: '1234' }), ['gpr']);
  assert.deepEqual(filter({ status: 'read', category: 'tasks' }), []);
  assert.deepEqual(filter({ status: 'read' }), ['work']);
  assert.deepEqual(rows, before);
});

test('categories handle linked tasks, attendance, reviews and future notification types', () => {
  for (const [type, expected] of [
    ['task_done', 'tasks'],
    ['attendance_started', 'attendance'],
    ['work_started', 'attendance'],
    ['drawing_batch_review', 'drawings'],
    ['project_review_sent', 'drawings'],
    ['drafter_assigned', 'drawings'],
    ['vehicle_declaration', 'vehicles'],
    ['gpr_email_order_received', 'gpr'],
    ['future_type', 'other'],
  ]) {
    assert.equal(notificationCategory({ type }), expected);
  }
  assert.equal(notificationCategory({ type: 'status_change', project_id: 'p' }), 'projects');
});

test('management labels, states and accessibility text have complete connected translations', () => {
  for (const [language, dictionary, connected] of [
    ['he', heNotifications, heTranslations],
    ['en', enNotifications, enTranslations],
    ['el', elNotifications, elTranslations],
    ['pt', ptNotifications, ptNotifications],
  ]) {
    for (const key of Object.keys(enNotifications).filter((key) =>
      key.startsWith('notifications.'),
    )) {
      assert.ok(dictionary[key]?.trim(), `${language}: ${key}`);
      assert.equal(connected[key], dictionary[key], `${language}: ${key} is connected`);
      assert.deepEqual(
        dictionary[key].match(/\{\{.*?\}\}/g),
        enNotifications[key].match(/\{\{.*?\}\}/g),
      );
      if (language !== 'he') assert.doesNotMatch(dictionary[key], /[\u0590-\u05ff]/);
    }
  }
});
