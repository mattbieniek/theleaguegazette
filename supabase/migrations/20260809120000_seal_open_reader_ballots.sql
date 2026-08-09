-- Keep an open Reader Poll's rankings private until its voting window closes.
drop policy if exists "Reader ballots are publicly visible"
  on public.reader_power_ballots;

create policy "Readers can read closed ballots or their own ballot"
  on public.reader_power_ballots for select to anon, authenticated
  using (
    user_id = auth.uid()
    or not public.reader_poll_is_open(season_year, week)
    or exists (select 1 from public.admin_users where user_id = auth.uid())
  );
