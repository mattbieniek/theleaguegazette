import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SLEEPER_LEAGUE_ID = "1257085409687506944";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

type SleeperRoster = {
  roster_id: number;
  owner_id?: string | null;
  co_owners?: string[] | null;
  players?: string[] | null;
  starters?: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
  settings?: {
    wins?: number | null;
    losses?: number | null;
    ties?: number | null;
    fpts?: number | null;
    fpts_decimal?: number | null;
    fpts_against?: number | null;
    fpts_against_decimal?: number | null;
    waiver_position?: number | null;
    waiver_budget_used?: number | null;
    [key: string]: unknown;
  } | null;
  metadata?: JsonObject | null;
  [key: string]: unknown;
};

type ManagerRow = {
  id: string;
  sleeper_user_id: string;
  display_name: string;
  avatar: string | null;
  metadata: JsonObject;
};

type FantasyTeamRow = {
  id: string;
  sleeper_roster_id: number;
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

/**
 * Sleeper stores the whole-number and decimal portions separately.
 *
 * Example:
 *   fpts = 123
 *   fpts_decimal = 45
 *   result = 123.45
 */
function combineSleeperPoints(
  whole: number | null | undefined,
  decimal: number | null | undefined,
): number {
  const wholeValue = Number(whole ?? 0);
  const decimalValue = Number(decimal ?? 0);

  if (!Number.isFinite(wholeValue)) {
    return 0;
  }

  if (!Number.isFinite(decimalValue)) {
    return wholeValue;
  }

  const sign = wholeValue < 0 ? -1 : 1;

  return wholeValue + sign * Math.abs(decimalValue) / 100;
}

function getTeamName(
  roster: SleeperRoster,
  manager?: ManagerRow,
): string | null {
  const rosterTeamName = roster.metadata?.team_name;

  if (
    typeof rosterTeamName === "string" &&
    rosterTeamName.trim().length > 0
  ) {
    return rosterTeamName.trim();
  }

  const managerTeamName = manager?.metadata?.team_name;

  if (
    typeof managerTeamName === "string" &&
    managerTeamName.trim().length > 0
  ) {
    return managerTeamName.trim();
  }

  return manager?.display_name ?? null;
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        success: false,
        error: {
          message:
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
        },
      },
      500,
    );
  }

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

  const startedAt = new Date().toISOString();
  let syncRunId: string | null = null;

  /**
   * Logging is intentionally nonfatal. If the status check constraint in
   * sync_runs uses different permitted values, the roster sync can still run.
   */
  try {
    const { data: syncRun, error: syncRunError } = await supabase
      .from("sync_runs")
      .insert({
        sync_type: "sleeper_rosters",
        sleeper_league_id: SLEEPER_LEAGUE_ID,
        status: "running",
        records_processed: 0,
        details: {
          function_name: "sync-sleeper-rosters",
        },
        started_at: startedAt,
      })
      .select("id")
      .single();

    if (syncRunError) {
      console.warn(
        "Could not create sync_runs entry:",
        syncRunError,
      );
    } else {
      syncRunId = syncRun.id;
    }
  } catch (loggingError) {
    console.warn(
      "Unexpected sync_runs insert error:",
      loggingError,
    );
  }

  try {
    /*
     * Step 1:
     * Find the internal UUID for the Sleeper league.
     */
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id, sleeper_league_id, name")
      .eq("sleeper_league_id", SLEEPER_LEAGUE_ID)
      .single();

    if (leagueError) {
      throw leagueError;
    }

    if (!league) {
      throw new Error(
        `League ${SLEEPER_LEAGUE_ID} was not found in the leagues table.`,
      );
    }

    /*
     * Step 2:
     * Load managers so Sleeper owner IDs can be converted into UUIDs.
     */
    const { data: managerData, error: managersError } = await supabase
      .from("managers")
      .select(
        "id, sleeper_user_id, display_name, avatar, metadata",
      );

    if (managersError) {
      throw managersError;
    }

    const managers = (managerData ?? []) as ManagerRow[];

    const managersBySleeperId = new Map<string, ManagerRow>(
      managers.map((manager) => [
        manager.sleeper_user_id,
        manager,
      ]),
    );

    /*
     * Step 3:
     * Fetch current rosters from Sleeper.
     */
    const sleeperResponse = await fetch(
      `https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}/rosters`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!sleeperResponse.ok) {
      const responseText = await sleeperResponse.text();

      throw new Error(
        `Sleeper API returned ${sleeperResponse.status} ` +
          `${sleeperResponse.statusText}: ${responseText}`,
      );
    }

    const sleeperRosters =
      await sleeperResponse.json() as SleeperRoster[];

    if (!Array.isArray(sleeperRosters)) {
      throw new Error(
        "Sleeper returned an invalid rosters response.",
      );
    }

    const syncedAt = new Date().toISOString();

    /*
     * Step 4:
     * Convert Sleeper rosters into fantasy_teams rows.
     */
    const fantasyTeamRecords = sleeperRosters.map((roster) => {
      if (!Number.isInteger(roster.roster_id)) {
        throw new Error(
          "A Sleeper roster is missing a valid roster_id.",
        );
      }

      const ownerId = roster.owner_id
        ? String(roster.owner_id)
        : null;

      const manager = ownerId
        ? managersBySleeperId.get(ownerId)
        : undefined;

      if (ownerId && !manager) {
        console.warn(
          `No managers row found for Sleeper owner ${ownerId}. ` +
            `Roster ${roster.roster_id} will have a null manager_id.`,
        );
      }

      const settings = roster.settings ?? {};

      return {
        league_id: league.id,
        manager_id: manager?.id ?? null,
        sleeper_roster_id: roster.roster_id,
        team_name: getTeamName(roster, manager),
        avatar: manager?.avatar ?? null,
        wins: Number(settings.wins ?? 0),
        losses: Number(settings.losses ?? 0),
        ties: Number(settings.ties ?? 0),
        points_for: combineSleeperPoints(
          settings.fpts,
          settings.fpts_decimal,
        ),
        points_against: combineSleeperPoints(
          settings.fpts_against,
          settings.fpts_against_decimal,
        ),
        waiver_position:
          settings.waiver_position === null ||
            settings.waiver_position === undefined
            ? null
            : Number(settings.waiver_position),
        waiver_budget_used:
          settings.waiver_budget_used === null ||
            settings.waiver_budget_used === undefined
            ? null
            : Number(settings.waiver_budget_used),
        settings,
        metadata: {
          ...(roster.metadata ?? {}),
          sleeper_owner_id: ownerId,
          sleeper_co_owner_ids: roster.co_owners ?? [],
        },
        raw_data: roster,
        last_synced_at: syncedAt,
        updated_at: syncedAt,
      };
    });

    /*
     * Step 5:
     * Upsert fantasy teams and return their internal UUIDs.
     */
    const { data: fantasyTeamsData, error: fantasyTeamsError } =
      await supabase
        .from("fantasy_teams")
        .upsert(fantasyTeamRecords, {
          onConflict: "league_id,sleeper_roster_id",
        })
        .select("id, sleeper_roster_id");

    if (fantasyTeamsError) {
      throw fantasyTeamsError;
    }

    const fantasyTeams =
      (fantasyTeamsData ?? []) as FantasyTeamRow[];

    const fantasyTeamByRosterId = new Map<number, string>(
      fantasyTeams.map((team) => [
        team.sleeper_roster_id,
        team.id,
      ]),
    );

    if (fantasyTeams.length !== sleeperRosters.length) {
      throw new Error(
        `Expected ${sleeperRosters.length} fantasy teams after upsert, ` +
          `but Supabase returned ${fantasyTeams.length}.`,
      );
    }

    /*
     * Step 6:
     * Collect every player referenced by the Sleeper rosters.
     */
    const allSleeperPlayerIds = [
      ...new Set(
        sleeperRosters.flatMap((roster) =>
          (roster.players ?? [])
            .filter((playerId): playerId is string =>
              typeof playerId === "string" &&
              playerId.length > 0
            )
        ),
      ),
    ];

    /*
     * Step 7:
     * Verify that all referenced players exist before replacing roster rows.
     *
     * roster_players has a foreign key to players.sleeper_player_id.
     */
    let existingPlayerIds = new Set<string>();

    if (allSleeperPlayerIds.length > 0) {
      const { data: existingPlayers, error: existingPlayersError } =
        await supabase
          .from("players")
          .select("sleeper_player_id")
          .in("sleeper_player_id", allSleeperPlayerIds);

      if (existingPlayersError) {
        throw existingPlayersError;
      }

      existingPlayerIds = new Set(
        (existingPlayers ?? []).map((player) =>
          String(player.sleeper_player_id)
        ),
      );
    }

    const missingPlayerIds = allSleeperPlayerIds.filter(
      (playerId) => !existingPlayerIds.has(playerId),
    );

    if (missingPlayerIds.length > 0) {
      throw new Error(
        `${missingPlayerIds.length} roster player IDs do not exist in the ` +
          `players table. Run sync-sleeper-players first. Missing IDs: ` +
          `${missingPlayerIds.slice(0, 25).join(", ")}` +
          `${missingPlayerIds.length > 25 ? "..." : ""}`,
      );
    }

    /*
     * Step 8:
     * Build the current roster-player relationships.
     */
    const rosterPlayerRecords = sleeperRosters.flatMap((roster) => {
      const fantasyTeamId = fantasyTeamByRosterId.get(
        roster.roster_id,
      );

      if (!fantasyTeamId) {
        throw new Error(
          `No fantasy team UUID was returned for Sleeper roster ` +
            `${roster.roster_id}.`,
        );
      }

      const starters = new Set(
        (roster.starters ?? []).map(String),
      );

      const reserve = new Set(
        (roster.reserve ?? []).map(String),
      );

      const taxi = new Set(
        (roster.taxi ?? []).map(String),
      );

      const rosterPlayerIds = [
        ...new Set(
          (roster.players ?? [])
            .filter((playerId): playerId is string =>
              typeof playerId === "string" &&
              playerId.length > 0
            )
            .map(String),
        ),
      ];

      return rosterPlayerIds.map((playerId) => ({
        fantasy_team_id: fantasyTeamId,
        sleeper_player_id: playerId,
        is_starter: starters.has(playerId),
        is_reserve: reserve.has(playerId),
        is_taxi: taxi.has(playerId),
        updated_at: syncedAt,
      }));
    });

    /*
     * Step 9:
     * Delete old current-roster relationships for these teams.
     *
     * This table represents the present roster state. Historical snapshots
     * will later be stored in a separate table.
     */
    const fantasyTeamIds = fantasyTeams.map((team) => team.id);

    if (fantasyTeamIds.length > 0) {
      const { error: deleteRosterPlayersError } = await supabase
        .from("roster_players")
        .delete()
        .in("fantasy_team_id", fantasyTeamIds);

      if (deleteRosterPlayersError) {
        throw deleteRosterPlayersError;
      }
    }

    /*
     * Step 10:
     * Insert the fresh roster-player relationships.
     */
    if (rosterPlayerRecords.length > 0) {
      const { error: rosterPlayersError } = await supabase
        .from("roster_players")
        .insert(rosterPlayerRecords);

      if (rosterPlayersError) {
        throw rosterPlayersError;
      }
    }

    const completedAt = new Date().toISOString();
    const recordsProcessed =
      fantasyTeams.length + rosterPlayerRecords.length;

    if (syncRunId) {
      const { error: syncRunUpdateError } = await supabase
        .from("sync_runs")
        .update({
          status: "success",
          records_processed: recordsProcessed,
          completed_at: completedAt,
          details: {
            league_uuid: league.id,
            league_name: league.name,
            fantasy_teams_synced: fantasyTeams.length,
            roster_players_synced: rosterPlayerRecords.length,
            managers_not_matched: fantasyTeamRecords.filter(
              (team) => team.manager_id === null,
            ).length,
          },
        })
        .eq("id", syncRunId);

      if (syncRunUpdateError) {
        console.warn(
          "Roster sync succeeded, but sync_runs could not be updated:",
          syncRunUpdateError,
        );
      }
    }

    return jsonResponse({
      success: true,
      message:
        `Synced ${fantasyTeams.length} fantasy teams and ` +
        `${rosterPlayerRecords.length} roster-player relationships.`,
      league: {
        id: league.id,
        sleeper_league_id: league.sleeper_league_id,
        name: league.name,
      },
      fantasy_teams_synced: fantasyTeams.length,
      roster_players_synced: rosterPlayerRecords.length,
      unmatched_owner_count: fantasyTeamRecords.filter(
        (team) => team.manager_id === null,
      ).length,
      completed_at: completedAt,
    });
  } catch (error) {
    console.error("sync-sleeper-rosters failed:", error);

    const errorDetails = serializeError(error);
    const completedAt = new Date().toISOString();

    if (syncRunId) {
      const errorMessage =
        typeof errorDetails.message === "string"
          ? errorDetails.message
          : "Roster sync failed.";

      const { error: syncRunFailureError } = await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: completedAt,
          details: {
            error: errorDetails,
          },
        })
        .eq("id", syncRunId);

      if (syncRunFailureError) {
        console.warn(
          "Could not mark sync run as failed:",
          syncRunFailureError,
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