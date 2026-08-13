# Live Supabase Audit

> Read-only verification performed August 7, 2026 against the linked, healthy project **The League Gazette Database**. Repository reconciliation completed August 9, 2026. No production schema, configuration, or data was changed.

## Audit scope

The audit used Supabase project metadata, live generated TypeScript definitions, PostgreSQL catalog queries, Storage bucket metadata, migration history, deployed Edge Function metadata, and temporary downloads of production-only function source. Table contents were not exported.

The full schema-dump command was unavailable because it requires Docker Desktop. Direct read-only catalog queries supplied the necessary inventory and policy information.

## Confirmed public schema

The live `public` schema contains 29 base tables:

```text
admin_users                    player_weekly_scores
draft_picks                    players
drafts                         power_rankings
editorial_notifications        publication_contributors
editorial_review_events        reader_poll_windows
fantasy_teams                  reader_power_ballots
gazette_articles               reader_profiles
league_members                 roster_players
league_transactions            roster_snapshot_players
leagues                        roster_snapshots
managers                       seasons
matchup_players                sync_runs
matchup_teams                  transaction_assets
matchups                       transaction_participants
weekly_digest_runs
```

All 29 live public base tables report row-level security enabled.

The live schema also contains seven views:

- `all_play_standings`
- `editorial_articles`
- `public_gazette_articles`
- `public_reader_profiles`
- `season_standings`
- `team_weekly_results`
- `weekly_standings`

`all_play_standings`, `public_gazette_articles`, `team_weekly_results`, and `weekly_standings` explicitly use `security_invoker=true`. Grants and underlying RLS remain part of the access boundary.

## Recovered production data domains

The August 9 reconciliation brought the migrations defining these live objects into the repository:

- `player_weekly_scores` stores a unique player/week score and raw Sleeper statistics for a season.
- `reader_profiles` stores display name and weekly-digest preference for Auth users.
- `reader_poll_windows` controls whether a season/week reader poll is open and when it closes.
- `reader_power_ballots` stores one ten-team ranking ballot per user, season, and week.
- `weekly_digest_runs` records digest recipients, deliveries, failures, status, and completion.
- `public_reader_profiles` exposes only reader user IDs and display names.

Associated RPCs include reader poll state/validation, public matchup and computer-poll lineups, site-account administration, contributor access, and article login identity.

## Migration reconciliation

The original 12 local migrations matched the first 12 remote versions. On August 9, the following nine migrations were fetched from the linked project's migration history into `supabase/migrations/`:

```text
20260803010000
20260804120000
20260804133000
20260804140000
20260805120000
20260805170000
20260805190000
20260805200000
20260805210000
```

`supabase migration list` now reports all 21 versions on both the local and remote sides. `src/types/database.ts` was regenerated from the linked `public` and `graphql_public` schemas, adding the reader, digest, player-score, editorial, and current RPC definitions. `npm run check` passed with zero diagnostics after regeneration.

This establishes a repository inventory matching the live migration history, but not a complete bootstrap history.

On August 9, `supabase db lint --linked --level warning` completed against the live `extensions` and `public` schemas with no errors. An initial clean local replay failed in `20260727210000_add_draft_history.sql` because `public.leagues` and `public.seasons` did not exist, and Git history confirmed that no earlier foundational migration was committed.

A schema-only live dump was preserved as `supabase/schemas/production.sql`. From that evidence, `20260727000000_foundational_schema.sql` reconstructs only the objects and historical privileges that predate the other migrations, rewinding columns, functions, policies, and tables introduced later. It has a hard guard that raises an error if the foundational schema already exists.

Three clean local resets were used to refine and verify the reconstruction. The final reset applies the foundation and all 21 historical migrations, passes local database lint, and produces a `public` schema dump with no differences from the production snapshot: 29 tables, 7 views, 20 public functions, and RLS on all 29 tables. Local generated types differ from linked types only in hosted PostgREST metadata and relationship ordering.

