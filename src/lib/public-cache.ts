export function setPublicCache(
  response: { headers: Headers },
  maxAge = 30,
  staleWhileRevalidate = 300,
): void {
  const value = `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
  response.headers.set("Cache-Control", value);
  response.headers.set("Vercel-CDN-Cache-Control", value);
}
