export const STORY_CATEGORIES = [
  "Gazette Exclusive",
  "Power Rankings",
  "By the Numbers",
  "Op-Ed",
  "Predictions",
  "Playoff Picture",
] as const;

export type StoryCategory = (typeof STORY_CATEGORIES)[number];

export function isStoryCategory(value: string): value is StoryCategory {
  return STORY_CATEGORIES.includes(value as StoryCategory);
}
