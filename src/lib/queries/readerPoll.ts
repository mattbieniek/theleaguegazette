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
  isOpen: boolean;
  closesAt: string | null;
};

export async function getLatestReaderPollPreview(): Promise<ReaderPollPreview | null> {
  const db = supabase as any;
  const { data: openWindow } = await db
    .from("reader_poll_windows")
    .select("season_year,week,is_open,closes_at")
    .eq("is_open", true)
    .order("season_year", { ascending: false })
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openWindow && (!openWindow.closes_at || new Date(openWindow.closes_at) > new Date())) {
    return {
      season: Number(openWindow.season_year),
      week: Number(openWindow.week),
      ballotCount: 0,
      leaders: [],
      isOpen: true,
      closesAt: String(openWindow.closes_at ?? "") || null,
    };
  }

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

  const { data: latestWindow } = await db
    .from("reader_poll_windows")
    .select("is_open,closes_at")
    .eq("season_year", latest.season_year)
    .eq("week", latest.week)
    .maybeSingle();
  const latestIsOpen = latestWindow
    ? Boolean(latestWindow.is_open) && (!latestWindow.closes_at || new Date(latestWindow.closes_at) > new Date())
    : true;
  if (latestIsOpen) {
    return {
      season: Number(latest.season_year),
      week: Number(latest.week),
      ballotCount: 0,
      leaders: [],
      isOpen: true,
      closesAt: latestWindow?.closes_at ? String(latestWindow.closes_at) : null,
    };
  }

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
    isOpen: false,
    closesAt: latestWindow?.closes_at ? String(latestWindow.closes_at) : null,
  };
}
