import { supabase } from "../supabase";
import type { Database } from "../../types/database";

export type GazetteArticleRow =
  Database["public"]["Tables"]["gazette_articles"]["Row"];

export interface GazetteArticle
  extends Omit<GazetteArticleRow, "body"> {
  body: string[];
}

function normalizeArticle(
  article: GazetteArticleRow
): GazetteArticle {
  const body = Array.isArray(article.body)
    ? article.body.filter(
        (paragraph): paragraph is string =>
          typeof paragraph === "string"
      )
    : [];

  return {
    ...article,
    body,
  };
}

export async function getPublishedArticles(): Promise<
  GazetteArticle[]
> {
  const { data, error } = await supabase
    .from("gazette_articles")
    .select("*")
    .eq("status", "published")
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
    .eq("status", "published")
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

export async function getPublishedArticleBySlug(
  slug: string
): Promise<GazetteArticle | null> {
  const { data, error } = await supabase
    .from("gazette_articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load Gazette article: ${error.message}`
    );
  }

  return data ? normalizeArticle(data) : null;
}