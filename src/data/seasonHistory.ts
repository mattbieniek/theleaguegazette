export type SeasonProvider = "sleeper" | "espn" | "manual";

export type SeasonHistoryMetadata = {
  year: number;
  provider: SeasonProvider;
  champion: string | null;
  runnerUp: string | null;
  championshipWeek: number | null;
  notes?: string;
};

/*
 * Provider-neutral season facts that cannot be inferred safely from weekly
 * score rows alone. Future ESPN or Sleeper imports can add one entry here
 * without changing any archive page or presentation component.
 */
export const seasonHistoryMetadata: SeasonHistoryMetadata[] = [
  {
    year: 2022,
    provider: "espn",
    champion: "The Watergirl",
    runnerUp: "JC Spooky football",
    championshipWeek: 17,
    notes: "Historical ESPN export imported from the league archive.",
  },
  {
    year: 2023,
    provider: "espn",
    champion: "The Columbus Conqu3eft...",
    runnerUp: "GimmeTheLOUt",
    championshipWeek: 17,
    notes: "Historical ESPN export imported from the league archive.",
  },
  {
    year: 2024,
    provider: "sleeper",
    champion: "Egyptian Suns",
    runnerUp: "The Bloody Marys",
    championshipWeek: 17,
    notes: "Championship result verified from the Sleeper winners bracket.",
  },
  {
    year: 2025,
    provider: "sleeper",
    champion: "The Reapers",
    runnerUp: "Haddonfield Slashers",
    championshipWeek: 17,
    notes: "Championship result verified from the Sleeper winners bracket.",
  },
];

export function getSeasonHistoryMetadata(
  year: number
): SeasonHistoryMetadata | null {
  return (
    seasonHistoryMetadata.find((season) => season.year === year) ?? null
  );
}
