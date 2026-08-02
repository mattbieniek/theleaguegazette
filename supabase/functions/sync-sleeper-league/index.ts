import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";

const DEFAULT_LEAGUE_ID = "1257085409687506944";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
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

    const body = await req.json().catch(() => ({})) as {
      sleeper_league_id?: string;
    };
    const sleeperLeagueId = String(
      body.sleeper_league_id ?? DEFAULT_LEAGUE_ID,
    ).trim();

    if (!/^\d+$/.test(sleeperLeagueId)) {
      throw new Error("sleeper_league_id must be a numeric Sleeper league ID.");
    }

    const sleeperResponse = await fetch(
      `https://api.sleeper.app/v1/league/${sleeperLeagueId}`,
    );

    if (!sleeperResponse.ok) {
      throw new Error(
        `Sleeper API returned ${sleeperResponse.status}: ${sleeperResponse.statusText}`,
      );
    }

    const league = await sleeperResponse.json();

    if (!league?.league_id) {
      throw new Error("Sleeper returned an invalid league response.");
    }

    const leagueRecord = {
      sleeper_league_id: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
      sport: league.sport,
      total_rosters: league.total_rosters,
      previous_league_id: league.previous_league_id || null,
      draft_id: league.draft_id || null,
      avatar: league.avatar || null,
      settings: league.settings || {},
      scoring_settings: league.scoring_settings || {},
      roster_positions: league.roster_positions || [],
      metadata: league.metadata || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("leagues")
      .upsert(leagueRecord, {
        onConflict: "sleeper_league_id",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .upsert({
        league_id: data.id,
        sleeper_league_id: league.league_id,
        year: Number(league.season),
        league_name: league.name ?? null,
        status: league.status ?? "complete",
        season_type: league.season_type ?? "regular",
        total_rosters: league.total_rosters ?? null,
        playoff_start_week: league.settings?.playoff_week_start ?? null,
        playoff_teams: league.settings?.playoff_teams ?? null,
        regular_season_weeks: league.settings?.playoff_week_start
          ? Number(league.settings.playoff_week_start) - 1
          : null,
        scoring_settings: league.scoring_settings ?? {},
        roster_positions: league.roster_positions ?? [],
        metadata: league.metadata ?? {},
        raw_data: league,
        updated_at: new Date().toISOString(),
      }, { onConflict: "sleeper_league_id" })
      .select()
      .single();

    if (seasonError) {
      throw seasonError;
    }

    return Response.json(
      {
        success: true,
        message: `Synced ${league.name}`,
        league: data,
        season,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
    } catch (error) {
    console.error("sync-sleeper-league failed:", error);

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
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  };
});
