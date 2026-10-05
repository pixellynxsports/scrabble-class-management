-- SCMS Final Tournament Certificate Layer
-- Run after sql/20261003_tournaments.sql.
-- Safe additive migration. Existing tournament, parent, attendance,
-- payment and order data is preserved.

alter table if exists public.tournament_awards
  add column if not exists certificate_number text;

alter table if exists public.tournament_awards
  add column if not exists certificate_status text not null default 'pending';

alter table if exists public.tournament_awards
  add column if not exists certificate_caption text;

alter table if exists public.tournament_awards
  add column if not exists certificate_generated_at timestamptz;

alter table if exists public.student_achievements
  add column if not exists certificate_number text;

alter table if exists public.student_achievements
  add column if not exists certificate_status text;

alter table if exists public.student_achievements
  add column if not exists certificate_path text;

alter table if exists public.student_achievements
  add column if not exists certificate_thumbnail_path text;

alter table if exists public.student_achievements
  add column if not exists certificate_caption text;

alter table if exists public.student_achievements
  add column if not exists certificate_generated_at timestamptz;

create unique index if not exists tournament_awards_certificate_number_idx
  on public.tournament_awards(certificate_number)
  where certificate_number is not null;

create index if not exists tournament_awards_certificate_status_idx
  on public.tournament_awards(tournament_id,certificate_status);

create index if not exists student_achievements_certificate_idx
  on public.student_achievements(source_type,source_id,certificate_status);

grant select,insert,update,delete on public.student_achievements to authenticated;
