-- Keep every manager-facing data source available to Supabase Realtime.
-- Each statement is idempotent so this migration is safe on databases where
-- some of the tables were already added to the publication manually.
do $$
begin
  begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.status_history; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.project_photos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.project_tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.project_workers; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.project_review_files; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.work_sessions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.attendance_sessions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.work_diaries; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;
