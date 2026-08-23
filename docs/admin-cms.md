# Admin CMS

> Repository-backed draft. Route and component inventory audited August 7, 2026 at `b12aff34`.

> **Verification status:** The CMS UI and live policies use the owner-confirmed Op-Ed contributor model. The production build and local administrator/contributor authorization matrix passed on August 9, 2026. After PR #26 merged, a read-only production walkthrough verified the corrected anonymous redirects and login-only layout; authenticated presentation remains unverified.

## Entry and authentication

`/admin/login` signs in through Supabase Auth with email and password. The shared `AdminLayout` is `noindex`; each interactive admin page checks the current session and redirects unauthenticated users to the login page. A user must exist in `admin_users` or `publication_contributors` to use the editorial area.

The initial August 9, 2026 production walkthrough confirmed that `/admin`, `/admin/articles`, and `/admin/notifications` redirected an anonymous visitor to `/admin/login`, but found that the logged-out page visibly rendered the full editorial sidebar, **New Story**, and **Sign out** controls. This was a navigation-disclosure and usability defect rather than an authorization bypass. PR #26 normalized the route's trailing slash before selecting the login-only layout. After merge commit `ffcb328e` deployed successfully, the canonical production URL showed the sign-in form with no admin navigation or session-only controls, retained `noindex, nofollow`, and produced no browser errors.

Authorization is enforced twice: browser code chooses the appropriate workspace and database RLS/RPCs enforce the actual permission. Session expiry and unauthorized errors should be treated as normal recoverable states, not as evidence that a user has access.

## Route map

| Route | Purpose | Access |
| --- | --- | --- |
| `/admin` | Editorial desk, counts, review queue, scheduled stories, and recent activity | Administrator |
| `/admin/articles` | Filterable story list and status counts | Administrator or Op-Ed contributor (own stories) |
| `/admin/articles/new` | Create an administrative story or contributor Op-Ed draft | Administrator or Op-Ed contributor |
| `/admin/articles/[id]` | Edit, preview, review, publish, schedule, archive, or delete a story | Administrator; Op-Ed contributor only for own draft/review stories |
| `/admin/notifications` | Read and resolve personal editorial notifications | Administrator or Op-Ed contributor |
| `/admin/contributors` | Grant or remove Op-Ed submission access | Administrator |
| `/admin/homepage` | Arrange live/scheduled story placement and featured story | Administrator |
| `/admin/rankings` | Draft and publish power-ranking editions | Administrator |
| `/admin/awards` | Inspect weekly results and refresh matchup data for awards | Administrator |
| `/admin/photos` | Review article artwork and missing alt text | Administrator |
| `/admin/teams` | Inspect teams, managers, records, and rosters | Administrator |
| `/admin/archive` | Inspect historical coverage and refresh draft/transaction archives | Administrator |
| `/admin/sleeper` | Run foundational and weekly Sleeper syncs and inspect freshness | Administrator |
| `/admin/changelog` | Review plain-language website changes grouped by commit date | Administrator |

Contributor navigation hides administrator groups, while direct-route checks and database authorization remain necessary. Contributor-facing route checks use the `op_ed` role.

## Daily publishing workflow

1. Open the Editorial Desk and review stories needing attention, scheduled stories, missing artwork alt text, and unread notifications.
2. Use Stories to filter by status or category. Administrators use the `editorial_articles` view for editorial metadata; Op-Ed contributors should see only their own rows from `gazette_articles`.
3. Open a story in the editor. Let autosave settle, or use **Save changes** before leaving the page. The editor warns before navigating away with unsaved changes or an active upload.
4. Use the readiness checklist and Preview before submitting, scheduling, or publishing.
5. For a submitted contributor story, review the history and body. Approve and publish, or return it with a specific revision note.
6. After publication, verify the public slug, Gazette listing, homepage placement, publication time, and image alternative text.

## Admin-only operating areas

- Homepage curation reads published and due scheduled stories, then writes `homepage_order` and `is_featured`.
- Contributors are managed through administrator-only RPCs. The user must already exist in Supabase Auth; granting access does not send an invitation.
- Sleeper, teams, archive, awards, and rankings pages use the administrator check before allowing operational actions.
- Notifications are personal: authenticated users can mark their own notifications read, while administrators receive review requests.
- Changelog entries are stored in `src/data/adminChangelog.ts` and served only after the private API verifies the current account in `admin_users`; the static page does not contain the entries.

## Failure and recovery notes

- A duplicate slug returns a specific conflict message; choose a new slug and save again.
- Autosave failures leave the story marked unsaved; use an explicit save after correcting the error.
- Featured-image uploads require a saved article first. Inline artwork can be staged before a new story has a headline or draft record. Replacing artwork on a live story requires alternative text.
- Returning a story for changes must include a non-empty review note and is performed through the protected RPC.
- Publishing, scheduling, archiving, and moving a live story back to draft or review require confirmation because they change public visibility.

## Role-based smoke test

- [x] Unauthenticated visitor is redirected to `/admin/login`, with `noindex, nofollow`. Verified in production on August 9, 2026.
- [ ] Administrator can create a draft, submit it, return it with feedback, publish it, schedule it, archive it, and see review history.
- [x] Op-Ed contributor can create only an Op-Ed story and cannot publish, feature, or assign homepage placement. Verified through the local API on August 9, 2026.
- [x] Op-Ed contributor cannot read or modify another user's draft. Verified through the local API on August 9, 2026.
- [ ] Public users cannot see draft, review, or archived stories.
- [ ] A scheduled story becomes publicly available when its publication time is reached.
- [ ] Notification read state changes only for the signed-in user.
- [ ] Direct route access and RLS agree with the visible navigation.

## Verification gaps

- Re-run `npm run test:contributor-rls` after changing contributor roles, article policies, publication transitions, or related RPCs. It creates and removes temporary identities and refuses non-local URLs by default.
- The anonymous production walkthrough is complete. Repeat it after future changes to `AdminLayout.astro`, login routing, or deployment path normalization.
- TODO: Complete a read-only authenticated administrator and Op-Ed contributor presentation walkthrough using owner-controlled sessions; do not create production test stories for this purpose.
- TODO: Confirm all admin route checks remain aligned with RLS and RPC permissions after future migrations.
- TODO: Document session expiry, password reset, rate limiting, and production incident handling.
