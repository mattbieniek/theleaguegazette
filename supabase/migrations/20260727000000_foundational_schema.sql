--
-- PostgreSQL database dump
--

-- Reconstructed from the verified production schema on 2026-08-09.
-- This migration is intentionally safe against accidental production execution:
-- production already has the foundational schema and must mark this version as
-- applied only through an explicitly reviewed migration-history repair.
do $$
begin
  if to_regclass('public.leagues') is not null then
    raise exception 'Foundational schema already exists. Do not apply this baseline; review and mark its migration version as applied instead.';
  end if;
end;
$$;


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE OR REPLACE FUNCTION public.is_gazette_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

GRANT ALL ON FUNCTION public.is_gazette_admin() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.set_updated_at() TO anon, authenticated, service_role;

-- Preserve the privilege defaults observed in the original hosted foundation so
-- objects created by the subsequent historical migrations replay identically.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    user_id uuid NOT NULL,
    display_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fantasy_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id uuid NOT NULL,
    manager_id uuid,
    sleeper_roster_id integer NOT NULL,
    team_name text,
    avatar text,
    wins integer DEFAULT 0 NOT NULL,
    losses integer DEFAULT 0 NOT NULL,
    ties integer DEFAULT 0 NOT NULL,
    points_for numeric(12,2) DEFAULT 0 NOT NULL,
    points_against numeric(12,2) DEFAULT 0 NOT NULL,
    waiver_position integer,
    waiver_budget_used integer,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    season_id uuid NOT NULL
);


--
-- Name: matchup_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchup_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matchup_id uuid NOT NULL,
    fantasy_team_id uuid NOT NULL,
    points numeric(10,2) DEFAULT 0 NOT NULL,
    starters_points numeric(10,2),
    bench_points numeric(10,2),
    is_winner boolean,
    is_tie boolean DEFAULT false NOT NULL,
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: matchups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id uuid NOT NULL,
    week integer NOT NULL,
    sleeper_matchup_id integer NOT NULL,
    status text DEFAULT 'complete'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    season_id uuid NOT NULL,
    CONSTRAINT matchups_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'complete'::text]))),
    CONSTRAINT matchups_week_check CHECK (((week >= 1) AND (week <= 18)))
);


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id uuid NOT NULL,
    year integer NOT NULL,
    sleeper_league_id text NOT NULL,
    season_type text DEFAULT 'regular'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    league_name text,
    total_rosters integer,
    playoff_teams integer,
    regular_season_weeks integer,
    playoff_start_week integer,
    scoring_settings jsonb DEFAULT '{}'::jsonb,
    roster_positions jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    raw_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seasons_season_type_check CHECK ((season_type = ANY (ARRAY['regular'::text, 'dynasty'::text, 'keeper'::text, 'bestball'::text]))),
    CONSTRAINT seasons_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'active'::text, 'completed'::text])))
);


--
-- Name: team_weekly_results; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.team_weekly_results WITH (security_invoker='true') AS
 SELECT m.id AS matchup_id,
    m.season_id,
    m.league_id,
    s.year AS season_year,
    s.sleeper_league_id,
    m.week,
    m.sleeper_matchup_id,
    mt.id AS matchup_team_id,
    mt.fantasy_team_id,
    ft.sleeper_roster_id,
    ft.team_name,
    opponent_mt.fantasy_team_id AS opponent_fantasy_team_id,
    opponent_ft.sleeper_roster_id AS opponent_sleeper_roster_id,
    opponent_ft.team_name AS opponent_team_name,
    (mt.points)::numeric AS points_for,
    (opponent_mt.points)::numeric AS points_against,
    (mt.points - opponent_mt.points) AS point_differential,
    (mt.starters_points)::numeric AS starters_points,
    (mt.bench_points)::numeric AS bench_points,
        CASE
            WHEN (mt.points > opponent_mt.points) THEN 'W'::text
            WHEN (mt.points < opponent_mt.points) THEN 'L'::text
            ELSE 'T'::text
        END AS result,
        CASE
            WHEN (mt.points > opponent_mt.points) THEN 1
            ELSE 0
        END AS win,
        CASE
            WHEN (mt.points < opponent_mt.points) THEN 1
            ELSE 0
        END AS loss,
        CASE
            WHEN (mt.points = opponent_mt.points) THEN 1
            ELSE 0
        END AS tie,
    mt.is_winner,
    mt.is_tie
   FROM (((((public.matchups m
     JOIN public.seasons s ON ((s.id = m.season_id)))
     JOIN public.matchup_teams mt ON ((mt.matchup_id = m.id)))
     JOIN public.fantasy_teams ft ON ((ft.id = mt.fantasy_team_id)))
     JOIN public.matchup_teams opponent_mt ON (((opponent_mt.matchup_id = m.id) AND (opponent_mt.id <> mt.id))))
     JOIN public.fantasy_teams opponent_ft ON ((opponent_ft.id = opponent_mt.fantasy_team_id)))
  WHERE (m.status = 'complete'::text);


