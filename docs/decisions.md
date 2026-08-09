# Architecture and Product Decisions

> Last verified: August 9, 2026 against `b12aff34`, the linked Supabase project, and a clean local reconstruction test.

This file records durable decisions. “Accepted” means the repository demonstrates the decision. “Provisional” means the implementation suggests it but the project owner should confirm the rationale.

## ADR-001: Astro is the application framework

**Status:** Accepted

**Decision:** Build the public site and admin workspace in Astro with TypeScript.

**Evidence:** `package.json`, `astro.config.mjs`, and the file-based routes under `src/pages/`.

**Consequences:** Rendering mode must be chosen route by route, and interactive administration is implemented with browser scripts inside Astro components.

## ADR-002: Deploy through the Astro Vercel adapter

**Status:** Accepted

**Decision:** Target Vercel and the canonical site URL `https://theleaguegazette.org`.

**Evidence:** `astro.config.mjs` and the root README.

**Consequences:** On-demand routes become Vercel functions. TODO: Verify production project settings and rollback practice.

## ADR-003: Use Supabase as the application backend

**Status:** Accepted

**Decision:** Use Supabase for persisted data, authentication, storage, row-level authorization, RPCs, and Edge Functions.

**Evidence:** Supabase clients, migrations, configuration, and functions in this repository.

**Consequences:** RLS is a critical security boundary, schema changes require migrations, and service-role secrets must remain server-side.

## ADR-004: Store normalized Sleeper data locally

**Status:** Accepted

**Decision:** Synchronize Sleeper data into Supabase through administrator-protected Edge Functions and query the stored model for major league features.

**Evidence:** Nine checked-in sync/backfill functions, one additional deployed player-score sync, and query modules for standings, matchups, rosters, drafts, and transactions.

**Consequences:** Syncs should be safe to repeat, historical data survives upstream changes, and operations must monitor freshness and failures.

## ADR-005: Separate public presentation from data access

**Status:** Accepted

**Decision:** Keep reusable data access and Gazette aggregation in `src/lib/queries/` and `src/lib/gazette/`, with routes and components responsible for presentation.

**Consequences:** New pages should reuse or extend these modules instead of embedding duplicate Supabase queries throughout templates.

## ADR-006: Use a role-limited contributor workflow

**Status:** Accepted — owner-confirmed August 7, 2026; repository UI aligned and local authorization matrix passed August 9, 2026

**Decision:** Non-admin publication contributors are Op-Ed writers. They may create and edit only their own Op-Ed stories while those stories are drafts or awaiting review, and may submit them for publication consideration. Only an administrator may approve, schedule, publish, archive, feature, or place an Op-Ed story on the homepage.

**Evidence:** Project-owner confirmation, the live `op_ed` article/Storage policies, the recovered Op-Ed migration, and the aligned contributor-facing CMS role checks and editor restrictions.

**Consequences:** Contributor access is a submission workflow, not delegated publishing authority. Scheduling, publishing, archiving, homepage placement, and contributor management remain admin-only. Authorization must be enforced in the database, not only hidden in the UI.

**Implementation note:** The UI, generated types, recovered migrations, and live policies align on `op_ed`/`Op-Ed`. The database constraint still accepts legacy `commissioner` records for compatibility; remove that compatibility only after confirming no production user depends on it. Preserve the local authorization matrix as a regression check.

## ADR-007: Favor editorial storytelling over raw data

**Status:** Provisional — owner confirmation required

**Decision:** Treat stories and editorial framing as the primary experience, with fantasy data supporting the narrative.

**Evidence:** Product structure, Gazette modules, homepage story components, and prior project context; this is not independently provable from code alone.

**Consequences:** TODO: Confirm and then use this principle when resolving navigation, homepage, and feature-priority tradeoffs.

## ADR-008: Editorial articles remain human-written

**Status:** Provisional — owner confirmation required

**Decision:** Do not introduce automatic article generation as part of the publication workflow.

**Evidence:** Prior project context only; the repository contains a human-operated editor and no generation pipeline.

**Consequences:** Automated systems may support data preparation, but publication authorship remains human unless this decision is explicitly revisited.

## ADR-009: Maintain a repository-local project handbook

**Status:** Accepted

**Decision:** Keep durable project knowledge in the versioned `docs/` directory, organized by subsystem, and update it alongside changes that affect documented behavior.

**Evidence:** The handbook index, subsystem pages, and `docs/project-history.md` in this repository.

**Consequences:** Future work starts from a compact, current project context. Documentation must distinguish repository evidence from hosted-system verification and owner-confirmed rationale. Conversation history remains background context rather than an authoritative specification.

## ADR-010: Reconstruct the missing foundation and preserve an independent schema snapshot

**Status:** Accepted locally; linked migration-history alignment requires explicit approval

**Decision:** Use guarded migration `20260727000000_foundational_schema.sql` to reconstruct the schema that predates tracked migrations. Keep `supabase/schemas/production.sql` as an independent, schema-only verification and recovery snapshot.

**Evidence:** The original first migration required foundational tables absent from every migration and Git history. The reconstructed foundation plus all 21 historical migrations completes a clean local reset, passes linting, and produces a schema dump identical to production.

**Consequences:** Local development has a reproducible schema bootstrap. The baseline intentionally refuses to execute when foundational tables already exist. Before the next linked database push, version `20260727000000` must be reviewed and deliberately recorded as already applied in production migration history; it must not be executed there.

## Adding a decision

Record the context, decision, evidence, consequences, status, and date. Prefer short records that explain why a constraint exists; implementation detail belongs in the subsystem documents.
