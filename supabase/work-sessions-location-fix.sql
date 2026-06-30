-- Location support for work session start/end.
-- Run once in Supabase SQL Editor.

alter table public.work_sessions
  add column if not exists started_lat double precision,
  add column if not exists started_lng double precision,
  add column if not exists started_accuracy double precision,
  add column if not exists ended_lat double precision,
  add column if not exists ended_lng double precision,
  add column if not exists ended_accuracy double precision;

create index if not exists work_sessions_started_location_idx
  on public.work_sessions(started_lat, started_lng)
  where started_lat is not null and started_lng is not null;

create index if not exists work_sessions_ended_location_idx
  on public.work_sessions(ended_lat, ended_lng)
  where ended_lat is not null and ended_lng is not null;
