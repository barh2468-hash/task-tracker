-- Keep the crew-only RPC for older clients. Both edits share one transaction
-- and the existing ownership checks, RLS, crew validation and crew audit.
create or replace function public.update_my_work_session_details(
  p_session_id uuid,
  p_crew_members jsonb,
  p_end_note text
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  work_row public.work_sessions;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into work_row from public.work_sessions
    where id = p_session_id and worker_id = (select auth.uid()) for update;
  if not found or work_row.ended_at is null then
    raise exception 'Only your own closed work session can be edited' using errcode = '42501';
  end if;

  perform public.update_my_work_session_crew(p_session_id, p_crew_members);
  if coalesce(work_row.end_note, '') is not distinct from coalesce(p_end_note, '') then return; end if;

  update public.work_sessions set end_note = coalesce(p_end_note, '')
    where id = p_session_id and worker_id = (select auth.uid());
  insert into public.status_history(project_id, old_status, new_status, changed_by, note)
    values(work_row.project_id, null, 'עודכנה הערת סיום לאחר סגירה', (select auth.uid()), p_end_note);
end;
$$;
revoke all on function public.update_my_work_session_details(uuid,jsonb,text) from public, anon;
grant execute on function public.update_my_work_session_details(uuid,jsonb,text) to authenticated;
