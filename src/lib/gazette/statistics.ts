import type { WeeklyTeamResult } from "../queries/awards";

export type TeamSeasonStatistics = {
  fantasyTeamId: string;
  teamName: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  averageScore: number;
  averagePointsAgainst: number;
  highScore: number;
  lowScore: number;
  scoringDeviation: number;
  averageMargin: number;
  averageBenchPoints: number;
};

export type SeasonStatistics = {
  seasonYear: number;
  teams: TeamSeasonStatistics[];
  games: number;
  leagueAverage: number;
  totalPoints: number;
};

function getStandardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const average =
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

  const variance =
    values.reduce(
      (sum, value) => sum + (value - average) ** 2,
      0
    ) / values.length;

  return Math.sqrt(variance);
}

export function buildSeasonStatistics(
  results: WeeklyTeamResult[],
  seasonYear: number
): SeasonStatistics {
  const seasonResults = results.filter(
    (result) => result.season_year === seasonYear
  );

  const teamGroups = new Map<string, WeeklyTeamResult[]>();

  for (const result of seasonResults) {
    const key = result.fantasy_team_id || result.team_name;
    const current = teamGroups.get(key) ?? [];
    current.push(result);
    teamGroups.set(key, current);
  }

  const teams = [...teamGroups.entries()]
    .map(([fantasyTeamId, rows]): TeamSeasonStatistics => {
      const scores = rows.map((row) => row.points_for);
      const pointsFor = scores.reduce(
        (sum, score) => sum + score,
        0
      );
      const pointsAgainst = rows.reduce(
        (sum, row) => sum + row.points_against,
        0
      );
      const benchPoints = rows.reduce(
        (sum, row) => sum + row.bench_points,
        0
      );
      const margins = rows.reduce(
        (sum, row) => sum + row.point_differential,
        0
      );

      return {
        fantasyTeamId,
        teamName: rows[0]?.team_name ?? "Unknown Team",
        games: rows.length,
        wins: rows.filter((row) => row.result === "W").length,
        losses: rows.filter((row) => row.result === "L").length,
        ties: rows.filter((row) => row.result === "T").length,
        pointsFor,
        pointsAgainst,
        averageScore: rows.length ? pointsFor / rows.length : 0,
        averagePointsAgainst: rows.length
          ? pointsAgainst / rows.length
          : 0,
        highScore: scores.length ? Math.max(...scores) : 0,
        lowScore: scores.length ? Math.min(...scores) : 0,
        scoringDeviation: getStandardDeviation(scores),
        averageMargin: rows.length ? margins / rows.length : 0,
        averageBenchPoints: rows.length
          ? benchPoints / rows.length
          : 0,
      };
    })
    .sort((first, second) => {
      if (second.wins !== first.wins) {
        return second.wins - first.wins;
      }

      return second.pointsFor - first.pointsFor;
    });

  const totalPoints = seasonResults.reduce(
    (sum, result) => sum + result.points_for,
    0
  );

  return {
    seasonYear,
    teams,
    games: new Set(
      seasonResults.map((result) => result.matchup_id)
    ).size,
    leagueAverage: seasonResults.length
      ? totalPoints / seasonResults.length
      : 0,
    totalPoints,
  };
}

export function formatTeamRecord(
  team: TeamSeasonStatistics
): string {
  const record = `${team.wins}-${team.losses}`;

  return team.ties > 0
    ? `${record}-${team.ties}`
    : record;
}
