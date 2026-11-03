-- Evaluate identity/role once per statement rather than at every joined row.
-- ALTER preserves policy roles, permissiveness, commands and write checks.
set local lock_timeout = '3s';

alter policy "profiles read own or managers" on public.profiles
  using (id = (select auth.uid()) or (select public.is_manager()));
alter policy "project workers read related" on public.project_workers
  using (worker_id = (select auth.uid()) or (select public.is_manager()));
alter policy "drafters_can_view_project_workers" on public.project_workers
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'drafter'));
alter policy "projects read assigned or managers" on public.projects
  using (assigned_to = (select auth.uid()) or (select public.is_manager()) or exists (
    select 1 from public.project_workers pw where pw.project_id = projects.id and pw.worker_id = (select auth.uid())
  ));
alter policy "drafters_can_view_drafting_projects" on public.projects
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'drafter')
    and status in ('עבר לשרטוט', 'נשלח להגהה'));
alter policy "tasks read related" on public.project_tasks
  using (exists (select 1 from public.projects pr where pr.id = project_tasks.project_id and (
    pr.assigned_to = (select auth.uid()) or (select public.is_manager()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    )
  )));
alter policy "history read related" on public.status_history
  using (exists (select 1 from public.projects pr where pr.id = status_history.project_id and (
    pr.assigned_to = (select auth.uid()) or (select public.is_manager()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    )
  )));

-- Recent history is loaded often; index both the global feed and project feed.
-- Tables are small (about 2,400 history rows), so ordinary index creation is bounded.
create index if not exists status_history_created_id_idx on public.status_history (created_at desc, id);
create index if not exists status_history_project_created_idx on public.status_history (project_id, created_at desc, id);
