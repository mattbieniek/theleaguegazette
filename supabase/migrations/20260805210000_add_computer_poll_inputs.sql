create or replace function public.public_computer_poll_lineups(
  target_season_year integer,
  target_through_week integer
)
returns table (
  fantasy_team_id uuid,
  week integer,
  sleeper_player_id text,
  player_position text,
  points numeric,
  is_starter boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    matchup_team.fantasy_team_id,
    matchup.week,
    matchup_player.sleeper_player_id,
    coalesce(player.position, '—'),
    matchup_player.points,
    matchup_player.is_starter
  from public.matchup_players as matchup_player
  join public.matchup_teams as matchup_team
    on matchup_team.id = matchup_player.matchup_team_id
  join public.matchups as matchup
    on matchup.id = matchup_team.matchup_id
  join public.seasons as season
    on season.id = matchup.season_id
  left join public.players as player
    on player.sleeper_player_id = matchup_player.sleeper_player_id
  where season.year = target_season_year
    and matchup.week between 1 and target_through_week
    and target_season_year between 2000 and 2200
    and target_through_week between 1 and 18;
$$;

revoke all on function public.public_computer_poll_lineups(integer, integer) from public;
grant execute on function public.public_computer_poll_lineups(integer, integer) to anon, authenticated;
