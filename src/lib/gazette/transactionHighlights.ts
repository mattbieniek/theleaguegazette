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
  const editorialMoves = transactions.filter(
    (transaction) =>
      transaction.type === "trade" || transaction.type === "waiver"
  );

  const selected = editorialMoves.slice(0, limit);
  const selectedIds = new Set(selected.map((transaction) => transaction.id));

  for (const transaction of transactions) {
    if (selected.length >= limit) break;
    if (!selectedIds.has(transaction.id)) selected.push(transaction);
  }

  return selected;
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
