import {
  getSeasonHistoryMetadata,
  type SeasonProvider,
} from "../../data/seasonHistory";
import type { WeeklyTeamResult } from "../queries/awards";
import {
  buildSeasonStatistics,
  type TeamSeasonStatistics,
} from "./statistics";

export type SeasonHighlight = {
  label: string;
  title: string;
  teamName: string;
  opponentName: string | null;
  value: string;
  week: number;
};

export type LeagueSeasonHistory = {
  year: number;
  provider: SeasonProvider | null;
  champion: string | null;
  runnerUp: string | null;
  championshipWeek: number | null;
  notes: string | null;
  teamCount: number;
  matchupCount: number;
  firstWeek: number;
  lastWeek: number;
  totalPoints: number;
  leagueAverage: number;
  standings: TeamSeasonStatistics[];
  highlights: SeasonHighlight[];
};

function formatPoints(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getUniqueMatchups(
  results: WeeklyTeamResult[]
): WeeklyTeamResult[] {
  const groups = new Map<string, WeeklyTeamResult[]>();

  for (const result of results) {
    const current = groups.get(result.matchup_id) ?? [];
    current.push(result);
    groups.set(result.matchup_id, current);
  }

  return [...groups.values()].map(
    (matchup) =>
      matchup.find((result) => result.result === "W") ?? matchup[0]
  );
}

function highestBy(
  results: WeeklyTeamResult[],
  getValue: (result: WeeklyTeamResult) => number
): WeeklyTeamResult | null {
  return (
    [...results].sort(
      (first, second) => getValue(second) - getValue(first)
    )[0] ?? null
  );
}

function lowestBy(
  results: WeeklyTeamResult[],
  getValue: (result: WeeklyTeamResult) => number
): WeeklyTeamResult | null {
  return (
    [...results].sort(
      (first, second) => getValue(first) - getValue(second)
    )[0] ?? null
  );
}

export function buildLeagueSeasonHistory(
  allResults: WeeklyTeamResult[],
  year: number
): LeagueSeasonHistory | null {
  const results = allResults.filter(
    (result) => result.season_year === year
  );

  if (results.length === 0) {
    return null;
  }

  const metadata = getSeasonHistoryMetadata(year);
  const statistics = buildSeasonStatistics(allResults, year);
  const matchups = getUniqueMatchups(results);
  const winners = results.filter((result) => result.result === "W");

  const highestScore = highestBy(results, (result) => result.points_for);
  const closestGame = lowestBy(
    matchups,
    (result) => Math.abs(result.point_differential)
  );
  const biggestBlowout = highestBy(
    winners,
    (result) => result.point_differential
  );
  const scoringLeader = [...statistics.teams].sort(
    (first, second) => second.pointsFor - first.pointsFor
  )[0] ?? null;

  const highlights: SeasonHighlight[] = [];

  if (scoringLeader) {
    highlights.push({
      label: "Season Scoring Leader",
      title: scoringLeader.teamName,
      teamName: scoringLeader.teamName,
      opponentName: null,
      value: `${formatPoints(scoringLeader.pointsFor)} total points`,
      week: 0,
    });
  }

  if (highestScore) {
    highlights.push({
      label: "Highest Weekly Score",
      title: highestScore.team_name,
      teamName: highestScore.team_name,
      opponentName: highestScore.opponent_team_name,
      value: `${formatPoints(highestScore.points_for)} points`,
      week: highestScore.week,
    });
  }

  if (closestGame) {
    highlights.push({
      label: "Closest Matchup",
      title: closestGame.team_name,
      teamName: closestGame.team_name,
      opponentName: closestGame.opponent_team_name,
      value: `${formatPoints(
        Math.abs(closestGame.point_differential)
      )}-point margin`,
      week: closestGame.week,
    });
  }

  if (biggestBlowout) {
    highlights.push({
      label: "Biggest Blowout",
      title: biggestBlowout.team_name,
      teamName: biggestBlowout.team_name,
      opponentName: biggestBlowout.opponent_team_name,
      value: `+${formatPoints(biggestBlowout.point_differential)}`,
      week: biggestBlowout.week,
    });
  }

  const weeks = results.map((result) => result.week);

  return {
    year,
    provider: metadata?.provider ?? null,
    champion: metadata?.champion ?? null,
    runnerUp: metadata?.runnerUp ?? null,
    championshipWeek: metadata?.championshipWeek ?? null,
    notes: metadata?.notes ?? null,
    teamCount: statistics.teams.length,
    matchupCount: statistics.games,
    firstWeek: Math.min(...weeks),
    lastWeek: Math.max(...weeks),
    totalPoints: statistics.totalPoints,
    leagueAverage: statistics.leagueAverage,
    standings: statistics.teams,
    highlights,
  };
}

export function buildLeagueHistory(
  results: WeeklyTeamResult[]
): LeagueSeasonHistory[] {
  const years = [...new Set(results.map((result) => result.season_year))]
    .sort((first, second) => second - first);

  return years.flatMap((year) => {
    const season = buildLeagueSeasonHistory(results, year);
    return season ? [season] : [];
  });
}
