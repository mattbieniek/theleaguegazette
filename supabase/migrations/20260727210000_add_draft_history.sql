create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  provider text not null,
  provider_draft_id text not null,
  season_year integer not null,
  name text,
  draft_type text,
  status text,
  rounds integer,
  team_count integer,
  starts_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_draft_id)
);

create table if not exists public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  fantasy_team_id uuid references public.fantasy_teams(id) on delete set null,
  provider_pick_id text not null,
  pick_number integer not null,
  round integer not null,
  round_pick integer not null,
  draft_slot integer,
  roster_id integer,
  manager_provider_id text,
  player_provider_id text,
  player_name text not null,
  position text,
  pro_team text,
  is_keeper boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, provider_pick_id),
  unique (draft_id, pick_number)
);

create index if not exists drafts_season_year_idx
  on public.drafts (season_year desc);

create index if not exists draft_picks_draft_order_idx
  on public.draft_picks (draft_id, pick_number);

create index if not exists draft_picks_fantasy_team_idx
  on public.draft_picks (fantasy_team_id);

alter table public.drafts enable row level security;
alter table public.draft_picks enable row level security;

create policy "Public can read drafts"
  on public.drafts for select
  to anon, authenticated
  using (true);

create policy "Public can read draft picks"
  on public.draft_picks for select
  to anon, authenticated
  using (true);

grant select on public.drafts, public.draft_picks to anon, authenticated;

