# Database

> Repository-backed draft with live verification and local reconstruction testing through August 9, 2026. See `supabase-audit.md` for the evidence record.

## Purpose

Supabase is the persistence and authorization layer for editorial content, league history, synchronized Sleeper data, users, notifications, and administrative workspaces. Public pages read through the browser-safe Supabase client; protected writes and synchronization use authenticated sessions, RPCs, or service-role Edge Functions.

The original migration directory began after the foundational league schema already existed. `20260727000000_foundational_schema.sql` reconstructs that missing foundation locally; the following 21 historical migrations then reproduce the verified production `public` schema. `supabase/schemas/production.sql` remains the independent schema-only comparison and recovery snapshot.

## Data domains

| Domain | Confirmed tables or objects | Main consumers |
| --- | --- | --- |
| League foundation | `leagues`, `seasons`, `managers`, `league_members`, `fantasy_teams` | Sleeper sync, teams, standings, history |
| Player and roster data | `players`, `roster_players`, `roster_snapshots`, `roster_snapshot_players` | Teams, rosters, historical views |
| Matchups and results | `matchups`, `matchup_teams`, `matchup_players`, `team_weekly_results` | Matchups, records, awards, rankings |
| Editorial | `gazette_articles`, `admin_users` | Gazette and admin CMS |
| Editorial collaboration | `publication_contributors`, `editorial_review_events`, `editorial_notifications` | Op-Ed submission and review workflow |
| Draft history | `drafts`, `draft_picks` | Draft archive and history |
| Transactions | `league_transactions`, `transaction_participants`, `transaction_assets` | Transaction archive and history |
| Rankings | `power_rankings` | Admin rankings workspace and public rankings page |
| Operations | `sync_runs` | Admin Sleeper status and freshness reporting |
| Reader participation | `reader_profiles`, `reader_poll_windows`, `reader_power_ballots` | Live reader identity, power ballots, and poll windows; application source is not present in this checkout |
| Player scoring | `player_weekly_scores` | Weekly NFL player scores used by live polling/ranking RPCs |
| Email digest | `weekly_digest_runs` | Delivery and failure history for the deployed weekly digest function |

The foundation, roster, matchup, editorial, and operations tables are referenced by application code and functions. `drafts`, `draft_picks`, transaction tables, contributor tables, review tables, notifications, and `power_rankings` are created or altered by migrations present in this repository.

## Migration-backed relationships and invariants

- `drafts` belongs optionally to a `league` and `season`; its provider draft ID is unique per provider.
- `draft_picks` belongs to a draft and optionally to a fantasy team. Provider pick ID and pick number are each unique within a draft; deleting a draft cascades to its picks.
- `league_transactions` belongs optionally to a league and season and is unique by provider transaction ID. Participants and assets cascade from their transaction.
- Completed transactions are the public boundary: participant and asset policies only expose rows whose parent transaction has `status = 'complete'`.
- `publication_contributors` is keyed by the Supabase Auth user ID. The live constraint permits legacy `commissioner` and intended `op_ed` values; the owner-confirmed target is Op-Ed-only non-admin access.
- `editorial_review_events` records `submitted`, `changes_requested`, and `approved`; a non-empty note is required for `changes_requested`.
- `editorial_notifications` belongs to a recipient and optionally an article. Notification kinds are `review_requested`, `story_published`, and `changes_requested`.
- `power_rankings` is unique by season and week, accepts weeks `0` through `18`, and stores ordered entries as a JSON array. Only `ready` editions are public.

## Row-level security

Confirmed policies include:

- Public read access for players, roster players, drafts, and draft picks.
- Public read access to complete transactions and their participants/assets.
- Public read access to ready power-ranking editions.
- Live Op-Ed contributors can create, read, update, and delete only their own eligible `Op-Ed` stories in `draft` or `ready_for_review` state.
- Contributors can insert/delete images only for their own Op-Ed stories in the `gazette-images` bucket.
- Users can read and mark only their own editorial notifications as read. General notification updates are revoked; the authenticated grant is limited to `read_at`.
- Review history is visible to administrators and the contributor who owns the associated story.
- Power rankings are administrator-managed; the same administrator check protects the management RPCs and workspace.
- Live reader policies allow users to manage their own profiles and open ballots, expose poll windows/ballots publicly, and reserve poll-window management for administrators.

The live schema has RLS enabled on all 29 public base tables. Its `op_ed`/`Op-Ed` contributor policies match the owner-confirmed product rule. The current editor, contributor screens, and recovered Op-Ed migration use the same role and category. An 11-check local API authorization matrix passed on August 9, 2026. See `supabase-audit.md` before changing contributor access.

RLS is part of the product's authorization boundary. UI visibility is not sufficient evidence of permission.

## Functions and triggers

Migration-backed administrative functions include contributor management, returning an article for changes, resolving review notifications, and `admin_sleeper_status()`. Status triggers create review notifications and review events, then remove stale review-request notifications when a story leaves review.

`admin_sleeper_status()` is administrator-only and reports the newest league record, dataset freshness timestamps, and the most recent sync runs. It is used by the admin Sleeper page and other admin surfaces.

## Storage

The live `gazette-images` bucket is public, limits files to 6 MiB, and accepts JPEG, PNG, and WebP. Administrator policies constrain management to the article folder; contributor policies constrain paths to a contributor-owned article ID but currently use the live Op-Ed model.

- TODO: Confirm naming conventions, orphan cleanup, and public URL behavior through an end-to-end upload test.

## Maintenance and verification

- Add schema changes as timestamped migrations and apply them in order.
- Keep `src/types/database.ts` aligned with the hosted schema, not only the local migration set. It was regenerated from the linked `public` and `graphql_public` schemas on August 9, 2026.
- The nine formerly remote-only migrations were recovered on August 9. Both linked and fully replayed local schemas pass database linting with no errors.
- `supabase db reset --local --no-seed` successfully applies the guarded foundation followed by all 21 historical migrations.
- The rebuilt `public` schema dump is byte-for-byte identical to `supabase/schemas/production.sql`: 29 tables, 7 views, 20 public functions, and RLS on all 29 tables.
- Linked and local generated types differ only in hosted PostgREST metadata and nondeterministic relationship ordering; the represented schema shape matches.
- The foundation is deliberately guarded against execution when `public.leagues` already exists. Production must eventually record version `20260727000000` as applied through a separately approved history repair; do not push it as executable SQL to the existing database.
- Re-run `npm run test:contributor-rls` after relevant schema or policy changes. Extend it when new contributor capabilities are introduced; Storage upload cleanup remains a separate end-to-end TODO.
- Never place secret values in documentation.
