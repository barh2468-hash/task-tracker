-- Independent drawing batches let field work continue while an earlier batch
-- is already in drafting or review. Existing project-level workflow remains
-- intact; documents can be linked to a batch incrementally.

create table public.project_drawing_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  batch_number integer not null,
  work_date date not null,
  update_type text not null,
  review_impact text not null,
  summary text not null,
  status text not null default 'pending_drafting',
  created_by uuid not null references public.profiles(id),
  assigned_drafter uuid references public.profiles(id),
  source_project_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_drawing_batches_project_number_key unique (project_id, batch_number),
  constraint project_drawing_batches_number_check check (batch_number > 0),
  constraint project_drawing_batches_summary_check check (char_length(summary) between 5 and 2000),
  constraint project_drawing_batches_update_type_check check (
    update_type in ('addition', 'correction', 'new_phase')
  ),
  constraint project_drawing_batches_review_impact_check check (
    review_impact in ('no_change', 'changes_review', 'unsure')
  ),
  constraint project_drawing_batches_status_check check (
    status in ('pending_drafting', 'in_drafting', 'sent_to_review', 'approved', 'cancelled')
  )
);

create index project_drawing_batches_project_status_created_idx
  on public.project_drawing_batches(project_id, status, created_at desc);
create index project_drawing_batches_assigned_status_idx
  on public.project_drawing_batches(assigned_drafter, status)
  where assigned_drafter is not null;
create index project_drawing_batches_created_by_idx
  on public.project_drawing_batches(created_by);

create table public.project_drawing_batch_events (
  id bigint generated always as identity primary key,
  drawing_batch_id uuid not null references public.project_drawing_batches(id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint project_drawing_batch_events_type_check check (
    event_type in ('created', 'status_changed', 'drafter_assigned')
  )
);

create index project_drawing_batch_events_batch_created_idx
  on public.project_drawing_batch_events(drawing_batch_id, created_at desc);
create index project_drawing_batch_events_created_by_idx
  on public.project_drawing_batch_events(created_by);

alter table public.project_documents
  add column if not exists drawing_batch_id uuid
  references public.project_drawing_batches(id) on delete set null;

alter table public.project_review_files
  add column if not exists drawing_batch_id uuid
  references public.project_drawing_batches(id) on delete set null;

create index if not exists project_documents_drawing_batch_id_idx
  on public.project_documents(drawing_batch_id)
  where drawing_batch_id is not null;
create index if not exists project_review_files_drawing_batch_id_idx
  on public.project_review_files(drawing_batch_id)
  where drawing_batch_id is not null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.prepare_project_drawing_batch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or new.created_by is distinct from actor_id then
    raise exception 'Drawing batch creator must match the authenticated user';
  end if;

  if not (select public.is_manager()) and not exists (
    select 1
    from public.projects pr
    where pr.id = new.project_id
      and (
        pr.assigned_to = actor_id
        or exists (
          select 1 from public.project_workers pw
          where pw.project_id = pr.id and pw.worker_id = actor_id
        )
      )
  ) then
    raise exception 'User is not assigned to this project';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
  if new.batch_number is null or new.batch_number < 1 then
    select coalesce(max(batch_number), 0) + 1
      into new.batch_number
    from public.project_drawing_batches
    where project_id = new.project_id;
  end if;

  if new.assigned_drafter is null then
    select pw.worker_id
      into new.assigned_drafter
    from public.project_workers pw
    join public.profiles drafter on drafter.id = pw.worker_id
    where pw.project_id = new.project_id
      and (
        drafter.role = 'drafter'
        or lower(drafter.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)'
      )
    order by pw.created_at desc
    limit 1;
  elsif not exists (
    select 1
    from public.project_workers pw
    join public.profiles drafter on drafter.id = pw.worker_id
    where pw.project_id = new.project_id
      and pw.worker_id = new.assigned_drafter
      and (
        drafter.role = 'drafter'
        or lower(drafter.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)'
      )
  ) then
    raise exception 'Assigned drafter is not assigned to this project';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.prepare_project_drawing_batch()
  from public, anon, authenticated;

create trigger prepare_project_drawing_batch_before_insert
before insert on public.project_drawing_batches
for each row execute function private.prepare_project_drawing_batch();

create or replace function private.enforce_project_drawing_batch_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text;
  actor_name text;
  actor_is_manager boolean;
  actor_is_drafter boolean;
  actor_is_field_worker boolean;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select role, full_name
    into actor_role, actor_name
  from public.profiles
  where id = actor_id;

  actor_is_manager := (select public.is_manager());
  actor_is_drafter := actor_role = 'drafter'
    or lower(coalesce(actor_name, '')) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)';
  actor_is_field_worker := actor_role = 'field_worker' and exists (
    select 1
    from public.projects pr
    where pr.id = old.project_id
      and (
        pr.assigned_to = actor_id
        or exists (
          select 1 from public.project_workers pw
          where pw.project_id = pr.id and pw.worker_id = actor_id
        )
      )
  );

  if actor_is_manager then
    new.updated_at := now();
    return new;
  end if;

  if new.project_id is distinct from old.project_id
    or new.batch_number is distinct from old.batch_number
    or new.work_date is distinct from old.work_date
    or new.update_type is distinct from old.update_type
    or new.review_impact is distinct from old.review_impact
    or new.summary is distinct from old.summary
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.source_project_status is distinct from old.source_project_status
    or new.assigned_drafter is distinct from old.assigned_drafter then
    raise exception 'Only a manager can edit drawing batch details or assignment';
  end if;

  if new.status is not distinct from old.status then
    new.updated_at := old.updated_at;
    return new;
  end if;

  if actor_is_drafter and old.assigned_drafter = actor_id and (
    (old.status = 'pending_drafting' and new.status = 'in_drafting')
    or (old.status = 'in_drafting' and new.status = 'sent_to_review')
    or (old.status = 'sent_to_review' and new.status = 'in_drafting')
  ) then
    new.updated_at := now();
    return new;
  end if;

  if actor_is_field_worker
    and old.status = 'sent_to_review'
    and new.status = 'approved' then
    new.updated_at := now();
    return new;
  end if;

  raise exception 'This drawing batch status transition is not allowed';
