import type { TeamRoster, RosterPlayer } from "../queries/rosters";
import type { WeeklyTeamResult } from "../queries/awards";
import type { WeeklyMatchup, MatchupPlayer } from "../queries/matchups";
import type { DraftEdition, DraftPick } from "../queries/drafts";
import type {
  LeagueTransaction,
  TransactionAsset,
  TransactionParticipant,
} from "../queries/transactions";
import type { PlayerWeeklyScore } from "../queries/playerScores";
import { findTeamByName } from "../../data/teams";

import matchups2022 from "../../../data/legacy/2022/matchups.json";
import rosters2022 from "../../../data/legacy/2022/rosters.json";
import draft2022 from "../../../data/legacy/2022/draft.json";
import transactions2022 from "../../../data/legacy/2022/transactions.json";
import matchups2023 from "../../../data/legacy/2023/matchups.json";
import rosters2023 from "../../../data/legacy/2023/rosters.json";
import draft2023 from "../../../data/legacy/2023/draft.json";
import transactions2023 from "../../../data/legacy/2023/transactions.json";

type LegacyRow = string[];
type LegacyPlayer = {
  slot: string;
  player: string;
  position: string;
  nflTeam: string;
  points: number;
};
type LegacyRosterTeam = {
  team: string;
  starters: LegacyPlayer[];
  bench: LegacyPlayer[];
};
type LegacyRosterMatchup = {
  matchupIndex: number;
  week: number;
  team1: string;
  team2: string;
  teams: LegacyRosterTeam[];
};

const legacyMatchupSources = [
  { year: 2022, rows: matchups2022 as LegacyRow[], rosters: rosters2022 as LegacyRosterMatchup[] },
  { year: 2023, rows: matchups2023 as LegacyRow[], rosters: rosters2023 as LegacyRosterMatchup[] },
];

function cleanTeamName(value: string | null | undefined): string {
  return value?.split("\n")[0]?.trim() ?? "Unknown Team";
}

