import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlainTextFromBody } from "./gazette/articleBody";
import type { Database, Json } from "../types/database";

export type ExportFormat = "xlsx" | "csv" | "json";
export type ExportDatasetKey =
  | "articles"
  | "standings"
  | "weekly_results"
  | "weekly_standings"
  | "teams"
  | "draft_picks"
  | "transactions"
  | "transaction_assets"
  | "player_scores";

export type ExportRow = Record<string, string | number | boolean | null>;

export type ExportDatasetDefinition = {
  key: ExportDatasetKey;
  label: string;
  description: string;
  filename: string;
  seasonFilter: boolean;
  columns: string[];
};

export const exportDatasets: ExportDatasetDefinition[] = [
  {
    key: "articles",
    label: "Published articles",
    description: "Published Gazette stories with headlines, summaries, authors, and article text.",
    filename: "gazette-articles",
    seasonFilter: false,
    columns: ["id", "slug", "category", "headline", "summary", "author_name", "published_at", "article_text", "image_url", "image_alt", "is_featured", "homepage_order", "created_at", "updated_at"],
  },
  {
    key: "standings",
    label: "Season standings",
    description: "Final calculated standings for each season, including records and scoring totals.",
    filename: "season-standings",
    seasonFilter: true,
    columns: ["season_year", "standings_rank", "team_name", "sleeper_roster_id", "games_played", "wins", "losses", "ties", "winning_percentage", "points_for", "points_against", "point_differential", "average_points", "highest_score", "lowest_score"],
  },
  {
    key: "weekly_results",
    label: "Weekly matchup results",
    description: "One row per team in every completed matchup, with opponents, results, and margins.",
    filename: "weekly-matchup-results",
    seasonFilter: true,
    columns: ["season_year", "week", "team_name", "sleeper_roster_id", "opponent_team_name", "opponent_sleeper_roster_id", "points_for", "points_against", "point_differential", "result", "starters_points", "bench_points", "sleeper_matchup_id"],
  },
  {
    key: "weekly_standings",
    label: "Weekly standings",
    description: "Cumulative standings after each completed week of a season.",
    filename: "weekly-standings",
    seasonFilter: true,
    columns: ["season_year", "week", "standings_rank", "team_name", "sleeper_roster_id", "games_played", "wins", "losses", "ties", "winning_percentage", "points_for", "points_against", "point_differential", "average_points", "highest_score", "lowest_score"],
  },
  {
    key: "teams",
    label: "Teams and records",
    description: "Fantasy-team identities, records, and sync timestamps by season.",
    filename: "teams-and-managers",
    seasonFilter: true,
    columns: ["season_year", "team_name", "sleeper_roster_id", "wins", "losses", "ties", "points_for", "points_against", "last_synced_at"],
  },
  {
    key: "draft_picks",
    label: "Draft picks",
    description: "Draft-by-draft pick history, player details, roster slots, and keepers.",
    filename: "draft-picks",
    seasonFilter: true,
    columns: ["season_year", "draft_name", "provider", "provider_draft_id", "pick_number", "round", "round_pick", "draft_slot", "roster_id", "team_name", "player_name", "player_provider_id", "position", "pro_team", "is_keeper"],
  },
  {
    key: "transactions",
    label: "Transactions",
    description: "Completed transaction headers, including week, type, FAAB, and timestamps.",
    filename: "transactions",
    seasonFilter: true,
    columns: ["season_year", "week", "transaction_type", "status", "provider", "provider_transaction_id", "creator_provider_id", "faab_bid", "occurred_at", "processed_at"],
  },
  {
    key: "transaction_assets",
    label: "Transaction assets",
    description: "Players, draft picks, FAAB, and team movements attached to completed transactions.",
    filename: "transaction-assets",
    seasonFilter: true,
    columns: ["season_year", "week", "transaction_type", "occurred_at", "asset_type", "movement_type", "player_name", "position", "pro_team", "from_team_name", "to_team_name", "draft_season", "draft_round", "amount"],
  },
  {
    key: "player_scores",
    label: "Weekly player scores",
    description: "Stored player scoring totals by season, week, position, and NFL team.",
    filename: "weekly-player-scores",
    seasonFilter: true,
    columns: ["season_year", "week", "player_name", "position", "nfl_team", "sleeper_player_id", "points"],
  },
];