end;
$$;

revoke execute on function private.enforce_project_drawing_batch_update()
  from public, anon, authenticated;

create trigger enforce_project_drawing_batch_update_before_update
before update on public.project_drawing_batches
for each row execute function private.enforce_project_drawing_batch_update();

create or replace function private.log_project_drawing_batch_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from actor_id then
      raise exception 'Drawing batch creator must match the authenticated user';
    end if;
    insert into public.project_drawing_batch_events (
      drawing_batch_id, event_type, new_status, note, created_by
    ) values (
      new.id, 'created', new.status, 'Drawing batch created', actor_id
    );
  else
    if new.status is distinct from old.status then
      insert into public.project_drawing_batch_events (
        drawing_batch_id, event_type, old_status, new_status, created_by
      ) values (
        new.id, 'status_changed', old.status, new.status, actor_id
      );
    end if;
    if new.assigned_drafter is distinct from old.assigned_drafter then
      insert into public.project_drawing_batch_events (
        drawing_batch_id, event_type, note, created_by
      ) values (
        new.id,
        'drafter_assigned',
        case
          when new.assigned_drafter is null then 'Drafter assignment removed'
          else 'Drafter assignment updated'
        end,
        actor_id
      );
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.log_project_drawing_batch_event()
  from public, anon, authenticated;

create trigger log_project_drawing_batch_event_after_change
after insert or update on public.project_drawing_batches
for each row execute function private.log_project_drawing_batch_event();

alter table public.project_drawing_batches enable row level security;
alter table public.project_drawing_batch_events enable row level security;

revoke all on table public.project_drawing_batches from anon, authenticated;
revoke all on table public.project_drawing_batch_events from anon, authenticated;
grant select, insert, update on table public.project_drawing_batches to authenticated;
grant select on table public.project_drawing_batch_events to authenticated;

create policy "drawing batches read related"
on public.project_drawing_batches for select
to authenticated
using (
  (select public.is_manager())
  or assigned_drafter = (select auth.uid())
  or exists (
    select 1
    from public.projects pr
    where pr.id = project_id
      and (
        pr.assigned_to = (select auth.uid())
        or exists (
          select 1 from public.project_workers pw
          where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
        )
      )
  )
);

create policy "drawing batches insert field or manager"
on public.project_drawing_batches for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select public.is_manager())
    or exists (
      select 1
      from public.projects pr
      where pr.id = project_id
        and (
          pr.assigned_to = (select auth.uid())
          or exists (
            select 1 from public.project_workers pw
            where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
          )
        )
    )
  )
);

create policy "drawing batches update related"
on public.project_drawing_batches for update
to authenticated
using (
  (select public.is_manager())
  or assigned_drafter = (select auth.uid())
  or exists (
    select 1
    from public.projects pr
    where pr.id = project_id
      and (
        pr.assigned_to = (select auth.uid())
        or exists (
          select 1 from public.project_workers pw
          where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
        )
      )
  )
)
with check (
  (select public.is_manager())
  or assigned_drafter = (select auth.uid())
  or exists (
    select 1
    from public.projects pr
    where pr.id = project_id
      and (
        pr.assigned_to = (select auth.uid())
        or exists (
          select 1 from public.project_workers pw
          where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
        )
      )
  )
);

create policy "drawing batch events read related"
on public.project_drawing_batch_events for select
to authenticated
using (
  (select public.is_manager())
  or exists (
    select 1
    from public.project_drawing_batches batch
    join public.projects pr on pr.id = batch.project_id
    where batch.id = drawing_batch_id
      and (
        batch.assigned_drafter = (select auth.uid())
        or pr.assigned_to = (select auth.uid())
        or exists (
          select 1 from public.project_workers pw
          where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
        )
      )
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.project_drawing_batches;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.project_drawing_batch_events;
  exception when duplicate_object then null;
  end;
end $$;
