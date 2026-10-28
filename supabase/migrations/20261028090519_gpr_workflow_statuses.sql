-- Preserve existing scheduled work. Retire approval into the clarification stage.
alter table public.gpr_work_orders drop constraint gpr_work_orders_status_check;
update public.gpr_work_orders set status='clarification' where status='approval';
alter table public.gpr_work_orders add constraint gpr_work_orders_status_check
  check (status in ('new','scheduled','scanning','interpretation','clarification','completed','cancelled'));
