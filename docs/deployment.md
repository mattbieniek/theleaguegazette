# Deployment

> Repository and hosted-settings audit completed August 8, 2026 at `b12aff34`. See `vercel-audit.md` for the evidence summary and remaining gaps.

## Confirmed application configuration

- Astro is configured with `output: 'static'` and `@astrojs/vercel`.
- The canonical site is `https://theleaguegazette.org`.
- The production build command is `npm run build`, which runs `astro check` before `astro build`.
- Astro's default build directory is `dist`.
- The repository uses Astro 7, TypeScript, Supabase JS, TipTap, and the bundled font packages.

The static output setting does not mean every page is build-time content. Routes that opt out of prerendering run on demand through the Vercel adapter; verify route-level behavior when changing data freshness or caching.

## Verified Vercel configuration

- Team/account: `mattbieniek's projects` on the Hobby plan.
- Vercel project: `theleaguegazette`.
- Connected repository: `mattbieniek/theleaguegazette`.
- Framework preset: Astro.
- Build command override: `npm run build`.
- Output directory: Astro default (`dist`); no override.
- Install and development commands: framework defaults; no overrides.
- Root directory: repository root.
- Node.js version: `24.x`.
- Function region: Washington, D.C. (`iad1`); Fluid Compute enabled.
- Production builds are prioritized; deployment checks and rolling releases are not configured.

The configured Node version is newer than the repository documents locally. Contributors should use a Node release compatible with Astro 7 and confirm `npm run check` and `npm run build`; add a repository-pinned Node version if reproducibility problems appear.

## Environment variables

Browser-visible variables:

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
PUBLIC_SLEEPER_LEAGUE_ID
```

Vercel contains each of these three names for Production/Preview and Development. `PUBLIC_SUPABASE_URL` is marked sensitive for Production/Preview. Values were deliberately not revealed during the audit.

Server and Edge Function variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ACTIVE_SLEEPER_LEAGUE_ID
ACTIVE_SEASON_YEAR
SYNC_CRON_SECRET
```

The deployed weekly digest additionally uses these confirmed secret names:

```text
PUBLIC_SITE_URL
RESEND_API_KEY
WEEKLY_DIGEST_CRON_SECRET
WEEKLY_DIGEST_FROM
```

Only the `PUBLIC_` values may reach browser code. Never expose `SUPABASE_SERVICE_ROLE_KEY` in Astro client code, logs, screenshots, or handbook pages.

At the start of a new season, update `PUBLIC_SLEEPER_LEAGUE_ID` to the new
league only after the active-season foundation sync has created its league,
season, users, and roster rows. The 2026 value is
`1389719207712681984`; keep the 2025 value in place until that initial import
has been verified so public pages do not point at an empty season.

## Local release checks

```bash
npm install
npm run check
npm run build
npm run preview
```

Use `npm run dev` for normal development; repository guidance recommends background mode when supported by the local CLI. Use `preview` to inspect the built artifact rather than relying only on development-server behavior.

## Recommended release sequence

1. Review the code, migrations, Edge Functions, and relevant handbook pages together.
2. Run `npm run check` and `npm run build` locally.
3. Apply approved Supabase migrations in order before releasing code that depends on them.
4. Deploy changed Edge Functions with the project-approved Supabase workflow.
5. Confirm the target environment contains the required variables and the expected site URL.
6. Smoke-test public navigation, a representative data page, a Gazette story, admin login, and any changed sync/editor workflow.
7. Record the deployed commit, verification date, and any known follow-up in the handbook or release notes.

The linked Supabase and Vercel projects are confirmed. Vercel automatically creates deployments from the connected GitHub repository; pull-request comments and commit statuses are enabled. The dashboard did not expose an explicit production-branch setting during this audit, so treat the production branch as unverified rather than assuming it is `main`.

On August 9, 2026, a read-only production walkthrough successfully rendered the homepage plus representative Gazette, matchup, standings, teams, history, search, and account-login routes without browser console errors. PR #26 merged as `ffcb328e`, its Vercel production deployment succeeded, and the canonical anonymous admin route was re-verified: it redirected to `/admin/login`, showed no admin navigation or session-only controls, retained `noindex, nofollow`, and produced no browser errors. Authenticated workspace presentation was not tested. See `admin-cms.md`.

## Domains and scheduled work

- `theleaguegazette.org` is the production domain.
- `www.theleaguegazette.org` redirects permanently (`308`) to `theleaguegazette.org`.
- `theleaguegazette.vercel.app` is valid and assigned to Production.
- Vercel Cron Jobs are enabled at the project level, but no job is configured; scheduled application work uses GitHub Actions instead.

The weekly digest is scheduled by `.github/workflows/weekly-digest.yml` for
14:00 UTC every Wednesday, which is 9:00 a.m. Central during daylight time and
8:00 a.m. Central during standard time. A second
`.github/workflows/weekly-digest-watchdog.yml` check runs at 14:45 UTC. Both
call the protected `send-weekly-digest` Edge Function using the repository's
`SUPABASE_URL` and `WEEKLY_DIGEST_CRON_SECRET` secrets. The function prevents
duplicate delivery for the same season and week, so the watchdog safely exits
when the primary send succeeded and recovers an edition when the scheduled
primary run was missed. Before the active season has any completed weekly
results, it labels the edition as `${season} Preseason` and uses the calendar
date in its duplicate key so multiple pre-season Wednesday editions can be
sent safely. Administrators can inspect delivery history in the Readers
workspace.

Sleeper automation is configured as a GitHub Actions workflow in
`.github/workflows/sleeper-sync.yml`. It calls the protected
`automate-sleeper-sync` Edge Function using `SUPABASE_URL` and
`SYNC_CRON_SECRET` repository secrets. The workflow runs hourly, every six
hours, daily, and Tuesday morning for weekly finalization. Schedules are UTC;
the function itself determines the active Sleeper week and rejects a league
whose returned season does not match the configured 2026 season.

## Rollback principles

- Application rollback should restore the last known-good Vercel deployment.
- A migration should be forward-fixed with a new migration unless a carefully reviewed rollback is explicitly safe.
- Edge Functions must be rolled back or redeployed as a compatible set with the database schema they expect.
- If a sync or editorial deployment is unhealthy, preserve `sync_runs`/application errors, stop repeated writes, and document the recovery before retrying.

## Verification checklist

- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] Required environment variables exist in the target environment.
- [ ] Migrations are applied in the intended order.
- [ ] Changed Edge Functions are deployed.
- [ ] Public representative routes and anonymous admin redirects pass; authenticated admin/contributor presentation remains pending.
- [ ] Scheduled publication and a representative Sleeper status/sync path are verified.
- [ ] GitHub Actions secrets and Supabase automation secrets are configured; run each sync mode manually once.
- [ ] Deployed commit and rollback target are recorded.

## Hosted-system TODOs

- TODO: Confirm the production branch, DNS ownership/provider, deployment-protection behavior, and an exact rollback runbook.
- TODO: Review the reconstructed foundation and recovered Edge Functions, then approve a history-only linked migration repair for version `20260727000000` before the next database push. The full local chain now reproduces the production `public` schema exactly.
- TODO: Record migration/function deployment commands, Auth redirect URLs, and backup policy. The linked Supabase project and Storage bucket are now verified.
- TODO: Verify the first scheduled Wednesday digest in GitHub Actions and confirm its delivery totals in the Readers workspace.
- TODO: Define logs, monitoring, alerts, incident contacts, and recovery time expectations.
