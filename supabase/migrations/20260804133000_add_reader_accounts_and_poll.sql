create table if not exists public.reader_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 40),
  digest_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reader_profiles enable row level security;
grant select, update on public.reader_profiles to authenticated;

create policy "Readers can view their own profile"
  on public.reader_profiles for select to authenticated
  using (user_id = auth.uid());

create policy "Admins can view reader profiles"
  on public.reader_profiles for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "Readers can update their own profile"
  on public.reader_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_reader_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare requested_name text;
begin
  requested_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1),
    'Gazette Reader'
  );
  if char_length(requested_name) < 2 then requested_name := 'Gazette Reader'; end if;
  insert into public.reader_profiles (user_id, display_name)
  values (new.id, left(requested_name, 40))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_reader_profile_after_signup on auth.users;
create trigger create_reader_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_reader_profile();

insert into public.reader_profiles (user_id, display_name)
select users.id, left(case when char_length(split_part(users.email, '@', 1)) >= 2 then split_part(users.email, '@', 1) else 'Gazette Reader' end, 40)
from auth.users users
where not exists (
  select 1 from public.reader_profiles profiles where profiles.user_id = users.id
);

create or replace view public.public_reader_profiles as
select user_id, display_name from public.reader_profiles;

grant select on public.public_reader_profiles to anon, authenticated;

create table if not exists public.reader_poll_windows (
  season_year integer not null,
  week integer not null check (week between 1 and 18),
  is_open boolean not null default true,
  closes_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (season_year, week)
);

alter table public.reader_poll_windows enable row level security;
grant select on public.reader_poll_windows to anon, authenticated;
grant insert, update, delete on public.reader_poll_windows to authenticated;

create policy "Poll windows are publicly visible"
  on public.reader_poll_windows for select using (true);

create policy "Admins can manage poll windows"
  on public.reader_poll_windows for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create table if not exists public.reader_power_ballots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  season_year integer not null,
  week integer not null check (week between 1 and 18),
  rankings jsonb not null check (jsonb_typeof(rankings) = 'array' and jsonb_array_length(rankings) = 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, season_year, week)
);

create or replace function public.validate_reader_ballot()
returns trigger language plpgsql set search_path = '' as $$
declare unique_teams integer; unique_ranks integer; minimum_rank integer; maximum_rank integer;
begin
  select count(distinct item ->> 'teamId'), count(distinct (item ->> 'rank')::integer),
    min((item ->> 'rank')::integer), max((item ->> 'rank')::integer)
  into unique_teams, unique_ranks, minimum_rank, maximum_rank
  from jsonb_array_elements(new.rankings) item;
  if unique_teams <> 10 or unique_ranks <> 10 or minimum_rank <> 1 or maximum_rank <> 10 then
    raise exception 'A ballot must rank ten different teams from first through tenth.';
  end if;
  return new;
exception when invalid_text_representation then
  raise exception 'Every ballot ranking must contain a numeric rank.';
end;
$$;

drop trigger if exists validate_reader_ballot_before_write on public.reader_power_ballots;
create trigger validate_reader_ballot_before_write
before insert or update on public.reader_power_ballots
for each row execute function public.validate_reader_ballot();

alter table public.reader_power_ballots enable row level security;
grant select on public.reader_power_ballots to anon, authenticated;
grant insert, update on public.reader_power_ballots to authenticated;

create or replace function public.reader_poll_is_open(target_season integer, target_week integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select poll_window.is_open and (poll_window.closes_at is null or poll_window.closes_at > now())
     from public.reader_poll_windows poll_window
     where poll_window.season_year = target_season and poll_window.week = target_week),
    true
  );
$$;

grant execute on function public.reader_poll_is_open(integer, integer) to anon, authenticated;

create policy "Reader ballots are publicly visible"
  on public.reader_power_ballots for select using (true);

create policy "Verified readers can submit their ballot"
  on public.reader_power_ballots for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.reader_poll_is_open(season_year, week)
  );

create policy "Readers can update their open ballot"
  on public.reader_power_ballots for update to authenticated
  using (user_id = auth.uid() and public.reader_poll_is_open(season_year, week))
  with check (user_id = auth.uid() and public.reader_poll_is_open(season_year, week));

create index if not exists reader_power_ballots_edition_idx
  on public.reader_power_ballots (season_year desc, week desc);

create or replace function public.set_reader_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists reader_profiles_updated_at on public.reader_profiles;
create trigger reader_profiles_updated_at before update on public.reader_profiles
for each row execute function public.set_reader_updated_at();

drop trigger if exists reader_power_ballots_updated_at on public.reader_power_ballots;
create trigger reader_power_ballots_updated_at before update on public.reader_power_ballots
for each row execute function public.set_reader_updated_at();
