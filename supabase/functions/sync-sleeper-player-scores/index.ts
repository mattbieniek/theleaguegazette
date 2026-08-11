import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";
import { activeSleeperLeagueId } from "../_shared/activeLeague.ts";

const ELIGIBLE = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const DEFENSE_SCORING_KEYS = new Set([
  "sack", "int", "ff", "fum_rec", "safe", "blk_kick", "def_td",
  "def_st_td", "def_st_ff", "def_st_fum_rec", "st_td", "st_ff", "st_fum_rec",
]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NumberMap = Record<string, number | null | undefined>;
type PlayerRow = { sleeper_player_id: string; full_name: string | null; position: string | null; nfl_team: string | null };

function defensePointsAllowedScore(stats: NumberMap, scoring: NumberMap): number {
  const allowed = Number(stats.pts_allow ?? stats.pts_allow_actual ?? 0);
  const key = allowed === 0 ? "pts_allow_0" : allowed <= 6 ? "pts_allow_1_6" : allowed <= 13 ? "pts_allow_7_13" : allowed <= 20 ? "pts_allow_14_20" : allowed <= 27 ? "pts_allow_21_27" : allowed <= 34 ? "pts_allow_28_34" : "pts_allow_35p";
  return Number(scoring[key] ?? 0);
}

function fantasyPoints(stats: NumberMap, scoring: NumberMap, position: string): number {
  let total = 0;
  for (const [key, weight] of Object.entries(scoring)) {
    if (key.startsWith("pts_allow_")) continue;
    if (position === "DEF" && !DEFENSE_SCORING_KEYS.has(key)) continue;
    total += Number(stats[key] ?? 0) * Number(weight ?? 0);
  }
  if (position === "DEF") total += defensePointsAllowedScore(stats, scoring);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase environment variables.");
    await requireAdmin(req, supabaseUrl, serviceRoleKey);
    const db = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({})) as { sleeper_league_id?: string; start_week?: number; end_week?: number };
    const leagueId = String(
      body.sleeper_league_id ?? activeSleeperLeagueId(),
    ).trim();
    const startWeek = Number(body.start_week ?? 1);
    const endWeek = Number(body.end_week ?? 17);
    if (!/^\d+$/.test(leagueId) || !Number.isInteger(startWeek) || !Number.isInteger(endWeek) || startWeek < 1 || endWeek > 18 || startWeek > endWeek) throw new Error("Choose a valid league ID and week range.");

    const { data: season, error: seasonError } = await db.from("seasons").select("id,year,scoring_settings").eq("sleeper_league_id", leagueId).single();
    if (seasonError || !season) throw new Error(seasonError?.message ?? `Season for league ${leagueId} was not found.`);
    const { data: league, error: leagueError } = await db.from("leagues").select("scoring_settings").eq("sleeper_league_id", leagueId).single();
    if (leagueError || !league) throw new Error(leagueError?.message ?? `League ${leagueId} was not found.`);
    const seasonScoring = (season.scoring_settings ?? {}) as NumberMap;
    const scoring = Object.keys(seasonScoring).length > 0 ? seasonScoring : (league.scoring_settings ?? {}) as NumberMap;
    if (Object.keys(scoring).length === 0) throw new Error(`No scoring settings are stored for ${season.year}.`);
    const players: PlayerRow[] = [];
    for (let start = 0; ; start += 1000) {
      const { data: page, error: playerError } = await db.from("players").select("sleeper_player_id,full_name,position,nfl_team").in("position", [...ELIGIBLE]).range(start, start + 999);
      if (playerError) throw playerError;
      players.push(...((page ?? []) as PlayerRow[]));
      if ((page?.length ?? 0) < 1000) break;
    }
    const playerById = new Map(players.map((player) => [player.sleeper_player_id, player]));
    let processed = 0;

    for (let week = startWeek; week <= endWeek; week++) {
      const response = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${season.year}/${week}`);
      if (!response.ok) throw new Error(`Sleeper stats returned ${response.status} for Week ${week}.`);
      const statsByPlayer = await response.json() as Record<string, NumberMap>;
      const rows = Object.entries(statsByPlayer).flatMap(([playerId, stats]) => {
        const isDefense = playerId.startsWith("TEAM_");
        const player = playerById.get(playerId);
        const position = isDefense ? "DEF" : player?.position ?? null;
        if (!position || !ELIGIBLE.has(position)) return [];
        const teamCode = isDefense ? playerId.replace("TEAM_", "") : player?.nfl_team ?? null;
        return [{ season_id: season.id, season_year: Number(season.year), week, sleeper_player_id: playerId, player_name: isDefense ? `${teamCode} Defense` : player?.full_name ?? playerId, position, nfl_team: teamCode, points: fantasyPoints(stats, scoring, position), raw_stats: stats, updated_at: new Date().toISOString() }];
      });
      for (let index = 0; index < rows.length; index += 500) {
        const { error } = await db.from("player_weekly_scores").upsert(rows.slice(index, index + 500), { onConflict: "season_id,week,sleeper_player_id" });
        if (error) throw error;
      }
      processed += rows.length;
    }
    return Response.json({ success: true, message: `Imported ${processed} player scores for ${season.year}.`, records_processed: processed }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ success: false, error: { message: error instanceof Error ? error.message : String(error) } }, { status: 500, headers: corsHeaders });
  }
});
