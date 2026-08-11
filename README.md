# Far Far Away Football — Prototype

A responsive Astro + TypeScript prototype for **The League Gazette**, using the completed 2025 Sleeper league as its initial data source.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:4321`.

## Production build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Create a new GitHub repository.
2. Push this project to the repository.
3. In Vercel, choose **Add New → Project** and import the repository.
4. Vercel should detect Astro automatically.
5. Build command: `npm run build`
6. Output directory: `dist`

No API key is needed for Sleeper. The integration is read-only.

## Sleeper league

- Active league ID: `1389719207712681984` (2026)
- API utility: `src/lib/sleeper.ts`
- Homepage performs client-side hydration and keeps polished fallback data when the API is unavailable.

Automated active-season imports run through `automate-sleeper-sync` from the
GitHub Actions workflow in `.github/workflows/sleeper-sync.yml`. Historical
league rows remain unchanged; administrator-triggered imports are required for
archived seasons.

## Current routes

- `/` — finished homepage prototype
- `/teams` — franchise directory
- `/teams/[slug]` — reusable profile template for all ten teams
- `/standings` — standings layout
- `/stats` — placeholder
- `/draft` — placeholder
- `/awards` — placeholder
- `/gazette` — placeholder

## Branding

League colors and team accent colors are defined in:

- `src/styles/global.css`
- `src/data/teams.ts`

Legacy logos are temporary placeholders and can be replaced without changing page layouts.

## Important prototype note

Because the build environment used to package this project could not reach the Sleeper API directly, the repository includes visually realistic fallback records. In a browser with normal internet access, the homepage attempts to replace those values with live archived Sleeper roster data. The next pass should add server/build-time data normalization and confirm the mapping against the actual Sleeper display names.

## Publication contributors

Commissioners use the existing `/admin/login` screen. To add one:

1. Invite or create the user in Supabase Authentication.
2. Apply the repository's latest database migrations.
3. Add the authenticated user to `public.publication_contributors`:

```sql
insert into public.publication_contributors (user_id, display_name, role)
values ('AUTH_USER_UUID', 'Commissioner Name', 'commissioner');
```

Commissioners can create, edit, upload artwork for, and delete only their own **Commissioner's Corner** stories. They can save drafts and submit stories for review. Scheduling, publishing, archiving, and homepage placement remain administrator-only.