type ExportClient = SupabaseClient<Database>;

function definitionFor(key: string): ExportDatasetDefinition {
  const definition = exportDatasets.find((item) => item.key === key);
  if (!definition) throw new Error("That dataset is not available for export.");
  return definition;
}

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const maxRows = 50_000;
  const rows: T[] = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }

  throw new Error("This export is larger than the 50,000-row limit. Narrow the season or dataset and try again.");
}

function jsonText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function articleText(body: Json | null): string | null {
  if (!body) return null;
  try {
    return getPlainTextFromBody(body as never) || null;
  } catch {
    return jsonText(body);
  }
}

function relationOne(value: unknown): Record<string, any> {
  if (Array.isArray(value)) return (value[0] ?? {}) as Record<string, any>;
  return (value ?? {}) as Record<string, any>;
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function shapeRows(definition: ExportDatasetDefinition, rows: ExportRow[]): ExportRow[] {
  return rows.map((row) => Object.fromEntries(
    definition.columns.map((column) => [column, row[column] ?? null]),
  ));
}

export async function getExportRows(
  client: ExportClient,
  key: ExportDatasetKey,
  season?: number,
): Promise<{ definition: ExportDatasetDefinition; rows: ExportRow[] }> {
  const definition = definitionFor(key);
  if (season !== undefined && !definition.seasonFilter) {
    throw new Error("This dataset is not split by season.");
  }

  let rows: ExportRow[];

  switch (key) {
    case "articles": {
      const data = await fetchAll<any>((from, to) => client
        .from("public_gazette_articles")
        .select("id,slug,category,headline,summary,author_name,published_at,body,image_url,image_alt,is_featured,homepage_order,created_at,updated_at")
        .order("published_at", { ascending: false, nullsFirst: false })
        .range(from, to));
      rows = data.map((row) => ({ ...row, article_text: articleText(row.body) }));
      break;
    }
    case "standings": {
      const data = await fetchAll<any>((from, to) => {
        let query = client.from("season_standings").select("season_year,standings_rank,team_name,sleeper_roster_id,games_played,wins,losses,ties,winning_percentage,points_for,points_against,point_differential,average_points,highest_score,lowest_score");
        if (season !== undefined) query = query.eq("season_year", season);
        return query.order("season_year", { ascending: false }).order("standings_rank").range(from, to);
      });
      rows = data;
      break;
    }
    case "weekly_results": {
      const data = await fetchAll<any>((from, to) => {
        let query = client.from("team_weekly_results").select("season_year,week,team_name,sleeper_roster_id,opponent_team_name,opponent_sleeper_roster_id,points_for,points_against,point_differential,result,starters_points,bench_points,sleeper_matchup_id");
        if (season !== undefined) query = query.eq("season_year", season);
        return query.order("season_year", { ascending: false }).order("week", { ascending: false }).range(from, to);
      });
      rows = data;
      break;
    }
    case "weekly_standings": {
      const data = await fetchAll<any>((from, to) => {
        let query = client.from("weekly_standings").select("season_year,week,standings_rank,team_name,sleeper_roster_id,games_played,wins,losses,ties,winning_percentage,points_for,points_against,point_differential,average_points,highest_score,lowest_score");
        if (season !== undefined) query = query.eq("season_year", season);
        return query.order("season_year", { ascending: false }).order("week", { ascending: false }).order("standings_rank").range(from, to);
      });
      rows = data;
      break;
    }
    case "teams": {
      const data = await fetchAll<any>((from, to) => {
        let query = client.from("fantasy_teams").select("team_name,sleeper_roster_id,wins,losses,ties,points_for,points_against,last_synced_at,seasons!inner(year)");
        if (season !== undefined) query = query.eq("seasons.year", season);
        return query.order("sleeper_roster_id").range(from, to);
      });
      rows = data.map((row) => {
        const seasonRow = relationOne(row.seasons);
        return {
          season_year: numberOrNull(seasonRow.year),
          team_name: row.team_name,
          sleeper_roster_id: row.sleeper_roster_id,
          wins: row.wins,
          losses: row.losses,
          ties: row.ties,
          points_for: row.points_for,
          points_against: row.points_against,
          last_synced_at: row.last_synced_at,
        };
      });
      break;
    }
    case "draft_picks": {
      const data = await fetchAll<any>((from, to) => {
        let query = client.from("draft_picks").select("pick_number,round,round_pick,draft_slot,roster_id,player_provider_id,player_name,position,pro_team,is_keeper,drafts!inner(season_year,name,provider,provider_draft_id),fantasy_teams(team_name)");
        if (season !== undefined) query = query.eq("drafts.season_year", season);
        return query.order("pick_number").range(from, to);
      });
      rows = data.map((row) => {
        const draft = relationOne(row.drafts);
        const team = relationOne(row.fantasy_teams);
        return {
          season_year: draft.season_year,
          draft_name: draft.name,
          provider: draft.provider,
          provider_draft_id: draft.provider_draft_id,
          pick_number: row.pick_number,
          round: row.round,
          round_pick: row.round_pick,
          draft_slot: row.draft_slot,
          roster_id: row.roster_id,
          team_name: team.team_name ?? null,
          player_name: row.player_name,
          player_provider_id: row.player_provider_id,
          position: row.position,
          pro_team: row.pro_team,
          is_keeper: row.is_keeper,
        };
      });
      break;
    }
    case "transactions": {
      const data = await fetchAll<any>((from, to) => {
        let query = client.from("league_transactions").select("season_year,week,transaction_type,status,provider,provider_transaction_id,creator_provider_id,faab_bid,occurred_at,processed_at").eq("status", "complete");
        if (season !== undefined) query = query.eq("season_year", season);
        return query.order("season_year", { ascending: false }).order("week", { ascending: false }).order("occurred_at", { ascending: false, nullsFirst: false }).range(from, to);
      });
      rows = data;
      break;
    }
    case "transaction_assets": {
      const data = await fetchAll<any>((from, to) => {
        let query = client.from("transaction_assets").select("asset_type,movement_type,player_name,position,pro_team,draft_season,draft_round,amount,from_team:fantasy_teams!transaction_assets_from_fantasy_team_id_fkey(team_name),to_team:fantasy_teams!transaction_assets_to_fantasy_team_id_fkey(team_name),league_transactions!inner(season_year,week,transaction_type,status,occurred_at)").eq("league_transactions.status", "complete");
        if (season !== undefined) query = query.eq("league_transactions.season_year", season);
        return query
          .order("season_year", { referencedTable: "league_transactions", ascending: false })
          .order("week", { referencedTable: "league_transactions", ascending: false })
          .range(from, to);
      });
      rows = data.map((row) => {
        const transaction = relationOne(row.league_transactions);
        const fromTeam = relationOne(row.from_team);
        const toTeam = relationOne(row.to_team);
        return {
          season_year: transaction.season_year,
          week: transaction.week,
          transaction_type: transaction.transaction_type,
          occurred_at: transaction.occurred_at,
          asset_type: row.asset_type,
          movement_type: row.movement_type,
          player_name: row.player_name,
          position: row.position,
          pro_team: row.pro_team,
          from_team_name: fromTeam.team_name ?? null,
          to_team_name: toTeam.team_name ?? null,
          draft_season: row.draft_season,
          draft_round: row.draft_round,
          amount: row.amount,
        };
      });
      break;
    }
    case "player_scores": {
      const data = await fetchAll<any>((from, to) => {
        let query = client.from("player_weekly_scores").select("season_year,week,player_name,position,nfl_team,sleeper_player_id,points");
        if (season !== undefined) query = query.eq("season_year", season);
        return query.order("season_year", { ascending: false }).order("week", { ascending: false }).order("points", { ascending: false }).range(from, to);
      });
      rows = data;
      break;
    }
  }

  return { definition, rows: shapeRows(definition, rows) };
}

export async function getExportSeasons(client: ExportClient): Promise<number[]> {
  const { data, error } = await client
    .from("seasons")
    .select("year")
    .order("year", { ascending: false });
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => Number(row.year)).filter(Number.isInteger))];
}
