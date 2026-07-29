import { supabase } from "../supabase";
import type { Database } from "../../types/database";

import {
  normalizeArticleBody,
  type RichTextDocument,
} from "../gazette/articleBody";

export type GazetteArticleRow =
  Database["public"]["Tables"]["gazette_articles"]["Row"];

export interface GazetteArticle
  extends Omit<GazetteArticleRow, "body"> {
  body: RichTextDocument;
}

export const COMMISSIONERS_CORNER_CATEGORY = "Commissioner's Corner";

function normalizeArticle(
  article: GazetteArticleRow
): GazetteArticle {
  return {
    ...article,
    body: normalizeArticleBody(article.body),
  };
}

export async function getPublishedArticles(): Promise<
  GazetteArticle[]
> {
  const { data, error } = await supabase
    .from("gazette_articles")
    .select("*")
    .in("status", ["published", "scheduled"])
    .lte("published_at", new Date().toISOString())
    .order("published_at", {
      ascending: false,
      nullsFirst: false,
    });

  if (error) {
    throw new Error(
      `Unable to load Gazette articles: ${error.message}`
    );
  }

  return (data ?? []).map(normalizeArticle);
}

export async function getHomepageArticles(): Promise<
  GazetteArticle[]
> {
  const { data, error } = await supabase
    .from("gazette_articles")
    .select("*")
    .in("status", ["published", "scheduled"])
    .neq("category", COMMISSIONERS_CORNER_CATEGORY)
    .lte("published_at", new Date().toISOString())
    .order("homepage_order", {
      ascending: true,
      nullsFirst: false,
    })
    .order("published_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(3);

  if (error) {
    throw new Error(
      `Unable to load homepage articles: ${error.message}`
    );
  }

  return (data ?? []).map(normalizeArticle);
}

export async function getCommissionersCornerArticles(
  limit = 3,
): Promise<GazetteArticle[]> {
  const { data, error } = await supabase
    .from("gazette_articles")
    .select("*")
    .eq("category", COMMISSIONERS_CORNER_CATEGORY)
    .in("status", ["published", "scheduled"])
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Unable to load Commissioner's Corner articles: ${error.message}`,
    );
  }

  return (data ?? []).map(normalizeArticle);
}

export async function getPublishedArticleBySlug(
  slug: string
): Promise<GazetteArticle | null> {
  const { data, error } = await supabase
    .from("gazette_articles")
    .select("*")
    .eq("slug", slug)
    .in("status", ["published", "scheduled"])
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load Gazette article: ${error.message}`
    );
  }

  return data ? normalizeArticle(data) : null;
}
