# Frontend

> Repository-backed draft. Route and shared-shell audit: August 7, 2026 at `b12aff34`.

## Public shell

`BaseLayout.astro` loads the global stylesheet and font packages, then composes `Masthead`, `SiteNav`, the page slot, and `SiteFooter`. It also centralizes document titles, descriptions, canonical URLs, social cards, article metadata, JSON-LD organization/website data, and breadcrumbs. Admin pages use `AdminLayout` and are marked `noindex`.

The primary navigation is intentionally small: Front Page, Gazette, Matchups, Standings, Teams, History, and Search. Feature pages that are not in the primary bar remain reachable from internal links, the footer, or contextual navigation.

## Route map

| Area | Routes | Main data or behavior |
| --- | --- | --- |
| Publication | `/`, `/gazette`, `/gazette/[slug]`, `/search` | Editorial queries from `src/lib/queries/gazette.ts`; article pages use article metadata and related stories |
| Current league | `/teams`, `/teams/[slug]`, `/standings`, `/matchups`, `/stats`, `/rankings`, `/awards` | Supabase league queries combined with pure aggregation modules under `src/lib/gazette/` |
| Archive | `/history`, `/history/[season]`, `/records`, `/draft`, `/transactions` | Historical results, drafts, transactions, and derived franchise/record views |
| System | `/robots.txt`, `/sitemap.xml`, `/404`, `/500` | Crawl rules, public URL generation, and error states |

## Data and rendering boundaries

- `src/lib/supabase.ts` provides the server-side client used by Astro pages and query modules.
- `src/lib/supabase-browser.ts` is for browser interactions such as admin authentication, CMS writes, and interactive controls.
- `src/lib/queries/` owns reusable database reads; `src/lib/gazette/` owns derived editorial, statistics, record, history, award, and franchise calculations.
- `src/data/` contains static league metadata, team identity, fallback content, and presentation constants.
- Components should format and present data; they should not duplicate database joins that belong in query or domain modules.

Astro is configured with `output: 'static'` and the Vercel adapter. Data-dependent pages can opt out of prerendering with `export const prerender = false`; the repository uses that override on several database-heavy routes. Do not infer a route's production caching behavior from the config alone—verify the built output when changing rendering or freshness requirements.

### Declared rendering matrix

With the current static-output configuration, routes without an override use the default build-time behavior. The route source declares:

| Rendering | Routes |
| --- | --- |
| On demand (`prerender = false`) | `/`, `/gazette`, `/gazette/[slug]`, `/search`, `/awards`, `/draft`, `/history`, `/history/[season]`, `/records`, `/stats`, `/transactions`, `/sitemap.xml`, `/500`, `/admin/articles/[id]` |
| Explicitly prerendered | `/robots.txt` |
| Default build-time shell | `/matchups`, `/standings`, `/rankings`, `/teams`, `/teams/[slug]`, `/404`, `/admin`, `/admin/login`, `/admin/articles`, `/admin/articles/new`, `/admin/notifications`, `/admin/contributors`, `/admin/homepage`, `/admin/rankings`, `/admin/awards`, `/admin/photos`, `/admin/teams`, `/admin/archive`, `/admin/sleeper` |

Most default admin routes render a static shell and load authenticated data in the browser. The matrix records source declarations, not a promise about CDN caching or Vercel revalidation.

## URL controls

Season, week, and search controls are represented in query parameters where applicable (for example, `?season=2025` or `?week=3`). Keep URLs shareable and preserve the selected state after navigation. Dynamic slugs are the canonical public article and team identifiers.

## Empty, error, and freshness states

Pages generally render a deliberate empty-state message when no completed league data or stories are available. Database errors should remain visible to the user in the relevant page state rather than silently presenting stale-looking values. When a page depends on a recent Sleeper sync, show the dataset's last-known freshness or explain that the archive is incomplete.

The administrator Sleeper workspace labels each active-season dataset as
Fresh, Stale, or Not synced. Its default thresholds are 24 hours for the
player/user directory, 6 hours for rosters, matchups, and transactions, 7
days for drafts, and 8 days for roster snapshots.

## SEO and accessibility contracts

- Give every public page a meaningful title and description through `BaseLayout`.
- Preserve canonical URLs, Open Graph/Twitter image metadata, and structured data when adding new public routes.
- Use `type="article"`, publication dates, and author metadata for Gazette stories.
- Keep headings hierarchical, tables captioned/labeled, interactive controls keyboard reachable, and images supplied with useful alternative text.
- Preserve the global `:focus-visible` treatment and reduced-motion media query.

## Adding a public page

1. Decide whether the page is editorial, current-league, or archive content.
2. Reuse an existing query/domain module or add one under the appropriate `src/lib/` directory.
3. Choose and document rendering/freshness behavior; add `prerender = false` only when the page needs on-demand data.
4. Use `BaseLayout`, canonical metadata, and the shared `site-shell`/token primitives.
5. Define loading, empty, error, offseason, and narrow-screen behavior.
6. Add contextual navigation and update the route map or sitemap when needed.
7. Run `npm run check` and `npm run build`, then smoke-test the public route with representative data.

## Verification gaps

- TODO: Document exact query dependencies, CDN/cache behavior, and empty/error states for each public route.
- TODO: Run an accessibility and mobile audit across the route families.
- TODO: Confirm production behavior for scheduled article visibility, stale league data, and error pages.
