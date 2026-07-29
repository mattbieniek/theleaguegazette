import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";

const SLEEPER_LEAGUE_ID = "1257085409687506944";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
      );
    }

    await requireAdmin(req, supabaseUrl, serviceRoleKey);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    /*
     * Step 1:
     * Find the internal UUID for this league.
     */
    const { data: leagueRow, error: leagueError } = await supabase
      .from("leagues")
      .select("id, sleeper_league_id, name")
      .eq("sleeper_league_id", SLEEPER_LEAGUE_ID)
      .single();

    if (leagueError) {
      throw leagueError;
    }

    if (!leagueRow) {
      throw new Error(
        `League ${SLEEPER_LEAGUE_ID} was not found in the leagues table.`,
      );
    }

    /*
     * Step 2:
     * Retrieve the league's users from Sleeper.
     */
    const sleeperResponse = await fetch(
      `https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}/users`,
    );

    if (!sleeperResponse.ok) {
      throw new Error(
        `Sleeper API returned ${sleeperResponse.status}: ${sleeperResponse.statusText}`,
      );
    }

    const sleeperUsers = await sleeperResponse.json();

    if (!Array.isArray(sleeperUsers)) {
      throw new Error("Sleeper returned an invalid users response.");
    }

    const syncedAt = new Date().toISOString();

    /*
     * Step 3:
     * Map Sleeper users to the existing managers table.
     */
    const managerRecords = sleeperUsers
      .filter((user) => user?.user_id)
      .map((user) => ({
        sleeper_user_id: String(user.user_id),
        username: user.username ?? null,
        display_name:
          user.display_name ??
          user.username ??
          `Sleeper User ${user.user_id}`,
        avatar: user.avatar ?? null,
        metadata: user.metadata ?? {},
        raw_data: user,
        last_synced_at: syncedAt,
        updated_at: syncedAt,
      }));

    if (managerRecords.length === 0) {
      return Response.json(
        {
          success: true,
          message: "Sleeper returned no league users.",
          league: leagueRow,
          managers_synced: 0,
          memberships_synced: 0,
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * Step 4:
     * Insert new managers or update existing ones.
     *
     * The managers table has a unique constraint on sleeper_user_id.
     */
    const { data: managers, error: managersError } = await supabase
      .from("managers")
      .upsert(managerRecords, {
        onConflict: "sleeper_user_id",
      })
      .select(
        "id, sleeper_user_id, username, display_name, avatar, metadata",
      );

    if (managersError) {
      throw managersError;
    }

    if (!managers) {
      throw new Error("Manager upsert completed without returning any rows.");
    }

    /*
     * Step 5:
     * Connect each manager UUID to the league UUID.
     *
     * league_members is the join table between leagues and managers.
     */
    const sleeperUserMap = new Map(
      sleeperUsers.map((user) => [
        String(user.user_id),
        user,
      ]),
    );

    const membershipRecords = managers.map((manager) => {
      const sleeperUser = sleeperUserMap.get(manager.sleeper_user_id);

      return {
        league_id: leagueRow.id,
        manager_id: manager.id,
        is_owner: false,
        metadata: {
          sleeper_user_id: manager.sleeper_user_id,
          team_name: sleeperUser?.metadata?.team_name ?? null,
          user_metadata: sleeperUser?.metadata ?? {},
        },
        updated_at: syncedAt,
      };
    });

    const { data: memberships, error: membershipsError } = await supabase
      .from("league_members")
      .upsert(membershipRecords, {
        onConflict: "league_id,manager_id",
      })
      .select(
        "id, league_id, manager_id, is_owner, metadata, updated_at",
      );

    if (membershipsError) {
      throw membershipsError;
    }

    return Response.json(
      {
        success: true,
        message:
          `Synced ${managers.length} managers and ${memberships?.length ?? membershipRecords.length} league memberships.`,
        league: {
          id: leagueRow.id,
          sleeper_league_id: leagueRow.sleeper_league_id,
          name: leagueRow.name,
        },
        managers_synced: managers.length,
        memberships_synced:
          memberships?.length ?? membershipRecords.length,
        managers,
        memberships: memberships ?? [],
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("sync-sleeper-users failed:", error);

    let errorDetails: unknown;

    if (error instanceof Error) {
      errorDetails = {
        message: error.message,
        stack: error.stack,
      };
    } else if (typeof error === "object" && error !== null) {
      errorDetails = error;
    } else {
      errorDetails = {
        message: String(error),
      };
    }

    return Response.json(
      {
        success: false,
        error: errorDetails,
      },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