--
-- Name: all_play_standings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.all_play_standings WITH (security_invoker='true') AS
 WITH weekly_comparisons AS (
         SELECT team.season_id,
            team.league_id,
            team.season_year,
            team.sleeper_league_id,
            team.week,
            team.fantasy_team_id,
            team.sleeper_roster_id,
            team.team_name,
            team.points_for,
            count(*) AS all_play_games,
            count(*) FILTER (WHERE (team.points_for > opponent.points_for)) AS all_play_wins,
            count(*) FILTER (WHERE (team.points_for < opponent.points_for)) AS all_play_losses,
            count(*) FILTER (WHERE (team.points_for = opponent.points_for)) AS all_play_ties
           FROM (public.team_weekly_results team
             JOIN public.team_weekly_results opponent ON (((opponent.season_id = team.season_id) AND (opponent.week = team.week) AND (opponent.fantasy_team_id <> team.fantasy_team_id))))
          GROUP BY team.season_id, team.league_id, team.season_year, team.sleeper_league_id, team.week, team.fantasy_team_id, team.sleeper_roster_id, team.team_name, team.points_for
        ), season_totals AS (
         SELECT weekly_comparisons.season_id,
            weekly_comparisons.league_id,
            weekly_comparisons.season_year,
            weekly_comparisons.sleeper_league_id,
            weekly_comparisons.fantasy_team_id,
            weekly_comparisons.sleeper_roster_id,
            weekly_comparisons.team_name,
            count(*) AS weeks_played,
            sum(weekly_comparisons.all_play_games) AS all_play_games,
            sum(weekly_comparisons.all_play_wins) AS all_play_wins,
            sum(weekly_comparisons.all_play_losses) AS all_play_losses,
            sum(weekly_comparisons.all_play_ties) AS all_play_ties,
            sum(weekly_comparisons.points_for) AS points_for,
            avg(weekly_comparisons.points_for) AS average_points,
                CASE
                    WHEN (sum(weekly_comparisons.all_play_games) = (0)::numeric) THEN (0)::numeric
                    ELSE ((sum(weekly_comparisons.all_play_wins) + (sum(weekly_comparisons.all_play_ties) * 0.5)) / sum(weekly_comparisons.all_play_games))
                END AS all_play_percentage
           FROM weekly_comparisons
          GROUP BY weekly_comparisons.season_id, weekly_comparisons.league_id, weekly_comparisons.season_year, weekly_comparisons.sleeper_league_id, weekly_comparisons.fantasy_team_id, weekly_comparisons.sleeper_roster_id, weekly_comparisons.team_name
        )
 SELECT row_number() OVER (PARTITION BY season_id ORDER BY season_totals.all_play_percentage DESC, all_play_wins DESC, season_totals.points_for DESC, sleeper_roster_id) AS all_play_rank,
    season_id,
    league_id,
    season_year,
    sleeper_league_id,
    fantasy_team_id,
    sleeper_roster_id,
    team_name,
    weeks_played,
    all_play_games,
    all_play_wins,
    all_play_losses,
    all_play_ties,
    round(all_play_percentage, 3) AS all_play_percentage,
    round(points_for, 2) AS points_for,
    round(average_points, 2) AS average_points
   FROM season_totals;


