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
    select
      admin_users.user_id,
      new.id,
      'review_requested',
      'Story ready for review',
      new.headline || ' is ready for an editorial decision.',
      '/admin/articles/' || new.id::text
    from public.admin_users;
  elsif tg_op = 'UPDATE' and new.status = 'published' and new.created_by is not null and exists (
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
  elsif tg_op = 'UPDATE' and new.status = 'draft' and old.status = 'ready_for_review' and new.created_by is not null and exists (
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
  after insert or update of status on public.gazette_articles
  for each row
  execute function public.create_editorial_status_notifications();
