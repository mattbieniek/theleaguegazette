


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_add_publication_contributor"("contributor_email" "text", "contributor_display_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare contributor_user_id uuid;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Administrator access is required.';
  end if;
  if nullif(trim(contributor_display_name), '') is null then
    raise exception 'A display name is required.';
  end if;
  select id into contributor_user_id from auth.users
  where lower(email) = lower(trim(contributor_email)) limit 1;
  if contributor_user_id is null then
    raise exception 'No Supabase Authentication user exists with that email address.';
  end if;
  insert into public.publication_contributors (user_id, display_name, role)
  values (contributor_user_id, trim(contributor_display_name), 'op_ed')
  on conflict (user_id) do update
    set display_name = excluded.display_name, role = excluded.role;
  return contributor_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_add_publication_contributor"("contributor_email" "text", "contributor_display_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_publication_contributors"() RETURNS TABLE("user_id" "uuid", "email" "text", "display_name" "text", "role" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    contributor.user_id,
    auth_user.email::text,
    contributor.display_name,
    contributor.role,
    contributor.created_at
  from public.publication_contributors as contributor
  join auth.users as auth_user on auth_user.id = contributor.user_id
  where exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
  order by contributor.created_at desc;
$$;


ALTER FUNCTION "public"."admin_publication_contributors"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_remove_publication_contributor"("contributor_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ) then
    raise exception 'Administrator access is required.';
  end if;

  delete from public.publication_contributors
  where user_id = contributor_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_remove_publication_contributor"("contributor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_return_article_for_changes"("target_article_id" "uuid", "review_note" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_status text;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;

  if length(trim(coalesce(review_note, ''))) = 0 then
    raise exception 'A review note is required';
  end if;

  select status into current_status
  from public.gazette_articles
  where id = target_article_id
  for update;

  if current_status is null then
    raise exception 'Story not found';
  end if;

  if current_status <> 'ready_for_review' then
    raise exception 'Only stories ready for review can be returned for changes';
  end if;

  insert into public.editorial_review_events (article_id, actor_user_id, action, note)
  values (target_article_id, auth.uid(), 'changes_requested', trim(review_note));

  update public.gazette_articles
  set status = 'draft', published_at = null, updated_at = now()
  where id = target_article_id;
end;
$$;


