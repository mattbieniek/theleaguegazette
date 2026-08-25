import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  activeSeasonYear,
  activeSleeperLeagueId,
  assertActiveLeague,
  type SleeperLeagueSummary,
} from "../_shared/activeLeague.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-cron-secret",
  "Content-Type": "application/json",
};

type SyncMode = "hourly" | "operations" | "daily" | "weekly-finalize";

type SleeperState = {
  week?: number;
  display_week?: number;
  league_season?: string | number;
  season?: string | number;
  season_type?: string;
};

type ChildResult = {
  functionName: string;
  success: boolean;
  status: number;
  message?: string;
  error?: string;
  recordsProcessed?: number;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: corsHeaders,
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function asRecordsProcessed(value: unknown): number {
  if (typeof value !== "object" || value === null) return 0;
  const record = value as Record<string, unknown>;
  for (const key of [
    "records_processed",
    "players_imported",
    "records_imported",
    "matchups_imported",
    "transactions_imported",
    "snapshots_imported",
  ]) {
    const number = Number(record[key]);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function messageFrom(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  if (typeof record.error === "object" && record.error !== null) {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
  }
  return undefined;
}

function requestedMode(request: Request): SyncMode {
  const value = new URL(request.url).searchParams.get("mode");
  if (value === "hourly" || value === "operations" || value === "daily" || value === "weekly-finalize") {
    return value;
  }
  return "hourly";
}

function isAuthorized(request: Request, expectedSecret: string): boolean {
  const provided = request.headers.get("x-sync-cron-secret")?.trim();
  return Boolean(expectedSecret && provided && provided === expectedSecret);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Sleeper returned ${response.status} for ${url}.`);
  }
  return await response.json() as T;
}

async function invokeChild(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string,
  body: Record<string, unknown> = {},
): Promise<ChildResult> {
  const endpoint = `${supabaseUrl}/functions/v1/${functionName}`;
  let lastError = "Unknown sync error";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      const success = response.ok && payload?.success !== false;
      if (success) {
        return {
          functionName,
          success: true,
          status: response.status,
          message: messageFrom(payload),
          recordsProcessed: asRecordsProcessed(payload),
        };
      }
      lastError = messageFrom(payload) ?? `HTTP ${response.status}`;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1_000 * attempt);
  }

  return {
    functionName,
    success: false,
    status: 500,
    error: lastError,
  };
}

async function recordRun(
  supabase: ReturnType<typeof createClient>,
  status: "running" | "success" | "failed",
  runId: string | null,
  details: Record<string, unknown>,
  errorMessage?: string,
): Promise<string | null> {
  if (!runId) {
    const { data } = await supabase
      .from("sync_runs")
      .insert({
        sync_type: "sleeper_automation",
        sleeper_league_id: activeSleeperLeagueId(),
        status,
        details,
        error_message: errorMessage ?? null,
        completed_at: status === "running" ? null : new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    return data?.id ?? null;
  }

  await supabase
    .from("sync_runs")
    .update({
      status,
      details,
      error_message: errorMessage ?? null,
      completed_at: status === "running" ? null : new Date().toISOString(),
      records_processed: Number(details.recordsProcessed ?? 0),
    })
    .eq("id", runId);
  return runId;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "Use POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("SYNC_CRON_SECRET")?.trim() ?? "";
  if (!supabaseUrl || !serviceRoleKey || !cronSecret) {
    return jsonResponse({ success: false, error: "Automation environment is not configured." }, 500);
  }
  if (!isAuthorized(request, cronSecret)) {
    return jsonResponse({ success: false, error: "Automation authentication failed." }, 401);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const mode = requestedMode(request);
  const leagueId = activeSleeperLeagueId();
  const seasonYear = activeSeasonYear();
  let runId: string | null = null;
  const results: ChildResult[] = [];
  let recordsProcessed = 0;

  try {
    const league = await fetchJson<SleeperLeagueSummary>(
      `https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}`,
    );
    assertActiveLeague(leagueId, league);

    const state = await fetchJson<SleeperState>(
      "https://api.sleeper.app/v1/state/nfl",
    );
    const stateSeason = Number(state.league_season ?? state.season);
    if (Number.isInteger(stateSeason) && stateSeason !== seasonYear) {
      throw new Error(`Sleeper state is on season ${stateSeason}; active season is ${seasonYear}.`);
    }
    const currentWeek = Math.max(
      1,
      Math.min(18, Number(state.display_week ?? state.week ?? league.current_week ?? 1)),
    );
    const completedWeek = currentWeek - 1;
    const hasRegularSeasonGames =
      state.season_type === "regular" || state.season_type === "post";

    runId = await recordRun(db, "running", null, {
      mode,
      seasonYear,
      currentWeek,
      leagueStatus: league.status ?? null,
      seasonType: state.season_type ?? null,
      recordsProcessed: 0,
    });

    const call = async (functionName: string, body: Record<string, unknown> = {}) => {
      const result = await invokeChild(supabaseUrl, serviceRoleKey, functionName, body);
      results.push(result);
      recordsProcessed += result.recordsProcessed ?? 0;
      await sleep(500);
      if (!result.success) throw new Error(`${functionName}: ${result.error ?? "sync failed"}`);
    };

    // This call is intentionally body-less so sync-sleeper-league applies its
    // active-season guard rather than accepting an arbitrary historical ID.
    await call("sync-sleeper-league");
    const { error: weekUpdateError } = await db
      .from("leagues")
      .update({ current_week: currentWeek })
      .eq("sleeper_league_id", leagueId);
    if (weekUpdateError) throw new Error(`Could not record current week: ${weekUpdateError.message}`);

    if (mode === "daily") {
      await call("sync-sleeper-players");
      await call("sync-sleeper-users", { sleeper_league_id: leagueId });
      await call("sync-sleeper-rosters", { sleeper_league_id: leagueId });
      await call("sync-sleeper-drafts", { sleeper_league_id: leagueId });
    } else if (mode === "operations") {
      await call("sync-sleeper-players");
      await call("sync-sleeper-users", { sleeper_league_id: leagueId });
      await call("sync-sleeper-rosters", { sleeper_league_id: leagueId });
      await call("sync-sleeper-transactions", {
        sleeper_league_id: leagueId,
        // Sleeper assigns post-draft preseason moves to Week 1 even while
        // its NFL state advances through preseason display weeks.
        start_week: hasRegularSeasonGames ? currentWeek : 1,
        end_week: currentWeek,
      });
    } else if (mode === "weekly-finalize") {
      if (hasRegularSeasonGames && completedWeek >= 1) {
        await call("sync-sleeper-matchups", {
          sleeper_league_id: leagueId,
          week: completedWeek,
          status: "complete",
        });
        await call("sync-sleeper-player-scores", {
          sleeper_league_id: leagueId,
          start_week: completedWeek,
          end_week: completedWeek,
        });
        await call("sync-sleeper-transactions", {
          sleeper_league_id: leagueId,
          start_week: completedWeek,
          end_week: completedWeek,
        });
        await call("sync-sleeper-roster-snapshots", {
          sleeper_league_id: leagueId,
          week: completedWeek,
          overwrite: false,
        });
      }
    } else if (mode === "hourly") {
      const hasMatchups = hasRegularSeasonGames &&
        (league.status === "in_season" || league.status === "complete");
      if (hasMatchups) {
        await call("sync-sleeper-matchups", {
          sleeper_league_id: leagueId,
          week: currentWeek,
          status: league.status === "complete" ? "complete" : "live",
        });
        await call("sync-sleeper-player-scores", {
          sleeper_league_id: leagueId,
          start_week: currentWeek,
          end_week: currentWeek,
        });
      }
    }

    await recordRun(db, "success", runId, {
      mode,
      seasonYear,
      currentWeek,
      recordsProcessed,
      results,
    });
    return jsonResponse({ success: true, mode, seasonYear, currentWeek, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordRun(db, "failed", runId, {
      mode,
      seasonYear,
      recordsProcessed,
      results,
    }, message);
    return jsonResponse({ success: false, mode, seasonYear, error: message, results }, 500);
  }
});
