alter table public.gazette_articles
  add column if not exists subcategory text;

alter table public.gazette_articles
  drop constraint if exists gazette_articles_subcategory_check;

alter table public.gazette_articles
  add constraint gazette_articles_subcategory_check
  check (subcategory is null or subcategory in ('General', 'Hot Takes', 'Hit Piece'));

comment on column public.gazette_articles.subcategory is
  'Optional desk-specific classification. Limited Op-Ed contributors choose from the approved Op-Ed subcategories.';
