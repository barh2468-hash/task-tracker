-- Immutable saved versions keep completed sheets separate from the local draft.
create table public.project_manhole_layouts (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  project_name text not null default '',
  created_by_name text not null default '',
  manhole_number text not null check (char_length(manhole_number) between 1 and 80),
  infrastructure text not null default '' check (char_length(infrastructure) <= 80),
  work_date date not null,
  file_name text not null check (char_length(file_name) between 1 and 240),
  pdf_path text not null unique,
  source_path text not null unique,
  preview_path text not null unique,
  pdf_size bigint not null check (pdf_size between 1 and 26214400),
  revision_of uuid references public.project_manhole_layouts(id),
  created_at timestamptz not null default now(),
  constraint manhole_pdf_path_matches_record check (pdf_path = project_id::text || '/' || created_by::text || '/' || id::text || '/report.pdf'),
  constraint manhole_source_path_matches_record check (source_path = project_id::text || '/' || created_by::text || '/' || id::text || '/source.json'),
  constraint manhole_preview_path_matches_record check (preview_path = project_id::text || '/' || created_by::text || '/' || id::text || '/preview.png')
);
create index manhole_layouts_project_created_idx on public.project_manhole_layouts(project_id, created_at desc);
create index manhole_layouts_worker_created_idx on public.project_manhole_layouts(created_by, created_at desc);
create index manhole_layouts_revision_idx on public.project_manhole_layouts(revision_of) where revision_of is not null;

alter table public.project_manhole_layouts enable row level security;
revoke all on public.project_manhole_layouts from public, anon, authenticated;
grant select, insert on public.project_manhole_layouts to authenticated;
grant all on public.project_manhole_layouts to service_role;

create policy "manhole layouts read assigned or manager" on public.project_manhole_layouts
for select to authenticated using (
  (select public.is_manager()) or exists (
    select 1 from public.projects pr where pr.id = project_manhole_layouts.project_id
    and (pr.assigned_to = (select auth.uid()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    ))
  )
);
create policy "manhole layouts insert assigned or manager" on public.project_manhole_layouts
for insert to authenticated with check (
  created_by = (select auth.uid()) and exists (
    select 1 from public.projects pr where pr.id = project_manhole_layouts.project_id
    and not coalesce(pr.is_archived, false)
    and ((select public.is_manager()) or pr.assigned_to = (select auth.uid()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    ))
  )
);

create schema if not exists private;
create function private.prepare_manhole_layout()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  select name into new.project_name from public.projects where id = new.project_id;
  select coalesce(full_name, '') into new.created_by_name from public.profiles where id = new.created_by;
  if new.revision_of is not null and not exists (
    select 1 from public.project_manhole_layouts previous
    where previous.id = new.revision_of and previous.project_id = new.project_id
  ) then raise exception 'Previous revision must belong to the same accessible project'; end if;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function private.prepare_manhole_layout() from public, anon, authenticated;
create trigger prepare_manhole_layout_before_insert before insert on public.project_manhole_layouts
for each row execute function private.prepare_manhole_layout();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('manhole-layouts', 'manhole-layouts', false, 26214400, array['application/pdf','application/json','image/png']);

create policy "manhole files read assigned or manager" on storage.objects
for select to authenticated using (
  bucket_id = 'manhole-layouts' and ((select public.is_manager()) or exists (
    select 1 from public.projects pr where pr.id::text = (storage.foldername(objects.name))[1]
    and (pr.assigned_to = (select auth.uid()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    ))
  ))
);
create policy "manhole files insert assigned or manager" on storage.objects
for insert to authenticated with check (
  bucket_id = 'manhole-layouts' and (storage.foldername(objects.name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.projects pr where pr.id::text = (storage.foldername(objects.name))[1]
    and not coalesce(pr.is_archived, false)
    and ((select public.is_manager()) or pr.assigned_to = (select auth.uid()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    ))
  )
);
-- Cleanup is allowed only for an uploader's incomplete save. Saved versions
-- cannot be overwritten or removed through the client Storage API.
create policy "manhole files cleanup incomplete own saves" on storage.objects
for delete to authenticated using (
  bucket_id = 'manhole-layouts' and (storage.foldername(objects.name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.projects pr where pr.id::text = (storage.foldername(objects.name))[1]
    and ((select public.is_manager()) or pr.assigned_to = (select auth.uid()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    ))
  )
  and not exists (
    select 1 from public.project_manhole_layouts sheet
    where sheet.pdf_path = objects.name or sheet.source_path = objects.name or sheet.preview_path = objects.name
  )
);

-- Server-only dispatch reservations prevent duplicate SMTP sends after retries.
create table public.manhole_layout_email_requests (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  request_hash text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','unknown')),
  result jsonb,
  created_at timestamptz not null default now()
);
create index manhole_email_requests_user_created_idx on public.manhole_layout_email_requests(user_id, created_at desc);
alter table public.manhole_layout_email_requests enable row level security;
revoke all on public.manhole_layout_email_requests from public, anon, authenticated;
grant all on public.manhole_layout_email_requests to service_role;
create policy "manhole email reservations server only" on public.manhole_layout_email_requests
for all to service_role using (true) with check (true);

create function public.reserve_manhole_email_request(request_id uuid, actor_id uuid, payload_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare previous public.manhole_layout_email_requests;
begin
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));
  select * into previous from public.manhole_layout_email_requests where id = request_id;
  if found then return to_jsonb(previous) || jsonb_build_object('existing',true); end if;
  if (select count(*) from public.manhole_layout_email_requests
      where user_id = actor_id and created_at > now() - interval '1 hour') >= 10
  then raise exception 'mail_rate_limited'; end if;
  insert into public.manhole_layout_email_requests(id,user_id,request_hash)
  values (request_id,actor_id,payload_hash) returning * into previous;
  return to_jsonb(previous) || jsonb_build_object('existing',false);
end;
$$;
revoke all on function public.reserve_manhole_email_request(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_manhole_email_request(uuid,uuid,text) to service_role;

alter publication supabase_realtime add table public.project_manhole_layouts;
