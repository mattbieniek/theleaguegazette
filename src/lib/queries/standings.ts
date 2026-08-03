import { supabase } from "../supabase";
import type { Database } from "../../types/database";
import type { WeeklyTeamResult } from "./awards";

export type SeasonStanding =
  Database["public"]["Views"]["season_standings"]["Row"];

export type HistoricalStanding = Pick<SeasonStanding, "fantasy_team_id" | "team_name" | "season_year" | "wins" | "losses" | "ties" | "points_for" | "points_against" | "point_differential" | "standings_rank">;

export function buildStandingsThroughWeek(results: WeeklyTeamResult[], season: number, week: number): HistoricalStanding[] {
  const teams = new Map<string, HistoricalStanding>();
  for (const result of results.filter((row) => row.season_year === season && row.week <= week)) {
    const current = teams.get(result.fantasy_team_id) ?? { fantasy_team_id: result.fantasy_team_id, team_name: result.team_name, season_year: season, wins: 0, losses: 0, ties: 0, points_for: 0, points_against: 0, point_differential: 0, standings_rank: null };
    current.wins = Number(current.wins) + (result.result === "W" ? 1 : 0);
    current.losses = Number(current.losses) + (result.result === "L" ? 1 : 0);
    current.ties = Number(current.ties) + (result.result === "T" ? 1 : 0);
    current.points_for = Number(current.points_for) + result.points_for;
    current.points_against = Number(current.points_against) + result.points_against;
    current.point_differential = Number(current.points_for) - Number(current.points_against);
    teams.set(result.fantasy_team_id, current);
  }
  return [...teams.values()].sort((a, b) => Number(b.wins) - Number(a.wins) || Number(b.ties) - Number(a.ties) || Number(b.points_for) - Number(a.points_for)).map((team, index) => ({ ...team, standings_rank: index + 1 }));
}

export async function getSeasonStandings(
  sleeperLeagueId: string
): Promise<SeasonStanding[]> {
  const { data, error } = await supabase
    .from("season_standings")
    .select("*")
    .eq("sleeper_league_id", sleeperLeagueId)
    .order("standings_rank", {
      ascending: true,
      nullsFirst: false,
    });

  if (error) {
    throw new Error(`Unable to load season standings: ${error.message}`);
  }

  return data ?? [];
}
