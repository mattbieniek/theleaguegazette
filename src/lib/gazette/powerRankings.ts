export type RankingResult = {
  teamId: string;
  teamName: string;
  rank: number;
  score: number;
  record: string;
  pointsFor: number;
  seasonAverage: number;
  leagueWinRate: number;
  standardWinRate: number;
  efficiencyRate: number;
  cvScore: number | null;
  cvRank: number;
  cvFactor: number;
};

export type RankingInput = {
  fantasy_team_id: string | null;
  team_name: string | null;
  week: number | null;
  points_for: number | null;
  point_differential: number | null;
  result: string | null;
};

export type RankingPlayerInput = {
  fantasy_team_id: string | null;
  week: number | null;
  sleeper_player_id: string | null;
  player_position: string | null;
  points: number | null;
  is_starter: boolean | null;
};

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function optimalLineupScore(players: RankingPlayerInput[]): number {
  const sorted = [...players].sort((first, second) => Number(second.points ?? 0) - Number(first.points ?? 0));
  const used = new Set<string>();
  let total = 0;

  const take = (positions: string[], count: number) => {
    const choices = sorted
      .filter((player) => {
        const id = String(player.sleeper_player_id ?? "");
        return id && positions.includes(String(player.player_position ?? "")) && !used.has(id);
      })
      .slice(0, count);
    for (const player of choices) {
      used.add(String(player.sleeper_player_id));
      total += Number(player.points ?? 0);
    }
  };

  take(["QB"], 1);
  take(["RB"], 2);
  take(["WR"], 2);
  take(["TE"], 1);
  take(["RB", "WR", "TE"], 2);
  take(["K"], 1);
  take(["DEF"], 1);
  return total;
}

export function buildComputerPoll(
  rows: RankingInput[],
  throughWeek: number,
  playerRows: RankingPlayerInput[] = [],
): RankingResult[] {
  const eligible = rows.filter(
    (row) => row.fantasy_team_id && row.week && row.week <= throughWeek,
  );
  const grouped = new Map<string, RankingInput[]>();
  const weeklyScores = new Map<number, RankingInput[]>();

  for (const row of eligible) {
    const id = String(row.fantasy_team_id);
    const teamGames = grouped.get(id) ?? [];
    teamGames.push(row);
    grouped.set(id, teamGames);
    const week = Number(row.week);
    const weekGames = weeklyScores.get(week) ?? [];
    weekGames.push(row);
    weeklyScores.set(week, weekGames);
  }

  const lineups = new Map<string, RankingPlayerInput[]>();
  for (const player of playerRows) {
    if (!player.fantasy_team_id || !player.week || player.week > throughWeek) continue;
    const key = `${player.fantasy_team_id}:${player.week}`;
    const lineup = lineups.get(key) ?? [];
    lineup.push(player);
    lineups.set(key, lineup);
  }

  const baseMetrics = [...grouped.entries()].map(([teamId, games]) => {
    games.sort((first, second) => Number(first.week) - Number(second.week));
    const wins = games.filter((game) => game.result === "W").length;
    const ties = games.filter((game) => game.result === "T").length;
    const scores = games.map((game) => Number(game.points_for ?? 0));
    let leagueWins = 0;
    let leagueOpportunities = 0;
    let actualPoints = 0;
    let optimalPoints = 0;

    for (const game of games) {
      const opponents = (weeklyScores.get(Number(game.week)) ?? []).filter(
        (other) => other.fantasy_team_id !== game.fantasy_team_id,
      );
      const score = Number(game.points_for ?? 0);
      for (const opponent of opponents) {
        const opponentScore = Number(opponent.points_for ?? 0);
        leagueWins += score > opponentScore ? 1 : score === opponentScore ? 0.5 : 0;
        leagueOpportunities += 1;
      }

      const weeklyLineup = lineups.get(`${teamId}:${game.week}`) ?? [];
      if (weeklyLineup.length) {
        actualPoints += score;
        optimalPoints += optimalLineupScore(weeklyLineup);
      }
    }

    const deviation = standardDeviation(scores);
    return {
      teamId,
      teamName: games.at(-1)?.team_name ?? "Unknown Team",
      record: `${wins}-${games.length - wins - ties}${ties ? `-${ties}` : ""}`,
      pointsFor: scores.reduce((sum, score) => sum + score, 0),
      seasonAverage: average(scores),
      leagueWinRate: leagueOpportunities ? leagueWins / leagueOpportunities : 0,
      standardWinRate: games.length ? (wins + ties * 0.5) / games.length : 0,
      efficiencyRate: optimalPoints > 0 ? Math.min(actualPoints / optimalPoints, 1) : 1,
      cvScore: deviation > 0 ? average(scores) / deviation : null,
    };
  });

  const cvOrder = [...baseMetrics].sort((first, second) => {
    if (first.cvScore === null && second.cvScore === null) return 0;
    if (first.cvScore === null) return -1;
    if (second.cvScore === null) return 1;
    return second.cvScore - first.cvScore;
  });
  const cvRanks = new Map<string, number>();
  let priorScore: number | null | undefined;
  let priorRank = 0;
  cvOrder.forEach((team, index) => {
    const rank = index === 0 || team.cvScore !== priorScore ? index + 1 : priorRank;
    cvRanks.set(team.teamId, rank);
    priorScore = team.cvScore;
    priorRank = rank;
  });

  return baseMetrics
    .map((team) => {
      const cvRank = cvRanks.get(team.teamId) ?? 1;
      const cvFactor = 1 - (cvRank - 1) * 0.05;
      const score = 100 * average([
        team.leagueWinRate,
        team.standardWinRate,
        team.efficiencyRate,
        cvFactor,
      ]);
      return { ...team, cvRank, cvFactor, score, rank: 0 };
    })
    .sort((first, second) => second.score - first.score || second.pointsFor - first.pointsFor)
    .map((team, index) => ({ ...team, rank: index + 1 }));
}
