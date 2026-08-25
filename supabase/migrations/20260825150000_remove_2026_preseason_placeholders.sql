-- Sleeper exposes the regular-season schedule during the NFL preseason with
-- both teams at zero. A weekly-finalize run incorrectly marked Week 2 as
-- complete, which made those placeholders appear as ties in public records.
delete from public.roster_snapshots
where season_id in (
  select id
  from public.seasons
  where year = 2026
    and sleeper_league_id = '1389719207712681984'
)
and week = 2;

delete from public.matchups as matchup
where matchup.season_id in (
  select id
  from public.seasons
  where year = 2026
    and sleeper_league_id = '1389719207712681984'
)
and matchup.week = 2
and not exists (
  select 1
  from public.matchup_teams as team
  where team.matchup_id = matchup.id
    and team.points <> 0
);
