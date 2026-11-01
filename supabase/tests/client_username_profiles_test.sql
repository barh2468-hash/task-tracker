begin;
select set_config('client_test.id',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('client_test.id')::uuid,current_setting('client_test.id')||'@clients.maya.invalid');
do $$ begin
  begin
    insert into public.profiles(id,email,full_name,role) values(current_setting('client_test.id')::uuid,current_setting('client_test.id')||'@clients.maya.invalid','Client alias fixture','field_worker');
    raise exception 'Client alias was allowed an employee role';
  exception when check_violation then null; end;
end $$;
insert into public.profiles(id,email,full_name,role) values(current_setting('client_test.id')::uuid,current_setting('client_test.id')||'@clients.maya.invalid','Client alias fixture','demo');
do $$ begin
  begin
    update public.profiles set role='admin' where id=current_setting('client_test.id')::uuid;
    raise exception 'Client alias was promoted to administrator';
  exception when check_violation then null; end;
end $$;
rollback;
select 'Client aliases are restricted to read-only profiles; fixtures rolled back.' as result;
