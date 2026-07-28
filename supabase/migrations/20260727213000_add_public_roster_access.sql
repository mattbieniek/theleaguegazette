alter table public.players enable row level security;
alter table public.roster_players enable row level security;

grant select on public.players, public.roster_players to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'players'
      and policyname = 'Public can read players'
  ) then
    create policy "Public can read players"
      on public.players for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roster_players'
      and policyname = 'Public can read roster players'
  ) then
    create policy "Public can read roster players"
      on public.roster_players for select
      to anon, authenticated
      using (true);
  end if;
end
$$;
