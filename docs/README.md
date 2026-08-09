# The League Gazette Handbook

> Last verified: August 9, 2026
> Verified against commit: `b12aff34`
> Scope: repository plus read-only Supabase and Vercel verification.

This handbook is the working guide to The League Gazette, an editorial fantasy-football publication for the Far Far Away Football league. It describes the application as it exists in the repository and keeps unverified operational details clearly labeled.

## Source of truth

When sources disagree, use this order:

1. Current repository code and migrations
2. Hosted Supabase schema, policies, functions, and jobs
3. Vercel and environment configuration
4. Successful build and runtime behavior
5. Committed documentation
6. Project conversations and memory

Update the relevant handbook page whenever a change affects documented behavior.

## Using this handbook for feature work

1. Start with `architecture.md`, then read the subsystem page that owns the change.
2. Use `development-workflow.md` to create a small feature brief with acceptance criteria and verification paths.
3. Confirm uncertain behavior from code or hosted configuration; do not promote a TODO or conversation detail into a fact.
4. Implement and test the change, then update the affected handbook page in the same handoff.
5. Record durable architectural or product choices in `decisions.md` and approved status changes in `roadmap.md`.

For most tasks, these two or three pages should provide enough context without rereading the full handbook.

## Current stack

- Astro 7 and TypeScript
- Astro's Vercel adapter
- Supabase database, authentication, storage, RPC functions, and Edge Functions
- Sleeper's read-only API as the fantasy-data source
- TipTap for rich-text article editing
- Inter, Newsreader, and IBM Plex Mono font packages
- Plain project CSS in `src/styles/global.css` and component-scoped styles

## Quick start

```bash
npm install
npm run dev
```

The development site defaults to `http://localhost:4321`. Repository guidance recommends running Astro's development server in background mode when supported by the local CLI.

Before handing off a change:

```bash
npm run check:handbook
npm run check
npm run build
```

The handbook check catches missing required pages, broken relative links, absent top-level headings, and malformed TODO list markers.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/pages/` | File-based public and admin routes |
| `src/components/` | Shared site, home, data, Gazette, and admin UI |
| `src/layouts/` | Public and admin page shells |
| `src/lib/` | Supabase clients, Sleeper client, queries, and Gazette domain logic |
| `src/data/` | Static league metadata and fallback/editorial data |
| `src/styles/` | Global design tokens and shared styling |
| `src/types/` | Database-facing TypeScript types |
| `public/` | Logos, icons, and editorial imagery |
| `supabase/migrations/` | Versioned database changes present in this checkout |
| `supabase/schemas/production.sql` | Schema-only snapshot of the verified live `public` schema; reference/recovery artifact, not an active migration |
| `supabase/functions/` | Admin-authorized Sleeper synchronization functions |

## Handbook contents

- [Architecture](architecture.md) — system boundaries, rendering, and data flow
- [Development workflow](development-workflow.md) — local work, verification, and documentation rules
- [Decisions](decisions.md) — accepted and provisional architectural decisions
- [Project history](project-history.md) — context behind the handbook and documentation practice
- [Database](database.md) — schema, RLS, functions, triggers, and storage
- [Supabase audit](supabase-audit.md) — live inventory, deployment drift, and reconciliation work
- [Vercel audit](vercel-audit.md) — hosted build, domain, Git, and environment inventory
- [Editorial workflow](editorial-workflow.md) — story lifecycle and review process
- [Sleeper sync](sleeper-sync.md) — synchronization functions and operating sequence
- [Frontend](frontend.md) — public routes, queries, and responsive behavior
- [Admin CMS](admin-cms.md) — authentication, permissions, and editorial tools
- [Design system](design-system.md) — typography, tokens, layout, and media
- [Deployment](deployment.md) — Vercel, variables, Supabase, and rollback
- [Roadmap](roadmap.md) — verified status and intentionally unverified plans

## Known verification gaps

- TODO: Review and commit the locally reproducible Supabase baseline/recovery set, then explicitly approve the production migration-history alignment before the next database push. The contributor-facing CMS and its isolated local authorization matrix are aligned with the accepted Op-Ed model.
- TODO: Confirm the production branch explicitly and perform a documented rollback drill; other core Vercel settings are recorded in `vercel-audit.md`.
- TODO: Identify the external or manual trigger for the deployed weekly digest; the live database does not have `pg_cron` installed.
- TODO: Complete the weekly-digest hardening work documented in `supabase-audit.md` before adding an automatic trigger.
- TODO: Deploy and verify the trailing-slash-safe logged-out admin layout, then complete an owner-session production presentation walkthrough. The local Op-Ed authorization matrix and representative public/anonymous production routes are verified.
