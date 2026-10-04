-- Retain immutable source files and revision links while removing one version
-- from the application. Authenticated clients cannot UPDATE or DELETE rows.
alter table public.project_manhole_layouts
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id),
  add constraint manhole_deletion_actor check ((deleted_at is null) = (deleted_by is null));
create index manhole_layouts_deleted_by_idx on public.project_manhole_layouts(deleted_by) where deleted_by is not null;

alter policy "manhole layouts read assigned or manager" on public.project_manhole_layouts
using (
  deleted_at is null and ((select public.is_manager()) or exists (
    select 1 from public.projects pr where pr.id = project_manhole_layouts.project_id
    and (pr.assigned_to = (select auth.uid()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    ))
  ))
);
alter policy "manhole layouts insert assigned or manager" on public.project_manhole_layouts
with check (
  deleted_at is null and deleted_by is null and created_by = (select auth.uid()) and exists (
    select 1 from public.projects pr where pr.id = project_manhole_layouts.project_id
    and not coalesce(pr.is_archived, false)
    and ((select public.is_manager()) or pr.assigned_to = (select auth.uid()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    ))
  )
);

-- The privileged operation is private, checks the current actor and current
-- project assignments itself, and locks the row for idempotent retries.
create function private.delete_manhole_layout(layout_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  sheet public.project_manhole_layouts;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into sheet from public.project_manhole_layouts where id = layout_id for update;
  if not found then raise exception 'Layout unavailable' using errcode = '42501'; end if;
  if not coalesce(public.is_manager(), false) and not (
    sheet.created_by = actor_id and exists (
      select 1 from public.projects pr where pr.id = sheet.project_id
      and (pr.assigned_to = actor_id or exists (
        select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = actor_id
      ))
    )
  ) then raise exception 'Layout unavailable' using errcode = '42501'; end if;
  if sheet.deleted_at is null then
    update public.project_manhole_layouts set deleted_at = clock_timestamp(), deleted_by = actor_id where id = sheet.id;
  end if;
  return sheet.id;
end;
$$;
revoke all on function private.delete_manhole_layout(uuid) from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.delete_manhole_layout(uuid) to authenticated;
create function public.delete_manhole_layout(layout_id uuid)
returns uuid language sql security invoker set search_path = '' as $$
  select private.delete_manhole_layout(layout_id);
$$;
revoke all on function public.delete_manhole_layout(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_manhole_layout(uuid) to authenticated;

-- Saved PDFs, source and previews are readable only while their row is visible
-- through RLS. Deleted layouts cannot be opened or attached to a new email.
alter policy "manhole files read assigned or manager" on storage.objects
using (
  bucket_id = 'manhole-layouts' and exists (
    select 1 from public.project_manhole_layouts sheet
    where sheet.pdf_path = objects.name or sheet.source_path = objects.name or sheet.preview_path = objects.name
  )
);

-- Cleanup must still see deleted rows, otherwise hiding a row with RLS would
-- accidentally make its retained files look like incomplete uploads.
create function private.is_saved_manhole_file(file_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.project_manhole_layouts sheet
    where sheet.pdf_path = file_path or sheet.source_path = file_path or sheet.preview_path = file_path
  );
$$;
revoke all on function private.is_saved_manhole_file(text) from public, anon, authenticated, service_role;
grant execute on function private.is_saved_manhole_file(text) to authenticated;
alter policy "manhole files cleanup incomplete own saves" on storage.objects
using (
  bucket_id = 'manhole-layouts' and (storage.foldername(objects.name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.projects pr where pr.id::text = (storage.foldername(objects.name))[1]
    and ((select public.is_manager()) or pr.assigned_to = (select auth.uid()) or exists (
      select 1 from public.project_workers pw where pw.project_id = pr.id and pw.worker_id = (select auth.uid())
    ))
  )
  and not private.is_saved_manhole_file(objects.name)
);
