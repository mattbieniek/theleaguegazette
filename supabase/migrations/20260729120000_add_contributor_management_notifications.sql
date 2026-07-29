create table if not exists public.editorial_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid references public.gazette_articles (id) on delete cascade,
  kind text not null check (kind in ('review_requested', 'story_published', 'changes_requested')),
  title text not null,
  message text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists editorial_notifications_recipient_created_idx
  on public.editorial_notifications (recipient_user_id, created_at desc);

alter table public.editorial_notifications enable row level security;

create policy "Users can read their own editorial notifications"
  on public.editorial_notifications for select
  to authenticated
  using (recipient_user_id = auth.uid());

create policy "Users can update their own editorial notifications"
  on public.editorial_notifications for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

create or replace function public.admin_publication_contributors()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    contributor.user_id,
    auth_user.email::text,
    contributor.display_name,
    contributor.role,
    contributor.created_at
  from public.publication_contributors as contributor
  join auth.users as auth_user on auth_user.id = contributor.user_id
  where exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
  order by contributor.created_at desc;
$$;

create or replace function public.admin_add_publication_contributor(
  contributor_email text,
  contributor_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  contributor_user_id uuid;
begin
  if not exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ) then
    raise exception 'Administrator access is required.';
  end if;

  if nullif(trim(contributor_display_name), '') is null then
    raise exception 'A display name is required.';
  end if;

  select id into contributor_user_id
  from auth.users
  where lower(email) = lower(trim(contributor_email))
  limit 1;

  if contributor_user_id is null then
    raise exception 'No Supabase Authentication user exists with that email address.';
  end if;

  insert into public.publication_contributors (user_id, display_name, role)
  values (contributor_user_id, trim(contributor_display_name), 'commissioner')
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        role = excluded.role;

  return contributor_user_id;
end;
$$;

create or replace function public.admin_remove_publication_contributor(
  contributor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ) then
    raise exception 'Administrator access is required.';
  end if;

  delete from public.publication_contributors
  where user_id = contributor_user_id;
end;
$$;

revoke all on function public.admin_publication_contributors() from public;
revoke all on function public.admin_add_publication_contributor(text, text) from public;
revoke all on function public.admin_remove_publication_contributor(uuid) from public;
grant execute on function public.admin_publication_contributors() to authenticated;
grant execute on function public.admin_add_publication_contributor(text, text) to authenticated;
grant execute on function public.admin_remove_publication_contributor(uuid) to authenticated;

create or replace function public.create_editorial_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'ready_for_review' then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    )
    select
      admin_users.user_id,
      new.id,
      'review_requested',
      'Story ready for review',
      new.headline || ' is ready for an editorial decision.',
      '/admin/articles/' || new.id::text
    from public.admin_users;
  elsif new.status = 'published' and new.created_by is not null and exists (
    select 1 from public.publication_contributors where user_id = new.created_by
  ) then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    ) values (
      new.created_by,
      new.id,
      'story_published',
      'Your story was published',
      new.headline || ' is now live in The League Gazette.',
      '/gazette/' || new.slug
    );
  elsif new.status = 'draft' and old.status = 'ready_for_review' and new.created_by is not null and exists (
    select 1 from public.publication_contributors where user_id = new.created_by
  ) then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    ) values (
      new.created_by,
      new.id,
      'changes_requested',
      'Story returned for changes',
      new.headline || ' was returned to draft for additional work.',
      '/admin/articles/' || new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists create_editorial_status_notifications on public.gazette_articles;
create trigger create_editorial_status_notifications
  after update of status on public.gazette_articles
  for each row
  execute function public.create_editorial_status_notifications();
