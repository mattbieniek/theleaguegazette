create table if not exists public.gazette_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.gazette_articles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gazette_comments_article_created_idx
  on public.gazette_comments (article_id, created_at);

alter table public.gazette_comments enable row level security;

grant select on public.gazette_comments to anon, authenticated;
grant insert, update on public.gazette_comments to authenticated;

create policy "Comments on published Gazette stories are readable"
  on public.gazette_comments for select
  using (
    exists (
      select 1
      from public.gazette_articles article
      where article.id = gazette_comments.article_id
        and article.status in ('published', 'scheduled')
        and article.published_at is not null
        and article.published_at <= now()
    )
  );

create policy "Signed-in readers can comment on published Gazette stories"
  on public.gazette_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.gazette_articles article
      where article.id = gazette_comments.article_id
        and article.status in ('published', 'scheduled')
        and article.published_at is not null
        and article.published_at <= now()
    )
  );

create policy "Readers can update their own Gazette comments"
  on public.gazette_comments for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists gazette_comments_updated_at on public.gazette_comments;
create trigger gazette_comments_updated_at
  before update on public.gazette_comments
  for each row execute function public.set_updated_at();