function historicalTeamName(value: string | null | undefined): string {
  const cleaned = cleanTeamName(value);
  if (!cleaned.endsWith("...")) return cleaned;
  const profile = findTeamByName(cleaned);
  return profile?.legacyName && profile.legacyName !== profile.name
    ? profile.legacyName
    : cleaned;
}

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function weekNumber(value: unknown): number {
  const match = String(value ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function slugForTeam(name: string): string {
  return findTeamByName(name)?.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sameTeam(first: string | null | undefined, second: string | null | undefined): boolean {
  const firstProfile = findTeamByName(cleanTeamName(first));
  const secondProfile = findTeamByName(cleanTeamName(second));
  if (firstProfile && secondProfile) return firstProfile.slug === secondProfile.slug;

  const left = cleanTeamName(first).toLowerCase().replace(/\.\.\.$/g, "");
  const right = cleanTeamName(second).toLowerCase().replace(/\.\.\.$/g, "");
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function matchupRows(source: (typeof legacyMatchupSources)[number]): LegacyRow[] {
  return source.rows.filter((row) => row[0]?.toLowerCase() !== "week");
}

function rosterFor(source: (typeof legacyMatchupSources)[number], index: number): LegacyRosterMatchup | null {
  return source.rosters.find((roster) => roster.matchupIndex === index + 1) ?? source.rosters[index] ?? null;
}

function rosterTeamFor(roster: LegacyRosterMatchup | null, name: string): LegacyRosterTeam | null {
  return roster?.teams.find((team) => sameTeam(team.team, name)) ?? null;
}

function lineupFor(rosterTeam: LegacyRosterTeam | null, year: number, matchupIndex: number): MatchupPlayer[] {
  if (!rosterTeam) return [];
  const starters = (rosterTeam.starters ?? []).map((player, index) => ({ player, index, isStarter: true }));
  const bench = (rosterTeam.bench ?? []).map((player, index) => ({ player, index, isStarter: false }));
  return [...starters, ...bench].map(({ player, index, isStarter }) => ({
    sleeperPlayerId: `legacy-${year}-${matchupIndex}-${rosterTeam.team}-${index}`,
    name: player.player,
    position: player.position || player.slot || "Other",
    nflTeam: player.nflTeam && player.nflTeam !== "N/A" ? player.nflTeam : null,
    points: numberValue(player.points),
    isStarter,
  }));
}

function playerSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getLegacyPlayerWeeklyScores(season?: number): PlayerWeeklyScore[] {
  const scores = new Map<string, PlayerWeeklyScore>();

  for (const source of legacyMatchupSources) {
    if (season && source.year !== season) continue;

    for (const roster of source.rosters) {
      for (const team of roster.teams) {
        for (const player of [...(team.starters ?? []), ...(team.bench ?? [])]) {
          const playerId = `legacy-${source.year}-${playerSlug(player.player)}`;
          const key = `${source.year}-${roster.week}-${playerId}`;
          const score: PlayerWeeklyScore = {
            season_year: source.year,
            week: roster.week,
            sleeper_player_id: playerId,
            player_name: player.player,
            position: player.position || player.slot || "Other",
            nfl_team: player.nflTeam && player.nflTeam !== "N/A" ? player.nflTeam : null,
            points: numberValue(player.points),
          };
          const existing = scores.get(key);
          if (!existing || score.points > existing.points) scores.set(key, score);
        }
      }
    }
  }

  return [...scores.values()].sort((first, second) =>
    first.season_year - second.season_year ||
    first.week - second.week ||
    second.points - first.points
  );
}

function pointsFrom(rosterTeam: LegacyRosterTeam | null, starters: boolean): number {
  return (starters ? rosterTeam?.starters : rosterTeam?.bench)?.reduce((sum, player) => sum + numberValue(player.points), 0) ?? 0;
}

export function getLegacyResults(): WeeklyTeamResult[] {
  return legacyMatchupSources.flatMap((source) => matchupRows(source).flatMap((row, index) => {
    const week = weekNumber(row[0]);
    const firstName = historicalTeamName(row[1]);
    const secondName = historicalTeamName(row[3]);
    const firstScore = numberValue(row[2]);
    const secondScore = numberValue(row[4]);
    if (!week || !firstName || !secondName) return [];

    const roster = rosterFor(source, index);
    const firstRoster = rosterTeamFor(roster, firstName);
    const secondRoster = rosterTeamFor(roster, secondName);
    const matchupId = `legacy-${source.year}-${index + 1}`;
    const firstResult = firstScore === secondScore ? "T" : firstScore > secondScore ? "W" : "L";
    const secondResult = firstScore === secondScore ? "T" : firstScore > secondScore ? "L" : "W";

    return [
      {
        matchup_id: matchupId,
        season_year: source.year,
        week,
        sleeper_matchup_id: index + 1,
        fantasy_team_id: `legacy-${source.year}-${slugForTeam(firstName)}`,
        team_name: firstName,
        opponent_fantasy_team_id: `legacy-${source.year}-${slugForTeam(secondName)}`,
        opponent_team_name: secondName,
        points_for: firstScore,
        points_against: secondScore,
        point_differential: firstScore - secondScore,
        starters_points: pointsFrom(firstRoster, true),
        bench_points: pointsFrom(firstRoster, false),
        result: firstResult,
        is_winner: firstResult === "W",
        is_tie: firstResult === "T",
      },
      {
        matchup_id: matchupId,
        season_year: source.year,
        week,
        sleeper_matchup_id: index + 1,
        fantasy_team_id: `legacy-${source.year}-${slugForTeam(secondName)}`,
        team_name: secondName,
        opponent_fantasy_team_id: `legacy-${source.year}-${slugForTeam(firstName)}`,
        opponent_team_name: firstName,
        points_for: secondScore,
        points_against: firstScore,
        point_differential: secondScore - firstScore,
        starters_points: pointsFrom(secondRoster, true),
        bench_points: pointsFrom(secondRoster, false),
        result: secondResult,
        is_winner: secondResult === "W",
        is_tie: secondResult === "T",
      },
    ];
  }));
}

export function getLegacyMatchups(): WeeklyMatchup[] {
  return legacyMatchupSources.flatMap((source) => matchupRows(source).flatMap((row, index) => {
    const week = weekNumber(row[0]);
    const firstName = historicalTeamName(row[1]);
    const secondName = historicalTeamName(row[3]);
    const firstScore = numberValue(row[2]);
    const secondScore = numberValue(row[4]);
    if (!week || !firstName || !secondName) return [];
    const roster = rosterFor(source, index);
    const firstRoster = rosterTeamFor(roster, firstName);
    const secondRoster = rosterTeamFor(roster, secondName);
    const tie = firstScore === secondScore;
    return [{
      id: `legacy-${source.year}-${index + 1}`,
      sleeperMatchupId: index + 1,
      week,
      seasonYear: source.year,
      teams: [
        {
          matchupTeamId: `legacy-${source.year}-${index + 1}-1`,
          fantasyTeamId: `legacy-${source.year}-${slugForTeam(firstName)}`,
          teamName: firstName,
          points: firstScore,
          startersPoints: pointsFrom(firstRoster, true),
          benchPoints: pointsFrom(firstRoster, false),
          result: tie ? "T" : firstScore > secondScore ? "W" : "L",
          isWinner: firstScore > secondScore,
          isTie: tie,
          lineup: lineupFor(firstRoster, source.year, index + 1),
        },
        {
          matchupTeamId: `legacy-${source.year}-${index + 1}-2`,
          fantasyTeamId: `legacy-${source.year}-${slugForTeam(secondName)}`,
          teamName: secondName,
          points: secondScore,
          startersPoints: pointsFrom(secondRoster, true),
          benchPoints: pointsFrom(secondRoster, false),
          result: tie ? "T" : secondScore > firstScore ? "W" : "L",
          isWinner: secondScore > firstScore,
          isTie: tie,
          lineup: lineupFor(secondRoster, source.year, index + 1),
        },
      ],
    } satisfies WeeklyMatchup];
  }));
}

function parseDraftPick(value: string, playerValue: string, teamValue: string, keeperValue: string, year: number): DraftPick {
  const pickMatch = value.match(/^(\d+)\.(\d+)\s*\((\d+)\)/);
  const parts = playerValue.split(" · ").map((part) => part.trim());
  const playerName = parts[0] || "Unknown Player";
  const position = parts[1] || null;
  const proTeam = parts[2]?.replace(/^\(|\)$/g, "") || null;
  const pickNumber = Number(pickMatch?.[3] ?? 0);
  const round = Number(pickMatch?.[1] ?? 0);
  const roundPick = Number(pickMatch?.[2] ?? 0);
  const fantasyTeamName = historicalTeamName(teamValue);
  return {
    pickNumber,
    round,
    roundPick,
    draftSlot: roundPick || null,
    rosterId: null,
    playerId: `legacy-${year}-${pickNumber}`,
    playerName,
    position,
    proTeam,
    isKeeper: keeperValue.trim() !== "--" && keeperValue.trim() !== "",
    fantasyTeamName,
    fantasyTeam: findTeamByName(fantasyTeamName),
  };
}

export function getLegacyDrafts(): DraftEdition[] {
  const sources = [
    { year: 2022, rows: draft2022 as LegacyRow[] },
    { year: 2023, rows: draft2023 as LegacyRow[] },
  ];
  return sources.map((source) => {
    const picks = source.rows.filter((row) => row[0]?.toLowerCase() !== "pick").map((row) => parseDraftPick(row[0] ?? "", row[1] ?? "", row[2] ?? "", row[3] ?? "", source.year));
    return {
      providerDraftId: `legacy-${source.year}`,
      seasonYear: source.year,
      name: `${source.year} ESPN Draft Import`,
      provider: "ESPN import",
      status: "complete",
      draftType: "snake",
      rounds: Math.max(0, ...picks.map((pick) => pick.round)),
      teamCount: new Set(picks.map((pick) => pick.fantasyTeamName)).size,
      picks,
    };
  });
}

function parseTransactionPlayer(value: string): Pick<TransactionAsset, "playerName" | "position" | "proTeam"> {
  const parts = value.split(" · ").map((part) => part.trim());
  return {
    playerName: parts[0] || null,
    proTeam: parts[1] || null,
    position: parts[2] || null,
  };
}

export function getLegacyTransactions(): LeagueTransaction[] {
  const sources = [
    { year: 2022, rows: transactions2022 as LegacyRow[] },
    { year: 2023, rows: transactions2023 as LegacyRow[] },
  ];
  return sources.flatMap((source) => source.rows.filter((row) => row[0]?.toLowerCase() !== "transaction at").map((row, index) => {
    const participantName = historicalTeamName(row[2]);
    const participant: TransactionParticipant = {
      rosterId: index + 1,
      fantasyTeamId: `legacy-${source.year}-${slugForTeam(participantName)}`,
      teamName: participantName,
      consented: true,
    };
    const assets = (row[3] ?? "").split("\n").filter(Boolean).map((value, assetIndex) => ({
      id: `legacy-${source.year}-${index + 1}-${assetIndex + 1}`,
      assetType: "player",
      movementType: "transfer",
      fromTeamName: null,
      toTeamName: participantName,
      ...parseTransactionPlayer(value),
      draftSeason: null,
      draftRound: null,
      amount: null,
    } satisfies TransactionAsset));
    return {
      id: `legacy-${source.year}-${index + 1}`,
      provider: "ESPN import",
      providerTransactionId: `legacy-${source.year}-${index + 1}`,
      seasonYear: source.year,
      week: weekNumber(row[0]),
      type: "free_agent",
      status: "complete",
      faabBid: row[4] ? numberValue(row[4]) : null,
      occurredAt: null,
      participants: [participant],
      assets,
    };
  }).filter((transaction) => transaction.week > 0));
}

export function getLegacyTeamRoster(year: number, teamName: string): TeamRoster | null {
  const source = legacyMatchupSources.find((item) => item.year === year);
  if (!source) return null;
  const roster = source.rosters.find((item) => item.teams.some((team) => sameTeam(team.team, teamName)));
  const team = roster?.teams.find((item) => sameTeam(item.team, teamName));
  if (!team) return null;
  const players = [...(team.starters ?? []).map((player, index) => ({ player, isStarter: true, index })), ...(team.bench ?? []).map((player, index) => ({ player, isStarter: false, index }))].map(({ player, isStarter, index }): RosterPlayer => ({
    id: `legacy-${year}-${slugForTeam(teamName)}-${index}`,
    name: player.player,
    firstName: null,
    lastName: null,
    position: player.position || player.slot || "Other",
    nflTeam: player.nflTeam === "N/A" ? null : player.nflTeam,
    jerseyNumber: null,
    age: null,
    yearsExperience: null,
    injuryStatus: null,
    status: "historical",
    isStarter,
    isReserve: !isStarter,
    isTaxi: false,
  }));
  return {
    teamName: cleanTeamName(team.team),
    rosterId: 0,
    seasonYear: year,
    lastSyncedAt: `${year}-12-31T00:00:00.000Z`,
    players,
  };
}
