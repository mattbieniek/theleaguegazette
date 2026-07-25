export interface HomepageStory {
  slug: string;
  category: string;
  headline: string;
  summary: string;
  author: string;
  publishedAt: string;
  image: string;
  imageAlt: string;
}

export const leadStory: HomepageStory = {
  slug: "season-opens-with-familiar-chaos",
  category: "League Dispatch",
  headline: "A new season begins, and the league is already descending into chaos",
  summary:
    "Optimism is high, projections are meaningless and every manager remains convinced this is finally the year everything goes according to plan.",
  author: "The Gazette Staff",
  publishedAt: "2026-07-25",
  image: "/images/homepage/lead-story-placeholder.jpg",
  imageAlt:
    "Fantasy football draft materials arranged on a table before the season",
};

export const secondaryStories: HomepageStory[] = [
  {
    slug: "preseason-power-rankings",
    category: "Power Rankings",
    headline: "Preseason rankings reward confidence, punish recent memory",
    summary:
      "The first rankings of the year feature familiar contenders, suspicious optimism and several managers preparing formal objections.",
    author: "The Gazette Staff",
    publishedAt: "2026-07-24",
    image: "/images/homepage/power-rankings-placeholder.jpg",
    imageAlt: "A handwritten fantasy football rankings sheet",
  },
  {
    slug: "draft-night-questions",
    category: "Analysis",
    headline: "The five questions that will define draft night",
    summary:
      "From first-round reaches to late-round grudges, these are the decisions most likely to shape the season before Week 1 begins.",
    author: "The Gazette Staff",
    publishedAt: "2026-07-23",
    image: "/images/homepage/draft-night-placeholder.jpg",
    imageAlt: "A fantasy football draft board with player names",
  },
];