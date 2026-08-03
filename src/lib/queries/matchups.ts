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
  sleeperLeagueId?: string
): Promise<MatchupWeek[]> {
  let query = supabase
    .from("team_weekly_results")
    .select("*")
    .not("week", "is", null)
    .not("matchup_id", "is", null)
    .order("week", {
      ascending: true,
    })
    .order("sleeper_matchup_id", {
      ascending: true,
      nullsFirst: false,
    });

  if (sleeperLeagueId) {
    query = query.eq("sleeper_league_id", sleeperLeagueId);
  }

  const { data, error } = await query;

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

  const weeks = new Map<
    string,
    {
      week: number;
      seasonYear: number | null;
      matchups: WeeklyMatchup[];
    }
  >();

  for (const matchup of weeklyMatchups) {
    const key = `${matchup.seasonYear ?? "unknown"}:${matchup.week}`;
    const current = weeks.get(key) ?? {
      week: matchup.week,
      seasonYear: matchup.seasonYear,
      matchups: [],
    };

    current.matchups.push(matchup);
    weeks.set(key, current);
  }

  return [...weeks.values()]
    .sort((a, b) =>
      (a.seasonYear ?? 0) - (b.seasonYear ?? 0) ||
      a.week - b.week
    )
    .map(({ week, seasonYear, matchups }) => ({
      week,
      seasonYear,
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
