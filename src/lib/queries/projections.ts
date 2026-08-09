import { supabase } from "../supabase";

export type PlayerWeeklyProjection = {
  id: string;
  seasonId: string;
  seasonYear: number;
  week: number;
  fantasyTeamId: string;
  teamName: string;
  sleeperPlayerId: string;
  playerName: string;
  position: string;
  nflTeam: string | null;
  projectedPoints: number;
  updatedAt: string;
};

export async function getPlayerWeeklyProjections(
  seasonYear?: number,
  week?: number,
): Promise<PlayerWeeklyProjection[]> {
  let query = supabase
    .from("player_weekly_projections")
    .select("id,season_id,season_year,week,fantasy_team_id,sleeper_player_id,player_name,position,nfl_team,projected_points,updated_at,fantasy_teams(team_name)")
    .order("season_year", { ascending: false })
    .order("week", { ascending: true })
    .order("projected_points", { ascending: false });

  if (seasonYear !== undefined) query = query.eq("season_year", seasonYear);
  if (week !== undefined) query = query.eq("week", week);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Unable to load player projections: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    seasonId: row.season_id,
    seasonYear: row.season_year,
    week: row.week,
    fantasyTeamId: row.fantasy_team_id,
    teamName: (Array.isArray(row.fantasy_teams)
      ? row.fantasy_teams[0]?.team_name
      : row.fantasy_teams?.team_name) ?? "Unnamed Team",
    sleeperPlayerId: row.sleeper_player_id,
    playerName: row.player_name,
    position: row.position,
    nflTeam: row.nfl_team,
    projectedPoints: Number(row.projected_points),
    updatedAt: row.updated_at,
  }));
}
