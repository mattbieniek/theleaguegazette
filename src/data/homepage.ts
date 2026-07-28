export interface HomepageStory {
  slug: string;
  category: string;
  headline: string;
  summary: string;
  author: string;
  publishedAt: string;
  image: string;
  imageAlt: string;
  body: string[];
}

export const leadStory: HomepageStory = {
  slug: "season-opens-with-familiar-chaos",
  category: "League Dispatch",
  headline: "A new season begins, and the league is already descending into chaos",
  summary:
    "Optimism is high, projections are meaningless and every manager remains convinced this is finally the year everything goes according to plan.",
  author: "The Gazette Staff",
  publishedAt: "2026-07-25",
  image: "/images/homepage/lead-story-placeholder.webp",
  imageAlt:
    "Fantasy football draft materials arranged on a table before the season",
  body: [
    "A new season has arrived, which means every manager has once again convinced himself that this will be the year everything finally goes according to plan.",
    "Draft boards are being studied, old mistakes are being reclassified as learning experiences and projected standings are already being treated as personal attacks.",
    "For now, everyone is undefeated. That condition is expected to last only briefly.",
  ],
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
    image: "/images/homepage/power-rankings-placeholder.webp",
    imageAlt: "A handwritten fantasy football rankings sheet",
    body: [
      "The preseason power rankings have arrived, despite the inconvenient fact that no meaningful football has yet been played.",
      "Recent success was rewarded, roster construction was reviewed and confidence was treated with the suspicion it deserves.",
      "Several teams believe they were ranked too low. At least one believes the ranking process itself should be investigated.",
    ],
  },
  {
    slug: "draft-night-questions",
    category: "Analysis",
    headline: "The five questions that will define draft night",
    summary:
      "From first-round reaches to late-round grudges, these are the decisions most likely to shape the season before Week 1 begins.",
    author: "The Gazette Staff",
    publishedAt: "2026-07-23",
    image: "/images/homepage/draft-night-placeholder.webp",
    imageAlt: "A fantasy football draft board with player names",
    body: [
      "Draft night has a way of turning careful preparation into immediate panic.",
      "The biggest questions rarely concern projections alone. They involve old rivalries, positional runs and the fear that someone else knows something you do not.",
      "By the final round, every roster will look both brilliant and deeply flawed.",
    ],
  },
];

export const homepageStories: HomepageStory[] = [
  leadStory,
  ...secondaryStories,
];
