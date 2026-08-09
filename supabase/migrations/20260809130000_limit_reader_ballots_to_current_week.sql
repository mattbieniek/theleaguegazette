-- Reader ballots follow the active league week and adapt to the number of
-- franchises in that season rather than assuming a ten-team league.
alter table public.reader_power_ballots
  drop constraint if exists reader_power_ballots_rankings_check;

alter table public.reader_power_ballots
  add constraint reader_power_ballots_rankings_check
  check (
    jsonb_typeof(rankings) = 'array'
    and jsonb_array_length(rankings) between 2 and 20
  );

create or replace function public.reader_poll_is_current_week(target_season integer, target_week integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_season = (select max(year) from public.seasons)
    and target_week = least(
      coalesce((select max(week) from public.team_weekly_results where season_year = target_season), 0) + 1,
      17
    );
$$;

grant execute on function public.reader_poll_is_current_week(integer, integer) to anon, authenticated;

create or replace function public.validate_reader_ballot()
returns trigger language plpgsql set search_path = '' as $$
declare
  expected_teams integer;
  unique_teams integer;
  unique_ranks integer;
  minimum_rank integer;
  maximum_rank integer;
begin
  select count(*) into expected_teams
  from public.season_standings
  where season_year = new.season_year;

  select count(distinct item ->> 'teamId'), count(distinct (item ->> 'rank')::integer),
    min((item ->> 'rank')::integer), max((item ->> 'rank')::integer)
  into unique_teams, unique_ranks, minimum_rank, maximum_rank
  from jsonb_array_elements(new.rankings) item;

  if expected_teams < 2
    or unique_teams <> expected_teams
    or unique_ranks <> expected_teams
    or minimum_rank <> 1
    or maximum_rank <> expected_teams then
    raise exception 'A ballot must rank every team from first through last.';
  end if;
  return new;
exception when invalid_text_representation then
  raise exception 'Every ballot ranking must contain a numeric rank.';
end;
$$;

drop policy if exists "Verified readers can submit their ballot"
  on public.reader_power_ballots;
drop policy if exists "Readers can update their open ballot"
  on public.reader_power_ballots;

create policy "Verified readers can submit their ballot"
  on public.reader_power_ballots for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.reader_poll_is_current_week(season_year, week)
    and public.reader_poll_is_open(season_year, week)
  );

create policy "Readers can update their open ballot"
  on public.reader_power_ballots for update to authenticated
  using (
    user_id = auth.uid()
    and public.reader_poll_is_current_week(season_year, week)
    and public.reader_poll_is_open(season_year, week)
  )
  with check (
    user_id = auth.uid()
    and public.reader_poll_is_current_week(season_year, week)
    and public.reader_poll_is_open(season_year, week)
  );
