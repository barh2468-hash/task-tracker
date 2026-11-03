// Isolated PostgreSQL integration test; never connects to the application DB.
import assert from 'node:assert/strict';
import console from 'node:console';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../../tmp/notification-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { notificationPreferenceCategory } from '../functions/_shared/notificationPreferences.js';

const db = new PGlite();
try {
  await db.exec(`
    create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,service_role;
    grant execute on function auth.uid() to authenticated,service_role;
    create table public.profiles(id uuid primary key);
    create table public.notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid references public.profiles(id),type text not null,title text);
    grant all on public.notifications to service_role;
    insert into public.profiles values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
  `);
  await db.exec(
    await readFile(
      new URL(
        '../migrations/20261101125128_notification_event_preferences.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const first = '00000000-0000-0000-0000-000000000001',
    second = '00000000-0000-0000-0000-000000000002';
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${first}',false);`,
  );
  await db.query(`insert into public.notification_preferences values ($1,'work_started',false)`, [
    first,
  ]);
  await assert.rejects(
    db.query(`insert into public.notification_preferences values ($1,'work_started',false)`, [
      second,
    ]),
    { code: '42501' },
  );
  await assert.rejects(
    db.query(`update public.notification_preferences set user_id=$1`, [second]),
    { code: '42501' },
  );
  assert.equal(
    (
      await db.query(
        `update public.notification_preferences set enabled=true where user_id=$1 returning *`,
        [second],
      )
    ).rows.length,
    0,
  );
  await db.exec(`reset role; set role service_role;`);
  await db.query(
    `insert into public.notifications(recipient_id,type) values ($1,'work_started'),($1,'work_ended'),($2,'work_started')`,
    [first, second],
  );
  assert.deepEqual(
    (
      await db.query(`select delivery_enabled from public.notifications order by recipient_id,type`)
    ).rows.map((row) => row.delivery_enabled),
    [true, false, true],
  );
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${second}',false);`,
  );
  assert.equal((await db.query('select * from public.notification_preferences')).rows.length, 0);
  await db.exec(`reset role; set role anon;`);
  await assert.rejects(db.query('select * from public.notification_preferences'), {
    code: '42501',
  });
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${first}',false);`,
  );
  await db.query(`update public.notification_preferences set enabled=true where user_id=$1`, [
    first,
  ]);
  await db.exec(`reset role;
    create table public.preference_test_outbox(notification_id uuid not null references public.notifications(id));
    create function public.preference_test_queue() returns trigger language plpgsql as $$ begin insert into public.preference_test_outbox values(new.id); return new; end $$;
    create trigger preference_test_queue after insert on public.notifications for each row execute function public.preference_test_queue();`);
  await db.query(`insert into public.notifications(recipient_id,type) values($1,'work_started')`, [
    first,
  ]);
  assert.equal((await db.query('select * from public.preference_test_outbox')).rows.length, 1);
  assert.equal(
    (
      await db.query(
        'select count(*)::int as count from public.notifications where not delivery_enabled',
      )
    ).rows[0].count,
    1,
  );
  await db.query(`update public.notification_preferences set enabled=false where user_id=$1`, [
    first,
  ]);
  await db.query(`insert into public.notifications(recipient_id,type) values($1,'work_started')`, [
    first,
  ]);
  assert.equal((await db.query('select * from public.preference_test_outbox')).rows.length, 2);
  assert.equal(
    (
      await db.query(
        'select count(*)::int as count from public.notifications where not delivery_enabled',
      )
    ).rows[0].count,
    2,
  );
  const types = [
    'chat_message',
    'gpr_email_order_received',
    'vehicle_odometer_escalation',
    'work_started',
    'work_ended',
    'attendance_reminder_repeat',
    'attendance_missing_escalation',
    'attendance_day_status',
    'status_change',
    'manager_project_status_changed',
    'project_assigned',
    'drafter_assigned',
    'project_drafter_assigned',
    'task_done',
    'task_from_worker',
    'continuation_report',
    'photo_deleted',
    'project_document_uploaded',
    'drawing_document_uploaded',
    'drawing_batch_review',
    'project_review_approved',
    'daily_drafting_ready',
    'unknown',
  ];
  for (const type of types)
    assert.equal(
      (await db.query('select public.notification_preference_category($1) as category', [type]))
        .rows[0].category,
      notificationPreferenceCategory(type),
      type,
    );
  console.log(
    'PostgreSQL integration passed: ownership/RLS, default-on, event-specific suppression, re-enable, retained history/outbox IDs, and category parity.',
  );
} finally {
  await db.close();
}
