-- Managers may delete any project photo. Field workers may delete photos only
-- from projects assigned to them, including additional project assignments.
drop policy if exists "photos delete managers" on public.project_photos;
drop policy if exists "photos delete managers or assigned field workers" on public.project_photos;

create policy "photos delete managers or assigned field workers" on public.project_photos
for delete
using (
  public.is_manager()
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'field_worker'
    )
    and exists (
      select 1
      from public.projects pr
      where pr.id = project_id
        and (
          pr.assigned_to = auth.uid()
          or exists (
            select 1
            from public.project_workers pw
            where pw.project_id = pr.id
              and pw.worker_id = auth.uid()
          )
        )
    )
  )
);

drop policy if exists "project photos delete managers" on storage.objects;
drop policy if exists "project photos delete managers or assigned field workers" on storage.objects;

create policy "project photos delete managers or assigned field workers" on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-photos'
  and (
    public.is_manager()
    or (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'field_worker'
      )
      and exists (
        select 1
        from public.projects pr
        where pr.id::text = (storage.foldername(name))[1]
          and (
            pr.assigned_to = auth.uid()
            or exists (
              select 1
              from public.project_workers pw
              where pw.project_id = pr.id
                and pw.worker_id = auth.uid()
            )
          )
      )
    )
  )
);
