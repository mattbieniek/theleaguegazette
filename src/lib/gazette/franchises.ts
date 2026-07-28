import { seasonHistoryMetadata } from "../../data/seasonHistory";
import type { Team } from "../../data/teams";
import type { WeeklyTeamResult } from "../queries/awards";

export type FranchiseSeason = {
  year: number;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  averageScore: number;
  champion: boolean;
  runnerUp: boolean;
};

export type FranchisePerformance = {
  label: string;
  value: string;
  opponentName: string | null;
  seasonYear: number;
  week: number;
};

export type FranchiseHistory = {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  averageScore: number;
  championships: number;
  runnerUpFinishes: number;
  seasons: FranchiseSeason[];
  performances: FranchisePerformance[];
};

function normalizeName(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function formatPoints(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function matchesFranchise(team: Team, name: string | null): boolean {
  const normalized = normalizeName(name);

  return [team.name, team.legacyName]
    .map(normalizeName)
    .includes(normalized);
}

function highestBy(
  rows: WeeklyTeamResult[],
  getValue: (row: WeeklyTeamResult) => number
): WeeklyTeamResult | null {
  return [...rows].sort(
    (first, second) => getValue(second) - getValue(first)
  )[0] ?? null;
}

function lowestBy(
  rows: WeeklyTeamResult[],
  getValue: (row: WeeklyTeamResult) => number
): WeeklyTeamResult | null {
  return [...rows].sort(
    (first, second) => getValue(first) - getValue(second)
  )[0] ?? null;
}

export function buildFranchiseHistory(
  allResults: WeeklyTeamResult[],
  team: Team
): FranchiseHistory | null {
  const results = allResults.filter((result) =>
    matchesFranchise(team, result.team_name)
  );

  if (results.length === 0) {
    return null;
  }

  const seasonGroups = new Map<number, WeeklyTeamResult[]>();

  for (const result of results) {
    const current = seasonGroups.get(result.season_year) ?? [];
    current.push(result);
    seasonGroups.set(result.season_year, current);
  }

  const seasons = [...seasonGroups.entries()]
    .map(([year, rows]): FranchiseSeason => {
      const pointsFor = rows.reduce(
        (sum, row) => sum + row.points_for,
        0
      );
      const pointsAgainst = rows.reduce(
        (sum, row) => sum + row.points_against,
        0
      );
      const metadata = seasonHistoryMetadata.find(
        (season) => season.year === year
      );

      return {
        year,
        games: rows.length,
        wins: rows.filter((row) => row.result === "W").length,
        losses: rows.filter((row) => row.result === "L").length,
        ties: rows.filter((row) => row.result === "T").length,
        pointsFor,
        pointsAgainst,
        averageScore: pointsFor / rows.length,
        champion: matchesFranchise(team, metadata?.champion ?? null),
        runnerUp: matchesFranchise(team, metadata?.runnerUp ?? null),
      };
    })
    .sort((first, second) => second.year - first.year);

  const highScore = highestBy(results, (row) => row.points_for);
  const lowScore = lowestBy(results, (row) => row.points_for);
  const biggestWin = highestBy(
    results.filter((row) => row.result === "W"),
    (row) => row.point_differential
  );
  const closestGame = lowestBy(
    results,
    (row) => Math.abs(row.point_differential)
  );
  const highestLoss = highestBy(
    results.filter((row) => row.result === "L"),
    (row) => row.points_for
  );

  const performances: FranchisePerformance[] = [];

  if (highScore) {
    performances.push({
      label: "Highest Score",
      value: `${formatPoints(highScore.points_for)} points`,
      opponentName: highScore.opponent_team_name,
      seasonYear: highScore.season_year,
      week: highScore.week,
    });
  }

  if (lowScore) {
    performances.push({
      label: "Lowest Score",
      value: `${formatPoints(lowScore.points_for)} points`,
      opponentName: lowScore.opponent_team_name,
      seasonYear: lowScore.season_year,
      week: lowScore.week,
    });
  }

  if (biggestWin) {
    performances.push({
      label: "Biggest Win",
      value: `+${formatPoints(biggestWin.point_differential)}`,
      opponentName: biggestWin.opponent_team_name,
      seasonYear: biggestWin.season_year,
      week: biggestWin.week,
    });
  }

  if (closestGame) {
    performances.push({
      label: "Closest Game",
      value: `${formatPoints(
        Math.abs(closestGame.point_differential)
      )}-point margin`,
      opponentName: closestGame.opponent_team_name,
      seasonYear: closestGame.season_year,
      week: closestGame.week,
    });
  }

  if (highestLoss) {
    performances.push({
      label: "Highest-Scoring Loss",
      value: `${formatPoints(highestLoss.points_for)} points`,
      opponentName: highestLoss.opponent_team_name,
      seasonYear: highestLoss.season_year,
      week: highestLoss.week,
    });
  }

  const pointsFor = results.reduce(
    (sum, result) => sum + result.points_for,
    0
  );

  return {
    games: results.length,
    wins: results.filter((result) => result.result === "W").length,
    losses: results.filter((result) => result.result === "L").length,
    ties: results.filter((result) => result.result === "T").length,
    pointsFor,
    pointsAgainst: results.reduce(
      (sum, result) => sum + result.points_against,
      0
    ),
    averageScore: pointsFor / results.length,
    championships: seasons.filter((season) => season.champion).length,
    runnerUpFinishes: seasons.filter((season) => season.runnerUp).length,
    seasons,
    performances,
  };
}

export function formatFranchiseRecord(
  wins: number,
  losses: number,
  ties: number
): string {
  const record = `${wins}-${losses}`;
  return ties > 0 ? `${record}-${ties}` : record;
}
