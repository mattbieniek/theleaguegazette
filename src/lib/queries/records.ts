import { supabase } from "../supabase";
import type { WeeklyTeamResult } from "./awards";
import { getLegacyResults } from "../legacy";

function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeResult(
  row: Record<string, unknown>
): WeeklyTeamResult {
  return {
    matchup_id: String(row.matchup_id ?? ""),
    season_year: toNumber(row.season_year),
    week: toNumber(row.week),
    sleeper_matchup_id: toNumber(row.sleeper_matchup_id),
    fantasy_team_id: String(row.fantasy_team_id ?? ""),
    team_name:
      String(row.team_name ?? "").trim() || "Unknown Team",
    opponent_fantasy_team_id:
      typeof row.opponent_fantasy_team_id === "string"
        ? row.opponent_fantasy_team_id
        : null,
    opponent_team_name:
      typeof row.opponent_team_name === "string"
        ? row.opponent_team_name.trim()
        : null,
    points_for: toNumber(row.points_for),
    points_against: toNumber(row.points_against),
    point_differential: toNumber(row.point_differential),
    starters_points: toNumber(row.starters_points),
    bench_points: toNumber(row.bench_points),
    result: String(row.result ?? ""),
    is_winner: Boolean(row.is_winner),
    is_tie: Boolean(row.is_tie),
  };
}

function keepCompletedMatchups(
  rows: WeeklyTeamResult[]
): WeeklyTeamResult[] {
  const grouped = new Map<string, WeeklyTeamResult[]>();

  for (const row of rows) {
    const current = grouped.get(row.matchup_id) ?? [];
    current.push(row);
    grouped.set(row.matchup_id, current);
  }

  return [...grouped.values()]
    .filter(
      (matchup) =>
        matchup.length === 2 &&
        // Sleeper publishes the schedule before games begin with both teams
        // at 0. Those placeholders are not completed ties and must not enter
        // standings, recent form, or the franchise record book.
        matchup.some(
          (row) => row.points_for !== 0 || row.points_against !== 0
        ) &&
        matchup.every((row) =>
          ["W", "L", "T"].includes(row.result)
        )
    )
    .flat();
}

export async function getHistoricalResults(
  sleeperLeagueId?: string
): Promise<WeeklyTeamResult[]> {
  let query = supabase
    .from("team_weekly_results")
    .select(
      `
        matchup_id,
        season_year,
        week,
        sleeper_matchup_id,
        fantasy_team_id,
        team_name,
        opponent_fantasy_team_id,
        opponent_team_name,
        points_for,
        points_against,
        point_differential,
        starters_points,
        bench_points,
        result,
        is_winner,
        is_tie
      `
    )
    .order("season_year", { ascending: false })
    .order("week", { ascending: false });

  if (sleeperLeagueId) {
    query = query.eq("sleeper_league_id", sleeperLeagueId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load historical league results: ${error.message}`
    );
  }

  const currentRows = (data ?? [])
    .map((row) =>
      normalizeResult(row as Record<string, unknown>)
    )
    .filter(
      (row) =>
        row.matchup_id &&
        row.season_year > 0 &&
        row.week > 0
    );

  return keepCompletedMatchups([...currentRows, ...getLegacyResults()]);
}
