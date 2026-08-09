import { createClient } from "@supabase/supabase-js";
import type { APIRoute } from "astro";
import { adminChangelog } from "../../../data/adminChangelog";
import type { Database } from "../../../types/database";

export const prerender = false;

const responseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
};

export const GET: APIRoute = async ({ request }) => {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: responseHeaders,
    });
  }

  const supabase = createClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Your session has expired." }), {
      status: 401,
      headers: responseHeaders,
    });
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !admin) {
    return new Response(JSON.stringify({ error: "Administrator access required." }), {
      status: 403,
      headers: responseHeaders,
    });
  }

  return new Response(JSON.stringify({ entries: adminChangelog }), {
    headers: responseHeaders,
  });
};
