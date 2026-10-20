-- Published snapshots are shared within this company's authenticated app.
-- Editing drafts remain local and are never exposed to employee readers.
create table public.work_plan_publications (
  plan_date date primary key,
  rows jsonb not null,
  roster_names jsonb not null default '[]'::jsonb,
  version integer not null default 1 check (version > 0),
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete set null,
  constraint work_plan_rows_array check (jsonb_typeof(rows) = 'array' and jsonb_array_length(rows) between 1 and 1000),
  constraint work_plan_roster_array check (jsonb_typeof(roster_names) = 'array' and jsonb_array_length(roster_names) <= 1000),
  constraint work_plan_payload_size check (octet_length(rows::text) <= 1048576)
);

create index work_plan_publications_published_by_idx on public.work_plan_publications(published_by);
alter table public.work_plan_publications enable row level security;
revoke all on public.work_plan_publications from public, anon, authenticated;
grant select, insert, update on public.work_plan_publications to authenticated;
grant all on public.work_plan_publications to service_role;

create policy "app members read published plans" on public.work_plan_publications
for select to authenticated using (exists (
  select 1 from public.profiles where id = (select auth.uid())
));
create policy "managers publish plans" on public.work_plan_publications
for insert to authenticated with check ((select public.is_manager()) and published_by = (select auth.uid()));
create policy "managers update published plans" on public.work_plan_publications
for update to authenticated using ((select public.is_manager()))
with check ((select public.is_manager()) and published_by = (select auth.uid()));

create function public.stamp_work_plan_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.plan_date = old.plan_date;
    new.version = old.version + 1;
  else
    new.version = 1;
  end if;
  new.published_at = now();
  return new;
end;
$$;
revoke all on function public.stamp_work_plan_publication() from public, anon, authenticated;
create trigger stamp_work_plan_publication before insert or update on public.work_plan_publications
for each row execute function public.stamp_work_plan_publication();
