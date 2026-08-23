drop policy if exists "Editors can stage unsaved inline artwork" on storage.objects;
create policy "Editors can stage unsaved inline artwork"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gazette-images'
    and name like 'draft-assets/' || auth.uid()::text || '/%'
    and (
      public.is_gazette_admin()
      or exists (
        select 1
        from public.publication_contributors
        where publication_contributors.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Editors can remove staged inline artwork" on storage.objects;
create policy "Editors can remove staged inline artwork"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gazette-images'
    and name like 'draft-assets/' || auth.uid()::text || '/%'
    and (
      public.is_gazette_admin()
      or exists (
        select 1
        from public.publication_contributors
        where publication_contributors.user_id = auth.uid()
      )
    )
  );
