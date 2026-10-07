-- Archived student parent review workflow
-- Parent access: historical records + review request only.
-- Teacher access: review requests and final activate/archive decision.

create table if not exists public.student_review_requests (
  request_id bigint generated always as identity primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'Pending'
    check (status in ('Pending','Approved','Kept Archived')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text
);

create unique index if not exists student_review_requests_one_pending_idx
  on public.student_review_requests(student_id)
  where status = 'Pending';

create index if not exists student_review_requests_parent_idx
  on public.student_review_requests(parent_user_id, requested_at desc);

create index if not exists student_review_requests_student_idx
  on public.student_review_requests(student_id, requested_at desc);

alter table public.student_review_requests enable row level security;

revoke all on table public.student_review_requests from anon, authenticated;
grant select, insert, update on table public.student_review_requests to authenticated;
grant usage, select on sequence public.student_review_requests_request_id_seq to authenticated;

drop policy if exists "Parents read own review requests" on public.student_review_requests;
create policy "Parents read own review requests"
on public.student_review_requests
for select
to authenticated
using (
  parent_user_id = (select auth.uid())
);

drop policy if exists "Parents submit archived student review requests" on public.student_review_requests;
create policy "Parents submit archived student review requests"
on public.student_review_requests
for insert
to authenticated
with check (
  parent_user_id = (select auth.uid())
  and exists (
    select 1
    from public.parent_students ps
    join public.students s on s.student_id = ps.student_id
    where ps.parent_user_id = (select auth.uid())
      and ps.student_id = student_review_requests.student_id
      and coalesce(s.active, true) = false
  )
);

drop policy if exists "Teachers review student requests" on public.student_review_requests;
create policy "Teachers review student requests"
on public.student_review_requests
for select
to authenticated
using (
  not exists (
    select 1
    from public.parent_accounts pa
    where pa.user_id = (select auth.uid())
  )
);

drop policy if exists "Teachers update student requests" on public.student_review_requests;
create policy "Teachers update student requests"
on public.student_review_requests
for update
to authenticated
using (
  not exists (
    select 1
    from public.parent_accounts pa
    where pa.user_id = (select auth.uid())
  )
)
with check (
  not exists (
    select 1
    from public.parent_accounts pa
    where pa.user_id = (select auth.uid())
  )
);
