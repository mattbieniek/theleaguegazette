update public.gazette_articles
set category = 'Op-Ed'
where category = 'Op Ed';
drop policy if exists "Contributors can create Op Ed drafts" on public.gazette_articles;
drop policy if exists "Contributors can read their own Op Ed stories" on public.gazette_articles;
drop policy if exists "Contributors can update their own Op Ed drafts" on public.gazette_articles;
drop policy if exists "Contributors can delete their own Op Ed drafts" on public.gazette_articles;
drop policy if exists "Contributors can upload their story images" on storage.objects;
drop policy if exists "Contributors can remove their story images" on storage.objects;
create policy "Contributors can create Op-Ed drafts"
  on public.gazette_articles for insert to authenticated
  with check (
    created_by = auth.uid()
    and category = 'Op-Ed'
    and status in ('draft', 'ready_for_review')
    and is_featured = false
    and homepage_order is null
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'op_ed'
    )
  );
create policy "Contributors can read their own Op-Ed stories"
  on public.gazette_articles for select to authenticated
  using (
    created_by = auth.uid()
    and category = 'Op-Ed'
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'op_ed'
    )
  );
create policy "Contributors can update their own Op-Ed drafts"
  on public.gazette_articles for update to authenticated
  using (
    created_by = auth.uid()
    and category = 'Op-Ed'
    and status in ('draft', 'ready_for_review')
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'op_ed'
    )
  )
  with check (
    created_by = auth.uid()
    and category = 'Op-Ed'
    and status in ('draft', 'ready_for_review')
    and is_featured = false
    and homepage_order is null
  );
create policy "Contributors can delete their own Op-Ed drafts"
  on public.gazette_articles for delete to authenticated
  using (
    created_by = auth.uid()
    and category = 'Op-Ed'
    and status in ('draft', 'ready_for_review')
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'op_ed'
    )
  );
create policy "Contributors can upload their story images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gazette-images'
    and exists (
      select 1 from public.gazette_articles
      where gazette_articles.id = case
          when split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then split_part(name, '/', 2)::uuid else null end
        and gazette_articles.created_by = auth.uid()
        and gazette_articles.category = 'Op-Ed'
    )
  );
create policy "Contributors can remove their story images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gazette-images'
    and exists (
      select 1 from public.gazette_articles
      where gazette_articles.id = case
          when split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then split_part(name, '/', 2)::uuid else null end
        and gazette_articles.created_by = auth.uid()
        and gazette_articles.category = 'Op-Ed'
    )
  );
