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

export const teams: Team[] = [
  { slug: 'haddonfield-slashers', name: 'Haddonfield Slashers', owner: 'Matt Bieniek', legacyName: 'Haddonfield Slashers', primary: '#D96A1B', secondary: '#9E1F1F', logo: '/logos/haddonfield.webp' },
  { slug: 'the-reapers', name: 'The Reapers', owner: 'Nick Lewandowski', legacyName: 'Spooky Football', primary: '#8B1E2D', secondary: '#E8E2D6', logo: '/logos/reapers.webp' },
  { slug: 'super-qb-hut-general', name: 'Super QB Hut General', owner: 'Julia Kurdys', legacyName: 'The Watergirl', aliases: ['The Bloody Marys'], primary: '#D8A227', secondary: '#B42C2C', logo: '/logos/qb-hut.webp' },
  { slug: 'love-and-fantasy-football', name: 'Love and Fantasy Football', owner: 'Scott Baker', legacyName: 'Columbus Conqueeftadors', primary: '#D8577C', secondary: '#F4C3D0', logo: '/logos/love-football.webp' },
  { slug: 'naberhood-watch', name: 'Naberhood Watch', owner: 'Brandon Smith', legacyName: 'Brimhaven Pirates', primary: '#203B73', secondary: '#C89C2B', logo: '/logos/naberhood.webp' },
  { slug: 'jamario-kart-racers', name: 'JaMario Kart Racers', owner: 'AJ Kurdys', legacyName: 'Washington Fantasy Team', primary: '#D73B2F', secondary: '#3A7BD5', logo: '/logos/jamario.webp' },
  { slug: 'shinra-tensei-pain', name: 'Shinra Tensei Pain', owner: 'Derek King', legacyName: 'Mud Village Team Kakashi', primary: '#7447C6', secondary: '#53B8FF', logo: '/logos/shinra.webp' },
  { slug: 'egyptian-suns', name: 'Egyptian Suns', owner: 'Amir Elgeyoushi', legacyName: 'Egyptian Suns', primary: '#D8A33B', secondary: '#E25C2A', logo: '/logos/egyptian-suns.webp' },
  { slug: 'fremennik-exiles', name: 'Fremennik Exiles', owner: 'Brennan Kurdys', legacyName: 'Fremennik Exiles', primary: '#4A6B8A', secondary: '#B58A33', logo: '/logos/fremennik.webp' },
  { slug: 'edgeville-nut-eaters', name: 'Edgeville Nut Eaters', owner: 'Randy Todd', legacyName: 'Edgeville Nut Eaters', primary: '#8A5A2B', secondary: '#5E8C3A', logo: '/logos/edgeville.webp' }
];