--
-- Name: gazette_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gazette_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    category text NOT NULL,
    headline text NOT NULL,
    summary text NOT NULL,
    author_name text DEFAULT 'The Gazette Staff'::text NOT NULL,
    published_at timestamp with time zone,
    image_url text,
    image_alt text,
    body jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    homepage_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gazette_articles_body_is_valid CHECK (((body IS NULL) OR (jsonb_typeof(body) = ANY (ARRAY['array'::text, 'object'::text])))),
    CONSTRAINT gazette_articles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready_for_review'::text, 'scheduled'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: editorial_articles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.editorial_articles AS
 SELECT id,
    slug,
    category,
    headline,
    summary,
    author_name,
    status,
    is_featured,
    homepage_order,
    image_url,
    image_alt,
    published_at,
    created_at,
    updated_at,
        CASE
            WHEN ((status = 'scheduled'::text) AND (published_at IS NOT NULL) AND (published_at <= now())) THEN 'Live — scheduled'::text
            WHEN (status = 'draft'::text) THEN 'Draft'::text
            WHEN (status = 'ready_for_review'::text) THEN 'Ready for review'::text
            WHEN (status = 'scheduled'::text) THEN 'Scheduled'::text
            WHEN (status = 'published'::text) THEN 'Published'::text
            WHEN (status = 'archived'::text) THEN 'Archived'::text
            ELSE initcap(replace(status, '_'::text, ' '::text))
        END AS status_label,
    ((image_url IS NOT NULL) AND (btrim(image_url) <> ''::text)) AS has_featured_image,
    ((image_url IS NOT NULL) AND (btrim(image_url) <> ''::text) AND ((image_alt IS NULL) OR (btrim(image_alt) = ''::text))) AS needs_image_alt,
    ((summary IS NOT NULL) AND (btrim(summary) <> ''::text)) AS has_summary,
    ((jsonb_typeof(body) = 'array'::text) AND (jsonb_array_length(body) > 0)) AS has_body,
    (status = 'scheduled'::text) AS is_scheduled,
    ((status = 'scheduled'::text) AND (published_at IS NOT NULL) AND (published_at <= now())) AS is_due_for_publishing,
    (((status = 'published'::text) AND (published_at IS NOT NULL) AND (published_at <= now())) OR ((status = 'scheduled'::text) AND (published_at IS NOT NULL) AND (published_at <= now()))) AS is_publicly_available,
    ((btrim(headline) <> ''::text) AND (btrim(slug) <> ''::text) AND (btrim(category) <> ''::text) AND (summary IS NOT NULL) AND (btrim(summary) <> ''::text) AND (jsonb_typeof(body) = 'array'::text) AND (jsonb_array_length(body) > 0) AND ((image_url IS NULL) OR (btrim(image_url) = ''::text) OR ((image_alt IS NOT NULL) AND (btrim(image_alt) <> ''::text)))) AS can_publish,
        CASE
            WHEN ((status = ANY (ARRAY['published'::text, 'scheduled'::text])) AND (published_at IS NOT NULL)) THEN published_at
            ELSE updated_at
        END AS editorial_date,
    GREATEST(updated_at, COALESCE(published_at, updated_at)) AS editorial_sort_at
   FROM public.gazette_articles article;


--
-- Name: league_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id uuid NOT NULL,
    manager_id uuid NOT NULL,
    is_owner boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leagues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sleeper_league_id text NOT NULL,
    name text NOT NULL,
    season integer NOT NULL,
    status text,
    sport text DEFAULT 'nfl'::text NOT NULL,
    total_rosters integer,
    current_week integer,
    previous_league_id text,
    draft_id text,
    scoring_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    roster_positions jsonb DEFAULT '[]'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    avatar text,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    sleeper_created_at timestamp with time zone,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: managers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.managers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sleeper_user_id text NOT NULL,
    username text,
    display_name text NOT NULL,
    avatar text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: matchup_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchup_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matchup_team_id uuid NOT NULL,
    sleeper_player_id text NOT NULL,
    is_starter boolean DEFAULT false NOT NULL,
    points numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    sleeper_player_id text NOT NULL,
    first_name text,
    last_name text,
    full_name text,
    "position" text,
    fantasy_positions text[] DEFAULT '{}'::text[] NOT NULL,
    nfl_team text,
    active boolean,
    status text,
    injury_status text,
    age integer,
    years_experience integer,
    jersey_number integer,
    depth_chart_position text,
    depth_chart_order integer,
    search_rank integer,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: public_gazette_articles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_gazette_articles WITH (security_invoker='true') AS
 SELECT id,
    slug,
    category,
    headline,
    summary,
    author_name,
    published_at,
    image_url,
    image_alt,
    body,
    is_featured,
    homepage_order,
    created_at,
    updated_at,
        CASE
            WHEN ((status = 'scheduled'::text) AND (published_at IS NOT NULL) AND (published_at <= now())) THEN 'published'::text
            ELSE status
        END AS effective_status,
        CASE
            WHEN ((status = 'scheduled'::text) AND (published_at IS NOT NULL) AND (published_at <= now())) THEN true
            ELSE false
        END AS published_from_schedule
   FROM public.gazette_articles
  WHERE (((status = 'published'::text) AND (published_at IS NOT NULL) AND (published_at <= now())) OR ((status = 'scheduled'::text) AND (published_at IS NOT NULL) AND (published_at <= now())));


--
-- Name: roster_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roster_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fantasy_team_id uuid NOT NULL,
    sleeper_player_id text NOT NULL,
    is_starter boolean DEFAULT false NOT NULL,
    is_reserve boolean DEFAULT false NOT NULL,
    is_taxi boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roster_snapshot_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roster_snapshot_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    roster_snapshot_id uuid NOT NULL,
    sleeper_player_id text NOT NULL,
    is_starter boolean DEFAULT false NOT NULL,
    is_reserve boolean DEFAULT false NOT NULL,
    is_taxi boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roster_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roster_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fantasy_team_id uuid NOT NULL,
    week integer NOT NULL,
    wins integer DEFAULT 0 NOT NULL,
    losses integer DEFAULT 0 NOT NULL,
    ties integer DEFAULT 0 NOT NULL,
    points_for numeric(8,2),
    points_against numeric(8,2),
    waiver_position integer,
    waiver_budget_used integer,
    settings jsonb,
    metadata jsonb,
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    season_id uuid NOT NULL
);


