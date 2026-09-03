alter table public.gazette_articles
  add column if not exists exclude_from_search boolean not null default false;

comment on column public.gazette_articles.exclude_from_search is
  'When true, keep the article visible on the site while asking public search engines not to index it.';

create or replace view public.editorial_articles as
select
  article.id,
  article.slug,
  article.category,
  article.headline,
  article.summary,
  article.author_name,
  article.status,
  article.is_featured,
  article.homepage_order,
  article.image_url,
  article.image_alt,
  article.published_at,
  article.created_at,
  article.updated_at,
  case
    when article.status = 'scheduled' and article.published_at is not null and article.published_at <= now()
      then 'Live — scheduled'
    when article.status = 'draft' then 'Draft'
    when article.status = 'ready_for_review' then 'Ready for review'
    when article.status = 'scheduled' then 'Scheduled'
    when article.status = 'published' then 'Published'
    when article.status = 'archived' then 'Archived'
    else initcap(replace(article.status, '_', ' '))
  end as status_label,
  (article.image_url is not null and btrim(article.image_url) <> '') as has_featured_image,
  (article.image_url is not null and btrim(article.image_url) <> '' and (article.image_alt is null or btrim(article.image_alt) = '')) as needs_image_alt,
  (article.summary is not null and btrim(article.summary) <> '') as has_summary,
  (jsonb_typeof(article.body) = 'array' and jsonb_array_length(article.body) > 0) as has_body,
  (article.status = 'scheduled') as is_scheduled,
  (article.status = 'scheduled' and article.published_at is not null and article.published_at <= now()) as is_due_for_publishing,
  ((article.status = 'published' or article.status = 'scheduled') and article.published_at is not null and article.published_at <= now()) as is_publicly_available,
  (btrim(article.headline) <> '' and btrim(article.slug) <> '' and btrim(article.category) <> '' and article.summary is not null and btrim(article.summary) <> '' and jsonb_typeof(article.body) = 'array' and jsonb_array_length(article.body) > 0 and (article.image_url is null or btrim(article.image_url) = '' or (article.image_alt is not null and btrim(article.image_alt) <> ''))) as can_publish,
  case
    when article.status in ('published', 'scheduled') and article.published_at is not null then article.published_at
    else article.updated_at
  end as editorial_date,
  greatest(article.updated_at, coalesce(article.published_at, article.updated_at)) as editorial_sort_at,
  article.exclude_from_search
from public.gazette_articles article;

create or replace view public.public_gazette_articles with (security_invoker = true) as
select
  article.id,
  article.slug,
  article.category,
  article.headline,
  article.summary,
  article.author_name,
  article.published_at,
  article.image_url,
  article.image_alt,
  article.body,
  article.is_featured,
  article.homepage_order,
  article.created_at,
  article.updated_at,
  case
    when article.status = 'scheduled' and article.published_at is not null and article.published_at <= now() then 'published'
    else article.status
  end as effective_status,
  case
    when article.status = 'scheduled' and article.published_at is not null and article.published_at <= now() then true
    else false
  end as published_from_schedule,
  article.exclude_from_search
from public.gazette_articles article
where
  (article.status = 'published' or article.status = 'scheduled')
  and article.published_at is not null
  and article.published_at <= now();
