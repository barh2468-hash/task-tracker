begin;
select plan(12);

select ok(
  to_regclass('public.project_drawing_batches') is not null,
  'drawing batches table exists'
);
select ok(
  to_regclass('public.project_drawing_batch_events') is not null,
  'drawing batch events table exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.project_drawing_batches'::regclass),
  'drawing batches have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.project_drawing_batch_events'::regclass),
  'drawing batch events have RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.project_drawing_batches', 'select'),
  'anonymous users cannot read drawing batches'
);
select ok(
  has_table_privilege('authenticated', 'public.project_drawing_batches', 'select'),
  'authenticated users have the select grant'
);
select ok(
  has_table_privilege('authenticated', 'public.project_drawing_batches', 'insert'),
  'authenticated users have the insert grant'
);
select ok(
  has_table_privilege('authenticated', 'public.project_drawing_batches', 'update'),
  'authenticated users have the update grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.project_drawing_batches', 'delete'),
  'authenticated users cannot delete drawing batches'
);
select ok(
  has_table_privilege('authenticated', 'public.project_drawing_batch_events', 'select')
    and not has_table_privilege('authenticated', 'public.project_drawing_batch_events', 'insert,update,delete'),
  'drawing batch events are read-only through the Data API'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_documents'
      and column_name = 'drawing_batch_id'
  ),
  'project documents can be linked to a drawing batch'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_review_files'
      and column_name = 'drawing_batch_id'
  ),
  'review files can be linked to a drawing batch'
);

select * from finish();
rollback;
