import { supabase } from "../supabase";

export type ReaderPollLeader = {
  rank: number;
  teamName: string;
  points: number;
  firstPlaceVotes: number;
};

export type ReaderPollPreview = {
  season: number;
  week: number;
  ballotCount: number;
  leaders: ReaderPollLeader[];
};

export async function getLatestReaderPollPreview(): Promise<ReaderPollPreview | null> {
  const db = supabase as any;
  const { data: latest, error: latestError } = await db
    .from("reader_power_ballots")
    .select("season_year,week")
    .order("season_year", { ascending: false })
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The Gazette must remain available while the reader-account migration is
  // being deployed or before the first ballot is submitted.
  if (latestError || !latest) return null;

  const { data: ballots, error } = await db
    .from("reader_power_ballots")
    .select("rankings")
    .eq("season_year", latest.season_year)
    .eq("week", latest.week);

  if (error || !ballots?.length) return null;

  const totals = new Map<string, { teamName: string; points: number; firstPlaceVotes: number }>();
  for (const ballot of ballots) {
    for (const entry of Array.isArray(ballot.rankings) ? ballot.rankings : []) {
      const teamId = String(entry.teamId ?? "");
      if (!teamId) continue;
      const current = totals.get(teamId) ?? { teamName: String(entry.teamName ?? "Unknown team"), points: 0, firstPlaceVotes: 0 };
      current.points += 11 - Number(entry.rank);
      if (Number(entry.rank) === 1) current.firstPlaceVotes += 1;
      totals.set(teamId, current);
    }
  }

  const leaders = [...totals.values()]
    .sort((first, second) => second.points - first.points || second.firstPlaceVotes - first.firstPlaceVotes)
    .slice(0, 5)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return {
    season: Number(latest.season_year),
    week: Number(latest.week),
    ballotCount: ballots.length,
    leaders,
  };
}
