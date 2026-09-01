# Architecture

> Last verified: August 6, 2026 against `b12aff34`.

## System overview

The League Gazette is a single Astro application with two experiences:

- A public editorial and league-statistics site under routes such as `/`, `/gazette`, `/teams`, and `/standings`.
- A browser-driven administrative workspace under `/admin` for stories, contributors, homepage curation, league content, and Sleeper synchronization.

Supabase is the application data and identity boundary. Sleeper is an upstream, read-only fantasy-football source. Vercel is the configured Astro deployment target.

## Runtime shape

`astro.config.mjs` sets `output: 'static'` and configures the Vercel adapter. Many data-dependent routes explicitly set `prerender = false`, so the deployed application is hybrid in practice: routes without that override can be generated at build time, while database-backed pages run on demand.

Confirmed on-demand public routes include the homepage, Gazette listing and article pages, search, awards, draft, history, rankings, records, stats, transactions, sitemap, and the 500 page. Several routes without an explicit override may remain statically generated; verify their build output before relying on that classification.

Admin pages are client-oriented Astro pages. Authentication and authorization checks occur through the Supabase browser client and database policies/RPCs. The dynamic article editor explicitly disables prerendering.

## Data flow

### Public request

1. An Astro route obtains the configured public Supabase client or calls a module in `src/lib/queries/` or `src/lib/gazette/`.
2. The query reads public data permitted by row-level security.
3. The route renders shared layouts and components.
4. Static metadata in `src/data/` supplies team identity, historical context, or fallback presentation where coded.

### Editorial write

1. A user signs in through `/admin/login` using Supabase Auth.
2. Admin pages initialize `src/lib/supabase-browser.ts`.
3. The CMS reads and writes through tables, storage, and security-definer RPCs subject to RLS and role rules.
4. Published stories are read by public Gazette queries and rendered by `ArticleBody.astro`.

### Sleeper synchronization

1. An authenticated administrator starts a sync from the admin Sleeper workspace or invokes an Edge Function by an approved operational method.
2. `_shared/requireAdmin.ts` validates the bearer token and administrator status.
3. The Edge Function fetches Sleeper's public API.
4. Normalized records are upserted into Supabase; status is exposed to the admin workspace where implemented.
5. Public query modules read the stored data rather than making every page request depend solely on Sleeper availability.

## Primary boundaries

- `src/lib/supabase.ts`: server/build-compatible public client.
- `src/lib/supabase-browser.ts`: browser-side client used by authenticated tools.
- `src/lib/sleeper.ts`: Sleeper API utility.
- `src/lib/queries/`: data-access modules for league features.
- `src/lib/gazette/`: presentation/domain aggregation for editorial pages.
- `supabase/functions/`: privileged ingestion boundary; service-role secrets stay server-side.
- `src/pages/api/admin/export.ts`: authenticated, read-only export boundary for approved league and published Gazette datasets.
- RLS and RPC functions: final authorization boundary for browser-originated data access.

## Security model

The public clients use `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`; these are intentionally browser-visible and must be paired with correct RLS. Edge Functions use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service-role key to Astro client code.

The owner-confirmed contributor model uses the `op_ed` role with ownership- and category-limited draft/review access; only administrators publish. Live policies, recovered migrations, and contributor-facing CMS checks implement that direction. The earlier commissioner migration remains historical, and the live role constraint temporarily accepts its value for compatibility. Administrative checks use `admin_users` and security-definer RPCs or Edge Function authorization. Data readers use the separate `data_export_readers` grant; the export route verifies the session and grant, then queries only public/RLS-approved objects through the user's authenticated Supabase client.

## Architectural risks and verification work

- TODO: Review and commit the verified foundational baseline and approve its production history-only alignment; the complete replay evidence is recorded in `supabase-audit.md`.
- TODO: Verify which routes are emitted statically versus as Vercel functions in a clean production build.
- TODO: Document caching, revalidation, and failure behavior for every public query.
- TODO: Confirm that every privileged browser action is protected by RLS or a role-checking RPC.
- TODO: Confirm production observability and error reporting.
