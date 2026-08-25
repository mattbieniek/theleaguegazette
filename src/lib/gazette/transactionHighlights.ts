import type { Team } from "../../data/teams";
import type { LeagueTransaction } from "../queries/transactions";

function normalizeName(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function transactionInvolvesTeam(
  transaction: LeagueTransaction,
  team: Pick<Team, "name" | "legacyName" | "aliases">
): boolean {
  const names = new Set(
    [team.name, team.legacyName, ...(team.aliases ?? [])].map(normalizeName)
  );

  return (
    transaction.participants.some((participant) =>
      names.has(normalizeName(participant.teamName))
    ) ||
    transaction.assets.some(
      (asset) =>
        names.has(normalizeName(asset.fromTeamName)) ||
        names.has(normalizeName(asset.toTeamName))
    )
  );
}

export function getHomepageTransactionHighlights(
  transactions: LeagueTransaction[],
  limit = 3
): LeagueTransaction[] {
  return [...transactions]
    .sort((first, second) => {
      const firstTime = first.occurredAt
        ? new Date(first.occurredAt).getTime()
        : 0;
      const secondTime = second.occurredAt
        ? new Date(second.occurredAt).getTime()
        : 0;

      return secondTime - firstTime ||
        second.seasonYear - first.seasonYear ||
        second.week - first.week;
    })
    .slice(0, limit);
}

export function getTeamTransactionHighlights(
  transactions: LeagueTransaction[],
  team: Pick<Team, "name" | "legacyName" | "aliases">,
  limit = 4
): LeagueTransaction[] {
  return transactions
    .filter((transaction) => transactionInvolvesTeam(transaction, team))
    .slice(0, limit);
}
