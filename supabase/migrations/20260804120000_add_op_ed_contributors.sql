alter table public.publication_contributors
  drop constraint if exists publication_contributors_role_check;

alter table public.publication_contributors
  add constraint publication_contributors_role_check
  check (role in ('commissioner', 'op_ed'));

update public.publication_contributors
set role = 'op_ed'
where role = 'commissioner';

drop policy if exists "Commissioners can create Corner drafts" on public.gazette_articles;
drop policy if exists "Commissioners can read their own Corner stories" on public.gazette_articles;
drop policy if exists "Commissioners can update their own Corner drafts" on public.gazette_articles;
drop policy if exists "Commissioners can delete their own Corner drafts" on public.gazette_articles;
drop policy if exists "Commissioners can upload images for their own stories" on storage.objects;
drop policy if exists "Commissioners can remove images from their own stories" on storage.objects;

create policy "Contributors can create Op Ed drafts"
  on public.gazette_articles for insert to authenticated
  with check (
    created_by = auth.uid()
    and category = 'Op Ed'
    and status in ('draft', 'ready_for_review')
    and is_featured = false
    and homepage_order is null
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'op_ed'
    )
  );

create policy "Contributors can read their own Op Ed stories"
  on public.gazette_articles for select to authenticated
  using (
    created_by = auth.uid()
    and category = 'Op Ed'
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'op_ed'
    )
  );

create policy "Contributors can update their own Op Ed drafts"
  on public.gazette_articles for update to authenticated
  using (
    created_by = auth.uid()
    and category = 'Op Ed'
    and status in ('draft', 'ready_for_review')
    and exists (
      select 1 from public.publication_contributors
      where user_id = auth.uid() and role = 'op_ed'
    )
  )
  with check (
    created_by = auth.uid()
    and category = 'Op Ed'
    and status in ('draft', 'ready_for_review')
    and is_featured = false
    and homepage_order is null
  );

create policy "Contributors can delete their own Op Ed drafts"
  on public.gazette_articles for delete to authenticated
  using (
    created_by = auth.uid()
    and category = 'Op Ed'
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
        and gazette_articles.category = 'Op Ed'
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
        and gazette_articles.category = 'Op Ed'
    )
  );

create or replace function public.admin_add_publication_contributor(
  contributor_email text,
  contributor_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare contributor_user_id uuid;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Administrator access is required.';
  end if;
  if nullif(trim(contributor_display_name), '') is null then
    raise exception 'A display name is required.';
  end if;
  select id into contributor_user_id from auth.users
  where lower(email) = lower(trim(contributor_email)) limit 1;
  if contributor_user_id is null then
    raise exception 'No Supabase Authentication user exists with that email address.';
  end if;
  insert into public.publication_contributors (user_id, display_name, role)
  values (contributor_user_id, trim(contributor_display_name), 'op_ed')
  on conflict (user_id) do update
    set display_name = excluded.display_name, role = excluded.role;
  return contributor_user_id;
end;
$$;

create or replace function public.article_login_identity(target_article_id uuid)
returns table (user_id uuid, email text, login text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.gazette_articles article
    where article.id = target_article_id
      and (article.created_by = auth.uid() or exists (
        select 1 from public.admin_users where admin_users.user_id = auth.uid()
      ))
  ) then
    raise exception 'Editorial access is required.';
  end if;
  return query
    select users.id, users.email::text, split_part(users.email, '@', 1)::text
    from public.gazette_articles article
    join auth.users users on users.id = article.created_by
    where article.id = target_article_id;
end;
$$;

revoke all on function public.article_login_identity(uuid) from public;
grant execute on function public.article_login_identity(uuid) to authenticated;
