export const DEFAULT_ACTIVE_SLEEPER_LEAGUE_ID = "1389719207712681984";
export const DEFAULT_ACTIVE_SEASON = 2026;

/**
 * The public environment value is updated in Vercel when a new season is
 * opened. The fallback keeps local previews pointed at the active season
 * instead of silently falling back to an archived league.
 */
export const ACTIVE_SLEEPER_LEAGUE_ID =
  import.meta.env.PUBLIC_SLEEPER_LEAGUE_ID ||
  DEFAULT_ACTIVE_SLEEPER_LEAGUE_ID;
