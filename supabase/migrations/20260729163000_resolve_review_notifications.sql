delete from public.editorial_notifications as notification
using public.gazette_articles as article
where notification.article_id = article.id
  and notification.kind = 'review_requested'
  and article.status <> 'ready_for_review';

create or replace function public.resolve_editorial_review_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'ready_for_review' and new.status <> 'ready_for_review' then
    delete from public.editorial_notifications
    where article_id = new.id
      and kind = 'review_requested';
  end if;

  return new;
end;
$$;

drop trigger if exists resolve_editorial_review_notifications on public.gazette_articles;
create trigger resolve_editorial_review_notifications
  after update of status on public.gazette_articles
  for each row
  execute function public.resolve_editorial_review_notifications();
