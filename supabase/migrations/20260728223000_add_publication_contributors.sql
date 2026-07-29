alter table public.gazette_articles
  add column if not exists created_by uuid references auth.users (id) on delete set null;

create table if not exists public.publication_contributors (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'commissioner'
    check (role in ('commissioner')),
  created_at timestamptz not null default now()
);

alter table public.publication_contributors enable row level security;

create policy "Contributors can read their own profile"
  on public.publication_contributors for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can manage contributor profiles"
  on public.publication_contributors for all
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ));

create policy "Commissioners can create Corner drafts"
  on public.gazette_articles for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and category = 'Commissioner''s Corner'
    and status in ('draft', 'ready_for_review')
    and is_featured = false
    and homepage_order is null
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid()
        and role = 'commissioner'
        and display_name = gazette_articles.author_name
    )
  );

create policy "Commissioners can read their own Corner stories"
  on public.gazette_articles for select
  to authenticated
  using (
    created_by = auth.uid()
    and category = 'Commissioner''s Corner'
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'commissioner'
    )
  );

create policy "Commissioners can update their own Corner drafts"
  on public.gazette_articles for update
  to authenticated
  using (
    created_by = auth.uid()
    and category = 'Commissioner''s Corner'
    and status in ('draft', 'ready_for_review')
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'commissioner'
    )
  )
  with check (
    created_by = auth.uid()
    and category = 'Commissioner''s Corner'
    and status in ('draft', 'ready_for_review')
    and is_featured = false
    and homepage_order is null
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid()
        and role = 'commissioner'
        and display_name = gazette_articles.author_name
    )
  );

create policy "Commissioners can delete their own Corner drafts"
  on public.gazette_articles for delete
  to authenticated
  using (
    created_by = auth.uid()
    and category = 'Commissioner''s Corner'
    and status in ('draft', 'ready_for_review')
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'commissioner'
    )
  );

create policy "Commissioners can upload images for their own stories"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gazette-images'
    and exists (
      select 1 from public.gazette_articles
      where gazette_articles.id = case
          when split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then split_part(name, '/', 2)::uuid
          else null
        end
        and gazette_articles.created_by = auth.uid()
        and gazette_articles.category = 'Commissioner''s Corner'
    )
  );

create policy "Commissioners can remove images from their own stories"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gazette-images'
    and exists (
      select 1 from public.gazette_articles
      where gazette_articles.id = case
          when split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then split_part(name, '/', 2)::uuid
          else null
        end
        and gazette_articles.created_by = auth.uid()
        and gazette_articles.category = 'Commissioner''s Corner'
    )
  );