--
-- Name: season_standings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.season_standings AS
 WITH team_game_results AS (
         SELECT m.id AS matchup_id,
            m.season_id,
            m.week,
            mt.fantasy_team_id,
            mt.points AS points_for,
            COALESCE(sum(opponent.points), (0)::numeric) AS points_against
           FROM ((public.matchups m
             JOIN public.matchup_teams mt ON ((mt.matchup_id = m.id)))
             LEFT JOIN public.matchup_teams opponent ON (((opponent.matchup_id = m.id) AND (opponent.id <> mt.id))))
          WHERE (m.status = 'complete'::text)
          GROUP BY m.id, m.season_id, m.week, mt.id, mt.fantasy_team_id, mt.points
        ), team_totals AS (
         SELECT ft.id AS fantasy_team_id,
            ft.season_id,
            s.league_id,
            s.year AS season_year,
            s.sleeper_league_id,
            ft.sleeper_roster_id,
            ft.team_name,
            count(tgr.matchup_id) AS games_played,
            count(tgr.matchup_id) FILTER (WHERE (tgr.points_for > tgr.points_against)) AS wins,
            count(tgr.matchup_id) FILTER (WHERE (tgr.points_for < tgr.points_against)) AS losses,
            count(tgr.matchup_id) FILTER (WHERE (tgr.points_for = tgr.points_against)) AS ties,
            COALESCE(sum(tgr.points_for), (0)::numeric) AS points_for,
            COALESCE(sum(tgr.points_against), (0)::numeric) AS points_against,
            COALESCE(avg(tgr.points_for), (0)::numeric) AS average_points,
            max(tgr.points_for) AS highest_score,
            min(tgr.points_for) AS lowest_score
           FROM ((public.fantasy_teams ft
             JOIN public.seasons s ON ((s.id = ft.season_id)))
             LEFT JOIN team_game_results tgr ON (((tgr.fantasy_team_id = ft.id) AND (tgr.season_id = ft.season_id))))
          GROUP BY ft.id, ft.season_id, s.league_id, s.year, s.sleeper_league_id, ft.sleeper_roster_id, ft.team_name
        ), standings_calculated AS (
         SELECT team_totals.fantasy_team_id,
            team_totals.season_id,
            team_totals.league_id,
            team_totals.season_year,
            team_totals.sleeper_league_id,
            team_totals.sleeper_roster_id,
            team_totals.team_name,
            team_totals.games_played,
            team_totals.wins,
            team_totals.losses,
            team_totals.ties,
            team_totals.points_for,
            team_totals.points_against,
            team_totals.average_points,
            team_totals.highest_score,
            team_totals.lowest_score,
                CASE
                    WHEN (team_totals.games_played = 0) THEN (0)::numeric
                    ELSE (((team_totals.wins)::numeric + ((team_totals.ties)::numeric * 0.5)) / (team_totals.games_played)::numeric)
                END AS winning_percentage,
            (team_totals.points_for - team_totals.points_against) AS point_differential
           FROM team_totals
        )
 SELECT fantasy_team_id,
    season_id,
    league_id,
    season_year,
    sleeper_league_id,
    sleeper_roster_id,
    team_name,
    games_played,
    wins,
    losses,
    ties,
    round(winning_percentage, 3) AS winning_percentage,
    round(points_for, 2) AS points_for,
    round(points_against, 2) AS points_against,
    round(point_differential, 2) AS point_differential,
    round(average_points, 2) AS average_points,
    round(highest_score, 2) AS highest_score,
    round(lowest_score, 2) AS lowest_score,
    dense_rank() OVER (PARTITION BY season_id ORDER BY standings_calculated.winning_percentage DESC, standings_calculated.points_for DESC, standings_calculated.point_differential DESC) AS standings_rank
   FROM standings_calculated;


--
-- Name: sync_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sync_type text NOT NULL,
    sleeper_league_id text,
    status text NOT NULL,
    records_processed integer DEFAULT 0 NOT NULL,
    error_message text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT sync_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'failed'::text])))
);


