import { supabase } from "../supabase";

export type GazetteRankingEntry = {
  teamId: string;
  teamName: string;
  rank: number;
  previousRank: number | null;
  record: string;
  pointsFor: number;
  note: string;
};

export type PublishedPowerRanking = {
  seasonYear: number;
  week: number;
  title: string;
  entries: GazetteRankingEntry[];
};

export async function getLatestPublishedPowerRanking(): Promise<PublishedPowerRanking | null> {
  const db = supabase as any;
  const { data, error } = await db
    .from("power_rankings")
    .select("season_year,week,title,entries")
    .eq("status", "ready")
    .order("season_year", { ascending: false })
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load the Gazette Poll: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const entries = Array.isArray(data.entries)
    ? (data.entries as GazetteRankingEntry[])
        .filter((entry) => entry && Number.isFinite(Number(entry.rank)))
        .sort((first, second) => Number(first.rank) - Number(second.rank))
    : [];

  return {
    seasonYear: Number(data.season_year),
    week: Number(data.week),
    title: String(data.title ?? `Week ${data.week} Gazette Poll`),
    entries,
  };
}