ALTER FUNCTION "public"."admin_return_article_for_changes"("target_article_id" "uuid", "review_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_contributor_access"("target_user_id" "uuid", "access_enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  account_name text;
begin
  if not exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ) then
    raise exception 'Administrator access is required.';
  end if;

  if exists (
    select 1 from public.admin_users
    where admin_users.user_id = target_user_id
  ) then
    raise exception 'Administrator accounts already have full editorial access.';
  end if;

  if access_enabled then
    select display_name into account_name
    from public.reader_profiles
    where user_id = target_user_id;

    if account_name is null then
      raise exception 'No Gazette account exists for that user.';
    end if;

    insert into public.publication_contributors (user_id, display_name, role)
    values (target_user_id, account_name, 'op_ed')
    on conflict (user_id) do update
      set display_name = excluded.display_name,
          role = excluded.role;
  else
    delete from public.publication_contributors
    where user_id = target_user_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."admin_set_contributor_access"("target_user_id" "uuid", "access_enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_site_accounts"() RETURNS TABLE("user_id" "uuid", "email" "text", "display_name" "text", "digest_enabled" boolean, "is_contributor" boolean, "is_admin" boolean, "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    profile.user_id,
    auth_user.email::text,
    profile.display_name,
    profile.digest_enabled,
    contributor.user_id is not null,
    admin_user.user_id is not null,
    profile.created_at
  from public.reader_profiles as profile
  join auth.users as auth_user on auth_user.id = profile.user_id
  left join public.publication_contributors as contributor on contributor.user_id = profile.user_id
  left join public.admin_users as admin_user on admin_user.user_id = profile.user_id
  where exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
  order by profile.created_at desc;
$$;


ALTER FUNCTION "public"."admin_site_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_sleeper_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;

  select jsonb_build_object(
    'league', coalesce((
      select to_jsonb(league_row)
      from (
        select id, name, sleeper_league_id, season, status, current_week,
          total_rosters, last_synced_at, updated_at
        from public.leagues
        order by season desc, updated_at desc
        limit 1
      ) league_row
    ), 'null'::jsonb),
    'datasets', jsonb_build_array(
      jsonb_build_object('key', 'players', 'label', 'NFL players', 'last_synced_at', (select max(last_synced_at) from public.players)),
      jsonb_build_object('key', 'managers', 'label', 'League users', 'last_synced_at', (select max(last_synced_at) from public.managers)),
      jsonb_build_object('key', 'rosters', 'label', 'Teams and rosters', 'last_synced_at', (select max(last_synced_at) from public.fantasy_teams)),
      jsonb_build_object('key', 'matchups', 'label', 'Matchups', 'last_synced_at', (select max(updated_at) from public.matchups)),
      jsonb_build_object('key', 'drafts', 'label', 'Draft history', 'last_synced_at', (select max(last_synced_at) from public.drafts)),
      jsonb_build_object('key', 'transactions', 'label', 'Transactions', 'last_synced_at', (select max(last_synced_at) from public.league_transactions)),
      jsonb_build_object('key', 'snapshots', 'label', 'Roster snapshots', 'last_synced_at', (select max(created_at) from public.roster_snapshots))
    ),
    'recent_runs', coalesce((
      select jsonb_agg(to_jsonb(run_row) order by run_row.started_at desc)
      from (
        select id, sync_type, status, started_at, completed_at,
          records_processed, error_message, details
        from public.sync_runs
        order by started_at desc
        limit 12
      ) run_row
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;


ALTER FUNCTION "public"."admin_sleeper_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."article_login_identity"("target_article_id" "uuid") RETURNS TABLE("user_id" "uuid", "email" "text", "login" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.gazette_articles article
    where article.id = target_article_id
      and (article.created_by = auth.uid() or exists (
        select 1 from public.admin_users where admin_users.user_id = auth.uid()
      ))
  ) then
    raise exception 'Editorial access is required.';
  end if;
  return query
    select users.id, users.email::text, split_part(users.email, '@', 1)::text
    from public.gazette_articles article
    join auth.users users on users.id = article.created_by
    where article.id = target_article_id;
end;
$$;


ALTER FUNCTION "public"."article_login_identity"("target_article_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_editorial_status_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  if new.status = 'ready_for_review' then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    )
    select admin_users.user_id, new.id, 'review_requested', 'Story ready for review',
      new.headline || ' is ready for an editorial decision.', '/admin/articles/' || new.id::text
    from public.admin_users;

    if new.created_by is not null and exists (
      select 1 from public.publication_contributors where user_id = new.created_by
    ) then
      insert into public.editorial_review_events (article_id, actor_user_id, action)
      values (new.id, new.created_by, 'submitted');
    end if;
  elsif tg_op = 'UPDATE' and new.status = 'published' and new.created_by is not null and exists (
    select 1 from public.publication_contributors where user_id = new.created_by
  ) then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    ) values (
      new.created_by, new.id, 'story_published', 'Your story was published',
      new.headline || ' is now live in The League Gazette.', '/gazette/' || new.slug
    );
    insert into public.editorial_review_events (article_id, actor_user_id, action)
    values (new.id, auth.uid(), 'approved');
  elsif tg_op = 'UPDATE' and new.status = 'draft' and old.status = 'ready_for_review' and new.created_by is not null and exists (
    select 1 from public.publication_contributors where user_id = new.created_by
  ) then
    insert into public.editorial_notifications (
      recipient_user_id, article_id, kind, title, message, action_url
    ) values (
      new.created_by, new.id, 'changes_requested', 'Story returned for changes',
      new.headline || ' was returned to draft with editorial feedback.', '/admin/articles/' || new.id::text
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."create_editorial_status_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_reader_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare requested_name text;
begin
  requested_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1),
    'Gazette Reader'
  );
  if char_length(requested_name) < 2 then requested_name := 'Gazette Reader'; end if;
  insert into public.reader_profiles (user_id, display_name)
  values (new.id, left(requested_name, 40))
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."create_reader_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_gazette_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_gazette_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preserve_matchup_player_nfl_team_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.nfl_team_at_week is not null then
    new.nfl_team_at_week := old.nfl_team_at_week;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."preserve_matchup_player_nfl_team_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_computer_poll_lineups"("target_season_year" integer, "target_through_week" integer) RETURNS TABLE("fantasy_team_id" "uuid", "week" integer, "sleeper_player_id" "text", "player_position" "text", "points" numeric, "is_starter" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    matchup_team.fantasy_team_id,
    matchup.week,
    matchup_player.sleeper_player_id,
    coalesce(player.position, '—'),
    matchup_player.points,
    matchup_player.is_starter
  from public.matchup_players as matchup_player
  join public.matchup_teams as matchup_team
    on matchup_team.id = matchup_player.matchup_team_id
  join public.matchups as matchup
    on matchup.id = matchup_team.matchup_id
  join public.seasons as season
    on season.id = matchup.season_id
  left join public.players as player
    on player.sleeper_player_id = matchup_player.sleeper_player_id
  where season.year = target_season_year
    and matchup.week between 1 and target_through_week
    and target_season_year between 2000 and 2200
    and target_through_week between 1 and 18;
$$;


ALTER FUNCTION "public"."public_computer_poll_lineups"("target_season_year" integer, "target_through_week" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_matchup_lineups"("target_matchup_team_ids" "uuid"[]) RETURNS TABLE("matchup_team_id" "uuid", "sleeper_player_id" "text", "player_name" "text", "player_position" "text", "nfl_team" "text", "points" numeric, "is_starter" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    matchup_player.matchup_team_id,
    matchup_player.sleeper_player_id,
    coalesce(player.full_name, 'Player ' || matchup_player.sleeper_player_id),
    coalesce(player.position, '—'),
    matchup_player.nfl_team_at_week,
    matchup_player.points,
    matchup_player.is_starter
  from public.matchup_players as matchup_player
  left join public.players as player
    on player.sleeper_player_id = matchup_player.sleeper_player_id
  where matchup_player.matchup_team_id = any(target_matchup_team_ids)
    and cardinality(target_matchup_team_ids) between 1 and 10;
$$;


ALTER FUNCTION "public"."public_matchup_lineups"("target_matchup_team_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reader_poll_is_open"("target_season" integer, "target_week" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (select poll_window.is_open and (poll_window.closes_at is null or poll_window.closes_at > now())
     from public.reader_poll_windows poll_window
     where poll_window.season_year = target_season and poll_window.week = target_week),
    true
  );
$$;


ALTER FUNCTION "public"."reader_poll_is_open"("target_season" integer, "target_week" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reader_poll_is_current_week"("target_season" integer, "target_week" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select target_season = (select max(year) from public.seasons)
    and target_week = least(
      coalesce((select max(week) from public.team_weekly_results where season_year = target_season), 0) + 1,
      17
    );
$$;


ALTER FUNCTION "public"."reader_poll_is_current_week"("target_season" integer, "target_week" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_editorial_review_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if old.status = 'ready_for_review' and new.status <> 'ready_for_review' then
    delete from public.editorial_notifications
    where article_id = new.id
      and kind = 'review_requested';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."resolve_editorial_review_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_power_rankings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_power_rankings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_reader_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin new.updated_at = now(); return new; end;
$$;


ALTER FUNCTION "public"."set_reader_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_reader_ballot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare expected_teams integer; unique_teams integer; unique_ranks integer; minimum_rank integer; maximum_rank integer;
begin
  select count(*) into expected_teams
  from public.season_standings
  where season_year = new.season_year;

  select count(distinct item ->> 'teamId'), count(distinct (item ->> 'rank')::integer),
    min((item ->> 'rank')::integer), max((item ->> 'rank')::integer)
  into unique_teams, unique_ranks, minimum_rank, maximum_rank
  from jsonb_array_elements(new.rankings) item;
  if expected_teams < 2 or unique_teams <> expected_teams or unique_ranks <> expected_teams or minimum_rank <> 1 or maximum_rank <> expected_teams then
    raise exception 'A ballot must rank every team from first through last.';
  end if;
  return new;
exception when invalid_text_representation then
  raise exception 'Every ballot ranking must contain a numeric rank.';
end;
$$;


ALTER FUNCTION "public"."validate_reader_ballot"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fantasy_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "manager_id" "uuid",
    "sleeper_roster_id" integer NOT NULL,
    "team_name" "text",
    "avatar" "text",
    "wins" integer DEFAULT 0 NOT NULL,
    "losses" integer DEFAULT 0 NOT NULL,
    "ties" integer DEFAULT 0 NOT NULL,
    "points_for" numeric(12,2) DEFAULT 0 NOT NULL,
    "points_against" numeric(12,2) DEFAULT 0 NOT NULL,
    "waiver_position" integer,
    "waiver_budget_used" integer,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "season_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fantasy_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matchup_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matchup_id" "uuid" NOT NULL,
    "fantasy_team_id" "uuid" NOT NULL,
    "points" numeric(10,2) DEFAULT 0 NOT NULL,
    "starters_points" numeric(10,2),
    "bench_points" numeric(10,2),
    "is_winner" boolean,
    "is_tie" boolean DEFAULT false NOT NULL,
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matchup_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matchups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "week" integer NOT NULL,
    "sleeper_matchup_id" integer NOT NULL,
    "status" "text" DEFAULT 'complete'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    CONSTRAINT "matchups_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'live'::"text", 'complete'::"text"]))),
    CONSTRAINT "matchups_week_check" CHECK ((("week" >= 1) AND ("week" <= 18)))
);


ALTER TABLE "public"."matchups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "sleeper_league_id" "text" NOT NULL,
    "season_type" "text" DEFAULT 'regular'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "league_name" "text",
    "total_rosters" integer,
    "playoff_teams" integer,
    "regular_season_weeks" integer,
    "playoff_start_week" integer,
    "scoring_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "roster_positions" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "seasons_season_type_check" CHECK (("season_type" = ANY (ARRAY['regular'::"text", 'dynasty'::"text", 'keeper'::"text", 'bestball'::"text"]))),
    CONSTRAINT "seasons_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'active'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."seasons" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_weekly_results" WITH ("security_invoker"='true') AS
 SELECT "m"."id" AS "matchup_id",
    "m"."season_id",
    "m"."league_id",
    "s"."year" AS "season_year",
    "s"."sleeper_league_id",
    "m"."week",
    "m"."sleeper_matchup_id",
    "mt"."id" AS "matchup_team_id",
    "mt"."fantasy_team_id",
    "ft"."sleeper_roster_id",
    "ft"."team_name",
    "opponent_mt"."fantasy_team_id" AS "opponent_fantasy_team_id",
    "opponent_ft"."sleeper_roster_id" AS "opponent_sleeper_roster_id",
    "opponent_ft"."team_name" AS "opponent_team_name",
    ("mt"."points")::numeric AS "points_for",
    ("opponent_mt"."points")::numeric AS "points_against",
    ("mt"."points" - "opponent_mt"."points") AS "point_differential",
    ("mt"."starters_points")::numeric AS "starters_points",
    ("mt"."bench_points")::numeric AS "bench_points",
        CASE
            WHEN ("mt"."points" > "opponent_mt"."points") THEN 'W'::"text"
            WHEN ("mt"."points" < "opponent_mt"."points") THEN 'L'::"text"
            ELSE 'T'::"text"
        END AS "result",
        CASE
            WHEN ("mt"."points" > "opponent_mt"."points") THEN 1
            ELSE 0
        END AS "win",
        CASE
            WHEN ("mt"."points" < "opponent_mt"."points") THEN 1
            ELSE 0
        END AS "loss",
        CASE
            WHEN ("mt"."points" = "opponent_mt"."points") THEN 1
            ELSE 0
        END AS "tie",
    "mt"."is_winner",
    "mt"."is_tie"
   FROM ((((("public"."matchups" "m"
     JOIN "public"."seasons" "s" ON (("s"."id" = "m"."season_id")))
     JOIN "public"."matchup_teams" "mt" ON (("mt"."matchup_id" = "m"."id")))
     JOIN "public"."fantasy_teams" "ft" ON (("ft"."id" = "mt"."fantasy_team_id")))
     JOIN "public"."matchup_teams" "opponent_mt" ON ((("opponent_mt"."matchup_id" = "m"."id") AND ("opponent_mt"."id" <> "mt"."id"))))
     JOIN "public"."fantasy_teams" "opponent_ft" ON (("opponent_ft"."id" = "opponent_mt"."fantasy_team_id")))
  WHERE ("m"."status" = 'complete'::"text");


ALTER VIEW "public"."team_weekly_results" OWNER TO "postgres";


COMMENT ON VIEW "public"."team_weekly_results" IS 'One row per fantasy team per completed weekly matchup, including opponent, score, result, and margin.';



CREATE OR REPLACE VIEW "public"."all_play_standings" WITH ("security_invoker"='true') AS
 WITH "weekly_comparisons" AS (
         SELECT "team"."season_id",
            "team"."league_id",
            "team"."season_year",
            "team"."sleeper_league_id",
            "team"."week",
            "team"."fantasy_team_id",
            "team"."sleeper_roster_id",
            "team"."team_name",
            "team"."points_for",
            "count"(*) AS "all_play_games",
            "count"(*) FILTER (WHERE ("team"."points_for" > "opponent"."points_for")) AS "all_play_wins",
            "count"(*) FILTER (WHERE ("team"."points_for" < "opponent"."points_for")) AS "all_play_losses",
            "count"(*) FILTER (WHERE ("team"."points_for" = "opponent"."points_for")) AS "all_play_ties"
           FROM ("public"."team_weekly_results" "team"
             JOIN "public"."team_weekly_results" "opponent" ON ((("opponent"."season_id" = "team"."season_id") AND ("opponent"."week" = "team"."week") AND ("opponent"."fantasy_team_id" <> "team"."fantasy_team_id"))))
          GROUP BY "team"."season_id", "team"."league_id", "team"."season_year", "team"."sleeper_league_id", "team"."week", "team"."fantasy_team_id", "team"."sleeper_roster_id", "team"."team_name", "team"."points_for"
        ), "season_totals" AS (
         SELECT "weekly_comparisons"."season_id",
            "weekly_comparisons"."league_id",
            "weekly_comparisons"."season_year",
            "weekly_comparisons"."sleeper_league_id",
            "weekly_comparisons"."fantasy_team_id",
            "weekly_comparisons"."sleeper_roster_id",
            "weekly_comparisons"."team_name",
            "count"(*) AS "weeks_played",
            "sum"("weekly_comparisons"."all_play_games") AS "all_play_games",
            "sum"("weekly_comparisons"."all_play_wins") AS "all_play_wins",
            "sum"("weekly_comparisons"."all_play_losses") AS "all_play_losses",
            "sum"("weekly_comparisons"."all_play_ties") AS "all_play_ties",
            "sum"("weekly_comparisons"."points_for") AS "points_for",
            "avg"("weekly_comparisons"."points_for") AS "average_points",
                CASE
                    WHEN ("sum"("weekly_comparisons"."all_play_games") = (0)::numeric) THEN (0)::numeric
                    ELSE (("sum"("weekly_comparisons"."all_play_wins") + ("sum"("weekly_comparisons"."all_play_ties") * 0.5)) / "sum"("weekly_comparisons"."all_play_games"))
                END AS "all_play_percentage"
           FROM "weekly_comparisons"
          GROUP BY "weekly_comparisons"."season_id", "weekly_comparisons"."league_id", "weekly_comparisons"."season_year", "weekly_comparisons"."sleeper_league_id", "weekly_comparisons"."fantasy_team_id", "weekly_comparisons"."sleeper_roster_id", "weekly_comparisons"."team_name"
        )
 SELECT "row_number"() OVER (PARTITION BY "season_id" ORDER BY "season_totals"."all_play_percentage" DESC, "all_play_wins" DESC, "season_totals"."points_for" DESC, "sleeper_roster_id") AS "all_play_rank",
    "season_id",
    "league_id",
    "season_year",
    "sleeper_league_id",
    "fantasy_team_id",
    "sleeper_roster_id",
    "team_name",
    "weeks_played",
    "all_play_games",
    "all_play_wins",
    "all_play_losses",
    "all_play_ties",
    "round"("all_play_percentage", 3) AS "all_play_percentage",
    "round"("points_for", 2) AS "points_for",
    "round"("average_points", 2) AS "average_points"
   FROM "season_totals";


ALTER VIEW "public"."all_play_standings" OWNER TO "postgres";


COMMENT ON VIEW "public"."all_play_standings" IS 'Season standings calculated as though each fantasy team played every other team every week.';



CREATE TABLE IF NOT EXISTS "public"."draft_picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "fantasy_team_id" "uuid",
    "provider_pick_id" "text" NOT NULL,
    "pick_number" integer NOT NULL,
    "round" integer NOT NULL,
    "round_pick" integer NOT NULL,
    "draft_slot" integer,
    "roster_id" integer,
    "manager_provider_id" "text",
    "player_provider_id" "text",
    "player_name" "text" NOT NULL,
    "position" "text",
    "pro_team" "text",
    "is_keeper" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."draft_picks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid",
    "season_id" "uuid",
    "provider" "text" NOT NULL,
    "provider_draft_id" "text" NOT NULL,
    "season_year" integer NOT NULL,
    "name" "text",
    "draft_type" "text",
    "status" "text",
    "rounds" integer,
    "team_count" integer,
    "starts_at" timestamp with time zone,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gazette_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "category" "text" NOT NULL,
    "headline" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "author_name" "text" DEFAULT 'The Gazette Staff'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "image_url" "text",
    "image_alt" "text",
    "body" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "homepage_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "subcategory" "text",
    CONSTRAINT "gazette_articles_body_is_valid" CHECK ((("body" IS NULL) OR ("jsonb_typeof"("body") = ANY (ARRAY['array'::"text", 'object'::"text"])))),
    CONSTRAINT "gazette_articles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready_for_review'::"text", 'scheduled'::"text", 'published'::"text", 'archived'::"text"]))),
    CONSTRAINT "gazette_articles_subcategory_check" CHECK ((("subcategory" IS NULL) OR ("subcategory" = ANY (ARRAY['General'::"text", 'Hot Takes'::"text", 'Hit Piece'::"text"]))))
);


ALTER TABLE "public"."gazette_articles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."gazette_articles"."subcategory" IS 'Optional desk-specific classification. Limited Op-Ed contributors choose from the approved Op-Ed subcategories.';


CREATE TABLE IF NOT EXISTS "public"."gazette_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "body" "jsonb" DEFAULT '{"type": "doc", "content": [{"type": "paragraph"}]}'::jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gazette_comments_body_check" CHECK (("jsonb_typeof"("body") = 'object'::"text") AND (("body" ->> 'type'::"text") = 'doc'::"text") AND ("pg_column_size"("body") <= 16000))
);


ALTER TABLE "public"."gazette_comments" OWNER TO "postgres";



CREATE OR REPLACE VIEW "public"."editorial_articles" AS
 SELECT "id",
    "slug",
    "category",
    "headline",
    "summary",
    "author_name",
    "status",
    "is_featured",
    "homepage_order",
    "image_url",
    "image_alt",
    "published_at",
    "created_at",
    "updated_at",
        CASE
            WHEN (("status" = 'scheduled'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())) THEN 'Live — scheduled'::"text"
            WHEN ("status" = 'draft'::"text") THEN 'Draft'::"text"
            WHEN ("status" = 'ready_for_review'::"text") THEN 'Ready for review'::"text"
            WHEN ("status" = 'scheduled'::"text") THEN 'Scheduled'::"text"
            WHEN ("status" = 'published'::"text") THEN 'Published'::"text"
            WHEN ("status" = 'archived'::"text") THEN 'Archived'::"text"
            ELSE "initcap"("replace"("status", '_'::"text", ' '::"text"))
        END AS "status_label",
    (("image_url" IS NOT NULL) AND ("btrim"("image_url") <> ''::"text")) AS "has_featured_image",
    (("image_url" IS NOT NULL) AND ("btrim"("image_url") <> ''::"text") AND (("image_alt" IS NULL) OR ("btrim"("image_alt") = ''::"text"))) AS "needs_image_alt",
    (("summary" IS NOT NULL) AND ("btrim"("summary") <> ''::"text")) AS "has_summary",
    (("jsonb_typeof"("body") = 'array'::"text") AND ("jsonb_array_length"("body") > 0)) AS "has_body",
    ("status" = 'scheduled'::"text") AS "is_scheduled",
    (("status" = 'scheduled'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())) AS "is_due_for_publishing",
    ((("status" = 'published'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())) OR (("status" = 'scheduled'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"()))) AS "is_publicly_available",
    (("btrim"("headline") <> ''::"text") AND ("btrim"("slug") <> ''::"text") AND ("btrim"("category") <> ''::"text") AND ("summary" IS NOT NULL) AND ("btrim"("summary") <> ''::"text") AND ("jsonb_typeof"("body") = 'array'::"text") AND ("jsonb_array_length"("body") > 0) AND (("image_url" IS NULL) OR ("btrim"("image_url") = ''::"text") OR (("image_alt" IS NOT NULL) AND ("btrim"("image_alt") <> ''::"text")))) AS "can_publish",
        CASE
            WHEN (("status" = ANY (ARRAY['published'::"text", 'scheduled'::"text"])) AND ("published_at" IS NOT NULL)) THEN "published_at"
            ELSE "updated_at"
        END AS "editorial_date",
    GREATEST("updated_at", COALESCE("published_at", "updated_at")) AS "editorial_sort_at"
   FROM "public"."gazette_articles" "article";


ALTER VIEW "public"."editorial_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."editorial_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "article_id" "uuid",
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "action_url" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "editorial_notifications_kind_check" CHECK (("kind" = ANY (ARRAY['review_requested'::"text", 'story_published'::"text", 'changes_requested'::"text"])))
);


ALTER TABLE "public"."editorial_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."editorial_review_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "editorial_review_events_action_check" CHECK (("action" = ANY (ARRAY['submitted'::"text", 'changes_requested'::"text", 'approved'::"text"]))),
    CONSTRAINT "editorial_review_note_required" CHECK ((("action" <> 'changes_requested'::"text") OR ("length"(TRIM(BOTH FROM COALESCE("note", ''::"text"))) > 0)))
);


ALTER TABLE "public"."editorial_review_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."league_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "manager_id" "uuid" NOT NULL,
    "is_owner" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."league_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."league_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid",
    "season_id" "uuid",
    "provider" "text" NOT NULL,
    "provider_transaction_id" "text" NOT NULL,
    "season_year" integer NOT NULL,
    "week" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "creator_provider_id" "text",
    "faab_bid" numeric,
    "occurred_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."league_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leagues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sleeper_league_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "season" integer NOT NULL,
    "status" "text",
    "sport" "text" DEFAULT 'nfl'::"text" NOT NULL,
    "total_rosters" integer,
    "current_week" integer,
    "previous_league_id" "text",
    "draft_id" "text",
    "scoring_settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "roster_positions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "avatar" "text",
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sleeper_created_at" timestamp with time zone,
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."leagues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."managers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sleeper_user_id" "text" NOT NULL,
    "username" "text",
    "display_name" "text" NOT NULL,
    "avatar" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."managers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matchup_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matchup_team_id" "uuid" NOT NULL,
    "sleeper_player_id" "text" NOT NULL,
    "is_starter" boolean DEFAULT false NOT NULL,
    "points" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nfl_team_at_week" "text"
);


ALTER TABLE "public"."matchup_players" OWNER TO "postgres";


COMMENT ON COLUMN "public"."matchup_players"."nfl_team_at_week" IS 'NFL team captured when the weekly Sleeper matchup was synchronized. Historical snapshots are never overwritten.';



CREATE TABLE IF NOT EXISTS "public"."player_weekly_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "season_year" integer NOT NULL,
    "week" integer NOT NULL,
    "sleeper_player_id" "text" NOT NULL,
    "player_name" "text" NOT NULL,
    "position" "text" NOT NULL,
    "nfl_team" "text",
    "points" numeric DEFAULT 0 NOT NULL,
    "raw_stats" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "player_weekly_scores_week_check" CHECK ((("week" >= 1) AND ("week" <= 18)))
);


ALTER TABLE "public"."player_weekly_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "sleeper_player_id" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "full_name" "text",
    "position" "text",
    "fantasy_positions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "nfl_team" "text",
    "active" boolean,
    "status" "text",
    "injury_status" "text",
    "age" integer,
    "years_experience" integer,
    "jersey_number" integer,
    "depth_chart_position" "text",
    "depth_chart_order" integer,
    "search_rank" integer,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."power_rankings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_year" integer NOT NULL,
    "week" integer NOT NULL,
    "title" "text" DEFAULT 'Power Rankings'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "entries" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "power_rankings_entries_check" CHECK (("jsonb_typeof"("entries") = 'array'::"text")),
    CONSTRAINT "power_rankings_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready'::"text"]))),
    CONSTRAINT "power_rankings_week_check" CHECK ((("week" >= 0) AND ("week" <= 18)))
);


ALTER TABLE "public"."power_rankings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_gazette_articles" WITH ("security_invoker"='true') AS
 SELECT "id",
    "slug",
    "category",
    "headline",
    "summary",
    "author_name",
    "published_at",
    "image_url",
    "image_alt",
    "body",
    "is_featured",
    "homepage_order",
    "created_at",
    "updated_at",
        CASE
            WHEN (("status" = 'scheduled'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())) THEN 'published'::"text"
            ELSE "status"
        END AS "effective_status",
        CASE
            WHEN (("status" = 'scheduled'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())) THEN true
            ELSE false
        END AS "published_from_schedule"
   FROM "public"."gazette_articles"
  WHERE ((("status" = 'published'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())) OR (("status" = 'scheduled'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())));


ALTER VIEW "public"."public_gazette_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reader_profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "digest_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_profiles_display_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "display_name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "display_name")) <= 40)))
);


ALTER TABLE "public"."reader_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_reader_profiles" AS
 SELECT "user_id",
    "display_name"
   FROM "public"."reader_profiles";


ALTER VIEW "public"."public_reader_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publication_contributors" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "role" "text" DEFAULT 'commissioner'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "publication_contributors_role_check" CHECK (("role" = ANY (ARRAY['commissioner'::"text", 'op_ed'::"text"])))
);


ALTER TABLE "public"."publication_contributors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reader_poll_windows" (
    "season_year" integer NOT NULL,
    "week" integer NOT NULL,
    "is_open" boolean DEFAULT true NOT NULL,
    "closes_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_poll_windows_week_check" CHECK ((("week" >= 1) AND ("week" <= 18)))
);


ALTER TABLE "public"."reader_poll_windows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reader_power_ballots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "season_year" integer NOT NULL,
    "week" integer NOT NULL,
    "rankings" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_power_ballots_rankings_check" CHECK ((("jsonb_typeof"("rankings") = 'array'::"text") AND ("jsonb_array_length"("rankings") >= 2) AND ("jsonb_array_length"("rankings") <= 20))),
    CONSTRAINT "reader_power_ballots_week_check" CHECK ((("week" >= 1) AND ("week" <= 18)))
);


ALTER TABLE "public"."reader_power_ballots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roster_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fantasy_team_id" "uuid" NOT NULL,
    "sleeper_player_id" "text" NOT NULL,
    "is_starter" boolean DEFAULT false NOT NULL,
    "is_reserve" boolean DEFAULT false NOT NULL,
    "is_taxi" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roster_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roster_snapshot_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "roster_snapshot_id" "uuid" NOT NULL,
    "sleeper_player_id" "text" NOT NULL,
    "is_starter" boolean DEFAULT false NOT NULL,
    "is_reserve" boolean DEFAULT false NOT NULL,
    "is_taxi" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roster_snapshot_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roster_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fantasy_team_id" "uuid" NOT NULL,
    "week" integer NOT NULL,
    "wins" integer DEFAULT 0 NOT NULL,
    "losses" integer DEFAULT 0 NOT NULL,
    "ties" integer DEFAULT 0 NOT NULL,
    "points_for" numeric(8,2),
    "points_against" numeric(8,2),
    "waiver_position" integer,
    "waiver_budget_used" integer,
    "settings" "jsonb",
    "metadata" "jsonb",
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "season_id" "uuid" NOT NULL
);


