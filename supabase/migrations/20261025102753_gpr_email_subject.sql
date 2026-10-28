alter table public.gpr_work_orders
  add column source_subject text not null default '' check (length(source_subject) <= 1000);
