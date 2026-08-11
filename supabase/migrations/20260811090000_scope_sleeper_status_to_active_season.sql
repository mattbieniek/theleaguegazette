create or replace function public.admin_sleeper_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  v_active_season_id uuid;
  v_active_league_id text;
  v_active_season_year integer;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;

  select s.id, s.sleeper_league_id, s.year
  into v_active_season_id, v_active_league_id, v_active_season_year
  from public.seasons s
  order by s.year desc, s.updated_at desc
  limit 1;

  select jsonb_build_object(
    'active_season_year', v_active_season_year,
    'active_league_id', v_active_league_id,
    'league', coalesce((
      select to_jsonb(league_row)
      from (
        select id, name, sleeper_league_id, season, status, current_week,
          total_rosters, last_synced_at, updated_at
        from public.leagues
        where public.leagues.sleeper_league_id = v_active_league_id
        limit 1
      ) league_row
    ), 'null'::jsonb),
    'datasets', jsonb_build_array(
      jsonb_build_object(
        'key', 'players',
        'label', 'NFL players',
        'last_synced_at', (select max(last_synced_at) from public.players)
      ),
      jsonb_build_object(
        'key', 'managers',
        'label', 'League users',
        'last_synced_at', (select max(last_synced_at) from public.managers)
      ),
      jsonb_build_object(
        'key', 'rosters',
        'label', 'Teams and rosters',
        'last_synced_at', (
          select max(ft.last_synced_at)
          from public.fantasy_teams ft
          where ft.season_id = v_active_season_id
        )
      ),
      jsonb_build_object(
        'key', 'matchups',
        'label', 'Matchups',
        'last_synced_at', (
          select max(m.updated_at)
          from public.matchups m
          where m.season_id = v_active_season_id
        )
      ),
      jsonb_build_object(
        'key', 'drafts',
        'label', 'Draft history',
        'last_synced_at', (
          select max(d.last_synced_at)
          from public.drafts d
          where d.season_id = v_active_season_id
        )
      ),
      jsonb_build_object(
        'key', 'transactions',
        'label', 'Transactions',
        'last_synced_at', (
          select max(t.last_synced_at)
          from public.league_transactions t
          where t.season_id = v_active_season_id
        )
      ),
      jsonb_build_object(
        'key', 'snapshots',
        'label', 'Roster snapshots',
        'last_synced_at', (
          select max(rs.created_at)
          from public.roster_snapshots rs
          where rs.season_id = v_active_season_id
        )
      )
    ),
    'recent_runs', coalesce((
      select jsonb_agg(to_jsonb(run_row) order by run_row.started_at desc)
      from (
        select id, sync_type, status, started_at, completed_at,
          records_processed, error_message, details
        from public.sync_runs
        where sleeper_league_id is null
          or public.sync_runs.sleeper_league_id = v_active_league_id
        order by started_at desc
        limit 12
      ) run_row
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_sleeper_status() from public;
grant execute on function public.admin_sleeper_status() to authenticated;
