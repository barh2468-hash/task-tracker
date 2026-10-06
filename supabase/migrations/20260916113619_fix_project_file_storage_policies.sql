-- Fix project file storage policies that accidentally resolved the unqualified
-- `name` column to projects.name inside the correlated subquery. The policies
-- must inspect storage.objects.name because it contains the project UUID as
-- the first path segment.

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
      where pr.id::text = (storage.foldername(objects.name))[1]
        and (
          pr.assigned_to = (select auth.uid())
          or exists (
            select 1
            from public.project_workers pw
            where pw.project_id = pr.id
              and pw.worker_id = (select auth.uid())
          )
        )
    )
  )
);

drop policy if exists "project documents storage insert managers or assigned field workers" on storage.objects;
create policy "project documents storage insert managers or assigned field workers" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-documents'
  and (storage.foldername(objects.name))[2] = (select auth.uid())::text
  and (
    public.is_manager()
    or (
      exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'field_worker'
      )
      and exists (
        select 1
        from public.projects pr
        where pr.id::text = (storage.foldername(objects.name))[1]
          and (
            pr.assigned_to = (select auth.uid())
            or exists (
              select 1
              from public.project_workers pw
              where pw.project_id = pr.id
                and pw.worker_id = (select auth.uid())
            )
          )
      )
    )
  )
);

drop policy if exists "project documents storage delete managers or uploader" on storage.objects;
create policy "project documents storage delete managers or uploader" on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-documents'
  and (
    public.is_manager()
    or (
      (storage.foldername(objects.name))[2] = (select auth.uid())::text
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'field_worker'
      )
      and exists (
        select 1
        from public.projects pr
        where pr.id::text = (storage.foldername(objects.name))[1]
          and (
            pr.assigned_to = (select auth.uid())
            or exists (
              select 1
              from public.project_workers pw
              where pw.project_id = pr.id
                and pw.worker_id = (select auth.uid())
            )
          )
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
      where pr.id::text = (storage.foldername(objects.name))[1]
        and (
          pr.assigned_to = (select auth.uid())
          or exists (
            select 1
            from public.project_workers pw
            where pw.project_id = pr.id
              and pw.worker_id = (select auth.uid())
          )
        )
    )
  )
);