ALTER TABLE "public"."roster_snapshots" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."season_standings" AS
 WITH "team_game_results" AS (
         SELECT "m"."id" AS "matchup_id",
            "m"."season_id",
            "m"."week",
            "mt"."fantasy_team_id",
            "mt"."points" AS "points_for",
            COALESCE("sum"("opponent"."points"), (0)::numeric) AS "points_against"
           FROM (("public"."matchups" "m"
             JOIN "public"."matchup_teams" "mt" ON (("mt"."matchup_id" = "m"."id")))
             LEFT JOIN "public"."matchup_teams" "opponent" ON ((("opponent"."matchup_id" = "m"."id") AND ("opponent"."id" <> "mt"."id"))))
          WHERE ("m"."status" = 'complete'::"text")
          GROUP BY "m"."id", "m"."season_id", "m"."week", "mt"."id", "mt"."fantasy_team_id", "mt"."points"
        ), "team_totals" AS (
         SELECT "ft"."id" AS "fantasy_team_id",
            "ft"."season_id",
            "s"."league_id",
            "s"."year" AS "season_year",
            "s"."sleeper_league_id",
            "ft"."sleeper_roster_id",
            "ft"."team_name",
            "count"("tgr"."matchup_id") AS "games_played",
            "count"("tgr"."matchup_id") FILTER (WHERE ("tgr"."points_for" > "tgr"."points_against")) AS "wins",
            "count"("tgr"."matchup_id") FILTER (WHERE ("tgr"."points_for" < "tgr"."points_against")) AS "losses",
            "count"("tgr"."matchup_id") FILTER (WHERE ("tgr"."points_for" = "tgr"."points_against")) AS "ties",
            COALESCE("sum"("tgr"."points_for"), (0)::numeric) AS "points_for",
            COALESCE("sum"("tgr"."points_against"), (0)::numeric) AS "points_against",
            COALESCE("avg"("tgr"."points_for"), (0)::numeric) AS "average_points",
            "max"("tgr"."points_for") AS "highest_score",
            "min"("tgr"."points_for") AS "lowest_score"
           FROM (("public"."fantasy_teams" "ft"
             JOIN "public"."seasons" "s" ON (("s"."id" = "ft"."season_id")))
             LEFT JOIN "team_game_results" "tgr" ON ((("tgr"."fantasy_team_id" = "ft"."id") AND ("tgr"."season_id" = "ft"."season_id"))))
          GROUP BY "ft"."id", "ft"."season_id", "s"."league_id", "s"."year", "s"."sleeper_league_id", "ft"."sleeper_roster_id", "ft"."team_name"
        ), "standings_calculated" AS (
         SELECT "team_totals"."fantasy_team_id",
            "team_totals"."season_id",
            "team_totals"."league_id",
            "team_totals"."season_year",
            "team_totals"."sleeper_league_id",
            "team_totals"."sleeper_roster_id",
            "team_totals"."team_name",
            "team_totals"."games_played",
            "team_totals"."wins",
            "team_totals"."losses",
            "team_totals"."ties",
            "team_totals"."points_for",
            "team_totals"."points_against",
            "team_totals"."average_points",
            "team_totals"."highest_score",
            "team_totals"."lowest_score",
                CASE
                    WHEN ("team_totals"."games_played" = 0) THEN (0)::numeric
                    ELSE ((("team_totals"."wins")::numeric + (("team_totals"."ties")::numeric * 0.5)) / ("team_totals"."games_played")::numeric)
                END AS "winning_percentage",
            ("team_totals"."points_for" - "team_totals"."points_against") AS "point_differential"
           FROM "team_totals"
        )
 SELECT "fantasy_team_id",
    "season_id",
    "league_id",
    "season_year",
    "sleeper_league_id",
    "sleeper_roster_id",
    "team_name",
    "games_played",
    "wins",
    "losses",
    "ties",
    "round"("winning_percentage", 3) AS "winning_percentage",
    "round"("points_for", 2) AS "points_for",
    "round"("points_against", 2) AS "points_against",
    "round"("point_differential", 2) AS "point_differential",
    "round"("average_points", 2) AS "average_points",
    "round"("highest_score", 2) AS "highest_score",
    "round"("lowest_score", 2) AS "lowest_score",
    "dense_rank"() OVER (PARTITION BY "season_id" ORDER BY "standings_calculated"."winning_percentage" DESC, "standings_calculated"."points_for" DESC, "standings_calculated"."point_differential" DESC) AS "standings_rank"
   FROM "standings_calculated";


