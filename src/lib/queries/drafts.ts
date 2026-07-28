import { supabase } from "../supabase";
import { teams, type Team } from "../../data/teams";

const SLEEPER_API = "https://api.sleeper.app/v1";

export type DraftPick = {
  pickNumber: number;
  round: number;
  roundPick: number;
  draftSlot: number | null;
  rosterId: number | null;
  playerId: string | null;
  playerName: string;
  position: string | null;
  proTeam: string | null;
  isKeeper: boolean;
  fantasyTeamName: string | null;
  fantasyTeam: Team | null;
};

export type DraftEdition = {
  providerDraftId: string;
  seasonYear: number;
  name: string;
  provider: string;
  status: string;
  draftType: string;
  rounds: number;
  teamCount: number;
  picks: DraftPick[];
};

type SleeperDraft = {
  draft_id: string;
  season: string;
  status: string;
  type: string;
  settings?: { rounds?: number; teams?: number };
  metadata?: { name?: string };
};

type SleeperPick = {
  pick_no: number;
  round: number;
  draft_slot: number | null;
  roster_id: number | null;
  player_id: string | null;
  is_keeper: boolean | null;
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
};

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function getStaticTeam(teamName: string | null): Team | null {
  if (!teamName) return null;
  return teams.find((team) =>
    [team.name, team.legacyName].some((name) => normalize(name) === normalize(teamName))
  ) ?? null;
}

async function getStoredDrafts(): Promise<DraftEdition[] | null> {
  const { data, error } = await supabase
    .from("drafts")
    .select(`
      provider_draft_id,
      season_year,
      name,
      provider,
      status,
      draft_type,
      rounds,
      team_count,
      draft_picks (
        pick_number,
        round,
        round_pick,
        draft_slot,
        roster_id,
        player_provider_id,
        player_name,
        position,
        pro_team,
        is_keeper,
        fantasy_teams (
          team_name
        )
      )
    `)
    .order("season_year", { ascending: false })
    .order("pick_number", {
      referencedTable: "draft_picks",
      ascending: true,
    });

  if (error) {
    console.warn("Stored draft archive unavailable; using Sleeper fallback.", error.message);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data.map((draft): DraftEdition => {
    const teamCount = draft.team_count ?? 0;
    const picks = (draft.draft_picks ?? []).map((pick): DraftPick => {
      const teamName = pick.fantasy_teams?.team_name ?? null;

      return {
        pickNumber: pick.pick_number,
        round: pick.round,
        roundPick: pick.round_pick,
        draftSlot: pick.draft_slot,
        rosterId: pick.roster_id,
        playerId: pick.player_provider_id,
        playerName: pick.player_name,
        position: pick.position,
        proTeam: pick.pro_team,
        isKeeper: pick.is_keeper,
        fantasyTeamName: teamName,
        fantasyTeam: getStaticTeam(teamName),
      };
    });

    return {
      providerDraftId: draft.provider_draft_id,
      seasonYear: draft.season_year,
      name: draft.name ?? `${draft.season_year} Draft`,
      provider: draft.provider,
      status: draft.status ?? "unknown",
      draftType: draft.draft_type ?? "unknown",
      rounds: draft.rounds ?? Math.max(0, ...picks.map((pick) => pick.round)),
      teamCount: teamCount || new Set(picks.map((pick) => pick.rosterId)).size,
      picks,
    };
  });
}

async function getRosterTeamMap(sleeperLeagueId: string) {
  const { data } = await supabase
    .from("fantasy_teams")
    .select("sleeper_roster_id,team_name,seasons!inner(sleeper_league_id)")
    .eq("seasons.sleeper_league_id", sleeperLeagueId);

  return new Map(
    (data ?? []).map((team) => [
      team.sleeper_roster_id,
      { name: team.team_name, profile: getStaticTeam(team.team_name) },
    ]),
  );
}

async function getSleeperDrafts(sleeperLeagueId: string): Promise<DraftEdition[]> {
  const draftResponse = await fetch(`${SLEEPER_API}/league/${sleeperLeagueId}/drafts`);
  if (!draftResponse.ok) return [];
  const sleeperDrafts = await draftResponse.json() as SleeperDraft[];
  const rosterTeams = await getRosterTeamMap(sleeperLeagueId);

  return Promise.all(sleeperDrafts.map(async (draft) => {
    const pickResponse = await fetch(`${SLEEPER_API}/draft/${draft.draft_id}/picks`);
    const rawPicks = pickResponse.ok ? await pickResponse.json() as SleeperPick[] : [];
    const teamCount = Number(draft.settings?.teams ?? 0) || 10;

    const picks = rawPicks.map((pick): DraftPick => {
      const mappedTeam = pick.roster_id ? rosterTeams.get(pick.roster_id) : null;
      const playerName = [pick.metadata?.first_name, pick.metadata?.last_name]
        .filter(Boolean)
        .join(" ") || `Player ${pick.player_id ?? pick.pick_no}`;

      return {
        pickNumber: pick.pick_no,
        round: pick.round,
        roundPick: ((pick.pick_no - 1) % teamCount) + 1,
        draftSlot: pick.draft_slot,
        rosterId: pick.roster_id,
        playerId: pick.player_id,
        playerName,
        position: pick.metadata?.position ?? null,
        proTeam: pick.metadata?.team ?? null,
        isKeeper: pick.is_keeper === true,
        fantasyTeamName: mappedTeam?.name ?? null,
        fantasyTeam: mappedTeam?.profile ?? null,
      };
    });

    return {
      providerDraftId: draft.draft_id,
      seasonYear: Number(draft.season),
      name: draft.metadata?.name ?? `${draft.season} Draft`,
      provider: "Sleeper",
      status: draft.status,
      draftType: draft.type,
      rounds: Number(draft.settings?.rounds ?? 0),
      teamCount,
      picks,
    };
  }));
}

export async function getDraftArchive(sleeperLeagueId: string): Promise<DraftEdition[]> {
  const storedDrafts = await getStoredDrafts();
  if (storedDrafts) {
    return storedDrafts;
  }

  const drafts = await getSleeperDrafts(sleeperLeagueId);
  return drafts.sort((a, b) => b.seasonYear - a.seasonYear);
}
