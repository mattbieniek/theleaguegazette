create or replace function public.admin_site_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  digest_enabled boolean,
  is_contributor boolean,
  is_admin boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    profile.user_id,
    auth_user.email::text,
    profile.display_name,
    profile.digest_enabled,
    contributor.user_id is not null,
    admin_user.user_id is not null,
    profile.created_at
  from public.reader_profiles as profile
  join auth.users as auth_user on auth_user.id = profile.user_id
  left join public.publication_contributors as contributor on contributor.user_id = profile.user_id
  left join public.admin_users as admin_user on admin_user.user_id = profile.user_id
  where exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
  order by profile.created_at desc;
$$;

create or replace function public.admin_set_contributor_access(
  target_user_id uuid,
  access_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_name text;
begin
  if not exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ) then
    raise exception 'Administrator access is required.';
  end if;

  if exists (
    select 1 from public.admin_users
    where admin_users.user_id = target_user_id
  ) then
    raise exception 'Administrator accounts already have full editorial access.';
  end if;

  if access_enabled then
    select display_name into account_name
    from public.reader_profiles
    where user_id = target_user_id;

    if account_name is null then
      raise exception 'No Gazette account exists for that user.';
    end if;

    insert into public.publication_contributors (user_id, display_name, role)
    values (target_user_id, account_name, 'op_ed')
    on conflict (user_id) do update
      set display_name = excluded.display_name,
          role = excluded.role;
  else
    delete from public.publication_contributors
    where user_id = target_user_id;
  end if;
end;
$$;

revoke all on function public.admin_site_accounts() from public;
revoke all on function public.admin_set_contributor_access(uuid, boolean) from public;
grant execute on function public.admin_site_accounts() to authenticated;
grant execute on function public.admin_set_contributor_access(uuid, boolean) to authenticated;

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
    player.nfl_team,
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