ALTER VIEW "public"."season_standings" OWNER TO "postgres";


COMMENT ON VIEW "public"."season_standings" IS 'Season-level fantasy standings calculated from completed matchups.';



CREATE TABLE IF NOT EXISTS "public"."sync_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_type" "text" NOT NULL,
    "sleeper_league_id" "text",
    "status" "text" NOT NULL,
    "records_processed" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "sync_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sync_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "provider_asset_key" "text" NOT NULL,
    "asset_type" "text" NOT NULL,
    "movement_type" "text" NOT NULL,
    "from_fantasy_team_id" "uuid",
    "to_fantasy_team_id" "uuid",
    "from_provider_roster_id" integer,
    "to_provider_roster_id" integer,
    "player_provider_id" "text",
    "player_name" "text",
    "position" "text",
    "pro_team" "text",
    "draft_season" integer,
    "draft_round" integer,
    "original_provider_roster_id" integer,
    "amount" numeric,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transaction_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "fantasy_team_id" "uuid",
    "provider_roster_id" integer NOT NULL,
    "consented" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transaction_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_digest_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_year" integer,
    "week" integer,
    "subject" "text" NOT NULL,
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "delivered_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "weekly_digest_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."weekly_digest_runs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."weekly_standings" WITH ("security_invoker"='true') AS
 WITH "cumulative_results" AS (
         SELECT "twr"."season_id",
            "twr"."league_id",
            "twr"."season_year",
            "twr"."sleeper_league_id",
            "twr"."week",
            "twr"."fantasy_team_id",
            "twr"."sleeper_roster_id",
            "twr"."team_name",
            "count"(*) OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "games_played",
            "sum"("twr"."win") OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "wins",
            "sum"("twr"."loss") OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "losses",
            "sum"("twr"."tie") OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "ties",
            "sum"("twr"."points_for") OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "points_for",
            "sum"("twr"."points_against") OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "points_against",
            "avg"("twr"."points_for") OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "average_points",
            "max"("twr"."points_for") OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "highest_score",
            "min"("twr"."points_for") OVER (PARTITION BY "twr"."season_id", "twr"."fantasy_team_id" ORDER BY "twr"."week" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "lowest_score"
           FROM "public"."team_weekly_results" "twr"
        ), "calculated" AS (
         SELECT "cumulative_results"."season_id",
            "cumulative_results"."league_id",
            "cumulative_results"."season_year",
            "cumulative_results"."sleeper_league_id",
            "cumulative_results"."week",
            "cumulative_results"."fantasy_team_id",
            "cumulative_results"."sleeper_roster_id",
            "cumulative_results"."team_name",
            "cumulative_results"."games_played",
            "cumulative_results"."wins",
            "cumulative_results"."losses",
            "cumulative_results"."ties",
            "cumulative_results"."points_for",
            "cumulative_results"."points_against",
            "cumulative_results"."average_points",
            "cumulative_results"."highest_score",
            "cumulative_results"."lowest_score",
            ("cumulative_results"."points_for" - "cumulative_results"."points_against") AS "point_differential",
                CASE
                    WHEN ("cumulative_results"."games_played" = 0) THEN (0)::numeric
                    ELSE ((("cumulative_results"."wins")::numeric + (("cumulative_results"."ties")::numeric * 0.5)) / ("cumulative_results"."games_played")::numeric)
                END AS "winning_percentage"
           FROM "cumulative_results"
        )
 SELECT "row_number"() OVER (PARTITION BY "season_id", "week" ORDER BY "calculated"."winning_percentage" DESC, "calculated"."points_for" DESC, "calculated"."point_differential" DESC, "sleeper_roster_id") AS "standings_rank",
    "season_id",
    "league_id",
    "season_year",
    "sleeper_league_id",
    "week",
    "fantasy_team_id",
    "sleeper_roster_id",
    "team_name",
    "games_played",
    "wins",
    "losses",
    "ties",
    "round"("winning_percentage", 3) AS "winning_percentage",
    "round"("points_for", 2) AS "points_for",
    "round"("points_against", 2) AS "points_against",
    "round"("point_differential", 2) AS "point_differential",
    "round"("average_points", 2) AS "average_points",
    "round"("highest_score", 2) AS "highest_score",
    "round"("lowest_score", 2) AS "lowest_score"
   FROM "calculated";


ALTER VIEW "public"."weekly_standings" OWNER TO "postgres";


COMMENT ON VIEW "public"."weekly_standings" IS 'Cumulative fantasy standings after each completed week of a season.';



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_draft_id_pick_number_key" UNIQUE ("draft_id", "pick_number");



ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_draft_id_provider_pick_id_key" UNIQUE ("draft_id", "provider_pick_id");



ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_provider_provider_draft_id_key" UNIQUE ("provider", "provider_draft_id");



ALTER TABLE ONLY "public"."editorial_notifications"
    ADD CONSTRAINT "editorial_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."editorial_review_events"
    ADD CONSTRAINT "editorial_review_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fantasy_teams"
    ADD CONSTRAINT "fantasy_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fantasy_teams"
    ADD CONSTRAINT "fantasy_teams_season_roster_key" UNIQUE ("season_id", "sleeper_roster_id");



ALTER TABLE ONLY "public"."gazette_articles"
    ADD CONSTRAINT "gazette_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gazette_articles"
    ADD CONSTRAINT "gazette_articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."league_members"
    ADD CONSTRAINT "league_members_league_id_manager_id_key" UNIQUE ("league_id", "manager_id");



ALTER TABLE ONLY "public"."league_members"
    ADD CONSTRAINT "league_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_transactions"
    ADD CONSTRAINT "league_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_transactions"
    ADD CONSTRAINT "league_transactions_provider_provider_transaction_id_key" UNIQUE ("provider", "provider_transaction_id");



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_sleeper_league_id_key" UNIQUE ("sleeper_league_id");



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_sleeper_user_id_key" UNIQUE ("sleeper_user_id");



ALTER TABLE ONLY "public"."matchup_players"
    ADD CONSTRAINT "matchup_players_matchup_team_id_sleeper_player_id_key" UNIQUE ("matchup_team_id", "sleeper_player_id");



ALTER TABLE ONLY "public"."matchup_players"
    ADD CONSTRAINT "matchup_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matchup_teams"
    ADD CONSTRAINT "matchup_teams_matchup_id_fantasy_team_id_key" UNIQUE ("matchup_id", "fantasy_team_id");



ALTER TABLE ONLY "public"."matchup_teams"
    ADD CONSTRAINT "matchup_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matchups"
    ADD CONSTRAINT "matchups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matchups"
    ADD CONSTRAINT "matchups_season_week_sleeper_matchup_key" UNIQUE ("season_id", "week", "sleeper_matchup_id");



ALTER TABLE ONLY "public"."player_weekly_scores"
    ADD CONSTRAINT "player_weekly_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_weekly_scores"
    ADD CONSTRAINT "player_weekly_scores_season_id_week_sleeper_player_id_key" UNIQUE ("season_id", "week", "sleeper_player_id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("sleeper_player_id");



ALTER TABLE ONLY "public"."power_rankings"
    ADD CONSTRAINT "power_rankings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."power_rankings"
    ADD CONSTRAINT "power_rankings_season_year_week_key" UNIQUE ("season_year", "week");



ALTER TABLE ONLY "public"."publication_contributors"
    ADD CONSTRAINT "publication_contributors_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."reader_poll_windows"
    ADD CONSTRAINT "reader_poll_windows_pkey" PRIMARY KEY ("season_year", "week");



ALTER TABLE ONLY "public"."reader_power_ballots"
    ADD CONSTRAINT "reader_power_ballots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reader_power_ballots"
    ADD CONSTRAINT "reader_power_ballots_user_id_season_year_week_key" UNIQUE ("user_id", "season_year", "week");



ALTER TABLE ONLY "public"."reader_profiles"
    ADD CONSTRAINT "reader_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."roster_players"
    ADD CONSTRAINT "roster_players_fantasy_team_id_sleeper_player_id_key" UNIQUE ("fantasy_team_id", "sleeper_player_id");



ALTER TABLE ONLY "public"."roster_players"
    ADD CONSTRAINT "roster_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roster_snapshot_players"
    ADD CONSTRAINT "roster_snapshot_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roster_snapshot_players"
    ADD CONSTRAINT "roster_snapshot_players_roster_snapshot_id_sleeper_player_i_key" UNIQUE ("roster_snapshot_id", "sleeper_player_id");



ALTER TABLE ONLY "public"."roster_snapshots"
    ADD CONSTRAINT "roster_snapshots_fantasy_team_id_week_key" UNIQUE ("fantasy_team_id", "week");



ALTER TABLE ONLY "public"."roster_snapshots"
    ADD CONSTRAINT "roster_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_league_id_year_key" UNIQUE ("league_id", "year");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_sleeper_league_id_key" UNIQUE ("sleeper_league_id");



ALTER TABLE ONLY "public"."sync_runs"
    ADD CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_assets"
    ADD CONSTRAINT "transaction_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_assets"
    ADD CONSTRAINT "transaction_assets_transaction_id_provider_asset_key_key" UNIQUE ("transaction_id", "provider_asset_key");



ALTER TABLE ONLY "public"."transaction_participants"
    ADD CONSTRAINT "transaction_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_participants"
    ADD CONSTRAINT "transaction_participants_transaction_id_provider_roster_id_key" UNIQUE ("transaction_id", "provider_roster_id");



ALTER TABLE ONLY "public"."weekly_digest_runs"
    ADD CONSTRAINT "weekly_digest_runs_pkey" PRIMARY KEY ("id");



CREATE INDEX "draft_picks_draft_order_idx" ON "public"."draft_picks" USING "btree" ("draft_id", "pick_number");



CREATE INDEX "draft_picks_fantasy_team_idx" ON "public"."draft_picks" USING "btree" ("fantasy_team_id");



CREATE INDEX "drafts_season_year_idx" ON "public"."drafts" USING "btree" ("season_year" DESC);



CREATE INDEX "editorial_notifications_recipient_created_idx" ON "public"."editorial_notifications" USING "btree" ("recipient_user_id", "created_at" DESC);



CREATE INDEX "editorial_review_events_article_created_idx" ON "public"."editorial_review_events" USING "btree" ("article_id", "created_at" DESC);



CREATE INDEX "fantasy_teams_league_id_idx" ON "public"."fantasy_teams" USING "btree" ("league_id");



CREATE INDEX "fantasy_teams_manager_id_idx" ON "public"."fantasy_teams" USING "btree" ("manager_id");



CREATE INDEX "fantasy_teams_season_idx" ON "public"."fantasy_teams" USING "btree" ("season_id");



CREATE INDEX "gazette_articles_homepage_idx" ON "public"."gazette_articles" USING "btree" ("is_featured", "homepage_order");



CREATE INDEX "gazette_articles_status_idx" ON "public"."gazette_articles" USING "btree" ("status");



CREATE INDEX "gazette_articles_status_published_at_idx" ON "public"."gazette_articles" USING "btree" ("status", "published_at" DESC);



CREATE INDEX "gazette_articles_status_published_idx" ON "public"."gazette_articles" USING "btree" ("status", "published_at" DESC);


CREATE INDEX "gazette_comments_article_created_idx" ON "public"."gazette_comments" USING "btree" ("article_id", "created_at");



CREATE INDEX "league_transactions_season_week_idx" ON "public"."league_transactions" USING "btree" ("season_year" DESC, "week" DESC, "occurred_at" DESC);



CREATE INDEX "league_transactions_type_idx" ON "public"."league_transactions" USING "btree" ("transaction_type", "status");



CREATE INDEX "matchup_players_matchup_team_idx" ON "public"."matchup_players" USING "btree" ("matchup_team_id");



CREATE INDEX "matchup_players_sleeper_player_idx" ON "public"."matchup_players" USING "btree" ("sleeper_player_id");



CREATE INDEX "matchup_teams_fantasy_team_idx" ON "public"."matchup_teams" USING "btree" ("fantasy_team_id");



CREATE INDEX "matchup_teams_matchup_idx" ON "public"."matchup_teams" USING "btree" ("matchup_id");



CREATE INDEX "matchups_league_week_idx" ON "public"."matchups" USING "btree" ("league_id", "week");



CREATE INDEX "matchups_season_week_idx" ON "public"."matchups" USING "btree" ("season_id", "week");



CREATE INDEX "player_weekly_scores_position_points_idx" ON "public"."player_weekly_scores" USING "btree" ("season_year", "position", "points" DESC);



CREATE INDEX "player_weekly_scores_season_week_idx" ON "public"."player_weekly_scores" USING "btree" ("season_year", "week");



CREATE INDEX "players_nfl_team_idx" ON "public"."players" USING "btree" ("nfl_team");



CREATE INDEX "players_position_idx" ON "public"."players" USING "btree" ("position");



CREATE INDEX "reader_power_ballots_edition_idx" ON "public"."reader_power_ballots" USING "btree" ("season_year" DESC, "week" DESC);



CREATE INDEX "roster_players_player_id_idx" ON "public"."roster_players" USING "btree" ("sleeper_player_id");



CREATE INDEX "roster_players_team_id_idx" ON "public"."roster_players" USING "btree" ("fantasy_team_id");



CREATE INDEX "roster_snapshots_season_week_idx" ON "public"."roster_snapshots" USING "btree" ("season_id", "week");



CREATE INDEX "seasons_league_idx" ON "public"."seasons" USING "btree" ("league_id");



CREATE INDEX "seasons_status_idx" ON "public"."seasons" USING "btree" ("status");



CREATE INDEX "seasons_year_idx" ON "public"."seasons" USING "btree" ("year");



CREATE INDEX "transaction_assets_from_team_idx" ON "public"."transaction_assets" USING "btree" ("from_fantasy_team_id");



CREATE INDEX "transaction_assets_to_team_idx" ON "public"."transaction_assets" USING "btree" ("to_fantasy_team_id");



CREATE INDEX "transaction_assets_transaction_idx" ON "public"."transaction_assets" USING "btree" ("transaction_id");



CREATE INDEX "transaction_participants_team_idx" ON "public"."transaction_participants" USING "btree" ("fantasy_team_id");



CREATE OR REPLACE TRIGGER "create_editorial_status_notifications" AFTER INSERT OR UPDATE OF "status" ON "public"."gazette_articles" FOR EACH ROW EXECUTE FUNCTION "public"."create_editorial_status_notifications"();



CREATE OR REPLACE TRIGGER "power_rankings_updated_at" BEFORE UPDATE ON "public"."power_rankings" FOR EACH ROW EXECUTE FUNCTION "public"."set_power_rankings_updated_at"();



CREATE OR REPLACE TRIGGER "preserve_matchup_player_nfl_team_snapshot" BEFORE UPDATE ON "public"."matchup_players" FOR EACH ROW EXECUTE FUNCTION "public"."preserve_matchup_player_nfl_team_snapshot"();



CREATE OR REPLACE TRIGGER "reader_power_ballots_updated_at" BEFORE UPDATE ON "public"."reader_power_ballots" FOR EACH ROW EXECUTE FUNCTION "public"."set_reader_updated_at"();



CREATE OR REPLACE TRIGGER "reader_profiles_updated_at" BEFORE UPDATE ON "public"."reader_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_reader_updated_at"();



CREATE OR REPLACE TRIGGER "resolve_editorial_review_notifications" AFTER UPDATE OF "status" ON "public"."gazette_articles" FOR EACH ROW EXECUTE FUNCTION "public"."resolve_editorial_review_notifications"();



CREATE OR REPLACE TRIGGER "set_gazette_articles_updated_at" BEFORE UPDATE ON "public"."gazette_articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


CREATE OR REPLACE TRIGGER "gazette_comments_updated_at" BEFORE UPDATE ON "public"."gazette_comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "validate_reader_ballot_before_write" BEFORE INSERT OR UPDATE ON "public"."reader_power_ballots" FOR EACH ROW EXECUTE FUNCTION "public"."validate_reader_ballot"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_fantasy_team_id_fkey" FOREIGN KEY ("fantasy_team_id") REFERENCES "public"."fantasy_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."editorial_notifications"
    ADD CONSTRAINT "editorial_notifications_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."gazette_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."editorial_notifications"
    ADD CONSTRAINT "editorial_notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."editorial_review_events"
    ADD CONSTRAINT "editorial_review_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."editorial_review_events"
    ADD CONSTRAINT "editorial_review_events_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."gazette_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fantasy_teams"
    ADD CONSTRAINT "fantasy_teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fantasy_teams"
    ADD CONSTRAINT "fantasy_teams_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fantasy_teams"
    ADD CONSTRAINT "fantasy_teams_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gazette_articles"
    ADD CONSTRAINT "gazette_articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."gazette_comments"
    ADD CONSTRAINT "gazette_comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."gazette_articles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."gazette_comments"
    ADD CONSTRAINT "gazette_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_members"
    ADD CONSTRAINT "league_members_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_members"
    ADD CONSTRAINT "league_members_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_transactions"
    ADD CONSTRAINT "league_transactions_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."league_transactions"
    ADD CONSTRAINT "league_transactions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matchup_players"
    ADD CONSTRAINT "matchup_players_matchup_team_id_fkey" FOREIGN KEY ("matchup_team_id") REFERENCES "public"."matchup_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matchup_players"
    ADD CONSTRAINT "matchup_players_sleeper_player_id_fkey" FOREIGN KEY ("sleeper_player_id") REFERENCES "public"."players"("sleeper_player_id");



ALTER TABLE ONLY "public"."matchup_teams"
    ADD CONSTRAINT "matchup_teams_fantasy_team_id_fkey" FOREIGN KEY ("fantasy_team_id") REFERENCES "public"."fantasy_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matchup_teams"
    ADD CONSTRAINT "matchup_teams_matchup_id_fkey" FOREIGN KEY ("matchup_id") REFERENCES "public"."matchups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matchups"
    ADD CONSTRAINT "matchups_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matchups"
    ADD CONSTRAINT "matchups_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_weekly_scores"
    ADD CONSTRAINT "player_weekly_scores_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."power_rankings"
    ADD CONSTRAINT "power_rankings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publication_contributors"
    ADD CONSTRAINT "publication_contributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_power_ballots"
    ADD CONSTRAINT "reader_power_ballots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_profiles"
    ADD CONSTRAINT "reader_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roster_players"
    ADD CONSTRAINT "roster_players_fantasy_team_id_fkey" FOREIGN KEY ("fantasy_team_id") REFERENCES "public"."fantasy_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roster_players"
    ADD CONSTRAINT "roster_players_sleeper_player_id_fkey" FOREIGN KEY ("sleeper_player_id") REFERENCES "public"."players"("sleeper_player_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roster_snapshot_players"
    ADD CONSTRAINT "roster_snapshot_players_roster_snapshot_id_fkey" FOREIGN KEY ("roster_snapshot_id") REFERENCES "public"."roster_snapshots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roster_snapshot_players"
    ADD CONSTRAINT "roster_snapshot_players_sleeper_player_id_fkey" FOREIGN KEY ("sleeper_player_id") REFERENCES "public"."players"("sleeper_player_id");



ALTER TABLE ONLY "public"."roster_snapshots"
    ADD CONSTRAINT "roster_snapshots_fantasy_team_id_fkey" FOREIGN KEY ("fantasy_team_id") REFERENCES "public"."fantasy_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roster_snapshots"
    ADD CONSTRAINT "roster_snapshots_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_assets"
    ADD CONSTRAINT "transaction_assets_from_fantasy_team_id_fkey" FOREIGN KEY ("from_fantasy_team_id") REFERENCES "public"."fantasy_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_assets"
    ADD CONSTRAINT "transaction_assets_to_fantasy_team_id_fkey" FOREIGN KEY ("to_fantasy_team_id") REFERENCES "public"."fantasy_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_assets"
    ADD CONSTRAINT "transaction_assets_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."league_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_participants"
    ADD CONSTRAINT "transaction_participants_fantasy_team_id_fkey" FOREIGN KEY ("fantasy_team_id") REFERENCES "public"."fantasy_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_participants"
    ADD CONSTRAINT "transaction_participants_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."league_transactions"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create Gazette articles" ON "public"."gazette_articles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_gazette_admin"());



CREATE POLICY "Admins can delete Gazette articles" ON "public"."gazette_articles" FOR DELETE TO "authenticated" USING ("public"."is_gazette_admin"());



CREATE POLICY "Admins can inspect digest runs" ON "public"."weekly_digest_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage contributor profiles" ON "public"."publication_contributors" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage player weekly scores" ON "public"."player_weekly_scores" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage poll windows" ON "public"."reader_poll_windows" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage power rankings" ON "public"."power_rankings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can read all Gazette articles" ON "public"."gazette_articles" FOR SELECT TO "authenticated" USING ("public"."is_gazette_admin"());



CREATE POLICY "Admins can read their own admin record" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Admins can update Gazette articles" ON "public"."gazette_articles" FOR UPDATE TO "authenticated" USING ("public"."is_gazette_admin"()) WITH CHECK ("public"."is_gazette_admin"());



CREATE POLICY "Admins can view reader profiles" ON "public"."reader_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Contributors can create Op-Ed drafts" ON "public"."gazette_articles" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("category" = 'Op-Ed'::"text") AND ("status" = ANY (ARRAY['draft'::"text", 'ready_for_review'::"text"])) AND ("is_featured" = false) AND ("homepage_order" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."publication_contributors"
  WHERE (("publication_contributors"."user_id" = "auth"."uid"()) AND ("publication_contributors"."role" = 'op_ed'::"text"))))));



