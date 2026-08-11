# Sleeper Synchronization

> Repository-backed draft. Function inventory, recovered player-score source, and local Edge-runtime loading verified August 9, 2026 at `b12aff34`.

The live project was checked on August 7 and reconciled locally on August 9. All ten Sleeper sync/backfill functions now have repository source and are active remotely. The recovered `sync-sleeper-player-scores` source imports weekly player statistics into `player_weekly_scores` and uses the shared administrator check.

## Purpose

Administrator-protected Supabase Edge Functions fetch league data from Sleeper and normalize it into the local Supabase model. Public pages read the normalized tables rather than depending on live Sleeper responses.

## Authorization and configuration

Each function requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The shared `requireAdmin` helper accepts either a trusted service-role bearer token for function-to-function calls or a Supabase Auth bearer token whose user exists in `admin_users`. Missing credentials, invalid sessions, and non-admin users fail before the sync work begins.

The league identifier is supplied as `sleeper_league_id` where the function supports an explicit body value; functions with a configured default fall back to the project league ID. The admin UI obtains the current ID from `admin_sleeper_status()`.

Automated imports use the active-season configuration in
`supabase/functions/_shared/activeLeague.ts`:

- Active Sleeper league: `1389719207712681984`
- Active season: `2026`
- Production overrides: `ACTIVE_SLEEPER_LEAGUE_ID` and `ACTIVE_SEASON_YEAR`

The scheduled orchestration function validates both values against Sleeper
before it writes. A historical league can still be imported through an
explicit administrator action, but it can never flow through the scheduled
path by accident.

## Canonical admin sequence

The `/admin/sleeper` page presents the foundational syncs in dependency order:

1. `sync-sleeper-league` — league settings, season, scoring, and current week
2. `sync-sleeper-players` — the NFL player directory
3. `sync-sleeper-users` — managers and league memberships
4. `sync-sleeper-rosters` — fantasy teams, standings totals, and current roster players
5. `sync-sleeper-drafts` — drafts and completed picks

Weekly or historical operations are separate because they require a season week:

- `sync-sleeper-matchups` — scores, matchup teams, starters, and player results
- `sync-sleeper-roster-snapshots` — preserves a team's weekly roster; existing snapshots require `overwrite: true` to replace them
- `sync-sleeper-transactions` — imports a week or inclusive week range of completed, pending, or other Sleeper transaction records

The UI validates weeks from `1` through `18`, sends `status: "complete"` for normal completed-week imports, and sends `overwrite: true` when explicitly refreshing a matchup or snapshot dataset.

## Function contracts observed in code

| Function | Request fields | Idempotency / result |
| --- | --- | --- |
| `sync-sleeper-league` | Optional configured league request | Upserts by `sleeper_league_id`; returns a success payload with the league record |
| `sync-sleeper-players` | No required body | Upserts the player directory; returns a success payload and counts |
| `sync-sleeper-users` | Optional `sleeper_league_id` | Upserts managers, then memberships; returns counts and league ID |
| `sync-sleeper-rosters` | Optional configured league request | Upserts teams and roster players, updates sync timestamps, and records a sync run |
| `sync-sleeper-drafts` | Optional `sleeper_league_id` | Upserts drafts by provider draft ID and picks by draft/provider pick ID |
| `sync-sleeper-matchups` | `sleeper_league_id`, integer `week`, optional status (`scheduled`, `live`, `complete`) | Upserts matchups by season/week/provider matchup ID and associated teams/players; records a sync run |
| `sync-sleeper-roster-snapshots` | Optional league ID, integer `week`, optional `overwrite` | Refuses to replace existing snapshots unless overwrite is true; records a sync run |
| `sync-sleeper-transactions` | Optional league ID, `start_week`, `end_week` | Fetches an inclusive range clamped to weeks 1–18; upserts by provider transaction and asset IDs |
| `backfill-sleeper-matchups` | League ID, `startWeek`/`endWeek` (or snake-case equivalents), optional status | Invokes the matchup function once per week and reports per-week successes/failures; intended for trusted function-to-function use |
| `sync-sleeper-player-scores` | Optional league ID, optional `start_week`/`end_week` (defaults 1–17; validates 1–18) | Imports eligible NFL player scores and raw stats, upserting by season/week/player |

Responses are JSON with `success: true` on completion. Validation, Sleeper HTTP failures, Supabase errors, and partial backfill failures return `success: false` with an error or per-week result details.

## Sync-run observability

Roster, matchup, snapshot, and transaction functions write `sync_runs` entries containing the dataset type, start/completion times, processed counts, and details or error messages. The admin status RPC displays the newest run history and dataset freshness. Status strings observed in the checked-in functions include `running`, `success`, `error`, and `failed`; reconcile those values with the hosted constraint before treating them as a stable enum.

`automate-sleeper-sync` is the scheduled entry point. It accepts a dedicated
`x-sync-cron-secret` and runs child functions sequentially, with a short delay
and one retry for transient failures. It records an overall
`sleeper_automation` run in addition to each child function's run. Supported
modes are `hourly`, `operations`, `daily`, and `weekly-finalize`.

## Retry and recovery guidance

- Repeating league, player, user, roster, draft, matchup, and transaction syncs is designed to update existing provider-keyed rows rather than duplicate them.
- Player-score imports are idempotent for returned rows through the season/week/player unique key. They do not delete rows omitted by a later Sleeper response, so investigate upstream corrections before assuming a rerun removes stale records.
- A failed run should be inspected in the admin status panel before retrying; the response and `sync_runs` details identify the affected dataset and week where available.
- Retry a single matchup/snapshot week first. Use the backfill function only for a deliberately chosen range.
- Do not use snapshot overwrite casually: it deletes the existing weekly snapshot before rebuilding it.
- If a foundational sync fails, repair it before running dependent roster, draft, or weekly imports.

## Verification gaps

- TODO: Add `ACTIVE_SLEEPER_LEAGUE_ID`, `ACTIVE_SEASON_YEAR`, and `SYNC_CRON_SECRET` to the hosted Edge Function environment.
- TODO: Add the repository's `SUPABASE_URL` and `SYNC_CRON_SECRET` as GitHub Actions secrets.
- TODO: Confirm the canonical production league ID and season response from Sleeper before the first scheduled run.
- TODO: Reconcile `sync_runs` status constraints and hosted function versions with this checkout.
- TODO: Record monitoring, alerting, rate-limit behavior, and the approved production recovery runbook after the first scheduled run.
