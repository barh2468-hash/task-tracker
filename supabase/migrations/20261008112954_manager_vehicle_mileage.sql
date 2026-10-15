-- Existing vehicles keep an unknown (NULL) odometer reading until entered.
alter table public.manager_vehicles
  add column current_mileage integer
  constraint manager_vehicles_nonnegative_mileage check (current_mileage >= 0);
