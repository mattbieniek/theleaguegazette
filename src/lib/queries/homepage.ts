import { supabase } from "../supabase";
import {
  getSeasonMatchups,
  type MatchupWeek,
} from "./matchups";
import {
  getSeasonStandings,
  type SeasonStanding,
} from "./standings";

export type HomepageLeagueData = {
  standings: SeasonStanding[];
  matchupWeeks: MatchupWeek[];
  seasonYear: number | null;
  usedFallback: boolean;
};

function weeksForSeason(
  weeks: MatchupWeek[],
  seasonYear: number | null | undefined,
): MatchupWeek[] {
  if (seasonYear === null || seasonYear === undefined) {
    return [];
  }

  return weeks.filter((week) => week.seasonYear === seasonYear);
}

export async function getHomepageLeagueData(
  activeSleeperLeagueId: string,
): Promise<HomepageLeagueData> {
  const [{ data: activeSeason }, { data: fallbackSeason }] = await Promise.all([
    supabase
      .from("seasons")
      .select("year,sleeper_league_id,status")
      .eq("sleeper_league_id", activeSleeperLeagueId)
      .maybeSingle(),
    supabase
      .from("seasons")
      .select("year,sleeper_league_id,status")
      .eq("status", "completed")
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const activeSeasonYear = activeSeason?.year ?? null;
  const [activeStandings, activeMatchupWeeks] = await Promise.all([
    getSeasonStandings(activeSleeperLeagueId),
    activeSeasonYear === null
      ? Promise.resolve([])
      : getSeasonMatchups(activeSleeperLeagueId, activeSeasonYear),
  ]);
  const currentWeeks = weeksForSeason(activeMatchupWeeks, activeSeasonYear);

  if (activeStandings.length > 0 && currentWeeks.length > 0) {
    return {
      standings: activeStandings,
      matchupWeeks: currentWeeks,
      seasonYear: activeSeasonYear,
      usedFallback: false,
    };
  }

  const fallbackSeasonYear = fallbackSeason?.year ?? null;
  const fallbackSleeperLeagueId = fallbackSeason?.sleeper_league_id ?? null;

  if (fallbackSeasonYear === null || fallbackSleeperLeagueId === null) {
    return {
      standings: activeStandings,
      matchupWeeks: currentWeeks,
      seasonYear: activeSeasonYear,
      usedFallback: false,
    };
  }

  const [fallbackStandings, fallbackMatchupWeeks] = await Promise.all([
    getSeasonStandings(fallbackSleeperLeagueId),
    getSeasonMatchups(undefined, fallbackSeasonYear),
  ]);
  const completedWeeks = weeksForSeason(
    fallbackMatchupWeeks,
    fallbackSeasonYear,
  );

  return {
    standings:
      fallbackStandings.length > 0 ? fallbackStandings : activeStandings,
    matchupWeeks:
      completedWeeks.length > 0 ? completedWeeks : currentWeeks,
    seasonYear:
      fallbackStandings.length > 0 || completedWeeks.length > 0
        ? fallbackSeasonYear
        : activeSeasonYear,
    usedFallback:
      fallbackStandings.length > 0 || completedWeeks.length > 0,
  };
}
