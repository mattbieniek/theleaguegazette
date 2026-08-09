# Project History and Handbook Notes

> Last updated: August 7, 2026

This page preserves the useful project context behind the handbook without treating a conversation transcript as implementation documentation.

## Why the handbook was created

The League Gazette has accumulated product decisions, implementation details, and operational knowledge across development sessions. Reconstructing that context from memory each time makes feature work slower and increases the risk of documenting behavior that was discussed but never implemented.

The handbook provides a durable, repository-local starting point for future work. It should make focused tasks—such as changing the admin CMS, extending Sleeper synchronization, or adding a public feature—possible without rereading the entire project history.

## Origin of this first draft

The initial handbook was planned during the ChatGPT conversation titled **High Usage Inquiry**. That conversation established the following working principles:

- Build documentation from the current project rather than from old conversations alone.
- Create the handbook incrementally, one subsystem at a time, so each session stays focused.
- Treat conversations as useful context for rationale, not as proof that a feature exists.
- Keep production-only facts clearly marked until they are verified against the hosted systems.

The first draft was then assembled from the repository at commit `b12aff34` and validated with the project's type check and production build.

## Source-of-truth hierarchy

When this page or a prior conversation conflicts with current behavior, use this order:

1. Current repository code and migrations
2. Hosted Supabase schema, policies, functions, and scheduled jobs
3. Vercel and environment configuration
4. Successful build and runtime behavior
5. Committed handbook documentation
6. Project conversations and memory

This hierarchy is intentionally repeated here because it is the most important rule for keeping the handbook accurate.

## Current confidence and open verification

The repository-backed portions of the handbook describe implemented routes, components, queries, migrations, functions, configuration, and styling. The following still require access to hosted systems or owner confirmation:

- The production Supabase schema may contain objects not represented by the checked-in migrations.
- Production environment variables, Vercel project settings, domains, and rollback procedures need confirmation.
- Scheduled jobs or external automation that invoke synchronization functions need confirmation.
- Product principles recorded as provisional decisions need owner confirmation.

These items are marked with `TODO` or an explicit verification status in the relevant handbook page.

## Documentation practice

Keep this page concise and historical. Add durable rationale to `decisions.md`, implementation details to the relevant subsystem page, and current behavior to code or migrations first. Do not copy a full chat transcript into the repository; preserve only context that helps a future maintainer understand why the handbook or a decision exists.
