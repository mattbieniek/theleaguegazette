/**
 * The league that automated jobs are allowed to write to.
 *
 * The environment variables make the production target explicit while the
 * checked-in defaults keep local development and scheduled previews aligned
 * with the 2026 season. Historical leagues must always be passed explicitly
 * to an administrator-only manual import instead of flowing through this
 * module.
 */
export const DEFAULT_ACTIVE_SLEEPER_LEAGUE_ID = "1389719207712681984";
export const DEFAULT_ACTIVE_SEASON_YEAR = 2026;

export function activeSleeperLeagueId(): string {
  return (
    Deno.env.get("ACTIVE_SLEEPER_LEAGUE_ID")?.trim() ||
    DEFAULT_ACTIVE_SLEEPER_LEAGUE_ID
  );
}

export function activeSeasonYear(): number {
  const configured = Number(Deno.env.get("ACTIVE_SEASON_YEAR"));
  return Number.isInteger(configured) && configured >= 2000 && configured <= 2200
    ? configured
    : DEFAULT_ACTIVE_SEASON_YEAR;
}

export type SleeperLeagueSummary = {
  league_id?: string;
  season?: string | number;
  status?: string | null;
  current_week?: number | null;
  previous_league_id?: string | null;
};

export function assertActiveLeague(
  leagueId: string,
  league: SleeperLeagueSummary,
): void {
  if (leagueId !== activeSleeperLeagueId()) {
    throw new Error("The requested league is not the configured active league.");
  }

  if (String(league.league_id ?? "") !== leagueId) {
    throw new Error("Sleeper returned a different league ID than requested.");
  }

  if (Number(league.season) !== activeSeasonYear()) {
    throw new Error(
      `Sleeper returned season ${String(league.season ?? "unknown")}; ` +
        `the active season is configured as ${activeSeasonYear()}.`,
    );
  }
}
