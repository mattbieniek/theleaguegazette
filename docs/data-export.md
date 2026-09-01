# Data Export

The `/admin/export` workspace gives approved accounts a read-only way to download curated Gazette and league data. It does not expose the Supabase dashboard, a database password, arbitrary SQL, draft content, reader accounts, or administrative records.

## Access model

The `data_export_readers` table is a separate access grant. It is intentionally not part of `publication_contributors`, because data readers must not receive editorial write permissions.

Administrators can grant or revoke the permission from `/admin/contributors` after the account exists in Supabase Auth and has a reader profile. Administrators also have access automatically. The export API verifies the current Supabase session and the grant on every request.

## Available exports

- Published Gazette articles
- Season standings
- Weekly matchup results
- Weekly standings
- Teams and records
- Draft picks
- Completed transactions
- Completed transaction assets
- Weekly player scores

Season-aware datasets can be narrowed to one season. Each export is built from an explicit allowlist of columns. The API supports `.xlsx`, `.csv`, and `.json` downloads and caps an individual export at 50,000 rows.

## Deployment

1. Apply the latest Supabase migrations, including `20260901100000_add_data_export_access.sql`.
2. Confirm AJ has a Supabase Auth account and has completed a reader profile.
3. Sign in as an administrator, open Accounts, and choose **Grant data access** for AJ.
4. AJ can sign in at `/admin/login`, open **Data Export**, choose a dataset and format, and download the file.

The Astro endpoint uses the signed-in user's publishable Supabase client and existing RLS policies to read only data already approved for authenticated/public access. No service-role secret is used by the export route.
