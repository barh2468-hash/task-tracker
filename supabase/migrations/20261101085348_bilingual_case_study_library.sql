-- Curated example projects can stand alone without creating operational jobs.
alter table public.demo_project_showcases
  add column source_project_id uuid references public.projects(id) on delete cascade,
  add column import_key text unique,
  add column translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translations) = 'object' and octet_length(translations::text) <= 131072);
update public.demo_project_showcases set source_project_id=project_id;
alter table public.demo_project_showcases drop constraint demo_project_showcases_project_id_fkey;
alter table public.demo_project_showcases alter column project_id set default gen_random_uuid();
create unique index demo_showcase_source_project_idx on public.demo_project_showcases(source_project_id);

alter table public.demo_case_studies
  alter column file_path drop not null,
  add column client_name text not null default '' check (char_length(client_name) <= 300),
  add column technical_details text not null default '' check (char_length(technical_details) <= 6000),
  add column translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translations) = 'object' and octet_length(translations::text) <= 131072);

create table public.demo_case_study_media (
  id uuid primary key default gen_random_uuid(),
  case_study_id uuid not null references public.demo_case_studies(id) on delete cascade,
  file_path text not null unique check (file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  position integer not null default 0 check (position >= 0),
  caption text not null check (char_length(caption) between 1 and 1000),
  caption_en text not null check (char_length(caption_en) between 1 and 1000)
);
create index demo_case_study_media_study_idx on public.demo_case_study_media(case_study_id);
alter table public.demo_case_study_media enable row level security;
revoke all on public.demo_case_study_media from anon;
grant select,insert,update,delete on public.demo_case_study_media to authenticated;
grant all on public.demo_case_study_media to service_role;
create policy demo_media_manage on public.demo_case_study_media for all to authenticated
  using ((select public.is_manager())) with check ((select public.is_manager()));
create policy demo_media_read on public.demo_case_study_media for select to authenticated
  using ((select private.is_demo()) and exists (
    select 1 from public.demo_case_studies d where d.id=case_study_id
  ));

update storage.buckets set allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp']
where id='demo-case-studies';
drop policy demo_storage_boundary on storage.objects;
create policy demo_storage_boundary on storage.objects as restrictive for all to authenticated
  using ((not (select private.is_demo()) and bucket_id <> 'demo-case-studies') or (
    bucket_id='demo-case-studies' and ((select public.is_manager()) or (
      (select private.is_demo()) and (
        exists(select 1 from public.demo_case_studies d where d.file_path=name) or
        exists(select 1 from public.demo_case_study_media m where m.file_path=name)
      )
    ))
  )) with check (not (select private.is_demo()) and (bucket_id <> 'demo-case-studies' or (select public.is_manager())));
create policy demo_image_read on storage.objects for select to authenticated
  using (bucket_id='demo-case-studies' and exists (
    select 1 from public.demo_case_study_media m where m.file_path=name
  ));
