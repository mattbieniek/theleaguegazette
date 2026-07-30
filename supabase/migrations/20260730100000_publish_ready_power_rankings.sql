create policy "Public can read ready power rankings"
  on public.power_rankings for select
  to anon, authenticated
  using (status = 'ready');
