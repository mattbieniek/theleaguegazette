import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";
import { activeSleeperLeagueId } from "../_shared/activeLeague.ts";

const SLEEPER_API = "https://api.sleeper.app/v1";

type SleeperDraftPick = {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
};

type SleeperFaabTransfer = {
  sender: number;
  receiver: number;
  amount: number;
};

type SleeperTransaction = {
  transaction_id: string;
  type: string;
  status: string;
  leg: number;
  roster_ids?: number[] | null;
  consenter_ids?: number[] | null;
  creator?: string | null;
  created?: number | null;
  status_updated?: number | null;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  draft_picks?: SleeperDraftPick[] | null;
  waiver_budget?: SleeperFaabTransfer[] | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type PlayerRow = {
  sleeper_player_id: string;
  full_name: string | null;
  position: string | null;
  nfl_team: string | null;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

function timestamp(value: number | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ success: true });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "Missing Supabase service credentials." }, 500);
  }

  await requireAdmin(req, supabaseUrl, serviceRoleKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let syncRunId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const sleeperLeagueId = String(
      body.sleeper_league_id ?? activeSleeperLeagueId(),
    );
    const startWeek = Math.max(1, Number(body.start_week ?? 1));
    const endWeek = Math.min(18, Number(body.end_week ?? 18));
    if (!Number.isInteger(startWeek) || !Number.isInteger(endWeek) || startWeek > endWeek) {
      return json({ success: false, error: "start_week and end_week must define a valid range from 1 to 18." }, 400);
    }

    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id,league_id,year")
      .eq("sleeper_league_id", sleeperLeagueId)
      .single();
    if (seasonError || !season) throw new Error(`Season not found: ${seasonError?.message ?? sleeperLeagueId}`);

    await supabase
      .from("sync_runs")
      .update({
        status: "error",
        error_message: "Superseded by a newer transaction sync.",
        completed_at: new Date().toISOString(),
      })
      .eq("sync_type", "sleeper_transactions")
      .eq("sleeper_league_id", sleeperLeagueId)
      .eq("status", "running");

    const { data: syncRun, error: syncRunError } = await supabase
      .from("sync_runs")
      .insert({
        sync_type: "sleeper_transactions",
        sleeper_league_id: sleeperLeagueId,
        status: "running",
        details: { start_week: startWeek, end_week: endWeek },
      })
      .select("id")
      .single();
    if (syncRunError) throw syncRunError;
    syncRunId = syncRun.id;

    const { data: fantasyTeams, error: teamError } = await supabase
      .from("fantasy_teams")
      .select("id,sleeper_roster_id")
      .eq("season_id", season.id);
    if (teamError) throw teamError;
    const teamByRoster = new Map((fantasyTeams ?? []).map((team) => [team.sleeper_roster_id, team.id]));

    const weeks = Array.from({ length: endWeek - startWeek + 1 }, (_, index) => startWeek + index);
    const weekResults = await Promise.all(weeks.map(async (week) => {
      const response = await fetch(`${SLEEPER_API}/league/${sleeperLeagueId}/transactions/${week}`);
      if (!response.ok) throw new Error(`Sleeper returned ${response.status} for Week ${week}`);
      return { week, transactions: await response.json() as SleeperTransaction[] };
    }));

    const allTransactions = weekResults.flatMap(({ week, transactions }) =>
      transactions.map((transaction) => ({ ...transaction, leg: transaction.leg || week }))
    );
    const playerIds = [...new Set(allTransactions.flatMap((transaction) => [
      ...Object.keys(transaction.adds ?? {}),
      ...Object.keys(transaction.drops ?? {}),
    ]))];

    const playerById = new Map<string, PlayerRow>();
    for (let index = 0; index < playerIds.length; index += 500) {
      const { data: players, error: playerError } = await supabase
        .from("players")
        .select("sleeper_player_id,full_name,position,nfl_team")
        .in("sleeper_player_id", playerIds.slice(index, index + 500));
      if (playerError) throw playerError;
      for (const player of players ?? []) playerById.set(player.sleeper_player_id, player as PlayerRow);
    }

    const now = new Date().toISOString();
    const transactionRows = allTransactions.map((transaction) => ({
          league_id: season.league_id,
          season_id: season.id,
          provider: "Sleeper",
          provider_transaction_id: transaction.transaction_id,
          season_year: season.year,
          week: transaction.leg,
          transaction_type: transaction.type,
          status: transaction.status,
          creator_provider_id: transaction.creator ?? null,
          faab_bid: Number(transaction.settings?.waiver_bid ?? 0) || null,
          occurred_at: timestamp(transaction.created),
          processed_at: timestamp(transaction.status_updated),
          settings: transaction.settings ?? {},
          metadata: transaction.metadata ?? {},
          raw_data: transaction,
          last_synced_at: now,
          updated_at: now,
    }));

    let storedTransactions: Array<{ id: string; provider_transaction_id: string }> = [];
    if (transactionRows.length) {
      const { data, error: transactionError } = await supabase
        .from("league_transactions")
        .upsert(transactionRows, { onConflict: "provider,provider_transaction_id" })
        .select("id,provider_transaction_id");
      if (transactionError) throw transactionError;
      storedTransactions = data ?? [];
    }

    const storedByProviderId = new Map(
      storedTransactions.map((transaction) => [transaction.provider_transaction_id, transaction.id]),
    );
    const storedIds = storedTransactions.map((transaction) => transaction.id);

    if (storedIds.length) {
      const { error: assetDeleteError } = await supabase
        .from("transaction_assets")
        .delete()
        .in("transaction_id", storedIds);
      if (assetDeleteError) throw assetDeleteError;

      const { error: participantDeleteError } = await supabase
        .from("transaction_participants")
        .delete()
        .in("transaction_id", storedIds);
      if (participantDeleteError) throw participantDeleteError;
    }

    const participantRows: Array<Record<string, unknown>> = [];
    const assetRows: Array<Record<string, unknown>> = [];

    for (const transaction of allTransactions) {
      const transactionId = storedByProviderId.get(transaction.transaction_id);
      if (!transactionId) continue;

      const rosterIds = new Set<number>([
        ...(transaction.roster_ids ?? []),
        ...Object.values(transaction.adds ?? {}),
        ...Object.values(transaction.drops ?? {}),
        ...(transaction.draft_picks ?? []).flatMap((pick) => [pick.previous_owner_id, pick.owner_id]),
        ...(transaction.waiver_budget ?? []).flatMap((transfer) => [transfer.sender, transfer.receiver]),
      ]);
      const consenters = new Set(transaction.consenter_ids ?? []);
      participantRows.push(...[...rosterIds].map((rosterId) => ({
        transaction_id: transactionId,
        fantasy_team_id: teamByRoster.get(rosterId) ?? null,
        provider_roster_id: rosterId,
        consented: consenters.has(rosterId),
      })));

      const addMap = transaction.adds ?? {};
      const dropMap = transaction.drops ?? {};
      const transactionPlayerIds = [...new Set([...Object.keys(addMap), ...Object.keys(dropMap)])];
      assetRows.push(...transactionPlayerIds.map((playerId) => {
        const fromRoster = dropMap[playerId] ?? null;
        const toRoster = addMap[playerId] ?? null;
        const player = playerById.get(playerId);
        return {
          transaction_id: transactionId,
          provider_asset_key: `player:${playerId}`,
          asset_type: "player",
          movement_type: fromRoster && toRoster ? "transfer" : toRoster ? "add" : "drop",
          from_fantasy_team_id: fromRoster ? teamByRoster.get(fromRoster) ?? null : null,
          to_fantasy_team_id: toRoster ? teamByRoster.get(toRoster) ?? null : null,
          from_provider_roster_id: fromRoster,
          to_provider_roster_id: toRoster,
          player_provider_id: playerId,
          player_name: player?.full_name ?? `Player ${playerId}`,
          position: player?.position ?? null,
          pro_team: player?.nfl_team ?? null,
          raw_data: { add_roster_id: toRoster, drop_roster_id: fromRoster },
        };
      }));

      (transaction.draft_picks ?? []).forEach((pick, index) => assetRows.push({
        transaction_id: transactionId,
        provider_asset_key: `pick:${pick.season}:${pick.round}:${pick.roster_id}:${index}`,
        asset_type: "draft_pick",
        movement_type: "transfer",
        from_fantasy_team_id: teamByRoster.get(pick.previous_owner_id) ?? null,
        to_fantasy_team_id: teamByRoster.get(pick.owner_id) ?? null,
        from_provider_roster_id: pick.previous_owner_id,
        to_provider_roster_id: pick.owner_id,
        draft_season: Number(pick.season),
        draft_round: pick.round,
        original_provider_roster_id: pick.roster_id,
        raw_data: pick,
      }));

      (transaction.waiver_budget ?? []).forEach((transfer, index) => assetRows.push({
        transaction_id: transactionId,
        provider_asset_key: `faab:${transfer.sender}:${transfer.receiver}:${index}`,
        asset_type: "faab",
        movement_type: "transfer",
        from_fantasy_team_id: teamByRoster.get(transfer.sender) ?? null,
        to_fantasy_team_id: teamByRoster.get(transfer.receiver) ?? null,
        from_provider_roster_id: transfer.sender,
        to_provider_roster_id: transfer.receiver,
        amount: transfer.amount,
        raw_data: transfer,
      }));
    }

    for (let index = 0; index < participantRows.length; index += 500) {
      const { error } = await supabase
        .from("transaction_participants")
        .insert(participantRows.slice(index, index + 500));
      if (error) throw error;
    }

    for (let index = 0; index < assetRows.length; index += 500) {
        const { error } = await supabase
          .from("transaction_assets")
          .insert(assetRows.slice(index, index + 500));
        if (error) throw error;
    }

    const participantsProcessed = participantRows.length;
    const assetsProcessed = assetRows.length;

    await supabase.from("sync_runs").update({
      status: "success",
      records_processed: allTransactions.length,
      completed_at: new Date().toISOString(),
      details: {
        start_week: startWeek,
        end_week: endWeek,
        transactions: allTransactions.length,
        participants: participantsProcessed,
        assets: assetsProcessed,
      },
    }).eq("id", syncRunId);

    return json({
      success: true,
      transactions_processed: allTransactions.length,
      participants_processed: participantsProcessed,
      assets_processed: assetsProcessed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (syncRunId) {
      await supabase.from("sync_runs").update({
        status: "error",
        error_message: message,
        completed_at: new Date().toISOString(),
      }).eq("id", syncRunId);
    }
    console.error("sync-sleeper-transactions failed:", error);
    return json({ success: false, error: message }, 500);
  }
});
