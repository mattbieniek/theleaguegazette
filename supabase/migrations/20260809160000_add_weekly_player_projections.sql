create table if not exists public.player_weekly_projections (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  season_year integer not null,
  week integer not null check (week between 1 and 18),
  fantasy_team_id uuid not null references public.fantasy_teams (id) on delete cascade,
  sleeper_player_id text not null references public.players (sleeper_player_id) on delete cascade,
  player_name text not null,
  position text not null,
  nfl_team text,
  projected_points numeric(10, 2) not null check (projected_points between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, week, sleeper_player_id)
);

create index if not exists player_weekly_projections_season_week_idx
  on public.player_weekly_projections (season_id, week);

create index if not exists player_weekly_projections_team_idx
  on public.player_weekly_projections (season_id, week, fantasy_team_id);

alter table public.player_weekly_projections enable row level security;

grant select on public.player_weekly_projections to anon, authenticated;
grant insert, update, delete on public.player_weekly_projections to authenticated;

create policy "Weekly player projections are public"
  on public.player_weekly_projections for select
  using (true);

create policy "Admins can manage weekly player projections"
  on public.player_weekly_projections for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop trigger if exists player_weekly_projections_updated_at on public.player_weekly_projections;
create trigger player_weekly_projections_updated_at
  before update on public.player_weekly_projections
  for each row execute function public.set_updated_at();
