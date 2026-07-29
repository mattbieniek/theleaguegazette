create or replace function public.admin_sleeper_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;

  select jsonb_build_object(
    'league', coalesce((
      select to_jsonb(league_row)
      from (
        select id, name, sleeper_league_id, season, status, current_week,
          total_rosters, last_synced_at, updated_at
        from public.leagues
        order by season desc, updated_at desc
        limit 1
      ) league_row
    ), 'null'::jsonb),
    'datasets', jsonb_build_array(
      jsonb_build_object('key', 'players', 'label', 'NFL players', 'last_synced_at', (select max(last_synced_at) from public.players)),
      jsonb_build_object('key', 'managers', 'label', 'League users', 'last_synced_at', (select max(last_synced_at) from public.managers)),
      jsonb_build_object('key', 'rosters', 'label', 'Teams and rosters', 'last_synced_at', (select max(last_synced_at) from public.fantasy_teams)),
      jsonb_build_object('key', 'matchups', 'label', 'Matchups', 'last_synced_at', (select max(updated_at) from public.matchups)),
      jsonb_build_object('key', 'drafts', 'label', 'Draft history', 'last_synced_at', (select max(last_synced_at) from public.drafts)),
      jsonb_build_object('key', 'transactions', 'label', 'Transactions', 'last_synced_at', (select max(last_synced_at) from public.league_transactions)),
      jsonb_build_object('key', 'snapshots', 'label', 'Roster snapshots', 'last_synced_at', (select max(created_at) from public.roster_snapshots))
    ),
    'recent_runs', coalesce((
      select jsonb_agg(to_jsonb(run_row) order by run_row.started_at desc)
      from (
        select id, sync_type, status, started_at, completed_at,
          records_processed, error_message, details
        from public.sync_runs
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
