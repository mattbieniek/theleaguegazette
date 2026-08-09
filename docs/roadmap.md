# Roadmap

> Repository-backed status record. Last reviewed August 9, 2026 at `b12aff34`.

This page separates implemented foundations, active verification work, and explicitly approved future work. Repository evidence proves that an implementation exists; it does not by itself prove production readiness.

## Status definitions

- **Implemented:** Present in the repository and included in the handbook.
- **Verification:** Implemented behavior that still needs hosted-system, role, accessibility, or operational confirmation.
- **Approved:** Future work explicitly accepted by the project owner with a defined outcome.
- **Proposed:** An idea only; keep it outside the committed roadmap until it is approved.

## Implemented foundation

- Public editorial shell, homepage, Gazette listing, article pages, and search
- Teams, standings, matchups, statistics, records, awards, rankings, history, drafts, and transactions
- Supabase-backed admin CMS with article editing, scheduling, homepage curation, photos, contributors, notifications, and review feedback
- Contributor review, notification, live Op-Ed policies, and aligned contributor-facing CMS controls
- Sleeper synchronization for league, players, users, rosters, snapshots, matchups, drafts, and transactions
- Astro/Vercel application configuration and repository-local project handbook

## Active verification backlog

### Priority 1 — security and publishing correctness

- Review and commit the reconstructed foundation, nine recovered migrations, two recovered Edge Functions, regenerated types, schema snapshot, and handbook. A clean local replay now matches the production `public` schema exactly.
- Before the next database deployment, approve a migration-history-only repair marking baseline version `20260727000000` applied on the linked project; never execute the guarded baseline against the existing schema.
- Harden and test `send-weekly-digest` before scheduling it: add duplicate-send protection, checked database operations, validated administrator-only test delivery, explicit partial-failure semantics, and privacy-conscious logging.
- Review and merge draft PR #26, then verify its trailing-slash-safe logged-out admin layout on the canonical production URL and complete an owner-session administrator/Op-Ed-contributor presentation walkthrough without creating production test data. The Vercel preview, public routes, anonymous redirects, and isolated local API authorization matrix are verified.
- Verify scheduled publication timing, public visibility, review notifications, and image permissions.

### Priority 2 — release and data operations

- Confirm the Vercel production branch, deployment-protection behavior, DNS ownership, and a tested rollback procedure; the project, Git integration, environment-variable names, domains, framework, build command, and Node version are verified.
- Confirm Supabase linkage, migration/function deployment commands, backups, Auth redirects, and Storage configuration.
- Locate or establish the weekly-digest scheduler; neither Supabase PostgreSQL cron nor a configured Vercel Cron Job was found. Inventory external Sleeper triggers and verify data-freshness expectations.

### Priority 3 — public experience

- Audit every public route's query dependencies, caching, empty/error behavior, and stale-data messaging.
- Run representative mobile, keyboard, contrast, and screen-reader checks.
- Define approved editorial image ratios, crop behavior, placeholders, and the light/dark theme policy.

## Approved future work

No future product features are recorded as approved in the repository at this review point. Add an item only after the project owner confirms its outcome and priority.

Use this format:

```text
Feature:
Outcome:
Status: Approved | In progress | Implemented
Acceptance criteria:
Dependencies:
Relevant handbook pages:
Verification:
```

## Maintenance rule

Move an item only when repository evidence or an explicit project decision supports the change. When an approved feature begins, link it to a focused development brief. When it ships, update the relevant subsystem documentation and move any unresolved production checks into the verification backlog.
