import type { APIRoute } from "astro";
import { teams } from "../data/teams";
import { seasonHistoryMetadata } from "../data/seasonHistory";
import { getPublishedArticles } from "../lib/queries/gazette";

export const prerender = false;

const staticPaths = [
  "/",
  "/gazette",
  "/matchups",
  "/standings",
  "/teams",
  "/stats",
  "/awards",
  "/history",
  "/records",
  "/draft",
  "/transactions",
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error("Astro site URL is required to generate the sitemap.");

  const articles = await getPublishedArticles();
  const entries = [
    ...staticPaths.map((path) => ({ path, lastmod: null as string | null })),
    ...teams.map((team) => ({ path: `/teams/${team.slug}`, lastmod: null })),
    ...seasonHistoryMetadata.map((season) => ({ path: `/history/${season.year}`, lastmod: null })),
    ...articles.map((article) => ({
      path: `/gazette/${article.slug}`,
      lastmod: article.updated_at ?? article.published_at,
    })),
  ];

  const body = entries.map((entry) => {
    const location = escapeXml(new URL(entry.path, site).toString());
    const lastmod = entry.lastmod
      ? `<lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>`
      : "";
    return `<url><loc>${location}</loc>${lastmod}</url>`;
  }).join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } }
  );
};
