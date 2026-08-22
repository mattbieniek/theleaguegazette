# Editorial Workflow

> Repository-backed draft. Article editor and review migrations audited August 7, 2026 at `b12aff34`.

> **Verification status:** The repository editor and live policies implement Op-Ed submission by non-admin contributors. The production build and 11-check local administrator/contributor authorization matrix passed on August 9, 2026.

## Purpose

The CMS supports writing, autosaving, review, scheduling, publication, homepage placement, artwork, feedback, notifications, archiving, and deletion. The browser editor provides the workflow experience; Supabase RLS and administrator RPCs provide the security boundary.

## Status model

| Status | Meaning | Public behavior |
| --- | --- | --- |
| `draft` | Work in progress | Not listed publicly |
| `ready_for_review` | Complete and awaiting administrator approval | Not listed publicly |
| `scheduled` | Approved for a future publication time | Public once `published_at` is reached |
| `published` | Live story | Public when `published_at` is present and reached |
| `archived` | Retained in the editorial archive | Removed from normal public listings |

Public Gazette queries include `published` and `scheduled` rows whose `published_at` is less than or equal to the current time. A scheduled story can therefore be live while retaining its `scheduled` status; the admin UI labels this “Live — scheduled.”

## Roles and boundaries

### Administrators

Administrators can manage all stories, publish or schedule stories, return submitted stories for changes, curate homepage placement, manage contributors, operate Sleeper syncs, and use the archive, rankings, awards, teams, and photo workspaces.

### Op-Ed contributors

Non-admin contributors are existing Supabase Auth users granted the `op_ed` role in `publication_contributors`. They may create and manage only their own Op-Ed stories while those stories are `draft` or `ready_for_review`, then submit them for consideration. They do not approve or publish. The intended editor fixes the category to `Op-Ed`, hides publication date and homepage controls, and exposes only draft and ready-for-review states.

The live database repeats these restrictions through ownership, category, status, and contributor checks. Hiding controls in the browser is not sufficient authorization. The editor also forces the Op-Ed category and contributor identity, rejects privileged statuses, clears publication and homepage controls from contributor payloads, and limits contributor role checks to `op_ed`.

## Story lifecycle

1. Create a story at `/admin/articles/new` or open an existing story from `/admin/articles`.
2. Enter a headline. A valid slug is generated automatically until the slug is manually edited. The first save requires a headline.
3. Write the summary and TipTap body, choose a category, set the author, and optionally select/upload artwork. Administrators can also prepare standalone artwork in the Photo Desk and select it later from the editor.
4. Changes to the headline, slug, summary, category, author, publication date, image fields, homepage order, and featured flag schedule an autosave after approximately 1.4 seconds. Autosave applies the current status and does not apply status-transition timestamp rules.
5. Use Preview to inspect the unsaved story without publishing it.
6. Before `ready_for_review`, `scheduled`, or `published`, the readiness checklist requires a headline, valid slug, category, summary, body, and alternative text whenever an image is present. Scheduling also requires a future publication date.
7. Select `ready_for_review` and submit. The database trigger records a `submitted` review event and creates review-request notifications for administrators.
8. An administrator either uses **Approve & Publish** or selects a publication status and confirms the transition. Publishing sets `published_at` to the current time when transitioning; scheduling stores the selected publication time.
9. An administrator may return a submitted story to draft through `admin_return_article_for_changes`, which requires a non-empty note, records `changes_requested`, clears `published_at`, and notifies the contributor.
10. Archive a story when it should remain retained but leave normal public listings. Permanent deletion is available from the editor and removes the article; the editor then attempts to remove its featured image when no other article references that URL.

## Review history and notifications

Review history is stored in `editorial_review_events` and displayed on the editor. The current actions are `submitted`, `changes_requested`, and `approved`. Notifications are stored in `editorial_notifications` and include review requests, publication notices, and requested changes. Leaving `ready_for_review` removes outstanding review-request notifications for that article.

## Publication checklist

Before publishing or scheduling, confirm:

- Headline, slug, category, summary, and body are complete.
- Featured image alternative text exists when an image is used.
- The publication date is correct; scheduled dates are in the future.
- The preview reads correctly on a narrow viewport.
- Homepage placement and featured status are intentional for administrators.
- The public article route, Gazette listing, homepage placement, and image alt text are correct after publication.

## Verification gaps

- Re-run the local `npm run test:contributor-rls` authorization matrix after changing this workflow. A production UI walkthrough should verify presentation and session behavior without attempting forbidden production mutations.
- TODO: Confirm timezone expectations for the local date-time control and scheduled publication.
- TODO: Confirm image size/type limits, orphan cleanup, and deletion behavior in production Storage.
