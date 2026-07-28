import type { Team } from "../../data/teams";
import type { DraftEdition, DraftPick } from "../queries/drafts";

export type TeamDraftClass = {
  providerDraftId: string;
  seasonYear: number;
  name: string;
  provider: string;
  draftSlot: number | null;
  picks: DraftPick[];
};

export type TeamDraftHistory = {
  classes: TeamDraftClass[];
  totalPicks: number;
  seasonsDrafted: number;
  latestSeason: number;
  earliestSeason: number;
};

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function belongsToTeam(pick: DraftPick, team: Team): boolean {
  if (pick.fantasyTeam?.slug === team.slug) return true;

  const pickName = normalize(pick.fantasyTeamName);
  return [team.name, team.legacyName].some(
    (name) => normalize(name) === pickName
  );
}

export function buildTeamDraftHistory(
  drafts: DraftEdition[],
  team: Team
): TeamDraftHistory | null {
  const classes = drafts
    .map((draft): TeamDraftClass | null => {
      const picks = draft.picks
        .filter((pick) => belongsToTeam(pick, team))
        .sort((first, second) => first.pickNumber - second.pickNumber);

      if (picks.length === 0) return null;

      return {
        providerDraftId: draft.providerDraftId,
        seasonYear: draft.seasonYear,
        name: draft.name,
        provider: draft.provider,
        draftSlot: picks.find((pick) => pick.draftSlot !== null)?.draftSlot ?? null,
        picks,
      };
    })
    .filter((draftClass): draftClass is TeamDraftClass => draftClass !== null)
    .sort((first, second) => second.seasonYear - first.seasonYear);

  if (classes.length === 0) return null;

  return {
    classes,
    totalPicks: classes.reduce((total, draftClass) => total + draftClass.picks.length, 0),
    seasonsDrafted: classes.length,
    latestSeason: classes[0].seasonYear,
    earliestSeason: classes.at(-1)?.seasonYear ?? classes[0].seasonYear,
  };
}
