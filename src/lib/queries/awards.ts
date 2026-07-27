import { supabase } from "../supabase";

export type WeeklyTeamResult = {
  matchup_id: string;
  season_year: number;
  week: number;
  sleeper_matchup_id: number;
  fantasy_team_id: string;
  team_name: string;
  opponent_fantasy_team_id: string | null;
  opponent_team_name: string | null;
  points_for: number;
  points_against: number;
  point_differential: number;
  starters_points: number;
  bench_points: number;
  result: "W" | "L" | "T" | string;
  is_winner: boolean;
  is_tie: boolean;
};

export type AwardsWeekOption = {
  seasonYear: number;
  week: number;
  teamResults: number;
  matchupCount: number;
  isComplete: boolean;
};

export type AwardsPageData = {
  weekOptions: AwardsWeekOption[];
  seasons: number[];
  selectedOption: AwardsWeekOption | null;
  selectedSeasonOptions: AwardsWeekOption[];
  results: WeeklyTeamResult[];
};

export type AwardsPageSelection = {
  season?: string | number | null;
  week?: string | number | null;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(
  value: string | number | null | undefined
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function getAvailableSeasons(
  weekOptions: AwardsWeekOption[]
): number[] {
  return Array.from(
    new Set(
      weekOptions.map(
        (option) => option.seasonYear
      )
    )
  ).sort((first, second) => second - first);
}

function normalizeResult(
  row: Record<string, unknown>
): WeeklyTeamResult {
  return {
    matchup_id: String(row.matchup_id ?? ""),
    season_year: toNumber(row.season_year),
    week: toNumber(row.week),
    sleeper_matchup_id: toNumber(
      row.sleeper_matchup_id
    ),
    fantasy_team_id: String(
      row.fantasy_team_id ?? ""
    ),
    team_name:
      String(row.team_name ?? "").trim() ||
      "Unknown Team",
    opponent_fantasy_team_id:
      typeof row.opponent_fantasy_team_id ===
      "string"
        ? row.opponent_fantasy_team_id
        : null,
    opponent_team_name:
      typeof row.opponent_team_name === "string"
        ? row.opponent_team_name.trim()
        : null,
    points_for: toNumber(row.points_for),
    points_against: toNumber(row.points_against),
    point_differential: toNumber(
      row.point_differential
    ),
    starters_points: toNumber(
      row.starters_points
    ),
    bench_points: toNumber(row.bench_points),
    result: String(row.result ?? ""),
    is_winner: Boolean(row.is_winner),
    is_tie: Boolean(row.is_tie),
  };
}

export async function getAwardsWeekOptions(): Promise<
  AwardsWeekOption[]
> {
  const { data, error } = await supabase
    .from("team_weekly_results")
    .select(
      `
        season_year,
        week,
        matchup_id
      `
    )
    .order("season_year", {
      ascending: false,
    })
    .order("week", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Unable to load Awards weeks: ${error.message}`
    );
  }

  const grouped = new Map<
    string,
    {
      seasonYear: number;
      week: number;
      teamResults: number;
      matchupIds: Set<string>;
    }
  >();

  for (const row of data ?? []) {
    const seasonYear = toNumber(row.season_year);
    const week = toNumber(row.week);
    const key = `${seasonYear}-${week}`;

    const existing = grouped.get(key) ?? {
      seasonYear,
      week,
      teamResults: 0,
      matchupIds: new Set<string>(),
    };

    existing.teamResults += 1;

    if (row.matchup_id) {
      existing.matchupIds.add(
        String(row.matchup_id)
      );
    }

    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      seasonYear: group.seasonYear,
      week: group.week,
      teamResults: group.teamResults,
      matchupCount: group.matchupIds.size,
      isComplete: group.teamResults >= 10,
    }))
    .sort((first, second) => {
      if (
        first.seasonYear !== second.seasonYear
      ) {
        return (
          second.seasonYear -
          first.seasonYear
        );
      }

      return second.week - first.week;
    });

    console.log("Awards week query", {
  data,
  error,
});
}

export async function getWeeklyAwardsResults(
  seasonYear: number,
  week: number
): Promise<WeeklyTeamResult[]> {
  const { data, error } = await supabase
    .from("team_weekly_results")
    .select(
      `
        matchup_id,
        season_year,
        week,
        sleeper_matchup_id,
        fantasy_team_id,
        team_name,
        opponent_fantasy_team_id,
        opponent_team_name,
        points_for,
        points_against,
        point_differential,
        starters_points,
        bench_points,
        result,
        is_winner,
        is_tie
      `
    )
    .eq("season_year", seasonYear)
    .eq("week", week)
    .order("sleeper_matchup_id", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Unable to load weekly Awards data: ${error.message}`
    );
  }

  return (data ?? []).map((row) =>
    normalizeResult(
      row as Record<string, unknown>
    )
  );
}

export async function getAwardsPageData(
  selection: AwardsPageSelection = {}
): Promise<AwardsPageData> {
  const weekOptions =
    await getAwardsWeekOptions();

  const seasons =
    getAvailableSeasons(weekOptions);

  const requestedSeason =
    toOptionalNumber(selection.season);

  const requestedWeek =
    toOptionalNumber(selection.week);

  const requestedOption =
    requestedSeason !== null &&
    requestedWeek !== null
      ? weekOptions.find(
          (option) =>
            option.seasonYear ===
              requestedSeason &&
            option.week === requestedWeek
        ) ?? null
      : null;

  /*
   * When a season is provided without a week,
   * default to the latest complete week from
   * that season.
   */
  const requestedSeasonDefault =
    requestedSeason !== null
      ? weekOptions.find(
          (option) =>
            option.seasonYear ===
              requestedSeason &&
            option.isComplete
        ) ??
        weekOptions.find(
          (option) =>
            option.seasonYear ===
            requestedSeason
        ) ??
        null
      : null;

  /*
   * Default behavior:
   * 1. Exact requested season/week
   * 2. Latest complete week in requested season
   * 3. Latest available week in requested season
   * 4. Latest complete week overall
   * 5. Latest week overall
   */
  const selectedOption =
    requestedOption ??
    requestedSeasonDefault ??
    weekOptions.find(
      (option) => option.isComplete
    ) ??
    weekOptions[0] ??
    null;

  const selectedSeasonOptions =
    selectedOption
      ? weekOptions.filter(
          (option) =>
            option.seasonYear ===
            selectedOption.seasonYear
        )
      : [];

  const results = selectedOption
    ? await getWeeklyAwardsResults(
        selectedOption.seasonYear,
        selectedOption.week
      )
    : [];

  return {
    weekOptions,
    seasons,
    selectedOption,
    selectedSeasonOptions,
    results,
  };
}