CREATE POLICY "Contributors can delete their own Op-Ed drafts" ON "public"."gazette_articles" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("category" = 'Op-Ed'::"text") AND ("status" = ANY (ARRAY['draft'::"text", 'ready_for_review'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."publication_contributors"
  WHERE (("publication_contributors"."user_id" = "auth"."uid"()) AND ("publication_contributors"."role" = 'op_ed'::"text"))))));



CREATE POLICY "Contributors can read their own Op-Ed stories" ON "public"."gazette_articles" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("category" = 'Op-Ed'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."publication_contributors"
  WHERE (("publication_contributors"."user_id" = "auth"."uid"()) AND ("publication_contributors"."role" = 'op_ed'::"text"))))));



CREATE POLICY "Contributors can read their own profile" ON "public"."publication_contributors" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Contributors can update their own Op-Ed drafts" ON "public"."gazette_articles" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("category" = 'Op-Ed'::"text") AND ("status" = ANY (ARRAY['draft'::"text", 'ready_for_review'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."publication_contributors"
  WHERE (("publication_contributors"."user_id" = "auth"."uid"()) AND ("publication_contributors"."role" = 'op_ed'::"text")))))) WITH CHECK ((("created_by" = "auth"."uid"()) AND ("category" = 'Op-Ed'::"text") AND ("status" = ANY (ARRAY['draft'::"text", 'ready_for_review'::"text"])) AND ("is_featured" = false) AND ("homepage_order" IS NULL)));



