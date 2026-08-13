alter table public.weekly_digest_runs
  add column if not exists edition_key text,
  add column if not exists is_test boolean not null default false;

alter table public.weekly_digest_runs
  drop constraint if exists weekly_digest_runs_status_check;

alter table public.weekly_digest_runs
  add constraint weekly_digest_runs_status_check
  check (status in ('running', 'completed', 'partial', 'failed'));

create unique index if not exists weekly_digest_runs_edition_key_idx
  on public.weekly_digest_runs (edition_key)
  where is_test = false and edition_key is not null;

comment on column public.weekly_digest_runs.edition_key is
  'Stable season/week key used to prevent duplicate production editions.';

comment on column public.weekly_digest_runs.is_test is
  'True for a single-address administrator preview; test runs do not claim an edition key.';
