-- New student registration migration
create table if not exists public.student_registrations (registration_id bigint generated always as identity primary key, registration_type text not null, parent_user_id uuid references auth.users(id) on delete cascade, parent_name text not null, parent_email text not null, parent_whatsapp text, student_name text not null, school text, age integer, scrabble_experience text, preferred_class_time text not null, status text not null default 'Pending Review', rejection_reason text, student_id text, submitted_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references auth.users(id));
create index if not exists student_registrations_status_idx on public.student_registrations(status, submitted_at desc);
create index if not exists student_registrations_parent_idx on public.student_registrations(parent_user_id);
create index if not exists student_registrations_email_idx on public.student_registrations(lower(parent_email));
alter table public.student_registrations enable row level security;
revoke all on public.student_registrations from anon;
grant select on public.student_registrations to authenticated;
grant select, insert, update, delete on public.student_registrations to service_role;
drop policy if exists "Parents can view their registrations" on public.student_registrations;
create policy "Parents can view their registrations" on public.student_registrations for select to authenticated using (parent_user_id = (select auth.uid()));
drop policy if exists "Teacher can view registrations" on public.student_registrations;
create policy "Teacher can view registrations" on public.student_registrations for select to authenticated using (not exists (select 1 from public.parent_accounts pa where pa.user_id = (select auth.uid())));
drop policy if exists "Teacher can update registrations" on public.student_registrations;
create policy "Teacher can update registrations" on public.student_registrations for update to authenticated using (not exists (select 1 from public.parent_accounts pa where pa.user_id = (select auth.uid()))) with check (not exists (select 1 from public.parent_accounts pa where pa.user_id = (select auth.uid())));
create or replace function public.next_student_id_for_registration() returns text language plpgsql security definer set search_path = public as $$ declare next_number integer; begin perform pg_advisory_xact_lock(839023); select coalesce(max((substring(student_id from 3))::integer),22)+1 into next_number from public.students where student_id ~ '^SC[0-9]+$'; return 'SC' || lpad(next_number::text,3,'0'); end; $$;
revoke all on function public.next_student_id_for_registration() from public;
grant execute on function public.next_student_id_for_registration() to service_role;
