import type {
  WeeklyTeamResult,
} from "../queries/awards";

export type WeeklyAwardTone =
  | "positive"
  | "negative"
  | "neutral"
  | "warning";

export type WeeklyAward = {
  id: string;
  label: string;
  title: string;
  teamName: string;
  opponentName: string | null;
  primaryValue: string;
  description: string;
  tone: WeeklyAwardTone;
};

function formatPoints(value: number): string {
  return value.toFixed(2);
}

function getHighest(
  rows: WeeklyTeamResult[],
  getValue: (
    row: WeeklyTeamResult
  ) => number
): WeeklyTeamResult | null {
  return (
    [...rows].sort(
      (first, second) =>
        getValue(second) -
        getValue(first)
    )[0] ?? null
  );
}

function getLowest(
  rows: WeeklyTeamResult[],
  getValue: (
    row: WeeklyTeamResult
  ) => number
): WeeklyTeamResult | null {
  return (
    [...rows].sort(
      (first, second) =>
        getValue(first) -
        getValue(second)
    )[0] ?? null
  );
}

function getUniqueMatchups(
  results: WeeklyTeamResult[]
): WeeklyTeamResult[] {
  return Array.from(
    new Map(
      results.map((result) => [
        result.matchup_id,
        result,
      ])
    ).values()
  );
}

export function buildWeeklyAwards(
  results: WeeklyTeamResult[],
  week: number
): WeeklyAward[] {
  if (results.length === 0) {
    return [];
  }

  const winners = results.filter(
    (result) => result.result === "W"
  );

  const losers = results.filter(
    (result) => result.result === "L"
  );

  const uniqueMatchups =
    getUniqueMatchups(results);

  const highestScore = getHighest(
    results,
    (result) => result.points_for
  );

  const lowestScore = getLowest(
    results,
    (result) => result.points_for
  );

  const biggestBlowout = getHighest(
    winners,
    (result) =>
      result.point_differential
  );

  const closestMatchup = getLowest(
    uniqueMatchups,
    (result) =>
      Math.abs(
        result.point_differential
      )
  );

  const highestScoringLoss = getHighest(
    losers,
    (result) => result.points_for
  );

  const lowestScoringWin = getLowest(
    winners,
    (result) => result.points_for
  );

  const bestBench = getHighest(
    results,
    (result) => result.bench_points
  );

  const awards: WeeklyAward[] = [];

  if (highestScore) {
    awards.push({
      id: "performance-of-the-week",
      label: "Performance of the Week",
      title: "The Golden Box Score",
      teamName: highestScore.team_name,
      opponentName:
        highestScore.opponent_team_name,
      primaryValue: `${formatPoints(
        highestScore.points_for
      )} points`,
      description:
        highestScore.result === "W"
          ? `${highestScore.team_name} posted the highest total of Week ${week} and converted it into a victory.`
          : `${highestScore.team_name} produced the week's highest score but still walked away without a win.`,
      tone: "positive",
    });
  }

  if (lowestScore) {
    awards.push({
      id: "lowest-score",
      label: "Low-Water Mark",
      title: "The Paper Bag",
      teamName: lowestScore.team_name,
      opponentName:
        lowestScore.opponent_team_name,
      primaryValue: `${formatPoints(
        lowestScore.points_for
      )} points`,
      description: `${lowestScore.team_name} finished Week ${week} with the league's lowest point total.`,
      tone: "negative",
    });
  }

  if (biggestBlowout) {
    awards.push({
      id: "biggest-blowout",
      label: "Largest Margin",
      title: "The Steamroller",
      teamName:
        biggestBlowout.team_name,
      opponentName:
        biggestBlowout.opponent_team_name,
      primaryValue: `+${formatPoints(
        biggestBlowout.point_differential
      )}`,
      description: `${biggestBlowout.team_name} delivered the week's largest margin of victory.`,
      tone: "positive",
    });
  }

  if (closestMatchup) {
    const winningTeamName =
      closestMatchup.result === "L"
        ? closestMatchup.opponent_team_name ??
          closestMatchup.team_name
        : closestMatchup.team_name;

    const losingTeamName =
      closestMatchup.result === "L"
        ? closestMatchup.team_name
        : closestMatchup.opponent_team_name;

    awards.push({
      id: "closest-matchup",
      label: "Closest Finish",
      title: "The Photo Finish",
      teamName: winningTeamName,
      opponentName: losingTeamName,
      primaryValue: `${formatPoints(
        Math.abs(
          closestMatchup.point_differential
        )
      )}-point margin`,
      description:
        "The week's tightest matchup was decided by the smallest scoring margin.",
      tone: "neutral",
    });
  }

  if (highestScoringLoss) {
    awards.push({
      id: "highest-scoring-loss",
      label: "Toughest Defeat",
      title: "The Bad Beat",
      teamName:
        highestScoringLoss.team_name,
      opponentName:
        highestScoringLoss.opponent_team_name,
      primaryValue: `${formatPoints(
        highestScoringLoss.points_for
      )} points`,
      description: `${highestScoringLoss.team_name} scored more than every other losing team and still came up short.`,
      tone: "warning",
    });
  }

  if (lowestScoringWin) {
    awards.push({
      id: "lowest-scoring-win",
      label: "Lowest Winning Score",
      title: "The Escape Artist",
      teamName:
        lowestScoringWin.team_name,
      opponentName:
        lowestScoringWin.opponent_team_name,
      primaryValue: `${formatPoints(
        lowestScoringWin.points_for
      )} points`,
      description: `${lowestScoringWin.team_name} escaped Week ${week} with the lowest winning score on the board.`,
      tone: "warning",
    });
  }

  if (bestBench) {
    awards.push({
      id: "best-bench",
      label: "Bench Production",
      title: "The Clipboard All-Stars",
      teamName: bestBench.team_name,
      opponentName:
        bestBench.opponent_team_name,
      primaryValue: `${formatPoints(
        bestBench.bench_points
      )} bench points`,
      description: `${bestBench.team_name} received the week's largest contribution from players who never entered the starting lineup.`,
      tone: "neutral",
    });
  }

  return awards;
}