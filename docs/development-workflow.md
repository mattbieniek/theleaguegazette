# Development Workflow

> Last verified: August 9, 2026 against `b12aff34` and a local Supabase/Docker runtime.

## Set up locally

1. Install the Node version supported by the current Astro release.
2. Run `npm install`.
3. Create `.env.local` with the required public variables; never commit values.
4. Run `npm run dev` (or `astro dev --background`, per `AGENTS.md`).

Required variable names found in application code:

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
PUBLIC_SLEEPER_LEAGUE_ID
```

Edge Functions expect `SUPABASE_URL` and, except where the platform supplies equivalent access, `SUPABASE_SERVICE_ROLE_KEY`.

## Work in focused slices

1. Identify the route, component, query, migration, or function that owns the behavior.
2. Read the applicable handbook page and nearby implementation before editing.
3. Preserve unrelated working-tree changes.
4. Make schema changes through a new timestamped migration; do not rewrite applied migrations.
5. Keep privileged secrets and service-role operations out of browser code.
6. Update the handbook when public behavior, data shape, permissions, configuration, or operations change.

## Verification

Minimum automated checks:

```bash
npm run check:handbook
npm run check
npm run build
```

`check:handbook` verifies that the required handbook pages exist, every handbook Markdown file has a top-level heading, relative Markdown links resolve inside the repository, and TODO list markers use the consistent `TODO:` form.

Add focused manual checks appropriate to the change:

- Public route loads at desktop and mobile widths.
- Empty, loading, and upstream-error states remain usable.
- Admin sign-in and sign-out work.
- A draft can be created and edited without unauthorized access.
- Review, schedule, publish, archive, and delete behavior matches the intended role.
- A changed sync function is idempotent and reports partial failures clearly.
- A database change works with RLS enabled for anon, contributor, admin, and service roles as applicable.

## Database workflow

- Treat `supabase/migrations/` as the complete local bootstrap: the reconstructed `20260727000000` foundation followed by 21 production-history migrations.
- Start Docker Desktop, run `supabase start`, and use `supabase db reset --local --no-seed` to verify a clean schema replay. Add controlled seed data separately when it exists.
- Use `supabase/schemas/production.sql` as an independent schema comparison and disaster-recovery reference; refresh it only after a reviewed hosted-schema audit.
- Test every new migration through a clean local reset before proposing deployment.
- Review grants and RLS whenever adding a table, view, function, or storage policy.
- Regenerate or manually update `src/types/database.ts` after schema changes.
- Generate linked types with `supabase gen types --linked --lang typescript --schema public,graphql_public` and review the diff before replacing `src/types/database.ts`.
- Never run `supabase db reset --linked`; the `--linked` target is production and would be destructive.
- Production currently lacks migration-history version `20260727000000`. Before the next database push, review the baseline and explicitly approve recording it with `supabase migration repair 20260727000000 --status applied --linked`; this changes migration history only and must not be run casually.

## Pull-request or handoff checklist

- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] `npm run check:handbook` passes.
- [ ] Relevant user paths were exercised.
- [ ] Authorization was tested for affected roles.
- [ ] New environment variables are named in `deployment.md` without secret values.
- [ ] Database and sync changes are documented.
- [ ] Relevant handbook pages were updated, or the change does not affect them.
- [ ] `roadmap.md` reflects any approved status change.

## Starting a focused development task

Provide the goal, current branch, relevant files, acceptance criteria, compatibility requirements, and links to `docs/architecture.md` plus the relevant subsystem page. Avoid using old conversations as proof of current behavior when code or hosted configuration can answer the question.

Use this compact brief:

```text
Goal:
User-visible outcome:
Relevant handbook pages:
Likely files/data objects:
Acceptance criteria:
Roles and permissions affected:
Empty/error/mobile states:
Verification commands and manual paths:
Out of scope:
```

## Documentation routing

| Change | Update |
| --- | --- |
| System boundary, rendering, or data flow | `architecture.md` |
| Table, policy, trigger, RPC, or storage rule | `database.md` |
| Article status, review, publication, or contributor behavior | `editorial-workflow.md` and usually `admin-cms.md` |
| Sleeper function, order, payload, or recovery | `sleeper-sync.md` |
| Public route, query, SEO, or page behavior | `frontend.md` |
| Tokens, components, media, or accessibility rules | `design-system.md` |
| Environment, release, rollback, or operations | `deployment.md` |
| Durable rationale | `decisions.md` |
| Approved work status | `roadmap.md` |

## Definition of done

A feature is ready to hand off when:

- The acceptance criteria are demonstrably satisfied.
- Automated checks pass and the affected user paths were exercised.
- Authorization and failure states were tested in proportion to risk.
- Schema/configuration changes are versioned and secrets remain outside the repository.
- Relevant handbook facts and verification markers are current.
- Any remaining uncertainty is explicit, bounded, and assigned to the verification backlog rather than described as implemented behavior.
