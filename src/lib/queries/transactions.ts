import { supabase } from "../supabase";

export type TransactionParticipant = {
  rosterId: number;
  fantasyTeamId: string | null;
  teamName: string | null;
  consented: boolean;
};

export type TransactionAsset = {
  id: string;
  assetType: "player" | "draft_pick" | "faab" | string;
  movementType: "add" | "drop" | "transfer" | string;
  fromTeamName: string | null;
  toTeamName: string | null;
  playerName: string | null;
  position: string | null;
  proTeam: string | null;
  draftSeason: number | null;
  draftRound: number | null;
  amount: number | null;
};

export type LeagueTransaction = {
  id: string;
  provider: string;
  providerTransactionId: string;
  seasonYear: number;
  week: number;
  type: string;
  status: string;
  faabBid: number | null;
  occurredAt: string | null;
  participants: TransactionParticipant[];
  assets: TransactionAsset[];
};

type RelatedTeam = { team_name?: string | null } | Array<{ team_name?: string | null }> | null;

function teamName(value: RelatedTeam): string | null {
  const team = Array.isArray(value) ? value[0] : value;
  return team?.team_name ?? null;
}

export async function getTransactionArchive(): Promise<LeagueTransaction[]> {
  const { data, error } = await supabase
    .from("league_transactions")
    .select(`
      id,
      provider,
      provider_transaction_id,
      season_year,
      week,
      transaction_type,
      status,
      faab_bid,
      occurred_at,
      transaction_participants (
        provider_roster_id,
        fantasy_team_id,
        consented,
        fantasy_teams (team_name)
      ),
      transaction_assets (
        id,
        asset_type,
        movement_type,
        player_name,
        position,
        pro_team,
        draft_season,
        draft_round,
        amount,
        from_team:fantasy_teams!transaction_assets_from_fantasy_team_id_fkey (team_name),
        to_team:fantasy_teams!transaction_assets_to_fantasy_team_id_fkey (team_name)
      )
    `)
    .eq("status", "complete")
    .order("season_year", { ascending: false })
    .order("week", { ascending: false })
    .order("occurred_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.warn("Transaction archive unavailable.", error.message);
    return [];
  }

  return (data ?? []).map((row): LeagueTransaction => ({
    id: String(row.id),
    provider: String(row.provider),
    providerTransactionId: String(row.provider_transaction_id),
    seasonYear: Number(row.season_year),
    week: Number(row.week),
    type: String(row.transaction_type),
    status: String(row.status),
    faabBid: row.faab_bid === null ? null : Number(row.faab_bid),
    occurredAt: typeof row.occurred_at === "string" ? row.occurred_at : null,
    participants: (row.transaction_participants ?? []).map((participant) => ({
      rosterId: Number(participant.provider_roster_id),
      fantasyTeamId: participant.fantasy_team_id ?? null,
      teamName: teamName(participant.fantasy_teams as RelatedTeam),
      consented: participant.consented === true,
    })),
    assets: (row.transaction_assets ?? []).map((asset) => ({
      id: String(asset.id),
      assetType: String(asset.asset_type),
      movementType: String(asset.movement_type),
      fromTeamName: teamName(asset.from_team as RelatedTeam),
      toTeamName: teamName(asset.to_team as RelatedTeam),
      playerName: asset.player_name ?? null,
      position: asset.position ?? null,
      proTeam: asset.pro_team ?? null,
      draftSeason: asset.draft_season === null ? null : Number(asset.draft_season),
      draftRound: asset.draft_round === null ? null : Number(asset.draft_round),
      amount: asset.amount === null ? null : Number(asset.amount),
    })),
  }));
}
