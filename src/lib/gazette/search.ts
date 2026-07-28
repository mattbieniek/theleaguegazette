import type { GazetteArticle } from "../queries/gazette";
import type { Team } from "../../data/teams";

export type SearchDestination = {
  title: string;
  description: string;
  href: string;
  section: string;
  keywords: string[];
};

export type SearchResults = {
  stories: GazetteArticle[];
  teams: Team[];
  destinations: SearchDestination[];
  total: number;
};

export const searchDestinations: SearchDestination[] = [
  { title: "Weekly Matchups", description: "Browse scores and head-to-head results by week.", href: "/matchups", section: "League", keywords: ["games", "scores", "schedule", "week"] },
  { title: "League Standings", description: "Current records, rankings and scoring totals.", href: "/standings", section: "League", keywords: ["rankings", "record", "wins", "losses"] },
  { title: "League Statistics", description: "Season leaders and franchise performance tables.", href: "/stats", section: "League", keywords: ["stats", "leaders", "points", "performance"] },
  { title: "Weekly Awards", description: "The best, worst and most painful weekly performances.", href: "/awards", section: "Gazette", keywords: ["honors", "golden box score", "bad beat", "bench"] },
  { title: "League History", description: "Champions, seasons and the league timeline.", href: "/history", section: "Archive", keywords: ["champions", "seasons", "past", "timeline"] },
  { title: "Record Book", description: "The greatest and most dubious marks in league history.", href: "/records", section: "Archive", keywords: ["records", "highest", "lowest", "all time"] },
  { title: "Draft Archive", description: "Every recorded selection from the league draft room.", href: "/draft", section: "Archive", keywords: ["draft", "picks", "rookies", "round"] },
  { title: "Transaction Ledger", description: "Trades, waivers, free agents and roster movement.", href: "/transactions", section: "Archive", keywords: ["trades", "waivers", "adds", "drops", "moves"] },
  { title: "Team Directory", description: "Meet every franchise and owner in the league.", href: "/teams", section: "League", keywords: ["teams", "owners", "franchises", "managers"] },
  { title: "The Gazette", description: "News, analysis and commentary from around the league.", href: "/gazette", section: "Gazette", keywords: ["stories", "articles", "news", "analysis"] },
];

function normalize(value: string | null | undefined): string {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

function matches(haystack: Array<string | null | undefined>, query: string): boolean {
  const searchable = normalize(haystack.filter(Boolean).join(" "));
  const terms = normalize(query).split(" ").filter(Boolean);
  return terms.length > 0 && terms.every((term) => searchable.includes(term));
}

function relevance(title: string, query: string): number {
  const normalizedTitle = normalize(title);
  const normalizedQuery = normalize(query);
  if (normalizedTitle === normalizedQuery) return 0;
  if (normalizedTitle.startsWith(normalizedQuery)) return 1;
  if (normalizedTitle.includes(normalizedQuery)) return 2;
  return 3;
}

export function searchPublicSite(
  articles: GazetteArticle[],
  teams: Team[],
  query: string
): SearchResults {
  const stories = articles
    .filter((article) => matches([
      article.headline,
      article.summary,
      article.category,
      article.author_name,
    ], query))
    .sort((first, second) => relevance(first.headline, query) - relevance(second.headline, query));

  const matchingTeams = teams
    .filter((team) => matches([
      team.name,
      team.owner,
      team.legacyName,
    ], query))
    .sort((first, second) => relevance(first.name, query) - relevance(second.name, query));

  const destinations = searchDestinations
    .filter((destination) => matches([
      destination.title,
      destination.description,
      destination.section,
      ...destination.keywords,
    ], query))
    .sort((first, second) => relevance(first.title, query) - relevance(second.title, query));

  return {
    stories,
    teams: matchingTeams,
    destinations,
    total: stories.length + matchingTeams.length + destinations.length,
  };
}

export function highlightSearchTerm(
  value: string,
  query: string
): Array<{ text: string; match: boolean }> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [{ text: value, match: false }];

  const index = value.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (index < 0) return [{ text: value, match: false }];

  return [
    { text: value.slice(0, index), match: false },
    { text: value.slice(index, index + trimmedQuery.length), match: true },
    { text: value.slice(index + trimmedQuery.length), match: false },
  ].filter((part) => part.text.length > 0);
}

