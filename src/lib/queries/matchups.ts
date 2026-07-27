import { supabase } from "../supabase";
import type { Database } from "../../types/database";

export type TeamWeeklyResult =
  Database["public"]["Views"]["team_weekly_results"]["Row"];

export type MatchupTeam = {
  fantasyTeamId: string | null;
  teamName: string;
  points: number | null;
  startersPoints: number | null;
  benchPoints: number | null;
  result: string | null;
  isWinner: boolean;
  isTie: boolean;
};

export type WeeklyMatchup = {
  id: string;
  sleeperMatchupId: number | null;
  week: number;
  seasonYear: number | null;
  teams: [MatchupTeam, MatchupTeam];
};

export type MatchupWeek = {
  week: number;
  seasonYear: number | null;
  matchups: WeeklyMatchup[];
};

function toMatchupTeam(
  row: TeamWeeklyResult
): MatchupTeam {
  return {
    fantasyTeamId: row.fantasy_team_id,
    teamName: row.team_name ?? "Unnamed Team",
    points: row.points_for,
    startersPoints: row.starters_points,
    benchPoints: row.bench_points,
    result: row.result,
    isWinner: row.is_winner === true,
    isTie: row.is_tie === true,
  };
}

export async function getSeasonMatchups(
  sleeperLeagueId: string
): Promise<MatchupWeek[]> {
  const { data, error } = await supabase
    .from("team_weekly_results")
    .select("*")
    .eq("sleeper_league_id", sleeperLeagueId)
    .not("week", "is", null)
    .not("matchup_id", "is", null)
    .order("week", {
      ascending: true,
    })
    .order("sleeper_matchup_id", {
      ascending: true,
      nullsFirst: false,
    });

  if (error) {
    throw new Error(
      `Unable to load league matchups: ${error.message}`
    );
  }

  const rows = data ?? [];

  const matchupGroups = new Map<
    string,
    TeamWeeklyResult[]
  >();

  for (const row of rows) {
    if (
      row.matchup_id === null ||
      row.week === null
    ) {
      continue;
    }

    const existing =
      matchupGroups.get(row.matchup_id) ?? [];

    existing.push(row);
    matchupGroups.set(row.matchup_id, existing);
  }

  const weeklyMatchups: WeeklyMatchup[] = [];

  for (const [matchupId, matchupRows] of matchupGroups) {
    if (matchupRows.length < 2) {
      continue;
    }

    const first = matchupRows[0];
    const second = matchupRows[1];

    if (
      !first ||
      !second ||
      first.week === null
    ) {
      continue;
    }

    weeklyMatchups.push({
      id: matchupId,
      sleeperMatchupId:
        first.sleeper_matchup_id,
      week: first.week,
      seasonYear: first.season_year,
      teams: [
        toMatchupTeam(first),
        toMatchupTeam(second),
      ],
    });
  }

  const weeks = new Map<number, WeeklyMatchup[]>();

  for (const matchup of weeklyMatchups) {
    const current =
      weeks.get(matchup.week) ?? [];

    current.push(matchup);
    weeks.set(matchup.week, current);
  }

  return [...weeks.entries()]
    .sort(([weekA], [weekB]) => weekA - weekB)
    .map(([week, matchups]) => ({
      week,
      seasonYear:
        matchups.find(
          (matchup) =>
            matchup.seasonYear !== null
        )?.seasonYear ?? null,
      matchups: matchups.sort((a, b) =>
        String(a.sleeperMatchupId ?? "").localeCompare(
          String(b.sleeperMatchupId ?? ""),
          undefined,
          {
            numeric: true,
          }
        )
      ),
    }));
}