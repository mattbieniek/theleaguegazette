import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";

const DEFAULT_SLEEPER_LEAGUE_ID = "1257085409687506944";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SnapshotRequest = {
  week?: number;
  sleeper_league_id?: string;
  overwrite?: boolean;
};

type FantasyTeam = {
  id: string;
  league_id: string;
  sleeper_roster_id: number;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  points_for: number | null;
  points_against: number | null;
  waiver_position: number | null;
  waiver_budget_used: number | null;
  settings: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  raw_data: Record<string, unknown> | null;
};

type RosterPlayer = {
  fantasy_team_id: string;
  sleeper_player_id: string;
  is_starter: boolean;
  is_reserve: boolean;
  is_taxi: boolean;
};

type SnapshotRow = {
  id: string;
  fantasy_team_id: string;
};

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return error as Record<string, unknown>;
  }

  return {
    message: String(error),
  };
}

function validateWeek(value: unknown): number {
  const week = Number(value);

  if (!Number.isInteger(week) || week < 1 || week > 18) {
    throw new Error(
      "week must be a whole number between 1 and 18.",
    );
  }

  return week;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: {
          message: "Method not allowed. Use POST.",
        },
      },
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        success: false,
        error: {
          message:
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
        },
      },
      500,
    );
  }

  await requireAdmin(req, supabaseUrl, serviceRoleKey);

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  let syncRunId: string | null = null;

  try {
    let body: SnapshotRequest;

    try {
      body = await req.json();
    } catch {
      throw new Error(
        "Request body must contain valid JSON.",
      );
    }

    const week = validateWeek(body.week);

    const sleeperLeagueId =
      body.sleeper_league_id?.trim() ||
      DEFAULT_SLEEPER_LEAGUE_ID;

    const overwrite = body.overwrite === true;
    const startedAt = new Date().toISOString();

    /*
     * Create a sync log entry.
     *
     * Logging failure is nonfatal so that a constraint mismatch in
     * sync_runs does not prevent the snapshot itself.
     */
    const { data: syncRun, error: syncRunInsertError } =
      await supabase
        .from("sync_runs")
        .insert({
          sync_type: "roster_snapshots",
          sleeper_league_id: sleeperLeagueId,
          status: "running",
          records_processed: 0,
          started_at: startedAt,
          details: {
            function_name:
              "sync-sleeper-roster-snapshots",
            week,
            overwrite,
          },
        })
        .select("id")
        .single();

    if (syncRunInsertError) {
      console.warn(
        "Could not create sync_runs row:",
        syncRunInsertError,
      );
    } else {
      syncRunId = syncRun.id;
    }

    /*
     * Find the internal league UUID.
     */
    const { data: league, error: leagueError } =
      await supabase
        .from("leagues")
        .select("id, name, sleeper_league_id")
        .eq("sleeper_league_id", sleeperLeagueId)
        .single();

    if (leagueError) {
      throw leagueError;
    }

    if (!league) {
      throw new Error(
        `League ${sleeperLeagueId} was not found.`,
      );
    }

    /*
     * Load every fantasy team in this league.
     */
    const { data: fantasyTeamData, error: teamsError } =
      await supabase
        .from("fantasy_teams")
        .select(`
          id,
          league_id,
          sleeper_roster_id,
          wins,
          losses,
          ties,
          points_for,
          points_against,
          waiver_position,
          waiver_budget_used,
          settings,
          metadata,
          raw_data
        `)
        .eq("league_id", league.id);

    if (teamsError) {
      throw teamsError;
    }

    const fantasyTeams =
      (fantasyTeamData ?? []) as FantasyTeam[];

    if (fantasyTeams.length === 0) {
      throw new Error(
        "No fantasy teams were found. Run sync-sleeper-rosters first.",
      );
    }

    const fantasyTeamIds = fantasyTeams.map(
      (team) => team.id,
    );

    /*
     * Load the current players assigned to those teams.
     */
    const { data: rosterPlayerData, error: playersError } =
      await supabase
        .from("roster_players")
        .select(`
          fantasy_team_id,
          sleeper_player_id,
          is_starter,
          is_reserve,
          is_taxi
        `)
        .in("fantasy_team_id", fantasyTeamIds);

    if (playersError) {
      throw playersError;
    }

    const rosterPlayers =
      (rosterPlayerData ?? []) as RosterPlayer[];

    /*
     * Check whether snapshots already exist.
     */
    const { data: existingSnapshotData, error: existingError } =
      await supabase
        .from("roster_snapshots")
        .select("id, fantasy_team_id")
        .eq("week", week)
        .in("fantasy_team_id", fantasyTeamIds);

    if (existingError) {
      throw existingError;
    }

    const existingSnapshots =
      (existingSnapshotData ?? []) as SnapshotRow[];

    if (existingSnapshots.length > 0 && !overwrite) {
      return jsonResponse(
        {
          success: false,
          error: {
            message:
              `Snapshots already exist for week ${week}. ` +
              `Send "overwrite": true to replace them.`,
          },
          existing_snapshot_count:
            existingSnapshots.length,
          week,
        },
        409,
      );
    }

    /*
     * If overwrite was requested, delete the old snapshots.
     *
     * roster_snapshot_players will be deleted automatically
     * because of ON DELETE CASCADE.
     */
    if (overwrite && existingSnapshots.length > 0) {
      const existingSnapshotIds = existingSnapshots.map(
        (snapshot) => snapshot.id,
      );

      const { error: deleteError } = await supabase
        .from("roster_snapshots")
        .delete()
        .in("id", existingSnapshotIds);

      if (deleteError) {
        throw deleteError;
      }
    }

    /*
     * Create one snapshot row per fantasy team.
     */
    const snapshotRecords = fantasyTeams.map((team) => ({
      fantasy_team_id: team.id,
      week,
      wins: team.wins ?? 0,
      losses: team.losses ?? 0,
      ties: team.ties ?? 0,
      points_for: team.points_for,
      points_against: team.points_against,
      waiver_position: team.waiver_position,
      waiver_budget_used: team.waiver_budget_used,
      settings: team.settings ?? {},
      metadata: {
        ...(team.metadata ?? {}),
        snapshot_source: "current_roster_tables",
        snapshot_created_at: new Date().toISOString(),
      },
      raw_data: team.raw_data ?? {},
    }));

    const { data: snapshotData, error: snapshotInsertError } =
      await supabase
        .from("roster_snapshots")
        .insert(snapshotRecords)
        .select("id, fantasy_team_id");

    if (snapshotInsertError) {
      throw snapshotInsertError;
    }

    const snapshots =
      (snapshotData ?? []) as SnapshotRow[];

    if (snapshots.length !== fantasyTeams.length) {
      throw new Error(
        `Expected ${fantasyTeams.length} snapshots, ` +
          `but Supabase returned ${snapshots.length}.`,
      );
    }

    const snapshotIdByTeamId = new Map<string, string>(
      snapshots.map((snapshot) => [
        snapshot.fantasy_team_id,
        snapshot.id,
      ]),
    );

    /*
     * Copy each current roster player into the historical table.
     */
    const snapshotPlayerRecords = rosterPlayers.map(
      (player) => {
        const snapshotId = snapshotIdByTeamId.get(
          player.fantasy_team_id,
        );

        if (!snapshotId) {
          throw new Error(
            `No snapshot was created for fantasy team ` +
              `${player.fantasy_team_id}.`,
          );
        }

        return {
          roster_snapshot_id: snapshotId,
          sleeper_player_id: player.sleeper_player_id,
          is_starter: player.is_starter ?? false,
          is_reserve: player.is_reserve ?? false,
          is_taxi: player.is_taxi ?? false,
        };
      },
    );

    if (snapshotPlayerRecords.length > 0) {
      const { error: snapshotPlayersError } =
        await supabase
          .from("roster_snapshot_players")
          .insert(snapshotPlayerRecords);

      if (snapshotPlayersError) {
        /*
         * Prevent half-complete snapshots if the child insert fails.
         */
        const snapshotIds = snapshots.map(
          (snapshot) => snapshot.id,
        );

        await supabase
          .from("roster_snapshots")
          .delete()
          .in("id", snapshotIds);

        throw snapshotPlayersError;
      }
    }

    const completedAt = new Date().toISOString();
    const recordsProcessed =
      snapshots.length + snapshotPlayerRecords.length;

    if (syncRunId) {
      const { error: syncRunUpdateError } =
        await supabase
          .from("sync_runs")
          .update({
            status: "success",
            records_processed: recordsProcessed,
            completed_at: completedAt,
            details: {
              function_name:
                "sync-sleeper-roster-snapshots",
              league_id: league.id,
              league_name: league.name,
              week,
              overwrite,
              snapshots_created: snapshots.length,
              snapshot_players_created:
                snapshotPlayerRecords.length,
            },
          })
          .eq("id", syncRunId);

      if (syncRunUpdateError) {
        console.warn(
          "Snapshot succeeded, but sync_runs update failed:",
          syncRunUpdateError,
        );
      }
    }

    return jsonResponse({
      success: true,
      message:
        `Created ${snapshots.length} roster snapshots ` +
        `and ${snapshotPlayerRecords.length} snapshot-player rows ` +
        `for week ${week}.`,
      league: {
        id: league.id,
        name: league.name,
        sleeper_league_id: league.sleeper_league_id,
      },
      week,
      overwrite,
      snapshots_created: snapshots.length,
      snapshot_players_created:
        snapshotPlayerRecords.length,
      completed_at: completedAt,
    });
  } catch (error) {
    console.error(
      "sync-sleeper-roster-snapshots failed:",
      error,
    );

    const errorDetails = serializeError(error);
    const completedAt = new Date().toISOString();

    if (syncRunId) {
      const message =
        typeof errorDetails.message === "string"
          ? errorDetails.message
          : "Roster snapshot sync failed.";

      const { error: loggingError } = await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: completedAt,
          details: {
            function_name:
              "sync-sleeper-roster-snapshots",
            error: errorDetails,
          },
        })
        .eq("id", syncRunId);

      if (loggingError) {
        console.warn(
          "Could not mark sync run as failed:",
          loggingError,
        );
      }
    }

    return jsonResponse(
      {
        success: false,
        error: errorDetails,
      },
      500,
    );
  }
});
