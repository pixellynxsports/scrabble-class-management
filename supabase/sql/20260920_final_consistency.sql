-- Final consistency migration for the 2026-09-20 project build.
-- Safe to run after the existing order payment proof migration.

alter table public.orders
drop constraint if exists order_status_check;

alter table public.orders
add constraint order_status_check
check (
  order_status in (
    'Pending Order',
    'Pending Payment',
    'Processing',
    'Order Done'
  )
);

update public.orders
set order_status = 'Pending Payment'
where order_status is null or trim(order_status) = '';
