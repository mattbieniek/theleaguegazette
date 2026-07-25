import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  sleeper_league_id?: string;
  week?: number;
  status?: "scheduled" | "live" | "complete";
};

type SleeperMatchupRoster = {
  roster_id: number;
  matchup_id: number | null;
  points?: number | null;
  custom_points?: number | null;
  starters?: Array<string | null> | null;
  players?: Array<string | null> | null;
  players_points?: Record<string, number | null> | null;
  starters_points?: Array<number | null> | null;
};

type FantasyTeam = {
  id: string;
  sleeper_roster_id: number;
};

type MatchupRecord = {
  id: string;
  sleeper_matchup_id: number;
};

type MatchupTeamRecord = {
  id: string;
  matchup_id: string;
  fantasy_team_id: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueStrings(values: Array<string | null> | null | undefined): string[] {
  return [
    ...new Set(
      (values ?? []).filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      ),
    ),
  ];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed. Use POST.",
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
        error:
          "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
      },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let syncRunId: string | null = null;

  try {
    let body: RequestBody;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Request body must be valid JSON.",
        },
        400,
      );
    }

    const sleeperLeagueId = body.sleeper_league_id?.trim();
    const week = Number(body.week);
    const status = body.status ?? "complete";

    if (!sleeperLeagueId) {
      return jsonResponse(
        {
          success: false,
          error: "sleeper_league_id is required.",
        },
        400,
      );
    }

    if (!Number.isInteger(week) || week < 1 || week > 18) {
      return jsonResponse(
        {
          success: false,
          error: "week must be an integer between 1 and 18.",
        },
        400,
      );
    }

    if (!["scheduled", "live", "complete"].includes(status)) {
      return jsonResponse(
        {
          success: false,
          error: "status must be scheduled, live, or complete.",
        },
        400,
      );
    }

    /*
     * Create a sync-run log.
     */
    const { data: syncRun, error: syncRunError } = await supabase
      .from("sync_runs")
      .insert({
        sync_type: "sleeper_matchups",
        sleeper_league_id: sleeperLeagueId,
        status: "running",
        details: {
          week,
          requested_status: status,
        },
      })
      .select("id")
      .single();

    if (syncRunError) {
      throw new Error(
        `Could not create sync_runs record: ${syncRunError.message}`,
      );
    }

    syncRunId = syncRun.id;

    /*
     * Find the season and its permanent parent league.
     */
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id, league_id, year, sleeper_league_id")
      .eq("sleeper_league_id", sleeperLeagueId)
      .single();

    if (seasonError || !season) {
      throw new Error(
        `Season not found for Sleeper league ${sleeperLeagueId}: ${
          seasonError?.message ?? "No matching season row"
        }`,
      );
    }

    /*
     * Load the fantasy-team mapping for this season.
     */
    const { data: fantasyTeams, error: fantasyTeamsError } = await supabase
      .from("fantasy_teams")
      .select("id, sleeper_roster_id")
      .eq("season_id", season.id);

    if (fantasyTeamsError) {
      throw new Error(
        `Could not load fantasy teams: ${fantasyTeamsError.message}`,
      );
    }

    if (!fantasyTeams?.length) {
      throw new Error(
        `No fantasy teams were found for season ${season.year}. Run the roster/team sync first.`,
      );
    }

    const fantasyTeamByRosterId = new Map<number, FantasyTeam>(
      (fantasyTeams as FantasyTeam[]).map((team) => [
        team.sleeper_roster_id,
        team,
      ]),
    );

    /*
     * Fetch the requested week from Sleeper.
     */
    const sleeperUrl =
      `https://api.sleeper.app/v1/league/${encodeURIComponent(
        sleeperLeagueId,
      )}/matchups/${week}`;

    const sleeperResponse = await fetch(sleeperUrl);

    if (!sleeperResponse.ok) {
      const responseText = await sleeperResponse.text();

      throw new Error(
        `Sleeper API returned ${sleeperResponse.status}: ${responseText}`,
      );
    }

    const sleeperRows =
      (await sleeperResponse.json()) as SleeperMatchupRoster[];

    if (!Array.isArray(sleeperRows)) {
      throw new Error("Sleeper returned an unexpected matchup response.");
    }

    if (sleeperRows.length === 0) {
      await supabase
        .from("sync_runs")
        .update({
          status: "success",
          records_processed: 0,
          completed_at: new Date().toISOString(),
          details: {
            week,
            season_id: season.id,
            message: "Sleeper returned no matchup rows for this week.",
          },
        })
        .eq("id", syncRunId);

      return jsonResponse({
        success: true,
        sleeper_league_id: sleeperLeagueId,
        season_id: season.id,
        week,
        message: "Sleeper returned no matchup rows for this week.",
        counts: {
          sleeper_rows: 0,
          matchups: 0,
          matchup_teams: 0,
          matchup_players: 0,
        },
      });
    }

    /*
     * Validate roster mappings before writing anything.
     */
    const missingRosterIds = [
      ...new Set(
        sleeperRows
          .map((row) => row.roster_id)
          .filter(
            (rosterId) =>
              Number.isInteger(rosterId) &&
              !fantasyTeamByRosterId.has(rosterId),
          ),
      ),
    ];

    if (missingRosterIds.length > 0) {
      throw new Error(
        `These Sleeper roster IDs are not mapped in fantasy_teams for this season: ${
          missingRosterIds.join(", ")
        }`,
      );
    }

    /*
     * Sleeper gives both opponents the same matchup_id.
     * Create one parent row for each unique matchup.
     */
    const sleeperMatchupIds = [
      ...new Set(
        sleeperRows
          .map((row) => row.matchup_id)
          .filter(
            (matchupId): matchupId is number =>
              Number.isInteger(matchupId),
          ),
      ),
    ];

    if (sleeperMatchupIds.length === 0) {
      throw new Error(
        "No valid matchup IDs were returned by Sleeper for this week.",
      );
    }

    const matchupRows = sleeperMatchupIds.map((sleeperMatchupId) => ({
      league_id: season.league_id,
      season_id: season.id,
      week,
      sleeper_matchup_id: sleeperMatchupId,
      status,
      updated_at: new Date().toISOString(),
    }));

    const { data: savedMatchups, error: matchupsError } = await supabase
      .from("matchups")
      .upsert(matchupRows, {
        onConflict: "season_id,week,sleeper_matchup_id",
      })
      .select("id, sleeper_matchup_id");

    if (matchupsError) {
      throw new Error(`Could not upsert matchups: ${matchupsError.message}`);
    }

    const matchupBySleeperId = new Map<number, MatchupRecord>(
      (savedMatchups as MatchupRecord[]).map((matchup) => [
        matchup.sleeper_matchup_id,
        matchup,
      ]),
    );

    /*
     * Determine winners, ties, starter totals, and bench totals.
     */
    const rowsByMatchupId = new Map<number, SleeperMatchupRoster[]>();

    for (const sleeperRow of sleeperRows) {
      if (!Number.isInteger(sleeperRow.matchup_id)) {
        continue;
      }

      const matchupId = sleeperRow.matchup_id as number;
      const existingRows = rowsByMatchupId.get(matchupId) ?? [];
      existingRows.push(sleeperRow);
      rowsByMatchupId.set(matchupId, existingRows);
    }

    const matchupTeamRows = sleeperRows
      .filter(
        (row) =>
          Number.isInteger(row.matchup_id) &&
          fantasyTeamByRosterId.has(row.roster_id),
      )
      .map((row) => {
        const sleeperMatchupId = row.matchup_id as number;
        const matchup = matchupBySleeperId.get(sleeperMatchupId);
        const fantasyTeam = fantasyTeamByRosterId.get(row.roster_id);

        if (!matchup || !fantasyTeam) {
          throw new Error(
            `Could not map roster ${row.roster_id} in Sleeper matchup ${sleeperMatchupId}.`,
          );
        }

        const players = uniqueStrings(row.players);
        const starters = uniqueStrings(row.starters);
        const starterSet = new Set(starters);
        const playerPoints = row.players_points ?? {};

        const startersPoints = starters.reduce(
          (total, playerId) =>
            total + asFiniteNumber(playerPoints[playerId], 0),
          0,
        );

        const benchPoints = players
          .filter((playerId) => !starterSet.has(playerId))
          .reduce(
            (total, playerId) =>
              total + asFiniteNumber(playerPoints[playerId], 0),
            0,
          );

        const matchupParticipants =
          rowsByMatchupId.get(sleeperMatchupId) ?? [];

        const participantScores = matchupParticipants.map((participant) =>
          asFiniteNumber(
            participant.custom_points ?? participant.points,
            0,
          )
        );

        const teamPoints = asFiniteNumber(
          row.custom_points ?? row.points,
          0,
        );

        const highestScore = Math.max(...participantScores);
        const winnerCount = participantScores.filter(
          (score) => score === highestScore,
        ).length;

        const isTie =
          matchupParticipants.length > 1 &&
          participantScores.every((score) => score === participantScores[0]);

        const isWinner =
          matchupParticipants.length > 1 &&
          !isTie &&
          teamPoints === highestScore &&
          winnerCount === 1;

        return {
          matchup_id: matchup.id,
          fantasy_team_id: fantasyTeam.id,
          points: teamPoints,
          starters_points: startersPoints,
          bench_points: benchPoints,
          is_winner: isWinner,
          is_tie: isTie,
          raw_data: row,
          updated_at: new Date().toISOString(),
        };
      });

    const { data: savedMatchupTeams, error: matchupTeamsError } =
      await supabase
        .from("matchup_teams")
        .upsert(matchupTeamRows, {
          onConflict: "matchup_id,fantasy_team_id",
        })
        .select("id, matchup_id, fantasy_team_id");

    if (matchupTeamsError) {
      throw new Error(
        `Could not upsert matchup teams: ${matchupTeamsError.message}`,
      );
    }

    const matchupTeamByCompositeKey = new Map<string, MatchupTeamRecord>(
      (savedMatchupTeams as MatchupTeamRecord[]).map((row) => [
        `${row.matchup_id}:${row.fantasy_team_id}`,
        row,
      ]),
    );

    /*
     * Assemble every unique player ID in the week's response.
     */
    const requestedPlayerIds = [
      ...new Set(
        sleeperRows.flatMap((row) => [
          ...uniqueStrings(row.players),
          ...uniqueStrings(row.starters),
        ]),
      ),
    ];

    /*
     * matchup_players has an FK to players.
     * Determine which IDs already exist before inserting.
     */
    let existingPlayerIds = new Set<string>();

    if (requestedPlayerIds.length > 0) {
      const { data: existingPlayers, error: existingPlayersError } =
        await supabase
          .from("players")
          .select("sleeper_player_id")
          .in("sleeper_player_id", requestedPlayerIds);

      if (existingPlayersError) {
        throw new Error(
          `Could not validate players: ${existingPlayersError.message}`,
        );
      }

      existingPlayerIds = new Set(
        (existingPlayers ?? []).map(
          (player) => player.sleeper_player_id as string,
        ),
      );
    }

    const missingPlayerIds = requestedPlayerIds.filter(
      (playerId) => !existingPlayerIds.has(playerId),
    );

    const matchupPlayerRows: Array<{
      matchup_team_id: string;
      sleeper_player_id: string;
      is_starter: boolean;
      points: number;
      updated_at: string;
    }> = [];

    for (const sleeperRow of sleeperRows) {
      if (!Number.isInteger(sleeperRow.matchup_id)) {
        continue;
      }

      const matchup = matchupBySleeperId.get(
        sleeperRow.matchup_id as number,
      );
      const fantasyTeam = fantasyTeamByRosterId.get(sleeperRow.roster_id);

      if (!matchup || !fantasyTeam) {
        continue;
      }

      const matchupTeam = matchupTeamByCompositeKey.get(
        `${matchup.id}:${fantasyTeam.id}`,
      );

      if (!matchupTeam) {
        throw new Error(
          `The matchup-team row could not be resolved for roster ${sleeperRow.roster_id}.`,
        );
      }

      const players = uniqueStrings(sleeperRow.players);
      const starters = new Set(uniqueStrings(sleeperRow.starters));
      const playerPoints = sleeperRow.players_points ?? {};

      for (const playerId of players) {
        /*
         * Skip IDs that do not yet exist in public.players, avoiding an FK
         * failure while reporting them in the response.
         */
        if (!existingPlayerIds.has(playerId)) {
          continue;
        }

        matchupPlayerRows.push({
          matchup_team_id: matchupTeam.id,
          sleeper_player_id: playerId,
          is_starter: starters.has(playerId),
          points: asFiniteNumber(playerPoints[playerId], 0),
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (matchupPlayerRows.length > 0) {
      const { error: matchupPlayersError } = await supabase
        .from("matchup_players")
        .upsert(matchupPlayerRows, {
          onConflict: "matchup_team_id,sleeper_player_id",
        });

      if (matchupPlayersError) {
        throw new Error(
          `Could not upsert matchup players: ${matchupPlayersError.message}`,
        );
      }
    }

    const recordsProcessed =
      matchupRows.length +
      matchupTeamRows.length +
      matchupPlayerRows.length;

    const resultDetails = {
      season_id: season.id,
      season_year: season.year,
      week,
      status,
      counts: {
        sleeper_rows: sleeperRows.length,
        matchups: matchupRows.length,
        matchup_teams: matchupTeamRows.length,
        matchup_players: matchupPlayerRows.length,
      },
      missing_player_ids: missingPlayerIds,
    };

    const { error: completeRunError } = await supabase
      .from("sync_runs")
      .update({
        status: "success",
        records_processed: recordsProcessed,
        completed_at: new Date().toISOString(),
        details: resultDetails,
      })
      .eq("id", syncRunId);

    if (completeRunError) {
      console.error(
        "Matchup data synced, but sync_runs could not be completed:",
        completeRunError,
      );
    }

    return jsonResponse({
      success: true,
      sleeper_league_id: sleeperLeagueId,
      ...resultDetails,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown synchronization error";

    console.error("sync-sleeper-matchups failed:", error);

    if (syncRunId) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncRunId);
    }

    return jsonResponse(
      {
        success: false,
        error: message,
      },
      500,
    );
  }
});