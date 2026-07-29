import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";

const DEFAULT_LEAGUE_ID = "1257085409687506944";
const SLEEPER_API = "https://api.sleeper.app/v1";

type SleeperDraft = {
  draft_id: string;
  league_id: string;
  season: string;
  status: string;
  type: string;
  start_time?: number | null;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type SleeperPick = {
  draft_id: string;
  pick_no: number;
  round: number;
  draft_slot: number | null;
  roster_id: number | null;
  picked_by: string | null;
  player_id: string | null;
  is_keeper: boolean | null;
  metadata?: Record<string, unknown>;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Sleeper API returned ${response.status} for ${url}`);
  }
  return response.json() as Promise<T>;
}

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
      throw new Error("Missing Supabase service credentials.");
    }

    await requireAdmin(req, supabaseUrl, serviceRoleKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sleeperLeagueId = body.sleeper_league_id ?? DEFAULT_LEAGUE_ID;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id")
      .eq("sleeper_league_id", sleeperLeagueId)
      .single();
    if (leagueError) throw leagueError;

    const drafts = await getJson<SleeperDraft[]>(
      `${SLEEPER_API}/league/${sleeperLeagueId}/drafts`,
    );

    let picksProcessed = 0;

    for (const draft of drafts) {
      const seasonYear = Number(draft.season);
      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("sleeper_league_id", sleeperLeagueId)
        .eq("year", seasonYear)
        .maybeSingle();

      const { data: storedDraft, error: draftError } = await supabase
        .from("drafts")
        .upsert(
          {
            league_id: league.id,
            season_id: season?.id ?? null,
            provider: "Sleeper",
            provider_draft_id: draft.draft_id,
            season_year: seasonYear,
            name: String(draft.metadata?.name ?? `${seasonYear} Draft`),
            draft_type: draft.type,
            status: draft.status,
            rounds: Number(draft.settings?.rounds ?? 0) || null,
            team_count: Number(draft.settings?.teams ?? 0) || null,
            starts_at: draft.start_time
              ? new Date(draft.start_time).toISOString()
              : null,
            settings: draft.settings ?? {},
            metadata: draft.metadata ?? {},
            raw_data: draft,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "provider,provider_draft_id" },
        )
        .select("id")
        .single();
      if (draftError) throw draftError;

      const { data: fantasyTeams, error: teamsError } = await supabase
        .from("fantasy_teams")
        .select("id,sleeper_roster_id")
        .eq("season_id", season?.id ?? "00000000-0000-0000-0000-000000000000");
      if (teamsError) throw teamsError;

      const teamByRoster = new Map(
        (fantasyTeams ?? []).map((team) => [team.sleeper_roster_id, team.id]),
      );
      const picks = await getJson<SleeperPick[]>(
        `${SLEEPER_API}/draft/${draft.draft_id}/picks`,
      );

      const pickRows = picks.map((pick) => {
        const metadata = pick.metadata ?? {};
        const playerName = [metadata.first_name, metadata.last_name]
          .filter(Boolean)
          .join(" ") || `Player ${pick.player_id ?? pick.pick_no}`;

        return {
          draft_id: storedDraft.id,
          fantasy_team_id: pick.roster_id
            ? teamByRoster.get(pick.roster_id) ?? null
            : null,
          provider_pick_id: `${draft.draft_id}:${pick.pick_no}`,
          pick_number: pick.pick_no,
          round: pick.round,
          round_pick: ((pick.pick_no - 1) % Number(draft.settings?.teams ?? 10)) + 1,
          draft_slot: pick.draft_slot,
          roster_id: pick.roster_id,
          manager_provider_id: pick.picked_by,
          player_provider_id: pick.player_id,
          player_name: playerName,
          position: typeof metadata.position === "string" ? metadata.position : null,
          pro_team: typeof metadata.team === "string" ? metadata.team : null,
          is_keeper: pick.is_keeper === true,
          metadata,
          raw_data: pick,
          updated_at: new Date().toISOString(),
        };
      });

      if (pickRows.length > 0) {
        const { error: picksError } = await supabase
          .from("draft_picks")
          .upsert(pickRows, { onConflict: "draft_id,provider_pick_id" });
        if (picksError) throw picksError;
      }
      picksProcessed += pickRows.length;
    }

    return Response.json(
      { success: true, drafts_processed: drafts.length, picks_processed: picksProcessed },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (error) {
    console.error("sync-sleeper-drafts failed:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
});
