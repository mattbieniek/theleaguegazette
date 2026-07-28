import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("Astro site URL is required to generate robots.txt.");

  return new Response([
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /search",
    `Sitemap: ${new URL("/sitemap.xml", site).toString()}`,
    "",
  ].join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
