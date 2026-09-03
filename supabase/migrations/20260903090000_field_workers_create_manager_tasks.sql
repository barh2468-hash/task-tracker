-- Allow a field worker to create a task only for a project assigned to them.
drop policy if exists "tasks insert managers" on public.project_tasks;
drop policy if exists "tasks insert managers or assigned field workers" on public.project_tasks;

create policy "tasks insert managers or assigned field workers" on public.project_tasks
for insert
with check (
  created_by = auth.uid()
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
  )
);
