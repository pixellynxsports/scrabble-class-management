-- SCMS Tournament Management
-- Run once in Supabase SQL Editor.
-- This migration is isolated from attendance, payments, orders and registration.

create table if not exists public.tournaments (
  tournament_id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  event_date date not null,
  start_time time,
  game text not null default 'Scrabble',
  format text not null check (format in ('single_elimination','double_elimination','round_robin','swiss','free_for_all','leaderboard')),
  status text not null default 'draft' check (status in ('draft','ready','active','completed','archived')),
  rounds_total integer,
  current_round integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.tournament_players (
  player_id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(tournament_id) on delete cascade,
  student_id text not null,
  display_name text not null,
  seed integer not null,
  status text not null default 'active',
  final_rank integer,
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  points numeric not null default 0,
  score_for integer not null default 0,
  score_against integer not null default 0,
  created_at timestamptz not null default now(),
  unique(tournament_id, student_id)
);

create table if not exists public.tournament_rounds (
  round_id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(tournament_id) on delete cascade,
  round_number integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(tournament_id, round_number)
);

create table if not exists public.tournament_matches (
  match_id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(tournament_id) on delete cascade,
  round_id uuid not null references public.tournament_rounds(round_id) on delete cascade,
  round_number integer not null,
  match_number integer not null,
  player1_id uuid references public.tournament_players(player_id) on delete set null,
  player2_id uuid references public.tournament_players(player_id) on delete set null,
  player1_score integer,
  player2_score integer,
  winner_player_id uuid references public.tournament_players(player_id) on delete set null,
  status text not null default 'open',
  table_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tournament_id, round_number, match_number)
);

create table if not exists public.tournament_awards (
  award_id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(tournament_id) on delete cascade,
  student_id text,
  student_name text,
  award_type text not null,
  rank integer,
  title text not null,
  certificate_path text,
  achievement_id uuid,
  created_at timestamptz not null default now(),
  unique(tournament_id, award_type)
);

create index if not exists tournaments_status_idx on public.tournaments(status);
create index if not exists tournament_players_tournament_idx on public.tournament_players(tournament_id);
create index if not exists tournament_matches_tournament_idx on public.tournament_matches(tournament_id);
create index if not exists tournament_awards_tournament_idx on public.tournament_awards(tournament_id);

alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_rounds enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_awards enable row level security;

drop policy if exists "Teachers manage tournaments" on public.tournaments;
create policy "Teachers manage tournaments" on public.tournaments for all to authenticated using (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid())) with check (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid()));

drop policy if exists "Teachers manage tournament players" on public.tournament_players;
create policy "Teachers manage tournament players" on public.tournament_players for all to authenticated using (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid())) with check (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid()));

drop policy if exists "Teachers manage tournament rounds" on public.tournament_rounds;
create policy "Teachers manage tournament rounds" on public.tournament_rounds for all to authenticated using (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid())) with check (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid()));

drop policy if exists "Teachers manage tournament matches" on public.tournament_matches;
create policy "Teachers manage tournament matches" on public.tournament_matches for all to authenticated using (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid())) with check (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid()));

drop policy if exists "Teachers manage tournament awards" on public.tournament_awards;
create policy "Teachers manage tournament awards" on public.tournament_awards for all to authenticated using (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid())) with check (not exists (select 1 from public.parent_accounts pa where pa.user_id=auth.uid()));

grant select,insert,update,delete on public.tournaments to authenticated;
grant select,insert,update,delete on public.tournament_players to authenticated;
grant select,insert,update,delete on public.tournament_rounds to authenticated;
grant select,insert,update,delete on public.tournament_matches to authenticated;
grant select,insert,update,delete on public.tournament_awards to authenticated;

alter table if exists public.student_achievements add column if not exists source_type text;
alter table if exists public.student_achievements add column if not exists source_id text;
create index if not exists student_achievements_source_idx on public.student_achievements(source_type,source_id);