--
-- Name: weekly_standings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.weekly_standings WITH (security_invoker='true') AS
 WITH cumulative_results AS (
         SELECT twr.season_id,
            twr.league_id,
            twr.season_year,
            twr.sleeper_league_id,
            twr.week,
            twr.fantasy_team_id,
            twr.sleeper_roster_id,
            twr.team_name,
            count(*) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS games_played,
            sum(twr.win) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS wins,
            sum(twr.loss) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS losses,
            sum(twr.tie) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ties,
            sum(twr.points_for) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS points_for,
            sum(twr.points_against) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS points_against,
            avg(twr.points_for) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS average_points,
            max(twr.points_for) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS highest_score,
            min(twr.points_for) OVER (PARTITION BY twr.season_id, twr.fantasy_team_id ORDER BY twr.week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS lowest_score
           FROM public.team_weekly_results twr
        ), calculated AS (
         SELECT cumulative_results.season_id,
            cumulative_results.league_id,
            cumulative_results.season_year,
            cumulative_results.sleeper_league_id,
            cumulative_results.week,
            cumulative_results.fantasy_team_id,
            cumulative_results.sleeper_roster_id,
            cumulative_results.team_name,
            cumulative_results.games_played,
            cumulative_results.wins,
            cumulative_results.losses,
            cumulative_results.ties,
            cumulative_results.points_for,
            cumulative_results.points_against,
            cumulative_results.average_points,
            cumulative_results.highest_score,
            cumulative_results.lowest_score,
            (cumulative_results.points_for - cumulative_results.points_against) AS point_differential,
                CASE
                    WHEN (cumulative_results.games_played = 0) THEN (0)::numeric
                    ELSE (((cumulative_results.wins)::numeric + ((cumulative_results.ties)::numeric * 0.5)) / (cumulative_results.games_played)::numeric)
                END AS winning_percentage
           FROM cumulative_results
        )
 SELECT row_number() OVER (PARTITION BY season_id, week ORDER BY calculated.winning_percentage DESC, calculated.points_for DESC, calculated.point_differential DESC, sleeper_roster_id) AS standings_rank,
    season_id,
    league_id,
    season_year,
    sleeper_league_id,
    week,
    fantasy_team_id,
    sleeper_roster_id,
    team_name,
    games_played,
    wins,
    losses,
    ties,
    round(winning_percentage, 3) AS winning_percentage,
    round(points_for, 2) AS points_for,
    round(points_against, 2) AS points_against,
    round(point_differential, 2) AS point_differential,
    round(average_points, 2) AS average_points,
    round(highest_score, 2) AS highest_score,
    round(lowest_score, 2) AS lowest_score
   FROM calculated;


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);


--
-- Name: fantasy_teams fantasy_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_pkey PRIMARY KEY (id);


--
-- Name: fantasy_teams fantasy_teams_season_roster_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_season_roster_key UNIQUE (season_id, sleeper_roster_id);


--
-- Name: gazette_articles gazette_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gazette_articles
    ADD CONSTRAINT gazette_articles_pkey PRIMARY KEY (id);


--
-- Name: gazette_articles gazette_articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gazette_articles
    ADD CONSTRAINT gazette_articles_slug_key UNIQUE (slug);


--
-- Name: league_members league_members_league_id_manager_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_league_id_manager_id_key UNIQUE (league_id, manager_id);


--
-- Name: league_members league_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_pkey PRIMARY KEY (id);


--
-- Name: leagues leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_pkey PRIMARY KEY (id);


--
-- Name: leagues leagues_sleeper_league_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_sleeper_league_id_key UNIQUE (sleeper_league_id);


--
-- Name: managers managers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers
    ADD CONSTRAINT managers_pkey PRIMARY KEY (id);


--
-- Name: managers managers_sleeper_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers
    ADD CONSTRAINT managers_sleeper_user_id_key UNIQUE (sleeper_user_id);


--
-- Name: matchup_players matchup_players_matchup_team_id_sleeper_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchup_players
    ADD CONSTRAINT matchup_players_matchup_team_id_sleeper_player_id_key UNIQUE (matchup_team_id, sleeper_player_id);


--
-- Name: matchup_players matchup_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchup_players
    ADD CONSTRAINT matchup_players_pkey PRIMARY KEY (id);


--
-- Name: matchup_teams matchup_teams_matchup_id_fantasy_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchup_teams
    ADD CONSTRAINT matchup_teams_matchup_id_fantasy_team_id_key UNIQUE (matchup_id, fantasy_team_id);


--
-- Name: matchup_teams matchup_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchup_teams
    ADD CONSTRAINT matchup_teams_pkey PRIMARY KEY (id);


--
-- Name: matchups matchups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchups
    ADD CONSTRAINT matchups_pkey PRIMARY KEY (id);


