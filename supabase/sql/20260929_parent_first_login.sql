-- Parent first login password change
-- Run once in Supabase SQL Editor.

alter table public.parent_accounts
add column if not exists must_change_password boolean not null default true;

update public.parent_accounts
set must_change_password = true;

-- Securely clear the first login flag for the signed in parent only.
-- This avoids granting parents broad UPDATE access to parent_accounts.
create or replace function public.complete_parent_first_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.parent_accounts
  set must_change_password = false,
      updated_at = now()
  where user_id = auth.uid();

  if not found then
    raise exception 'Parent account not found.';
  end if;
end;
$$;

revoke all on function public.complete_parent_first_login() from public;
grant execute on function public.complete_parent_first_login() to authenticated;
