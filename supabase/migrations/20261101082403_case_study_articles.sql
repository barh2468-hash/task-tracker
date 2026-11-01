-- Native article content shares the existing project grants, publication and RLS.
alter table public.demo_case_studies
  add column challenge text not null default '' check (char_length(challenge) <= 16000),
  add column work_process text not null default '' check (char_length(work_process) <= 16000),
  add column solution text not null default '' check (char_length(solution) <= 16000),
  add column outcome text not null default '' check (char_length(outcome) <= 16000);
