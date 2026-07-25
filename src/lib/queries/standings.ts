import { supabase } from "../supabase";
import type { Database } from "../../types/database";

export type SeasonStanding =
  Database["public"]["Views"]["season_standings"]["Row"];

export async function getSeasonStandings(
  sleeperLeagueId: string
): Promise<SeasonStanding[]> {
  const { data, error } = await supabase
    .from("season_standings")
    .select("*")
    .eq("sleeper_league_id", sleeperLeagueId)
    .order("standings_rank", {
      ascending: true,
      nullsFirst: false,
    });

  if (error) {
    throw new Error(`Unable to load season standings: ${error.message}`);
  }

  return data ?? [];
}