CREATE POLICY "Editorial participants can view review history" ON "public"."editorial_review_events" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM ("public"."gazette_articles"
     JOIN "public"."publication_contributors" ON (("publication_contributors"."user_id" = "auth"."uid"())))
  WHERE (("gazette_articles"."id" = "editorial_review_events"."article_id") AND ("gazette_articles"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Player weekly scores are public" ON "public"."player_weekly_scores" FOR SELECT USING (true);



CREATE POLICY "Poll windows are publicly visible" ON "public"."reader_poll_windows" FOR SELECT USING (true);



CREATE POLICY "Public can read draft picks" ON "public"."draft_picks" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read drafts" ON "public"."drafts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read fantasy teams" ON "public"."fantasy_teams" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read league transactions" ON "public"."league_transactions" FOR SELECT TO "authenticated", "anon" USING (("status" = 'complete'::"text"));



CREATE POLICY "Public can read leagues" ON "public"."leagues" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read matchup teams" ON "public"."matchup_teams" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read matchups" ON "public"."matchups" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read players" ON "public"."players" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read ready power rankings" ON "public"."power_rankings" FOR SELECT TO "authenticated", "anon" USING (("status" = 'ready'::"text"));



CREATE POLICY "Public can read roster players" ON "public"."roster_players" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read seasons" ON "public"."seasons" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read transaction assets" ON "public"."transaction_assets" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."league_transactions"
  WHERE (("league_transactions"."id" = "transaction_assets"."transaction_id") AND ("league_transactions"."status" = 'complete'::"text")))));



