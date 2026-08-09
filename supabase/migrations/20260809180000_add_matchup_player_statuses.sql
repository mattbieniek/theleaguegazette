drop function if exists public.public_matchup_lineups(uuid[]);

create function public.public_matchup_lineups(target_matchup_team_ids uuid[])
returns table (
  matchup_team_id uuid,
  sleeper_player_id text,
  player_name text,
  player_position text,
  nfl_team text,
  player_status text,
  injury_status text,
  points numeric,
  is_starter boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    matchup_player.matchup_team_id,
    matchup_player.sleeper_player_id,
    coalesce(player.full_name, 'Player ' || matchup_player.sleeper_player_id),
    coalesce(player.position, '—'),
    matchup_player.nfl_team_at_week,
    player.status,
    player.injury_status,
    matchup_player.points,
    matchup_player.is_starter
  from public.matchup_players as matchup_player
  left join public.players as player
    on player.sleeper_player_id = matchup_player.sleeper_player_id
  where matchup_player.matchup_team_id = any(target_matchup_team_ids)
    and cardinality(target_matchup_team_ids) between 1 and 10;
$$;

revoke all on function public.public_matchup_lineups(uuid[]) from public;
grant execute on function public.public_matchup_lineups(uuid[]) to anon, authenticated;
