-- Recoverable deletion retains mail IDs and issuer/order matching to prevent reimport.
alter table public.gpr_work_orders add column deleted_at timestamptz;
alter table public.gpr_work_orders add column deleted_by uuid references public.profiles(id) on delete set null;
create index gpr_work_orders_deleted_by_idx on public.gpr_work_orders(deleted_by) where deleted_by is not null;
create index notifications_unread_gpr_idx on public.notifications(recipient_id,created_at desc)
  where type='gpr_email_order_received' and not is_read;

create function public.set_gpr_order_deleted(p_order_id uuid,p_updated_at timestamptz,p_deleted boolean)
returns public.gpr_work_orders language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); result public.gpr_work_orders;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise insufficient_privilege using message='Administrator required';
  end if;
  if p_deleted is null then raise invalid_parameter_value using message='Deletion state required'; end if;
  update public.gpr_work_orders set
    deleted_at=case when p_deleted then clock_timestamp() else null end,
    deleted_by=case when p_deleted then actor else null end
  where id=p_order_id and updated_at=p_updated_at
    and ((p_deleted and deleted_at is null) or (not p_deleted and deleted_at is not null))
  returning * into result;
  if not found then raise sqlstate '40001' using message='GPR order changed; refresh and retry'; end if;
  if p_deleted then
    update public.notifications set is_read=true where gpr_order_id=p_order_id and recipient_id=actor and not is_read;
  end if;
  return result;
end $$;
revoke all on function public.set_gpr_order_deleted(uuid,timestamptz,boolean) from public,anon;
grant execute on function public.set_gpr_order_deleted(uuid,timestamptz,boolean) to authenticated;
