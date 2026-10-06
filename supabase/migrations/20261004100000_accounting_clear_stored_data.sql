-- The accounting year-end table is now built in the browser from the two
-- uploaded files and exported to Excel; nothing is stored. Clears everything
-- the earlier flows saved. Tables and RLS policies are left in place.
delete from public.accounting_vehicle_payroll_records;
delete from public.accounting_vehicle_usage_records;
delete from public.accounting_card_balances;
delete from public.accounting_imports;
