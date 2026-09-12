-- Run this once in Supabase SQL Editor before using the online website.
-- The current website stores the manual-registration commitment checkbox.

alter table public.students
add column if not exists commitment_confirmed text;

-- Confirm the column exists.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'students'
  and column_name = 'commitment_confirmed';