--
-- Name: matchups matchups_season_week_sleeper_matchup_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchups
    ADD CONSTRAINT matchups_season_week_sleeper_matchup_key UNIQUE (season_id, week, sleeper_matchup_id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (sleeper_player_id);


--
-- Name: roster_players roster_players_fantasy_team_id_sleeper_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_players
    ADD CONSTRAINT roster_players_fantasy_team_id_sleeper_player_id_key UNIQUE (fantasy_team_id, sleeper_player_id);


--
-- Name: roster_players roster_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_players
    ADD CONSTRAINT roster_players_pkey PRIMARY KEY (id);


--
-- Name: roster_snapshot_players roster_snapshot_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_snapshot_players
    ADD CONSTRAINT roster_snapshot_players_pkey PRIMARY KEY (id);


--
-- Name: roster_snapshot_players roster_snapshot_players_roster_snapshot_id_sleeper_player_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_snapshot_players
    ADD CONSTRAINT roster_snapshot_players_roster_snapshot_id_sleeper_player_i_key UNIQUE (roster_snapshot_id, sleeper_player_id);


--
-- Name: roster_snapshots roster_snapshots_fantasy_team_id_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_snapshots
    ADD CONSTRAINT roster_snapshots_fantasy_team_id_week_key UNIQUE (fantasy_team_id, week);


--
-- Name: roster_snapshots roster_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_snapshots
    ADD CONSTRAINT roster_snapshots_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_league_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_league_id_year_key UNIQUE (league_id, year);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_sleeper_league_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_sleeper_league_id_key UNIQUE (sleeper_league_id);


--
-- Name: sync_runs sync_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_runs
    ADD CONSTRAINT sync_runs_pkey PRIMARY KEY (id);


--
-- Name: fantasy_teams_league_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fantasy_teams_league_id_idx ON public.fantasy_teams USING btree (league_id);


--
-- Name: fantasy_teams_manager_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fantasy_teams_manager_id_idx ON public.fantasy_teams USING btree (manager_id);


--
-- Name: fantasy_teams_season_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fantasy_teams_season_idx ON public.fantasy_teams USING btree (season_id);


--
-- Name: gazette_articles_homepage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gazette_articles_homepage_idx ON public.gazette_articles USING btree (is_featured, homepage_order);


--
-- Name: gazette_articles_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gazette_articles_status_idx ON public.gazette_articles USING btree (status);


--
-- Name: gazette_articles_status_published_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gazette_articles_status_published_at_idx ON public.gazette_articles USING btree (status, published_at DESC);


--
-- Name: gazette_articles_status_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gazette_articles_status_published_idx ON public.gazette_articles USING btree (status, published_at DESC);


--
-- Name: matchup_players_matchup_team_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchup_players_matchup_team_idx ON public.matchup_players USING btree (matchup_team_id);


--
-- Name: matchup_players_sleeper_player_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchup_players_sleeper_player_idx ON public.matchup_players USING btree (sleeper_player_id);


--
-- Name: matchup_teams_fantasy_team_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchup_teams_fantasy_team_idx ON public.matchup_teams USING btree (fantasy_team_id);


--
-- Name: matchup_teams_matchup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchup_teams_matchup_idx ON public.matchup_teams USING btree (matchup_id);


--
-- Name: matchups_league_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchups_league_week_idx ON public.matchups USING btree (league_id, week);


--
-- Name: matchups_season_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchups_season_week_idx ON public.matchups USING btree (season_id, week);


--
-- Name: players_nfl_team_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX players_nfl_team_idx ON public.players USING btree (nfl_team);


--
-- Name: players_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX players_position_idx ON public.players USING btree ("position");


--
-- Name: roster_players_player_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX roster_players_player_id_idx ON public.roster_players USING btree (sleeper_player_id);


--
-- Name: roster_players_team_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX roster_players_team_id_idx ON public.roster_players USING btree (fantasy_team_id);


--
-- Name: roster_snapshots_season_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX roster_snapshots_season_week_idx ON public.roster_snapshots USING btree (season_id, week);


--
-- Name: seasons_league_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seasons_league_idx ON public.seasons USING btree (league_id);


--
-- Name: seasons_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seasons_status_idx ON public.seasons USING btree (status);


--
-- Name: seasons_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seasons_year_idx ON public.seasons USING btree (year);


--
-- Name: gazette_articles set_gazette_articles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_gazette_articles_updated_at BEFORE UPDATE ON public.gazette_articles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: fantasy_teams fantasy_teams_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;


--
-- Name: fantasy_teams fantasy_teams_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE SET NULL;


--
-- Name: fantasy_teams fantasy_teams_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: league_members league_members_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;


--
-- Name: league_members league_members_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE CASCADE;


--
-- Name: matchup_players matchup_players_matchup_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchup_players
    ADD CONSTRAINT matchup_players_matchup_team_id_fkey FOREIGN KEY (matchup_team_id) REFERENCES public.matchup_teams(id) ON DELETE CASCADE;


--
-- Name: matchup_players matchup_players_sleeper_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchup_players
    ADD CONSTRAINT matchup_players_sleeper_player_id_fkey FOREIGN KEY (sleeper_player_id) REFERENCES public.players(sleeper_player_id);


--
-- Name: matchup_teams matchup_teams_fantasy_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchup_teams
    ADD CONSTRAINT matchup_teams_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id) ON DELETE CASCADE;


