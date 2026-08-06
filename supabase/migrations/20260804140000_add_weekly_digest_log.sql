create table if not exists public.weekly_digest_runs (
  id uuid primary key default gen_random_uuid(),
  season_year integer,
  week integer,
  subject text not null,
  recipient_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'running' check (status in ('running','completed','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.weekly_digest_runs enable row level security;
grant select on public.weekly_digest_runs to authenticated;

create policy "Admins can inspect digest runs"
  on public.weekly_digest_runs for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
