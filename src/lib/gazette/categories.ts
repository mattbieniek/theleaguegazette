export const STORY_CATEGORIES = [
  "Gazette Exclusive",
  "By the Numbers",
  "Op-Ed",
  "Predictions",
  "Playoff Picture",
] as const;

export type StoryCategory = (typeof STORY_CATEGORIES)[number];

export const ADMIN_STORY_CATEGORIES = STORY_CATEGORIES.filter(
  (category) => category !== "Op-Ed",
);

export const OP_ED_SUBCATEGORIES = [
  "General",
  "Hot Takes",
  "Hit Piece",
] as const;

export type OpEdSubcategory = (typeof OP_ED_SUBCATEGORIES)[number];

export function isStoryCategory(value: string): value is StoryCategory {
  return STORY_CATEGORIES.includes(value as StoryCategory);
}

export function formatStoryCategory(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): string {
  const label = category?.trim() || "Uncategorized";
  return label === "Op-Ed" && subcategory?.trim()
    ? `${label} · ${subcategory.trim()}`
    : label;
}
