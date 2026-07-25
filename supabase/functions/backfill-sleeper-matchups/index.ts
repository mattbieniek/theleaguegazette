import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BackfillRequest = {
  sleeperLeagueId?: string;
  sleeper_league_id?: string;
  startWeek?: number;
  endWeek?: number;
  status?: "scheduled" | "live" | "complete";
};

type WeekResult = {
  week: number;
  success: boolean;
  status?: number;
  response?: unknown;
  error?: string;
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed. Use POST.",
      },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not configured.");
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
    }

    let body: BackfillRequest;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Request body must contain valid JSON.",
        },
        400,
      );
    }

    // Accept either camelCase or snake_case in the backfill request.
    const sleeperLeagueId =
      body.sleeperLeagueId ?? body.sleeper_league_id;

    const startWeek = body.startWeek ?? 1;
    const endWeek = body.endWeek ?? 18;
    const matchupStatus = body.status ?? "complete";

    if (
      typeof sleeperLeagueId !== "string" ||
      sleeperLeagueId.trim().length === 0
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "sleeperLeagueId or sleeper_league_id must be provided.",
        },
        400,
      );
    }

    if (!Number.isInteger(startWeek) || startWeek < 1 || startWeek > 18) {
      return jsonResponse(
        {
          success: false,
          error: "startWeek must be a whole number from 1 through 18.",
        },
        400,
      );
    }

    if (!Number.isInteger(endWeek) || endWeek < 1 || endWeek > 18) {
      return jsonResponse(
        {
          success: false,
          error: "endWeek must be a whole number from 1 through 18.",
        },
        400,
      );
    }

    if (endWeek < startWeek) {
      return jsonResponse(
        {
          success: false,
          error: "endWeek cannot be earlier than startWeek.",
        },
        400,
      );
    }

    const validStatuses = ["scheduled", "live", "complete"];

    if (!validStatuses.includes(matchupStatus)) {
      return jsonResponse(
        {
          success: false,
          error:
            "status must be scheduled, live, or complete.",
        },
        400,
      );
    }

    const functionUrl =
      `${supabaseUrl}/functions/v1/sync-sleeper-matchups`;

    const results: WeekResult[] = [];

    for (let week = startWeek; week <= endWeek; week++) {
      try {
        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
            "apikey": serviceRoleKey,
          },
          body: JSON.stringify({
            week,
            sleeper_league_id: sleeperLeagueId,
            status: matchupStatus,
          }),
        });

        const responseText = await response.text();
        const responseData = parseResponseBody(responseText);

        if (!response.ok) {
          results.push({
            week,
            success: false,
            status: response.status,
            response: responseData,
            error:
              `sync-sleeper-matchups returned HTTP ${response.status}.`,
          });
        } else {
          results.push({
            week,
            success: true,
            status: response.status,
            response: responseData,
          });
        }
      } catch (error) {
        console.error(`Week ${week} invocation failed:`, error);

        results.push({
          week,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown invocation error.",
        });
      }

      // Prevent every request from being made simultaneously.
      if (week < endWeek) {
        await delay(200);
      }
    }

    const weeksSucceeded = results.filter(
      (result) => result.success,
    ).length;

    const weeksFailed = results.length - weeksSucceeded;

    return jsonResponse({
      success: weeksFailed === 0,
      sleeperLeagueId,
      startWeek,
      endWeek,
      matchupStatus,
      weeksAttempted: results.length,
      weeksSucceeded,
      weeksFailed,
      results,
    });
  } catch (error) {
    console.error("Backfill failed:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown backfill error.",
      },
      500,
    );
  }
});

function parseResponseBody(responseText: string): unknown {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}