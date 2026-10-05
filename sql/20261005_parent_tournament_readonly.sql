-- SCMS Parent Tournament Read Only Access
-- Run after 20261003_tournaments.sql.
-- Parents only receive SELECT access through RLS.
-- Teacher write access remains unchanged.

drop policy if exists "Parents read linked tournaments" on public.tournaments;
create policy "Parents read linked tournaments"
on public.tournaments
for select
to authenticated
using (
  exists (
    select 1
    from public.tournament_players tp
    join public.parent_students ps on ps.student_id = tp.student_id
    where tp.tournament_id = tournaments.tournament_id
      and ps.parent_user_id = (select auth.uid())
  )
);

drop policy if exists "Parents read linked tournament players" on public.tournament_players;
create policy "Parents read linked tournament players"
on public.tournament_players
for select
to authenticated
using (
  exists (
    select 1
    from public.parent_students ps
    where ps.student_id = tournament_players.student_id
      and ps.parent_user_id = (select auth.uid())
  )
);

drop policy if exists "Parents read linked tournament rounds" on public.tournament_rounds;
create policy "Parents read linked tournament rounds"
on public.tournament_rounds
for select
to authenticated
using (
  exists (
    select 1
    from public.tournament_players tp
    join public.parent_students ps on ps.student_id = tp.student_id
    where tp.tournament_id = tournament_rounds.tournament_id
      and ps.parent_user_id = (select auth.uid())
  )
);

drop policy if exists "Parents read linked tournament matches" on public.tournament_matches;
create policy "Parents read linked tournament matches"
on public.tournament_matches
for select
to authenticated
using (
  exists (
    select 1
    from public.tournament_players tp
    join public.parent_students ps on ps.student_id = tp.student_id
    where tp.tournament_id = tournament_matches.tournament_id
      and ps.parent_user_id = (select auth.uid())
  )
);

drop policy if exists "Parents read linked tournament awards" on public.tournament_awards;
create policy "Parents read linked tournament awards"
on public.tournament_awards
for select
to authenticated
using (
  exists (
    select 1
    from public.parent_students ps
    where ps.student_id = tournament_awards.student_id
      and ps.parent_user_id = (select auth.uid())
  )
);

create index if not exists tournament_players_student_idx
  on public.tournament_players(student_id);

create index if not exists parent_students_user_student_idx
  on public.parent_students(parent_user_id,student_id);

create index if not exists tournament_rounds_tournament_round_idx
  on public.tournament_rounds(tournament_id,round_number);

create index if not exists tournament_matches_tournament_round_idx
  on public.tournament_matches(tournament_id,round_number,match_number);

create index if not exists tournament_awards_tournament_student_idx
  on public.tournament_awards(tournament_id,student_id);