--
-- Name: matchup_teams matchup_teams_matchup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchup_teams
    ADD CONSTRAINT matchup_teams_matchup_id_fkey FOREIGN KEY (matchup_id) REFERENCES public.matchups(id) ON DELETE CASCADE;


--
-- Name: matchups matchups_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchups
    ADD CONSTRAINT matchups_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;


--
-- Name: matchups matchups_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchups
    ADD CONSTRAINT matchups_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: roster_players roster_players_fantasy_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_players
    ADD CONSTRAINT roster_players_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id) ON DELETE CASCADE;


--
-- Name: roster_players roster_players_sleeper_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_players
    ADD CONSTRAINT roster_players_sleeper_player_id_fkey FOREIGN KEY (sleeper_player_id) REFERENCES public.players(sleeper_player_id) ON DELETE CASCADE;


--
-- Name: roster_snapshot_players roster_snapshot_players_roster_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_snapshot_players
    ADD CONSTRAINT roster_snapshot_players_roster_snapshot_id_fkey FOREIGN KEY (roster_snapshot_id) REFERENCES public.roster_snapshots(id) ON DELETE CASCADE;


--
-- Name: roster_snapshot_players roster_snapshot_players_sleeper_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_snapshot_players
    ADD CONSTRAINT roster_snapshot_players_sleeper_player_id_fkey FOREIGN KEY (sleeper_player_id) REFERENCES public.players(sleeper_player_id);


--
-- Name: roster_snapshots roster_snapshots_fantasy_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_snapshots
    ADD CONSTRAINT roster_snapshots_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id) ON DELETE CASCADE;


--
-- Name: roster_snapshots roster_snapshots_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_snapshots
    ADD CONSTRAINT roster_snapshots_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: seasons seasons_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;


--
-- Name: gazette_articles Admins can create Gazette articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create Gazette articles" ON public.gazette_articles FOR INSERT TO authenticated WITH CHECK (public.is_gazette_admin());


--
-- Name: gazette_articles Admins can delete Gazette articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete Gazette articles" ON public.gazette_articles FOR DELETE TO authenticated USING (public.is_gazette_admin());


--
-- Name: gazette_articles Admins can read all Gazette articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all Gazette articles" ON public.gazette_articles FOR SELECT TO authenticated USING (public.is_gazette_admin());


--
-- Name: admin_users Admins can read their own admin record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read their own admin record" ON public.admin_users FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: gazette_articles Admins can update Gazette articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update Gazette articles" ON public.gazette_articles FOR UPDATE TO authenticated USING (public.is_gazette_admin()) WITH CHECK (public.is_gazette_admin());


--
-- Name: fantasy_teams Public can read fantasy teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read fantasy teams" ON public.fantasy_teams FOR SELECT TO authenticated, anon USING (true);


--
-- Name: leagues Public can read leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read leagues" ON public.leagues FOR SELECT TO authenticated, anon USING (true);


--
-- Name: matchup_teams Public can read matchup teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read matchup teams" ON public.matchup_teams FOR SELECT TO authenticated, anon USING (true);


--
-- Name: matchups Public can read matchups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read matchups" ON public.matchups FOR SELECT TO authenticated, anon USING (true);


--
-- Name: players Public can read players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read players" ON public.players FOR SELECT TO authenticated, anon USING (true);


--
-- Name: roster_players Public can read roster players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read roster players" ON public.roster_players FOR SELECT TO authenticated, anon USING (true);


--
-- Name: seasons Public can read seasons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read seasons" ON public.seasons FOR SELECT TO authenticated, anon USING (true);


--
-- Name: gazette_articles Published Gazette articles are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Published Gazette articles are publicly readable" ON public.gazette_articles FOR SELECT TO authenticated, anon USING ((((status = 'published'::text) AND (published_at IS NOT NULL) AND (published_at <= now())) OR ((status = 'scheduled'::text) AND (published_at IS NOT NULL) AND (published_at <= now()))));


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fantasy_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: gazette_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gazette_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: league_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

--
-- Name: leagues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

--
-- Name: managers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

--
-- Name: matchup_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchup_players ENABLE ROW LEVEL SECURITY;

--
-- Name: matchup_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchup_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: matchups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;

--
-- Name: players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

--
-- Name: roster_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roster_players ENABLE ROW LEVEL SECURITY;

--
-- Name: roster_snapshot_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roster_snapshot_players ENABLE ROW LEVEL SECURITY;

