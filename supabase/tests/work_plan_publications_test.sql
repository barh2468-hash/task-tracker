-- Run against the application database. All writes are rolled back.
begin;
select set_config('test.plan_manager', (select id::text from public.profiles where role in ('admin','manager') order by id limit 1), true);
select set_config('test.plan_worker', (select id::text from public.profiles where role = 'field_worker' order by id limit 1), true);

do $$ begin
  if current_setting('test.plan_manager') = '' or current_setting('test.plan_worker') = '' then
    raise exception 'A manager and a field worker are required';
  end if;
  if has_table_privilege('anon', 'public.work_plan_publications', 'SELECT') then
    raise exception 'Anonymous publication access must be denied';
  end if;
  if has_table_privilege('authenticated', 'public.work_plan_publications', 'DELETE') then
    raise exception 'Publication deletion must be denied';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.plan_worker'), true);
do $$ declare changed integer; begin
  if not exists(select 1 from public.work_plan_publications) then raise exception 'Workers must be able to view the published plan'; end if;
  update public.work_plan_publications set published_by = auth.uid();
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Workers must not update published plans'; end if;
  begin
    insert into public.work_plan_publications(plan_date, rows, published_by) values ('2999-12-31', '[{}]', auth.uid());
    raise exception 'Workers must not insert published plans';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.plan_manager'), true);
do $$ declare day date; previous integer; changed integer; begin
  select plan_date, version into strict day, previous from public.work_plan_publications order by plan_date desc limit 1;
  update public.work_plan_publications set published_by = auth.uid() where plan_date = day and version = previous;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Managers must be able to publish'; end if;
  if (select version from public.work_plan_publications where plan_date = day) <> previous + 1 then raise exception 'Publication version must increment'; end if;
  update public.work_plan_publications set published_by = auth.uid() where plan_date = day and version = previous;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Stale publication must not overwrite a newer version'; end if;
end $$;
rollback;
