-- Shared PDF documents for projects. Managers can manage documents on every
-- project; field workers can upload to projects assigned to them. Everyone
-- who can access the project can read its documents.

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  file_path text not null unique,
  file_name text not null,
  file_size bigint not null,
  created_at timestamptz not null default now(),
  constraint project_documents_file_name_length check (char_length(file_name) between 1 and 255),
  constraint project_documents_pdf_name check (lower(file_name) like '%.pdf'),
  constraint project_documents_file_size check (file_size between 1 and 20971520)
);

create index if not exists idx_project_documents_project_created
  on public.project_documents(project_id, created_at desc);

alter table public.project_documents enable row level security;

drop policy if exists "project documents read related" on public.project_documents;
drop policy if exists "project documents insert managers or assigned field workers" on public.project_documents;
drop policy if exists "project documents delete managers or uploader" on public.project_documents;

create policy "project documents read related" on public.project_documents
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

create policy "project documents insert managers or assigned field workers" on public.project_documents
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    public.is_manager()
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'field_worker'
      )
      and exists (
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
    )
  )
);

create policy "project documents delete managers or uploader" on public.project_documents
for delete to authenticated
using (
  public.is_manager()
  or (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'field_worker'
    )
    and exists (
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
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project documents storage read related" on storage.objects;
drop policy if exists "project documents storage insert managers or assigned field workers" on storage.objects;
drop policy if exists "project documents storage delete managers or uploader" on storage.objects;

create policy "project documents storage read related" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-documents'
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

create policy "project documents storage insert managers or assigned field workers" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-documents'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    public.is_manager()
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'field_worker'
      )
      and exists (
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
  )
);

create policy "project documents storage delete managers or uploader" on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-documents'
  and (
    public.is_manager()
    or (
      (storage.foldername(name))[2] = auth.uid()::text
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'field_worker'
      )
      and exists (
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
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.project_documents;
  exception when duplicate_object then null;
  end;
end $$;

