create table if not exists public.editorial_review_events (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.gazette_articles(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('submitted', 'changes_requested', 'approved')),
  note text,
  created_at timestamptz not null default now(),
  constraint editorial_review_note_required check (
    action <> 'changes_requested' or length(trim(coalesce(note, ''))) > 0
  )
);

create index if not exists editorial_review_events_article_created_idx
  on public.editorial_review_events (article_id, created_at desc);

alter table public.editorial_review_events enable row level security;

create policy "Editorial participants can view review history"
on public.editorial_review_events for select
to authenticated
using (
  exists (select 1 from public.admin_users where user_id = auth.uid())
  or exists (
    select 1
    from public.gazette_articles
    join public.publication_contributors
      on publication_contributors.user_id = auth.uid()
    where gazette_articles.id = editorial_review_events.article_id
      and gazette_articles.created_by = auth.uid()
  )
);

create or replace function public.admin_return_article_for_changes(
  target_article_id uuid,
  review_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;

  if length(trim(coalesce(review_note, ''))) = 0 then
    raise exception 'A review note is required';
  end if;

  select status into current_status
  from public.gazette_articles
  where id = target_article_id
  for update;

  if current_status is null then
    raise exception 'Story not found';
  end if;

  if current_status <> 'ready_for_review' then
    raise exception 'Only stories ready for review can be returned for changes';
  end if;

  insert into public.editorial_review_events (article_id, actor_user_id, action, note)
  values (target_article_id, auth.uid(), 'changes_requested', trim(review_note));

  update public.gazette_articles
  set status = 'draft', published_at = null, updated_at = now()
  where id = target_article_id;
end;
$$;

revoke all on function public.admin_return_article_for_changes(uuid, text) from public;
grant execute on function public.admin_return_article_for_changes(uuid, text) to authenticated;

create or replace function public.create_editorial_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  if new.status = 'ready_for_review' then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    )
    select admin_users.user_id, new.id, 'review_requested', 'Story ready for review',
      new.headline || ' is ready for an editorial decision.', '/admin/articles/' || new.id::text
    from public.admin_users;

    if new.created_by is not null and exists (
      select 1 from public.publication_contributors where user_id = new.created_by
    ) then
      insert into public.editorial_review_events (article_id, actor_user_id, action)
      values (new.id, new.created_by, 'submitted');
    end if;
  elsif tg_op = 'UPDATE' and new.status = 'published' and new.created_by is not null and exists (
    select 1 from public.publication_contributors where user_id = new.created_by
  ) then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    ) values (
      new.created_by, new.id, 'story_published', 'Your story was published',
      new.headline || ' is now live in The League Gazette.', '/gazette/' || new.slug
    );
    insert into public.editorial_review_events (article_id, actor_user_id, action)
    values (new.id, auth.uid(), 'approved');
  elsif tg_op = 'UPDATE' and new.status = 'draft' and old.status = 'ready_for_review' and new.created_by is not null and exists (
    select 1 from public.publication_contributors where user_id = new.created_by
  ) then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    ) values (
      new.created_by, new.id, 'changes_requested', 'Story returned for changes',
      new.headline || ' was returned to draft with editorial feedback.', '/admin/articles/' || new.id::text
    );
  end if;

  return new;
end;
$$;
