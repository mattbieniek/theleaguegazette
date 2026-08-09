alter table public.matchup_players
  add column if not exists nfl_team_at_week text;

create or replace function public.preserve_matchup_player_nfl_team_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.nfl_team_at_week is not null then
    new.nfl_team_at_week := old.nfl_team_at_week;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_matchup_player_nfl_team_snapshot
  on public.matchup_players;
create trigger preserve_matchup_player_nfl_team_snapshot
before update on public.matchup_players
for each row execute function public.preserve_matchup_player_nfl_team_snapshot();

create or replace function public.public_matchup_lineups(target_matchup_team_ids uuid[])
returns table (
  matchup_team_id uuid,
  sleeper_player_id text,
  player_name text,
  player_position text,
  nfl_team text,
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

comment on column public.matchup_players.nfl_team_at_week is
  'NFL team captured when the weekly Sleeper matchup was synchronized. Historical snapshots are never overwritten.';
