export type Team = {
  slug: string;
  name: string;
  owner: string;
  legacyName: string;
  aliases?: string[];
  primary: string;
  secondary: string;
  logo: string;
};

export function getFormerTeamNames(team: Team): string[] {
  const currentName = team.name.trim().toLowerCase();

  return [...(team.aliases ?? []), team.legacyName]
    .map((name) => name.trim())
    .filter(
      (name, index, names) =>
        name.length > 0 &&
        !name.endsWith("...") &&
        name.toLowerCase() !== currentName &&
        names.findIndex(
          (candidate) =>
            candidate.toLowerCase() === name.toLowerCase()
        ) === index
    );
}

export function findTeamByName(name: string | null): Team | null {
  const normalizedName = name?.trim().toLowerCase().replace(/\.\.\.$/, "");

  if (!normalizedName) {
    return null;
  }

  return teams.find((team) =>
    [team.name, team.legacyName, ...(team.aliases ?? [])].some(
      (candidate) => {
        const normalizedCandidate = candidate.trim().toLowerCase();
        return normalizedCandidate === normalizedName ||
          normalizedCandidate.startsWith(normalizedName);
      }
    )
  ) ?? null;
}

export const teams: Team[] = [
  { slug: 'haddonfield-slashers', name: 'Haddonfield Slashers', owner: 'Matt Bieniek', legacyName: 'Haddonfield Slashers', primary: '#D96A1B', secondary: '#9E1F1F', logo: '/logos/haddonfield.webp' },
  { slug: 'the-reapers', name: 'The Reapers', owner: 'Nick Lewandowski', legacyName: 'Spooky Football', aliases: ['JC Spooky football', 'GimmeTheLOUt'], primary: '#8B1E2D', secondary: '#E8E2D6', logo: '/logos/reapers.webp' },
  { slug: 'super-qb-hut-general', name: 'Super QB Hut General', owner: 'Julia Kurdys', legacyName: 'The Watergirl', aliases: ['The Bloody Marys'], primary: '#D8A227', secondary: '#B42C2C', logo: '/logos/qb-hut.webp' },
  { slug: 'love-and-fantasy-football', name: 'Love and Fantasy Football', owner: 'Scott Baker', legacyName: 'Columbus Conqueeftadors', aliases: ['The Columbus Conqu3eft...', 'The Columbus Conqu3eftadors'], primary: '#D8577C', secondary: '#F4C3D0', logo: '/logos/love-football.webp' },
  { slug: 'naberhood-watch', name: 'Naberhood Watch', owner: 'Brandon Smith', legacyName: 'Brimhaven Pirates', primary: '#203B73', secondary: '#C89C2B', logo: '/logos/naberhood.webp' },
  { slug: 'jamario-kart-racers', name: 'JaMario Kart Racers', owner: 'AJ Kurdys', legacyName: 'Washington Fantasy Team', primary: '#D73B2F', secondary: '#3A7BD5', logo: '/logos/jamario.webp' },
  { slug: 'shinra-tensei-pain', name: 'Shinra Tensei Pain', owner: 'Derek King', legacyName: 'Mud Village Team Kakashi', aliases: ['Mud Village Team Kaka...'], primary: '#7447C6', secondary: '#53B8FF', logo: '/logos/shinra.webp' },
  { slug: 'egyptian-suns', name: 'Egyptian Suns', owner: 'Amir Elgeyoushi', legacyName: 'Egyptian Suns', primary: '#D8A33B', secondary: '#E25C2A', logo: '/logos/egyptian-suns.webp' },
  { slug: 'fremennik-exiles', name: 'Fremennik Exiles', owner: 'Brennan Kurdys', legacyName: 'Fremennik Exiles', primary: '#4A6B8A', secondary: '#B58A33', logo: '/logos/fremennik.webp' },
  { slug: 'edgeville-nut-eaters', name: 'Edgeville Nut Eaters', owner: 'Randy Todd', legacyName: 'Edgeville Nut Eaters', primary: '#8A5A2B', secondary: '#5E8C3A', logo: '/logos/edgeville.webp' }
];
