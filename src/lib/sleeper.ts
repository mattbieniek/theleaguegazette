import { ACTIVE_SLEEPER_LEAGUE_ID } from "./currentLeague";

export const LEAGUE_ID = ACTIVE_SLEEPER_LEAGUE_ID;
const API = 'https://api.sleeper.app/v1';

export type SleeperLeague = { league_id: string; name: string; season: string; total_rosters: number; settings?: Record<string, number> };
export type SleeperUser = { user_id: string; display_name: string; metadata?: { team_name?: string } };
export type SleeperRoster = { roster_id: number; owner_id: string; settings: { wins: number; losses: number; ties?: number; fpts: number; fpts_decimal?: number; fpts_against?: number; fpts_against_decimal?: number } };

export async function getLeague() {
  return fetch(`${API}/league/${LEAGUE_ID}`).then(r => {
    if (!r.ok) throw new Error('Sleeper league request failed');
    return r.json() as Promise<SleeperLeague>;
  });
}

export async function getUsers() {
  return fetch(`${API}/league/${LEAGUE_ID}/users`).then(r => r.json() as Promise<SleeperUser[]>);
}

export async function getRosters() {
  return fetch(`${API}/league/${LEAGUE_ID}/rosters`).then(r => r.json() as Promise<SleeperRoster[]>);
}

export async function getDrafts() {
  return fetch(`${API}/league/${LEAGUE_ID}/drafts`).then(r => r.json());
}
