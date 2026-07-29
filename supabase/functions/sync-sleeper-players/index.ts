import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const BATCH_SIZE = 500;

type SleeperPlayer = {
  player_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  team?: string | null;
  active?: boolean | null;
  status?: string | null;
  injury_status?: string | null;
  age?: number | null;
  years_exp?: number | null;
  number?: number | null;
  depth_chart_position?: string | null;
  depth_chart_order?: number | null;
  search_rank?: number | null;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase credentials." }),
      { status: 500 },
    );
  }

  await requireAdmin(req, supabaseUrl, serviceRoleKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const response = await fetch(PLAYERS_URL);

    if (!response.ok) {
      throw new Error(
        `Sleeper request failed: ${response.status}`,
      );
    }

    const playerObject = await response.json() as Record<
      string,
      SleeperPlayer
    >;

    const rows = Object.entries(playerObject).map(
      ([playerId, player]) => ({
        sleeper_player_id: player.player_id ?? playerId,
        first_name: player.first_name ?? null,
        last_name: player.last_name ?? null,
        full_name:
          player.full_name ??
          [player.first_name, player.last_name]
            .filter(Boolean)
            .join(" ") ??
          null,
        position: player.position ?? null,
        fantasy_positions: player.fantasy_positions ?? [],
        nfl_team: player.team ?? null,
        active: player.active ?? null,
        status: player.status ?? null,
        injury_status: player.injury_status ?? null,
        age: player.age ?? null,
        years_experience: player.years_exp ?? null,
        jersey_number: player.number ?? null,
        depth_chart_position: player.depth_chart_position ?? null,
        depth_chart_order: player.depth_chart_order ?? null,
        search_rank: player.search_rank ?? null,
        raw_data: player,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    );

    let imported = 0;

    for (const batch of chunk(rows, BATCH_SIZE)) {
      const { error } = await supabase
        .from("players")
        .upsert(batch, {
          onConflict: "sleeper_player_id",
        });

      if (error) {
        throw new Error(`Player batch failed: ${error.message}`);
      }

      imported += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        players_imported: imported,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unknown error";

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
