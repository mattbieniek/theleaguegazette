import { findTeamByName, type Team } from "../../data/teams";
import type { WeeklyTeamResult } from "../queries/awards";

export type RecentResult = {
  matchupId: string;
  seasonYear: number;
  week: number;
  opponentName: string;
  pointsFor: number;
  pointsAgainst: number;
  margin: number;
  result: "W" | "L" | "T";
};

export type TeamRecentForm = {
  seasonYear: number;
  games: RecentResult[];
  wins: number;
  losses: number;
  ties: number;
  averageScore: number;
  streakCount: number;
  streakResult: "W" | "L" | "T";
  bestPerformance: RecentResult;
  closestGame: RecentResult;
};

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function buildTeamRecentForm(
  results: WeeklyTeamResult[],
  team: Team,
  limit = 5,
): TeamRecentForm | null {
  const identities = new Set(
    [team.name, team.legacyName, ...(team.aliases ?? [])].map(normalize),
  );

  const teamResults = results
    .filter((result) => findTeamByName(result.team_name)?.slug === team.slug || identities.has(normalize(result.team_name)))
    .sort((first, second) =>
      second.season_year - first.season_year || second.week - first.week
    );

  const seasonYear = teamResults[0]?.season_year;
  if (!seasonYear) return null;

  const games = teamResults
    .filter((result) => result.season_year === seasonYear)
    .slice(0, limit)
    .map((result): RecentResult => ({
      matchupId: result.matchup_id,
      seasonYear: result.season_year,
      week: result.week,
      opponentName: result.opponent_team_name ?? "Unknown opponent",
      pointsFor: result.points_for,
      pointsAgainst: result.points_against,
      margin: Math.abs(result.point_differential),
      result: result.result as "W" | "L" | "T",
    }));

  if (games.length === 0) return null;

  const streakResult = games[0].result;
  const streakCount = games.findIndex((game) => game.result !== streakResult);
  const bestPerformance = [...games].sort(
    (first, second) => second.pointsFor - first.pointsFor,
  )[0];
  const closestGame = [...games].sort(
    (first, second) => first.margin - second.margin,
  )[0];

  return {
    seasonYear,
    games,
    wins: games.filter((game) => game.result === "W").length,
    losses: games.filter((game) => game.result === "L").length,
    ties: games.filter((game) => game.result === "T").length,
    averageScore: games.reduce((sum, game) => sum + game.pointsFor, 0) / games.length,
    streakCount: streakCount === -1 ? games.length : streakCount,
    streakResult,
    bestPerformance,
    closestGame,
  };
}

export function formatStreak(form: TeamRecentForm): string {
  const labels = { W: "winning", L: "losing", T: "tied" } as const;
  return `${form.streakCount}-game ${labels[form.streakResult]} streak`;
}
