-- Complete the review workflow and classify PDFs exchanged between field teams
-- and drafters. This migration is idempotent so it also repairs installations
-- where the review UI existed before its table or storage policies were added.

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check check (
    status in (
      'בעבודה בשטח',
      'עבר לשרטוט',
      'נדרש GPR',
      'מחכה להיתרים',
      'נשלח להגהה',
      'הגהה הושלמה',
      'הושלם'
    )
  );

create table if not exists public.project_review_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  file_path text not null unique,
  file_name text not null,
  created_at timestamptz not null default now(),
  constraint project_review_files_name_length check (char_length(file_name) between 1 and 255),
  constraint project_review_files_pdf_name check (lower(file_name) like '%.pdf')
);

create index if not exists idx_project_review_files_project_created
  on public.project_review_files(project_id, created_at desc);

alter table public.project_review_files enable row level security;

drop policy if exists "review files read related" on public.project_review_files;
drop policy if exists "review files insert manager or assigned drafter" on public.project_review_files;
drop policy if exists "review files delete manager or uploader" on public.project_review_files;

create policy "review files read related" on public.project_review_files
for select to authenticated
using (
  public.is_manager()
  or exists (
    select 1
    from public.projects pr
    where pr.id = project_id
      and (
        pr.assigned_to = auth.uid()
        or exists (
          select 1 from public.project_workers pw
          where pw.project_id = pr.id and pw.worker_id = auth.uid()
        )
      )
  )
);

create policy "review files insert manager or assigned drafter" on public.project_review_files
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    public.is_manager()
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and (
            p.role = 'drafter'
            or lower(p.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)'
          )
      )
      and exists (
        select 1 from public.project_workers pw
        where pw.project_id = project_id and pw.worker_id = auth.uid()
      )
    )
  )
);

create policy "review files delete manager or uploader" on public.project_review_files
for delete to authenticated
using (
  public.is_manager()
  or (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.project_workers pw
      where pw.project_id = project_id and pw.worker_id = auth.uid()
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-review-files', 'project-review-files', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "review files storage read related" on storage.objects;
drop policy if exists "review files storage insert manager or assigned drafter" on storage.objects;
drop policy if exists "review files storage delete manager or uploader" on storage.objects;

create policy "review files storage read related" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-review-files'
  and (
    public.is_manager()
    or exists (
      select 1
      from public.projects pr
      where pr.id::text = (storage.foldername(name))[1]
        and (
          pr.assigned_to = auth.uid()
          or exists (
            select 1 from public.project_workers pw
            where pw.project_id = pr.id and pw.worker_id = auth.uid()
          )
        )
    )
  )
);

create policy "review files storage insert manager or assigned drafter" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-review-files'
  and (
    public.is_manager()
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and (
            p.role = 'drafter'
            or lower(p.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)'
          )
      )
      and exists (
        select 1 from public.project_workers pw
        where pw.project_id::text = (storage.foldername(name))[1]
          and pw.worker_id = auth.uid()
      )
    )
  )
);

create policy "review files storage delete manager or uploader" on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-review-files'
  and (
    public.is_manager()
    or (
      (storage.foldername(name))[2] = auth.uid()::text
      and exists (
        select 1 from public.project_workers pw
        where pw.project_id::text = (storage.foldername(name))[1]
          and pw.worker_id = auth.uid()
      )
    )
  )
);

alter table public.project_documents
  add column if not exists document_type text not null default 'general';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_documents_type_check'
      and conrelid = 'public.project_documents'::regclass
  ) then
    alter table public.project_documents
      add constraint project_documents_type_check check (
        document_type in ('general', 'boundary_sketch', 'drawing_source', 'drawing_correction')
      );
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.project_review_files;
  exception when duplicate_object then null;
  end;
end $$;