--
-- Name: roster_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roster_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: seasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE admin_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_users TO anon;
GRANT ALL ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;


--
-- Name: TABLE fantasy_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fantasy_teams TO anon;
GRANT ALL ON TABLE public.fantasy_teams TO authenticated;
GRANT ALL ON TABLE public.fantasy_teams TO service_role;


--
-- Name: TABLE matchup_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchup_teams TO anon;
GRANT ALL ON TABLE public.matchup_teams TO authenticated;
GRANT ALL ON TABLE public.matchup_teams TO service_role;


--
-- Name: TABLE matchups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchups TO anon;
GRANT ALL ON TABLE public.matchups TO authenticated;
GRANT ALL ON TABLE public.matchups TO service_role;


--
-- Name: TABLE seasons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.seasons TO anon;
GRANT ALL ON TABLE public.seasons TO authenticated;
GRANT ALL ON TABLE public.seasons TO service_role;


--
-- Name: TABLE team_weekly_results; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_weekly_results TO anon;
GRANT ALL ON TABLE public.team_weekly_results TO authenticated;
GRANT ALL ON TABLE public.team_weekly_results TO service_role;


--
-- Name: TABLE all_play_standings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.all_play_standings TO anon;
GRANT ALL ON TABLE public.all_play_standings TO authenticated;
GRANT ALL ON TABLE public.all_play_standings TO service_role;


--
-- Name: TABLE gazette_articles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gazette_articles TO anon;
GRANT ALL ON TABLE public.gazette_articles TO authenticated;
GRANT ALL ON TABLE public.gazette_articles TO service_role;


--
-- Name: TABLE editorial_articles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.editorial_articles TO authenticated;
GRANT ALL ON TABLE public.editorial_articles TO service_role;


--
-- Name: TABLE league_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.league_members TO anon;
GRANT ALL ON TABLE public.league_members TO authenticated;
GRANT ALL ON TABLE public.league_members TO service_role;


--
-- Name: TABLE leagues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leagues TO anon;
GRANT ALL ON TABLE public.leagues TO authenticated;
GRANT ALL ON TABLE public.leagues TO service_role;


--
-- Name: TABLE managers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.managers TO anon;
GRANT ALL ON TABLE public.managers TO authenticated;
GRANT ALL ON TABLE public.managers TO service_role;


--
-- Name: TABLE matchup_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchup_players TO anon;
GRANT ALL ON TABLE public.matchup_players TO authenticated;
GRANT ALL ON TABLE public.matchup_players TO service_role;


--
-- Name: TABLE players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.players TO anon;
GRANT ALL ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.players TO service_role;


--
-- Name: TABLE public_gazette_articles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.public_gazette_articles TO anon;
GRANT ALL ON TABLE public.public_gazette_articles TO authenticated;
GRANT ALL ON TABLE public.public_gazette_articles TO service_role;


--
-- Name: TABLE roster_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roster_players TO anon;
GRANT ALL ON TABLE public.roster_players TO authenticated;
GRANT ALL ON TABLE public.roster_players TO service_role;


--
-- Name: TABLE roster_snapshot_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roster_snapshot_players TO anon;
GRANT ALL ON TABLE public.roster_snapshot_players TO authenticated;
GRANT ALL ON TABLE public.roster_snapshot_players TO service_role;


--
-- Name: TABLE roster_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roster_snapshots TO anon;
GRANT ALL ON TABLE public.roster_snapshots TO authenticated;
GRANT ALL ON TABLE public.roster_snapshots TO service_role;


--
-- Name: TABLE season_standings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.season_standings TO anon;
GRANT ALL ON TABLE public.season_standings TO authenticated;
GRANT ALL ON TABLE public.season_standings TO service_role;


--
-- Name: TABLE sync_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sync_runs TO anon;
GRANT ALL ON TABLE public.sync_runs TO authenticated;
GRANT ALL ON TABLE public.sync_runs TO service_role;


--
-- Name: TABLE weekly_standings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.weekly_standings TO anon;
GRANT ALL ON TABLE public.weekly_standings TO authenticated;
GRANT ALL ON TABLE public.weekly_standings TO service_role;

REVOKE ALL ON TABLE public.editorial_articles FROM anon;

COMMENT ON VIEW public.team_weekly_results IS 'One row per fantasy team per completed weekly matchup, including opponent, score, result, and margin.';
COMMENT ON VIEW public.all_play_standings IS 'Season standings calculated as though each fantasy team played every other team every week.';
COMMENT ON VIEW public.season_standings IS 'Season-level fantasy standings calculated from completed matchups.';
COMMENT ON VIEW public.weekly_standings IS 'Cumulative fantasy standings after each completed week of a season.';


--
-- PostgreSQL database dump complete
--