CREATE POLICY "Public can read transaction participants" ON "public"."transaction_participants" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."league_transactions"
  WHERE (("league_transactions"."id" = "transaction_participants"."transaction_id") AND ("league_transactions"."status" = 'complete'::"text")))));



CREATE POLICY "Published Gazette articles are publicly readable" ON "public"."gazette_articles" FOR SELECT TO "authenticated", "anon" USING (((("status" = 'published'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())) OR (("status" = 'scheduled'::"text") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"()))));



CREATE POLICY "Comments on published Gazette stories are readable" ON "public"."gazette_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."gazette_articles" "article"
  WHERE (("article"."id" = "gazette_comments"."article_id") AND ("article"."status" = ANY (ARRAY['published'::"text", 'scheduled'::"text"])) AND ("article"."published_at" IS NOT NULL) AND ("article"."published_at" <= "now"())))));


CREATE POLICY "Signed-in readers can comment on published Gazette stories" ON "public"."gazette_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."gazette_articles" "article"
  WHERE (("article"."id" = "gazette_comments"."article_id") AND ("article"."status" = ANY (ARRAY['published'::"text", 'scheduled'::"text"])) AND ("article"."published_at" IS NOT NULL) AND ("article"."published_at" <= "now"())))));


CREATE POLICY "Readers can update their own Gazette comments" ON "public"."gazette_comments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


CREATE POLICY "Readers can read closed ballots or their own ballot" ON "public"."reader_power_ballots" FOR SELECT TO "anon", "authenticated" USING (( ("user_id" = "auth"."uid"()) OR (NOT "public"."reader_poll_is_open"("season_year", "week")) OR (EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))));



CREATE POLICY "Readers can update their open ballot" ON "public"."reader_power_ballots" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."reader_poll_is_current_week"("season_year", "week") AND "public"."reader_poll_is_open"("season_year", "week"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."reader_poll_is_current_week"("season_year", "week") AND "public"."reader_poll_is_open"("season_year", "week")));



