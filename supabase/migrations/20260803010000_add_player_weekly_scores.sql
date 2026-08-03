create table if not exists public.player_weekly_scores (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  season_year integer not null,
  week integer not null check (week between 1 and 18),
  sleeper_player_id text not null,
  player_name text not null,
  position text not null,
  nfl_team text,
  points numeric not null default 0,
  raw_stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, week, sleeper_player_id)
);

create index if not exists player_weekly_scores_season_week_idx
  on public.player_weekly_scores (season_year, week);
create index if not exists player_weekly_scores_position_points_idx
  on public.player_weekly_scores (season_year, position, points desc);

alter table public.player_weekly_scores enable row level security;

create policy "Player weekly scores are public"
  on public.player_weekly_scores for select
  using (true);

create policy "Admins can manage player weekly scores"
  on public.player_weekly_scores for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
