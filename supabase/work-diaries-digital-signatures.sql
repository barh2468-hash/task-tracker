-- Work diaries with two required digital signatures.
-- Safe additive migration. Run once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.projects
add column if not exists requires_work_diary boolean not null default false;

create sequence if not exists public.work_diary_number_seq
  start with 7180
  increment by 1
  minvalue 1;

create table if not exists public.work_diaries (
  id uuid primary key default gen_random_uuid(),
  diary_number bigint not null default nextval('public.work_diary_number_seq') unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  form_data jsonb not null default '{}'::jsonb,
  customer_signature text not null check (length(customer_signature) > 100),
  team_lead_signature text not null check (length(team_lead_signature) > 100),
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists work_diaries_project_id_idx
  on public.work_diaries(project_id);
create index if not exists work_diaries_signed_at_idx
  on public.work_diaries(signed_at desc);

alter table public.work_diaries enable row level security;

grant usage, select on sequence public.work_diary_number_seq to authenticated;
grant select, insert, delete on table public.work_diaries to authenticated;

drop policy if exists "work diaries read related" on public.work_diaries;
drop policy if exists "work diaries insert related" on public.work_diaries;
drop policy if exists "work diaries delete managers" on public.work_diaries;

create policy "work diaries read related" on public.work_diaries
for select using (
  public.is_manager()
  or exists (
    select 1
    from public.projects pr
    where pr.id = project_id
      and pr.assigned_to = auth.uid()
  )
  or exists (
    select 1
    from public.project_workers pw
    where pw.project_id = work_diaries.project_id
      and pw.worker_id = auth.uid()
  )
);

create policy "work diaries insert related" on public.work_diaries
for insert with check (
  created_by = auth.uid()
  and (
    public.is_manager()
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_id
        and pr.assigned_to = auth.uid()
    )
    or exists (
      select 1
      from public.project_workers pw
      where pw.project_id = work_diaries.project_id
        and pw.worker_id = auth.uid()
    )
  )
);

create policy "work diaries delete managers" on public.work_diaries
for delete using (public.is_manager());

do $$
begin
  begin
    alter publication supabase_realtime add table public.work_diaries;
  exception when duplicate_object then null;
  end;
end $$;
