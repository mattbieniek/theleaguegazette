create table if not exists public.power_rankings (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null,
  week integer not null check (week between 0 and 18),
  title text not null default 'Power Rankings',
  status text not null default 'draft' check (status in ('draft', 'ready')),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_year, week)
);

alter table public.power_rankings enable row level security;

create policy "Admins can manage power rankings"
  on public.power_rankings for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create or replace function public.set_power_rankings_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists power_rankings_updated_at on public.power_rankings;
create trigger power_rankings_updated_at before update on public.power_rankings
for each row execute function public.set_power_rankings_updated_at();