## Contributor-policy mismatch

The live contributor role constraint permits both `commissioner` and `op_ed` for legacy compatibility. Live contributor article and Storage policies authorize only `op_ed` contributors working on the `Op-Ed` category. The recovered Op-Ed migration and contributor-facing CMS now use that same model; the earlier commissioner migration remains as immutable project history.

The project owner confirmed on August 7, 2026 that the intended model is Op-Ed-only for non-admin contributors: contributors submit their own Op-Ed drafts for consideration, and administrators alone approve and publish them. Production policies, recovered migrations, and the repository UI reflect that direction. On August 9, 2026, an isolated local API test passed 11 checks spanning role grants, ownership, category/status restrictions, admin publication, post-publication lockout, and public visibility.

## Storage

One live bucket is configured:

| Bucket | Public | Size limit | MIME types |
| --- | --- | --- | --- |
| `gazette-images` | Yes | 6 MiB | JPEG, PNG, WebP |

Administrator policies cover article-folder image reads/writes/deletes. Live contributor Storage policies currently follow the Op-Ed ownership model described above.

## Edge Functions and scheduling

Eleven Edge Functions are active. All eleven now have local source. The two functions recovered from the hosted project on August 9 are:

- `sync-sleeper-player-scores` — administrator-protected import of weekly player statistics into `player_weekly_scores`
- `send-weekly-digest` — sends email through Resend, accepting either the configured cron secret or an administrator token, and records `weekly_digest_runs`

The digest's required secret names are present, including its Resend key, cron secret, sender, and public site URL; values were not inspected or recorded.

The live database has no `cron.job` table and no `pg_cron` extension. Therefore the digest is manually invoked or scheduled outside PostgreSQL. The trigger location still requires verification.

Most deployed Edge Functions have platform JWT verification disabled and perform authorization inside their handlers. `sync-sleeper-player-scores` is the exception with platform JWT verification enabled. Handler-level authorization must remain part of every function review.

The deployed JWT settings for all eleven functions are now recorded explicitly in `supabase/config.toml`, preventing an ordinary CLI deployment from silently changing that platform boundary. All eleven sources load together in the local Supabase Edge runtime compatible with Deno 2.1.4.

### Recovered-function review

`sync-sleeper-player-scores` validates an administrator through the shared helper, validates league/week inputs, requires stored scoring settings, paginates eligible players, calculates weekly scores, and upserts in 500-row batches on the season/week/player key. Its retry behavior updates returned rows but does not remove formerly stored players omitted from a later upstream response. Authentication and validation failures are currently returned as generic HTTP 500 responses after handler-level exceptions.

`send-weekly-digest` accepts either the configured cron-secret header or a verified administrator bearer token, loads opted-in confirmed users, escapes editorial/user content in HTML, sends through Resend, and records a run. The hardening migration adds a unique season/week edition key, restricts test deliveries to administrator sessions, validates test addresses, checks database operations, records explicit `completed`, `partial`, and `failed` outcomes, and keeps recipient/provider response details out of logs. Failed or partial production editions require an administrator-reviewed retry rather than silently sending a duplicate edition.

No production function was changed or redeployed during this review. Fixes should be implemented and tested locally with a mock email provider or an explicitly authorized test address before deployment.

## Remaining reconciliation

1. Review and commit the recovered migrations, Edge Functions, explicit JWT configuration, generated types, and handbook together.
2. Review the reconstructed foundation, then separately approve marking version `20260727000000` as applied in linked migration history before any future database push. This must be a history-only repair; the baseline must not execute against the existing production schema.
3. Preserve and rerun the local Op-Ed authorization matrix after policy changes; retire the legacy database constraint value only after checking for dependent production users.
4. Identify or establish the weekly-digest scheduler after the hardened function has been deployed and an administrator test delivery has been approved.
5. Run role-based smoke tests, preferably against a non-production project.
