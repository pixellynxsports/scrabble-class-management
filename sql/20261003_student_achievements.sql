-- Student Achievements
-- Stores achievement records and optional downloadable attachments for each student.
-- Run this migration in the Supabase SQL Editor.

create table if not exists public.student_achievements (
  achievement_id uuid primary key default gen_random_uuid(),
  student_id text not null,
  title text not null,
  category text not null default 'Achievement',
  achievement_date date not null default current_date,
  description text,
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  created_by uuid references auth.users(id),
  source_type text,
  source_id text,
  created_at timestamptz not null default now()
);

create index if not exists student_achievements_student_id_idx
  on public.student_achievements(student_id);

create index if not exists student_achievements_date_idx
  on public.student_achievements(achievement_date desc);

create index if not exists student_achievements_source_idx
  on public.student_achievements(source_type, source_id);

alter table public.student_achievements enable row level security;

drop policy if exists "Teachers manage student achievements" on public.student_achievements;
create policy "Teachers manage student achievements"
on public.student_achievements
for all
to authenticated
using (
  not exists (
    select 1 from public.parent_accounts pa
    where pa.user_id = auth.uid()
  )
)
with check (
  not exists (
    select 1 from public.parent_accounts pa
    where pa.user_id = auth.uid()
  )
);

drop policy if exists "Parents view linked student achievements" on public.student_achievements;
create policy "Parents view linked student achievements"
on public.student_achievements
for select
to authenticated
using (
  exists (
    select 1
    from public.parent_students ps
    where ps.parent_user_id = auth.uid()
      and ps.student_id = student_achievements.student_id
  )
);

insert into storage.buckets (id, name, public)
values ('student-achievements', 'student-achievements', false)
on conflict (id) do update set public = false;

drop policy if exists "Teachers upload achievement files" on storage.objects;
create policy "Teachers upload achievement files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-achievements'
  and not exists (
    select 1 from public.parent_accounts pa
    where pa.user_id = auth.uid()
  )
);

drop policy if exists "Teachers update achievement files" on storage.objects;
create policy "Teachers update achievement files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-achievements'
  and not exists (
    select 1 from public.parent_accounts pa
    where pa.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'student-achievements'
  and not exists (
    select 1 from public.parent_accounts pa
    where pa.user_id = auth.uid()
  )
);

drop policy if exists "Teachers delete achievement files" on storage.objects;
create policy "Teachers delete achievement files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-achievements'
  and not exists (
    select 1 from public.parent_accounts pa
    where pa.user_id = auth.uid()
  )
);

drop policy if exists "Parents read linked achievement files" on storage.objects;
create policy "Parents read linked achievement files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-achievements'
  and exists (
    select 1
    from public.parent_students ps
    where ps.parent_user_id = auth.uid()
      and ps.student_id = (storage.foldername(name))[1]
  )
);

drop policy if exists "Teachers read achievement files" on storage.objects;
create policy "Teachers read achievement files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-achievements'
  and not exists (
    select 1 from public.parent_accounts pa
    where pa.user_id = auth.uid()
  )
);
