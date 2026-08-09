import { supabase } from "../supabase";
import type { Database } from "../../types/database";
import { getLegacyMatchups } from "../legacy";

export type TeamWeeklyResult =
  Database["public"]["Views"]["team_weekly_results"]["Row"];

export type MatchupTeam = {
  matchupTeamId: string | null;
  fantasyTeamId: string | null;
  teamName: string;
  points: number | null;
  startersPoints: number | null;
  benchPoints: number | null;
  result: string | null;
  isWinner: boolean;
  isTie: boolean;
  lineup: MatchupPlayer[];
};

export type MatchupPlayer = {
  sleeperPlayerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  status: string | null;
  injuryStatus: string | null;
  points: number;
  isStarter: boolean;
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
    matchupTeamId: row.matchup_team_id,
    fantasyTeamId: row.fantasy_team_id,
    teamName: row.team_name ?? "Unnamed Team",
    points: row.points_for,
    startersPoints: row.starters_points,
    benchPoints: row.bench_points,
    result: row.result,
    isWinner: row.is_winner === true,
    isTie: row.is_tie === true,
    lineup: [],
  };
}

async function loadMatchupLineups(matchupTeamIds: string[]) {
  const { data: matchupPlayers, error } = await supabase.rpc("public_matchup_lineups", {
    target_matchup_team_ids: matchupTeamIds,
  });
  if (error) throw new Error(`Unable to load matchup lineups: ${error.message}`);

  const lineups = new Map<string, MatchupPlayer[]>();
  for (const row of matchupPlayers ?? []) {
    const lineup = lineups.get(row.matchup_team_id) ?? [];
    lineup.push({
      sleeperPlayerId: row.sleeper_player_id,
      name: row.player_name,
      position: row.player_position,
      nflTeam: row.nfl_team,
      status: row.player_status,
      injuryStatus: row.injury_status,
      points: Number(row.points),
      isStarter: row.is_starter,
    });
    lineups.set(row.matchup_team_id, lineup);
  }

  const positionOrder = new Map(["QB", "RB", "WR", "TE", "K", "DEF"].map((position, index) => [position, index]));
  for (const lineup of lineups.values()) {
    lineup.sort((a, b) => Number(b.isStarter) - Number(a.isStarter) || (positionOrder.get(a.position) ?? 99) - (positionOrder.get(b.position) ?? 99) || b.points - a.points);
  }
  return lineups;
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
      teams: [toMatchupTeam(first), toMatchupTeam(second)],
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

  const historicalWeeks = new Map<string, { week: number; seasonYear: number | null; matchups: WeeklyMatchup[] }>();
  for (const matchup of getLegacyMatchups()) {
    const key = `${matchup.seasonYear ?? "unknown"}:${matchup.week}`;
    const current = historicalWeeks.get(key) ?? {
      week: matchup.week,
      seasonYear: matchup.seasonYear,
      matchups: [],
    };
    current.matchups.push(matchup);
    historicalWeeks.set(key, current);
  }

  for (const [key, value] of weeks) {
    const current = historicalWeeks.get(key) ?? {
      week: value.week,
      seasonYear: value.seasonYear,
      matchups: [],
    };
    current.matchups.push(...value.matchups);
    historicalWeeks.set(key, current);
  }

  return [...historicalWeeks.values()]
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

export async function hydrateMatchupLineups(matchups: WeeklyMatchup[]) {
  const matchupTeamIds = [...new Set(matchups.flatMap((matchup) => matchup.teams.map((team) => team.matchupTeamId).filter((id): id is string => Boolean(id))).filter((id) => !id.startsWith("legacy-")))];
  if (!matchupTeamIds.length) return;
  const lineups = await loadMatchupLineups(matchupTeamIds);
  for (const matchup of matchups) {
    for (const team of matchup.teams) {
      team.lineup = team.matchupTeamId ? lineups.get(team.matchupTeamId) ?? [] : [];
    }
  }
}