CREATE POLICY "Readers can update their own profile" ON "public"."reader_profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Readers can view their own profile" ON "public"."reader_profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own editorial notifications" ON "public"."editorial_notifications" FOR SELECT TO "authenticated" USING (("recipient_user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own editorial notifications" ON "public"."editorial_notifications" FOR UPDATE TO "authenticated" USING (("recipient_user_id" = "auth"."uid"())) WITH CHECK (("recipient_user_id" = "auth"."uid"()));



CREATE POLICY "Verified readers can submit their ballot" ON "public"."reader_power_ballots" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."reader_poll_is_current_week"("season_year", "week") AND "public"."reader_poll_is_open"("season_year", "week")));



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."draft_picks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."editorial_review_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fantasy_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gazette_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gazette_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."league_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."league_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leagues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."managers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matchup_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matchup_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matchups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_weekly_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."power_rankings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publication_contributors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reader_poll_windows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reader_power_ballots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reader_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roster_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roster_snapshot_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roster_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_digest_runs" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_add_publication_contributor"("contributor_email" "text", "contributor_display_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_add_publication_contributor"("contributor_email" "text", "contributor_display_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_add_publication_contributor"("contributor_email" "text", "contributor_display_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_add_publication_contributor"("contributor_email" "text", "contributor_display_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_publication_contributors"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_publication_contributors"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_publication_contributors"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_publication_contributors"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_remove_publication_contributor"("contributor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_remove_publication_contributor"("contributor_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_remove_publication_contributor"("contributor_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_remove_publication_contributor"("contributor_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_return_article_for_changes"("target_article_id" "uuid", "review_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_return_article_for_changes"("target_article_id" "uuid", "review_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_return_article_for_changes"("target_article_id" "uuid", "review_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_return_article_for_changes"("target_article_id" "uuid", "review_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_contributor_access"("target_user_id" "uuid", "access_enabled" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_contributor_access"("target_user_id" "uuid", "access_enabled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_contributor_access"("target_user_id" "uuid", "access_enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_contributor_access"("target_user_id" "uuid", "access_enabled" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_site_accounts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_site_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_site_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_site_accounts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_sleeper_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_sleeper_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_sleeper_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_sleeper_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."article_login_identity"("target_article_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."article_login_identity"("target_article_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."article_login_identity"("target_article_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."article_login_identity"("target_article_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_editorial_status_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_editorial_status_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_editorial_status_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_reader_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_reader_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_reader_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_gazette_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_gazette_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_gazette_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preserve_matchup_player_nfl_team_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."preserve_matchup_player_nfl_team_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preserve_matchup_player_nfl_team_snapshot"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_computer_poll_lineups"("target_season_year" integer, "target_through_week" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_computer_poll_lineups"("target_season_year" integer, "target_through_week" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."public_computer_poll_lineups"("target_season_year" integer, "target_through_week" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_computer_poll_lineups"("target_season_year" integer, "target_through_week" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_matchup_lineups"("target_matchup_team_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_matchup_lineups"("target_matchup_team_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."public_matchup_lineups"("target_matchup_team_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_matchup_lineups"("target_matchup_team_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reader_poll_is_open"("target_season" integer, "target_week" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reader_poll_is_open"("target_season" integer, "target_week" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reader_poll_is_open"("target_season" integer, "target_week" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."reader_poll_is_current_week"("target_season" integer, "target_week" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reader_poll_is_current_week"("target_season" integer, "target_week" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reader_poll_is_current_week"("target_season" integer, "target_week" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_editorial_review_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_editorial_review_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_editorial_review_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_power_rankings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_power_rankings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_power_rankings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_reader_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_reader_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_reader_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_reader_ballot"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_reader_ballot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_reader_ballot"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."fantasy_teams" TO "anon";
GRANT ALL ON TABLE "public"."fantasy_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."fantasy_teams" TO "service_role";



GRANT ALL ON TABLE "public"."matchup_teams" TO "anon";
GRANT ALL ON TABLE "public"."matchup_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."matchup_teams" TO "service_role";



GRANT ALL ON TABLE "public"."matchups" TO "anon";
GRANT ALL ON TABLE "public"."matchups" TO "authenticated";
GRANT ALL ON TABLE "public"."matchups" TO "service_role";



GRANT ALL ON TABLE "public"."seasons" TO "anon";
GRANT ALL ON TABLE "public"."seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."seasons" TO "service_role";



GRANT ALL ON TABLE "public"."team_weekly_results" TO "anon";
GRANT ALL ON TABLE "public"."team_weekly_results" TO "authenticated";
GRANT ALL ON TABLE "public"."team_weekly_results" TO "service_role";



GRANT ALL ON TABLE "public"."all_play_standings" TO "anon";
GRANT ALL ON TABLE "public"."all_play_standings" TO "authenticated";
GRANT ALL ON TABLE "public"."all_play_standings" TO "service_role";



GRANT ALL ON TABLE "public"."draft_picks" TO "anon";
GRANT ALL ON TABLE "public"."draft_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."draft_picks" TO "service_role";



GRANT ALL ON TABLE "public"."drafts" TO "anon";
GRANT ALL ON TABLE "public"."drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."drafts" TO "service_role";



GRANT ALL ON TABLE "public"."gazette_articles" TO "anon";
GRANT ALL ON TABLE "public"."gazette_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."gazette_articles" TO "service_role";


GRANT SELECT ON TABLE "public"."gazette_comments" TO "anon";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."gazette_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."gazette_comments" TO "service_role";



GRANT ALL ON TABLE "public"."editorial_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."editorial_articles" TO "service_role";



GRANT ALL ON TABLE "public"."editorial_notifications" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."editorial_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."editorial_notifications" TO "service_role";



GRANT UPDATE("read_at") ON TABLE "public"."editorial_notifications" TO "authenticated";



GRANT ALL ON TABLE "public"."editorial_review_events" TO "anon";
GRANT ALL ON TABLE "public"."editorial_review_events" TO "authenticated";
GRANT ALL ON TABLE "public"."editorial_review_events" TO "service_role";



GRANT ALL ON TABLE "public"."league_members" TO "anon";
GRANT ALL ON TABLE "public"."league_members" TO "authenticated";
GRANT ALL ON TABLE "public"."league_members" TO "service_role";



GRANT ALL ON TABLE "public"."league_transactions" TO "anon";
GRANT ALL ON TABLE "public"."league_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."league_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."leagues" TO "anon";
GRANT ALL ON TABLE "public"."leagues" TO "authenticated";
GRANT ALL ON TABLE "public"."leagues" TO "service_role";



GRANT ALL ON TABLE "public"."managers" TO "anon";
GRANT ALL ON TABLE "public"."managers" TO "authenticated";
GRANT ALL ON TABLE "public"."managers" TO "service_role";



GRANT ALL ON TABLE "public"."matchup_players" TO "anon";
GRANT ALL ON TABLE "public"."matchup_players" TO "authenticated";
GRANT ALL ON TABLE "public"."matchup_players" TO "service_role";



GRANT ALL ON TABLE "public"."player_weekly_scores" TO "anon";
GRANT ALL ON TABLE "public"."player_weekly_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."player_weekly_scores" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."power_rankings" TO "anon";
GRANT ALL ON TABLE "public"."power_rankings" TO "authenticated";
GRANT ALL ON TABLE "public"."power_rankings" TO "service_role";



GRANT ALL ON TABLE "public"."public_gazette_articles" TO "anon";
GRANT ALL ON TABLE "public"."public_gazette_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."public_gazette_articles" TO "service_role";



GRANT ALL ON TABLE "public"."reader_profiles" TO "anon";
GRANT ALL ON TABLE "public"."reader_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."reader_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."public_reader_profiles" TO "anon";
GRANT ALL ON TABLE "public"."public_reader_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."public_reader_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."publication_contributors" TO "anon";
GRANT ALL ON TABLE "public"."publication_contributors" TO "authenticated";
GRANT ALL ON TABLE "public"."publication_contributors" TO "service_role";



GRANT ALL ON TABLE "public"."reader_poll_windows" TO "anon";
GRANT ALL ON TABLE "public"."reader_poll_windows" TO "authenticated";
GRANT ALL ON TABLE "public"."reader_poll_windows" TO "service_role";



GRANT ALL ON TABLE "public"."reader_power_ballots" TO "anon";
GRANT ALL ON TABLE "public"."reader_power_ballots" TO "authenticated";
GRANT ALL ON TABLE "public"."reader_power_ballots" TO "service_role";



GRANT ALL ON TABLE "public"."roster_players" TO "anon";
GRANT ALL ON TABLE "public"."roster_players" TO "authenticated";
GRANT ALL ON TABLE "public"."roster_players" TO "service_role";



GRANT ALL ON TABLE "public"."roster_snapshot_players" TO "anon";
GRANT ALL ON TABLE "public"."roster_snapshot_players" TO "authenticated";
GRANT ALL ON TABLE "public"."roster_snapshot_players" TO "service_role";



GRANT ALL ON TABLE "public"."roster_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."roster_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."roster_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."season_standings" TO "anon";
GRANT ALL ON TABLE "public"."season_standings" TO "authenticated";
GRANT ALL ON TABLE "public"."season_standings" TO "service_role";



GRANT ALL ON TABLE "public"."sync_runs" TO "anon";
GRANT ALL ON TABLE "public"."sync_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_runs" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_assets" TO "anon";
GRANT ALL ON TABLE "public"."transaction_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_assets" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_participants" TO "anon";
GRANT ALL ON TABLE "public"."transaction_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_participants" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_digest_runs" TO "anon";
GRANT ALL ON TABLE "public"."weekly_digest_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_digest_runs" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_standings" TO "anon";
GRANT ALL ON TABLE "public"."weekly_standings" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_standings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
