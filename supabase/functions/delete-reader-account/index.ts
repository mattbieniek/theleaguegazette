import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Use POST." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "Account deletion is not configured." },
      503,
    );
  }

  if (!accessToken) {
    return jsonResponse({ success: false, error: "Sign in to continue." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return jsonResponse({ success: false, error: "Your session has expired." }, 401);
  }

  const [{ data: admin }, { data: contributor }] = await Promise.all([
    supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("publication_contributors")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (admin || contributor) {
    return jsonResponse(
      {
        success: false,
        error: "Editorial accounts must be removed by an administrator.",
      },
      403,
    );
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error("Unable to delete reader account:", deleteError.message);
    return jsonResponse(
      { success: false, error: "The account could not be deleted. Try again." },
      500,
    );
  }

  return jsonResponse({ success: true });
});
