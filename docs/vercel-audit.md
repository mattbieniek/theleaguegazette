# Vercel Audit

> Read-only hosted-settings audit completed August 8, 2026 against repository commit `b12aff34`. No settings, secrets, domains, or deployments were changed.

This page records what was observed in the Vercel dashboard so future work does not need to rediscover the deployment baseline. Secret values were not revealed or copied.

## Project identity

| Setting | Verified value |
| --- | --- |
| Team/account | `mattbieniek's projects` |
| Plan | Hobby |
| Project | `theleaguegazette` |
| Connected Git repository | `mattbieniek/theleaguegazette` |
| Git connection date shown | July 28 |
| Production domain | `theleaguegazette.org` |

The project is actively deploying from GitHub. The dashboard showed a current Production deployment and recent Preview deployments associated with pull requests.

## Build and runtime

| Setting | Verified value |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` (override enabled) |
| Output directory | Framework default, `dist` |
| Install command | Framework default |
| Development command | Framework default, `astro dev` |
| Root directory | Repository root |
| Ignored build step | Automatic |
| Node.js | `24.x` |
| Build machine | Team default; next deployment reports Standard |
| Concurrent builds | Disabled; builds queue one at a time |
| Prioritize production builds | Enabled |
| Deployment checks | None configured |
| Rolling releases | Disabled |

Vercel Functions use Fluid Compute in Washington, D.C. (`iad1`). The Hobby allocation shown is Standard, 1 vCPU and 2 GB memory.

## Git behavior

- Pull-request comments are enabled.
- Commit comments are disabled.
- Commit statuses are enabled.
- Consolidated commit status is disabled.
- Verified commits inherit the team setting, which is disabled.
- Git LFS is disabled.
- No deploy hooks are configured.

TODO: Verify the production branch explicitly. The settings page inspected during this audit did not display a production-branch control, and the deploy-hook example's `main` placeholder is not evidence of the configured production branch.

## Domains

| Domain | Behavior |
| --- | --- |
| `theleaguegazette.org` | Production |
| `www.theleaguegazette.org` | `308` redirect to `theleaguegazette.org` |
| `theleaguegazette.vercel.app` | Valid configuration; Production |

TODO: Record the DNS provider/owner and the recovery process for domain access.

## Environment-variable inventory

The following variable names exist in both Production/Preview and Development:

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
PUBLIC_SLEEPER_LEAGUE_ID
```

`PUBLIC_SUPABASE_URL` is marked sensitive for Production/Preview. System environment variables are enabled. The audit verified names and target environments only; it did not reveal values or prove that each value points to the intended Supabase project or Sleeper league.

Server-only secrets used by Supabase Edge Functions are managed separately and are documented by name in `deployment.md` and `supabase-audit.md`.

## Scheduling

Vercel Cron Jobs are enabled, but no project cron job is configured. The dashboard presents setup instructions rather than a job inventory. Combined with the absence of PostgreSQL cron in Supabase, this leaves the deployed `send-weekly-digest` function without a verified automatic trigger.

The weekly digest is now scheduled through GitHub Actions for 14:00 UTC every Wednesday. Verify the first scheduled run, its failure reporting, and the corresponding delivery record in the Readers workspace.

## Operational follow-ups

1. Confirm the production branch and deployment-protection settings.
2. Pin the intended Node version in the repository if consistent local/hosted runtimes are required.
3. Document a rollback drill using a known-good deployment; do not perform one on production solely for documentation.
4. Record DNS ownership and account-recovery responsibility.
5. Establish monitoring and alerts for failed builds, runtime errors, and scheduled work.
6. Recheck this page after changing Vercel settings, domains, environment-variable names, or the Git connection.
