create table if not exists public.league_transactions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  provider text not null,
  provider_transaction_id text not null,
  season_year integer not null,
  week integer not null,
  transaction_type text not null,
  status text not null,
  creator_provider_id text,
  faab_bid numeric,
  occurred_at timestamptz,
  processed_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);

create table if not exists public.transaction_participants (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.league_transactions(id) on delete cascade,
  fantasy_team_id uuid references public.fantasy_teams(id) on delete set null,
  provider_roster_id integer not null,
  consented boolean not null default false,
  created_at timestamptz not null default now(),
  unique (transaction_id, provider_roster_id)
);

create table if not exists public.transaction_assets (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.league_transactions(id) on delete cascade,
  provider_asset_key text not null,
  asset_type text not null,
  movement_type text not null,
  from_fantasy_team_id uuid references public.fantasy_teams(id) on delete set null,
  to_fantasy_team_id uuid references public.fantasy_teams(id) on delete set null,
  from_provider_roster_id integer,
  to_provider_roster_id integer,
  player_provider_id text,
  player_name text,
  position text,
  pro_team text,
  draft_season integer,
  draft_round integer,
  original_provider_roster_id integer,
  amount numeric,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (transaction_id, provider_asset_key)
);

create index if not exists league_transactions_season_week_idx
  on public.league_transactions (season_year desc, week desc, occurred_at desc);

create index if not exists league_transactions_type_idx
  on public.league_transactions (transaction_type, status);

create index if not exists transaction_participants_team_idx
  on public.transaction_participants (fantasy_team_id);

create index if not exists transaction_assets_transaction_idx
  on public.transaction_assets (transaction_id);

create index if not exists transaction_assets_from_team_idx
  on public.transaction_assets (from_fantasy_team_id);

create index if not exists transaction_assets_to_team_idx
  on public.transaction_assets (to_fantasy_team_id);

alter table public.league_transactions enable row level security;
alter table public.transaction_participants enable row level security;
alter table public.transaction_assets enable row level security;

create policy "Public can read league transactions"
  on public.league_transactions for select
  to anon, authenticated
  using (status = 'complete');

create policy "Public can read transaction participants"
  on public.transaction_participants for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.league_transactions
      where league_transactions.id = transaction_participants.transaction_id
        and league_transactions.status = 'complete'
    )
  );

create policy "Public can read transaction assets"
  on public.transaction_assets for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.league_transactions
      where league_transactions.id = transaction_assets.transaction_id
        and league_transactions.status = 'complete'
    )
  );

grant select on public.league_transactions,
  public.transaction_participants,
  public.transaction_assets
to anon, authenticated;
