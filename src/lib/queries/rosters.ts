import { supabase } from "../supabase";

export type RosterPlayer = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  position: string;
  nflTeam: string | null;
  jerseyNumber: number | null;
  age: number | null;
  yearsExperience: number | null;
  injuryStatus: string | null;
  status: string | null;
  isStarter: boolean;
  isReserve: boolean;
  isTaxi: boolean;
};

export type TeamRoster = {
  teamName: string;
  rosterId: number;
  seasonYear: number;
  lastSyncedAt: string;
  players: RosterPlayer[];
};

const positionOrder = new Map([
  ["QB", 1],
  ["RB", 2],
  ["WR", 3],
  ["TE", 4],
  ["K", 5],
  ["DEF", 6],
]);

export async function getTeamRoster(
  sleeperLeagueId: string,
  teamName: string,
): Promise<TeamRoster | null> {
  const { data, error } = await supabase
    .from("fantasy_teams")
    .select(`
      team_name,
      sleeper_roster_id,
      last_synced_at,
      seasons!inner (
        year,
        sleeper_league_id
      ),
      roster_players (
        is_starter,
        is_reserve,
        is_taxi,
        players (
          sleeper_player_id,
          full_name,
          first_name,
          last_name,
          position,
          nfl_team,
          jersey_number,
          age,
          years_experience,
          injury_status,
          status
        )
      )
    `)
    .eq("seasons.sleeper_league_id", sleeperLeagueId)
    .ilike("team_name", teamName)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load team roster: ${error.message}`);
  }

  if (!data) return null;

  const players = (data.roster_players ?? [])
    .flatMap((entry): RosterPlayer[] => {
      const player = entry.players;
      if (!player) return [];

      return [{
        id: player.sleeper_player_id,
        name: player.full_name ??
          ([player.first_name, player.last_name].filter(Boolean).join(" ") || "Unknown Player"),
        firstName: player.first_name,
        lastName: player.last_name,
        position: player.position ?? "Other",
        nflTeam: player.nfl_team,
        jerseyNumber: player.jersey_number,
        age: player.age,
        yearsExperience: player.years_experience,
        injuryStatus: player.injury_status,
        status: player.status,
        isStarter: entry.is_starter,
        isReserve: entry.is_reserve,
        isTaxi: entry.is_taxi,
      }];
    })
    .sort((first, second) =>
      (positionOrder.get(first.position) ?? 99) -
        (positionOrder.get(second.position) ?? 99) ||
      Number(second.isStarter) - Number(first.isStarter) ||
      first.name.localeCompare(second.name)
    );

  return {
    teamName: data.team_name ?? teamName,
    rosterId: data.sleeper_roster_id,
    seasonYear: data.seasons.year,
    lastSyncedAt: data.last_synced_at,
    players,
  };
}

export async function getArchivedTeamRosters(
  seasonYears: number[],
  teamNames: string[],
): Promise<TeamRoster[]> {
  const years = [...new Set(seasonYears)].filter(Number.isInteger);
  const names = [...new Set(teamNames.map((name) => name.trim()))]
    .filter(Boolean);

  if (years.length === 0 || names.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("fantasy_teams")
    .select(`
      team_name,
      sleeper_roster_id,
      last_synced_at,
      seasons!inner (
        year
      ),
      roster_players (
        is_starter,
        is_reserve,
        is_taxi,
        players (
          sleeper_player_id,
          full_name,
          first_name,
          last_name,
          position,
          nfl_team,
          jersey_number,
          age,
          years_experience,
          injury_status,
          status
        )
      )
    `)
    .in("seasons.year", years)
    .in("team_name", names);

  if (error) {
    throw new Error(`Unable to load archived team rosters: ${error.message}`);
  }

  return (data ?? [])
    .map((team): TeamRoster => {
      const players = (team.roster_players ?? [])
        .flatMap((entry): RosterPlayer[] => {
          const player = entry.players;
          if (!player) return [];

          return [{
            id: player.sleeper_player_id,
            name: player.full_name ??
              ([player.first_name, player.last_name].filter(Boolean).join(" ") || "Unknown Player"),
            firstName: player.first_name,
            lastName: player.last_name,
            position: player.position ?? "Other",
            nflTeam: player.nfl_team,
            jerseyNumber: player.jersey_number,
            age: player.age,
            yearsExperience: player.years_experience,
            injuryStatus: player.injury_status,
            status: player.status,
            isStarter: entry.is_starter,
            isReserve: entry.is_reserve,
            isTaxi: entry.is_taxi,
          }];
        })
        .sort((first, second) =>
          (positionOrder.get(first.position) ?? 99) -
            (positionOrder.get(second.position) ?? 99) ||
          Number(second.isStarter) - Number(first.isStarter) ||
          first.name.localeCompare(second.name)
        );

      return {
        teamName: team.team_name ?? names[0] ?? "Unknown Team",
        rosterId: team.sleeper_roster_id,
        seasonYear: team.seasons.year,
        lastSyncedAt: team.last_synced_at,
        players,
      };
    })
    .sort((first, second) => second.seasonYear - first.seasonYear);
}
