create table if not exists public.gazette_article_view_events (
  article_id uuid not null references public.gazette_articles (id) on delete cascade,
  visitor_key text not null check (char_length(visitor_key) between 16 and 128),
  bucket bigint not null,
  created_at timestamptz not null default now(),
  primary key (article_id, visitor_key, bucket)
);

create table if not exists public.gazette_article_view_totals (
  article_id uuid primary key references public.gazette_articles (id) on delete cascade,
  view_count bigint not null default 0 check (view_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.gazette_article_view_events enable row level security;
alter table public.gazette_article_view_totals enable row level security;

revoke all on table public.gazette_article_view_events from anon, authenticated;
revoke all on table public.gazette_article_view_totals from anon, authenticated;

drop function if exists public.track_gazette_article_view(uuid, text);
create or replace function public.track_gazette_article_view(
  target_article_id uuid,
  target_visitor_key text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_bucket bigint;
  inserted_count integer;
  total bigint;
begin
  if target_article_id is null
    or target_visitor_key is null
    or char_length(trim(target_visitor_key)) not between 16 and 128 then
    return null;
  end if;

  if not exists (
    select 1
    from public.gazette_articles
    where id = target_article_id
      and status in ('published', 'scheduled')
      and published_at is not null
      and published_at <= now()
  ) then
    return null;
  end if;

  current_bucket := floor(extract(epoch from clock_timestamp()) / 1800)::bigint;

  insert into public.gazette_article_view_events (article_id, visitor_key, bucket)
  values (target_article_id, trim(target_visitor_key), current_bucket)
  on conflict (article_id, visitor_key, bucket) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    insert into public.gazette_article_view_totals (article_id, view_count)
    values (target_article_id, 1)
    on conflict (article_id) do update
      set view_count = public.gazette_article_view_totals.view_count + 1,
          updated_at = now();
  end if;

  select view_count
    into total
    from public.gazette_article_view_totals
   where article_id = target_article_id;

  return coalesce(total, 0);
end;
$$;

drop function if exists public.admin_article_view_counts();
create or replace function public.admin_article_view_counts()
returns table(article_id uuid, view_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  return query
  select article.id, coalesce(total.view_count, 0)::bigint
    from public.gazette_articles article
    left join public.gazette_article_view_totals total on total.article_id = article.id;
end;
$$;

grant execute on function public.track_gazette_article_view(uuid, text) to anon, authenticated;
grant execute on function public.admin_article_view_counts() to authenticated;

drop trigger if exists gazette_article_view_totals_updated_at on public.gazette_article_view_totals;
create trigger gazette_article_view_totals_updated_at
  before update on public.gazette_article_view_totals
  for each row execute function public.set_updated_at();
