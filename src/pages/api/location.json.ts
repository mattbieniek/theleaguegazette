import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const encodedCity = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  let city = "";

  if (encodedCity) {
    try {
      city = decodeURIComponent(encodedCity);
    } catch {
      city = encodedCity;
    }
  }

  return new Response(
    JSON.stringify({ location: city && region ? `${city}, ${region}` : city || "Houston, Texas" }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store",
      },
    },
  );
};
