import type { WeeklyTeamResult } from "../queries/awards";

export type LeagueRecordTone =
  | "green"
  | "red"
  | "gold"
  | "slate";

export type LeagueRecord = {
  id: string;
  symbol: string;
  label: string;
  title: string;
  value: string;
  teamName: string;
  opponentName: string | null;
  teamScore: number;
  opponentScore: number | null;
  seasonYear: number;
  week: number;
  description: string;
  tone: LeagueRecordTone;
  tiedPerformances: number;
};

type Candidate = {
  row: WeeklyTeamResult;
  value: number;
};

function formatPoints(value: number): string {
  return value.toFixed(2);
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
      matchup.find((result) => result.result === "W") ??
      matchup[0]
  );
}

function selectCandidate(
  candidates: Candidate[],
  direction: "highest" | "lowest"
): Candidate | null {
  return (
    [...candidates].sort((first, second) =>
      direction === "highest"
        ? second.value - first.value
        : first.value - second.value
    )[0] ?? null
  );
}

function countTies(
  candidates: Candidate[],
  selected: Candidate
): number {
  return candidates.filter(
    (candidate) => candidate.value === selected.value
  ).length;
}

function createRecord(
  candidate: Candidate,
  candidates: Candidate[],
  details: Omit<
    LeagueRecord,
    | "value"
    | "teamName"
    | "opponentName"
    | "teamScore"
    | "opponentScore"
    | "seasonYear"
    | "week"
    | "tiedPerformances"
  > & {
    formatValue: (value: number) => string;
  }
): LeagueRecord {
  const { row, value } = candidate;

  return {
    id: details.id,
    symbol: details.symbol,
    label: details.label,
    title: details.title,
    value: details.formatValue(value),
    teamName: row.team_name,
    opponentName: row.opponent_team_name,
    teamScore: row.points_for,
    opponentScore: row.points_against,
    seasonYear: row.season_year,
    week: row.week,
    description: details.description,
    tone: details.tone,
    tiedPerformances: countTies(candidates, candidate),
  };
}

export function buildLeagueRecords(
  results: WeeklyTeamResult[]
): LeagueRecord[] {
  if (results.length === 0) {
    return [];
  }

  const matchups = getUniqueMatchups(results);
  const winners = results.filter((result) => result.result === "W");
  const losers = results.filter((result) => result.result === "L");

  const scored = results.map((row) => ({
    row,
    value: row.points_for,
  }));
  const margins = winners.map((row) => ({
    row,
    value: row.point_differential,
  }));
  const closeGames = matchups.map((row) => ({
    row,
    value: Math.abs(row.point_differential),
  }));
  const combinedScores = matchups.map((row) => ({
    row,
    value: row.points_for + row.points_against,
  }));
  const losingScores = losers.map((row) => ({
    row,
    value: row.points_for,
  }));
  const winningScores = winners.map((row) => ({
    row,
    value: row.points_for,
  }));
  const benches = results.map((row) => ({
    row,
    value: row.bench_points,
  }));

  const definitions = [
    {
      candidate: selectCandidate(scored, "highest"),
      candidates: scored,
      details: {
        id: "highest-score",
        symbol: "★",
        label: "Single-Week Scoring",
        title: "Highest Score",
        formatValue: (value: number) => `${formatPoints(value)} points`,
        description:
          "The largest team score recorded in a completed league matchup.",
        tone: "green" as const,
      },
    },
    {
      candidate: selectCandidate(scored, "lowest"),
      candidates: scored,
      details: {
        id: "lowest-score",
        symbol: "↓",
        label: "Single-Week Scoring",
        title: "Lowest Score",
        formatValue: (value: number) => `${formatPoints(value)} points`,
        description:
          "The smallest team score recorded in a completed league matchup.",
        tone: "red" as const,
      },
    },
    {
      candidate: selectCandidate(margins, "highest"),
      candidates: margins,
      details: {
        id: "biggest-blowout",
        symbol: "+",
        label: "Margin of Victory",
        title: "Biggest Blowout",
        formatValue: (value: number) => `+${formatPoints(value)}`,
        description:
          "The widest winning margin in the completed matchup archive.",
        tone: "gold" as const,
      },
    },
    {
      candidate: selectCandidate(closeGames, "lowest"),
      candidates: closeGames,
      details: {
        id: "closest-matchup",
        symbol: "Δ",
        label: "Margin of Victory",
        title: "Closest Matchup",
        formatValue: (value: number) =>
          `${formatPoints(value)}-point margin`,
        description:
          "The narrowest final result in the completed matchup archive.",
        tone: "slate" as const,
      },
    },
    {
      candidate: selectCandidate(combinedScores, "highest"),
      candidates: combinedScores,
      details: {
        id: "highest-combined-score",
        symbol: "Σ",
        label: "Combined Scoring",
        title: "Highest-Scoring Game",
        formatValue: (value: number) => `${formatPoints(value)} points`,
        description:
          "The greatest combined point total produced by two opposing teams.",
        tone: "green" as const,
      },
    },
    {
      candidate: selectCandidate(losingScores, "highest"),
      candidates: losingScores,
      details: {
        id: "highest-scoring-loss",
        symbol: "!",
        label: "Painful Defeat",
        title: "Highest-Scoring Loss",
        formatValue: (value: number) => `${formatPoints(value)} points`,
        description:
          "The most points scored by a team that still finished with a loss.",
        tone: "gold" as const,
      },
    },
    {
      candidate: selectCandidate(winningScores, "lowest"),
      candidates: winningScores,
      details: {
        id: "lowest-scoring-win",
        symbol: "↗",
        label: "Fortunate Victory",
        title: "Lowest-Scoring Win",
        formatValue: (value: number) => `${formatPoints(value)} points`,
        description:
          "The fewest points scored by a team that still secured a victory.",
        tone: "gold" as const,
      },
    },
    {
      candidate: selectCandidate(benches, "highest"),
      candidates: benches,
      details: {
        id: "most-bench-points",
        symbol: "B",
        label: "Bench Production",
        title: "Most Bench Points",
        formatValue: (value: number) => `${formatPoints(value)} points`,
        description:
          "The largest total produced by a team’s non-starting players in one week.",
        tone: "slate" as const,
      },
    },
  ];

  return definitions.flatMap(({ candidate, candidates, details }) =>
    candidate ? [createRecord(candidate, candidates, details)] : []
  );
}
