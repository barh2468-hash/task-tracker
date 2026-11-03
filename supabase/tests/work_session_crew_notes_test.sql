-- Run after the crew-notes migration. Fixtures and audits are rolled back.
begin;
set local statement_timeout = '20s';
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select id from public.profiles where role = 'admin' order by id limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  admin_id uuid := auth.uid();
  test_worker_id uuid;
  test_project_id uuid;
  closed_id uuid;
  open_id uuid;
  original_start timestamptz := '2026-11-02 06:00:00+00';
  original_end timestamptz := '2026-11-02 09:00:00+00';
  original_note text := E'Original note\nהערה מקורית';
  updated_note text := E'Original note\nהערה מקורית\nΕπιπλέον πληροφορίες <b> & =SUM(A1)';
  crew jsonb := '[{"id":null,"name":"חיים","source":"helper"}]';
  audits bigint;
begin
  select id into strict test_worker_id from public.profiles where role = 'field_worker' order by id limit 1;
  insert into public.projects(name, location, created_by, assigned_to)
    values('Crew notes regression', 'Test', admin_id, test_worker_id) returning id into test_project_id;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',test_worker_id,'role','authenticated')::text, true);
  insert into public.work_sessions(project_id, worker_id, started_at, ended_at, end_note)
    values(test_project_id, test_worker_id, original_start, original_end, original_note) returning id into closed_id;
  insert into public.work_sessions(project_id, worker_id, started_at)
    values(test_project_id, test_worker_id, now()) returning id into open_id;
  select count(*) into audits from public.status_history h where h.project_id = test_project_id;

  perform public.update_my_work_session_details(closed_id, '[]', updated_note);
  assert (select w.end_note = updated_note and w.crew_members = '[]'::jsonb
    and w.started_at = original_start and w.ended_at = original_end and not w.daily_drafting_ready
    from public.work_sessions w where w.id = closed_id), 'Note-only edits must preserve text, crew, times and closed state';
  assert (select count(*) = audits + 1 from public.status_history h where h.project_id = test_project_id), 'Note-only edits must be audited';
  perform public.update_my_work_session_details(closed_id, '[]', updated_note);
  assert (select count(*) = audits + 1 from public.status_history h where h.project_id = test_project_id), 'Unchanged saves must not duplicate audits';

  perform public.update_my_work_session_details(closed_id, crew, original_note);
  assert (select w.end_note = original_note and w.crew_members = crew from public.work_sessions w where w.id = closed_id), 'Crew and note must save together';
  begin
    perform public.update_my_work_session_details(closed_id, '[{"source":"invalid","name":"Bad"}]', 'Must not save');
    raise exception 'Invalid crew was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid crew member' then raise; end if;
  end;
  assert (select w.end_note = original_note and w.crew_members = crew from public.work_sessions w where w.id = closed_id), 'Failed crew validation must leave the note unchanged';

  perform public.update_my_work_session_details(closed_id, crew, '');
  assert (select w.end_note = '' from public.work_sessions w where w.id = closed_id), 'Clearing a note must be supported';
  perform public.update_my_work_session_details(closed_id, crew, original_note);
  perform public.update_my_work_session_crew(closed_id, '[]');
  assert (select w.end_note = original_note and w.crew_members = '[]'::jsonb from public.work_sessions w where w.id = closed_id), 'Legacy crew-only calls must preserve notes';

  begin
    perform public.update_my_work_session_details(open_id, '[]', updated_note);
    raise exception 'Open work session was editable';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated')::text, true);
  begin
    perform public.update_my_work_session_details(closed_id, '[]', updated_note);
    raise exception 'Another user could edit the session';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  begin
    perform public.update_my_work_session_details(closed_id, '[]', updated_note);
    raise exception 'An unauthenticated caller could edit the session';
  exception when insufficient_privilege then null; end;
  assert not has_function_privilege('anon', 'public.update_my_work_session_details(uuid,jsonb,text)', 'EXECUTE'), 'Anonymous callers must not have execute access';
end;
$$;
reset role;
rollback;
select 'Crew and notes: atomic saves, note-only changes, text preservation, no-op, clearing, legacy compatibility and access controls verified; fixtures rolled back' as result;
