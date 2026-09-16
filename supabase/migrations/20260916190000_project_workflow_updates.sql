-- Project workflow updates: field-only assignments, review status rename,
-- additional notes, and image support for boundary/correction documents.

alter table public.projects
  add column if not exists additional_notes text;

alter table public.projects drop constraint if exists projects_status_check;

update public.projects
set status = 'עבר לבקרה'
where status = 'הגהה הושלמה';

update public.status_history
set old_status = 'עבר לבקרה'
where old_status = 'הגהה הושלמה';

update public.status_history
set new_status = 'עבר לבקרה'
where new_status = 'הגהה הושלמה';

alter table public.projects
  add constraint projects_status_check check (
    status in (
      'בעבודה בשטח',
      'עבר לשרטוט',
      'נדרש GPR',
      'מחכה להיתרים',
      'נשלח להגהה',
      'עבר לבקרה',
      'הושלם'
    )
  );

alter table public.project_documents
  add column if not exists mime_type text;

update public.project_documents
set mime_type = case
  when lower(file_name) like '%.pdf' then 'application/pdf'
  when lower(file_name) like '%.jpg' or lower(file_name) like '%.jpeg' then 'image/jpeg'
  when lower(file_name) like '%.png' then 'image/png'
  when lower(file_name) like '%.webp' then 'image/webp'
  when lower(file_name) like '%.heic' then 'image/heic'
  else mime_type
end
where mime_type is null;

alter table public.project_documents
  drop constraint if exists project_documents_pdf_name;
alter table public.project_documents
  drop constraint if exists project_documents_supported_name;
alter table public.project_documents
  add constraint project_documents_supported_name check (
    lower(file_name) ~ '\.(pdf|jpe?g|png|webp|heic)$'
  );

alter table public.project_documents
  drop constraint if exists project_documents_mime_type_check;
alter table public.project_documents
  add constraint project_documents_mime_type_check check (
    mime_type is null
    or mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Every authenticated participant who can access a project (manager, assigned
-- field worker, or assigned drafter) can read and preview its shared files.
drop policy if exists "project documents read related" on public.project_documents;
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

drop policy if exists "project documents storage read related" on storage.objects;
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

drop policy if exists "review files read related" on public.project_review_files;
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

drop policy if exists "review files storage read related" on storage.objects;
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
