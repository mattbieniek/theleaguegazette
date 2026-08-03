import { supabase } from "../supabase";

export type PlayerWeeklyScore = {
  season_year: number;
  week: number;
  sleeper_player_id: string;
  player_name: string;
  position: string;
  nfl_team: string | null;
  points: number;
};

export type LineupEntry = PlayerWeeklyScore & { slot: string };

export async function getPlayerWeeklyScores(season?: number): Promise<PlayerWeeklyScore[]> {
  const db = supabase as any;
  const rows: PlayerWeeklyScore[] = [];
  for (let start = 0; ; start += 1000) {
    let query = db.from("player_weekly_scores").select("season_year,week,sleeper_player_id,player_name,position,nfl_team,points").order("week").order("points", { ascending: false }).range(start, start + 999);
    if (season) query = query.eq("season_year", season);
    const { data, error } = await query;
    if (error) throw new Error(`Unable to load player scores: ${error.message}`);
    rows.push(...(data ?? []).map((row: PlayerWeeklyScore) => ({ ...row, points: Number(row.points ?? 0) })));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}

function take(scores: PlayerWeeklyScore[], position: string, count: number, used?: Set<string>): PlayerWeeklyScore[] {
  return scores.filter((score) => score.position === position && !used?.has(score.sleeper_player_id)).slice(0, count);
}

export function buildPerfectLineup(scores: PlayerWeeklyScore[]): LineupEntry[] {
  const sorted = [...scores].sort((a, b) => b.points - a.points);
  const used = new Set<string>();
  const lineup: LineupEntry[] = [];
  const add = (slot: string, candidates: PlayerWeeklyScore[]) => candidates.forEach((score, index) => { used.add(score.sleeper_player_id); lineup.push({ ...score, slot: candidates.length > 1 ? `${slot}${index + 1}` : slot }); });
  add("QB", take(sorted, "QB", 1, used));
  add("RB", take(sorted, "RB", 2, used));
  add("WR", take(sorted, "WR", 2, used));
  add("TE", take(sorted, "TE", 1, used));
  add("FLEX", sorted.filter((score) => ["RB", "WR", "TE"].includes(score.position) && !used.has(score.sleeper_player_id)).slice(0, 2));
  add("K", take(sorted, "K", 1, used));
  add("DEF", take(sorted, "DEF", 1, used));
  return lineup;
}

export function buildSeasonSlotRecords(scores: PlayerWeeklyScore[]): LineupEntry[] {
  const sorted = [...scores].sort((a, b) => b.points - a.points);
  const slots: Array<[string, string[], number]> = [
    ["QB", ["QB"], 1], ["RB", ["RB"], 2], ["WR", ["WR"], 2], ["TE", ["TE"], 1],
    ["FLEX", ["RB", "WR", "TE"], 2], ["K", ["K"], 1], ["DEF", ["DEF"], 1],
  ];
  return slots.flatMap(([slot, positions, count]) => sorted.filter((score) => positions.includes(score.position)).slice(0, count).map((score, index) => ({ ...score, slot: count > 1 ? `${slot}${index + 1}` : slot })));
}
