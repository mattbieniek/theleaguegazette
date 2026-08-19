import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
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
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "Account management is not configured." },
      503,
    );
  }

  try {
    await requireAdmin(request, supabaseUrl, serviceRoleKey);

    const accessToken = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    if (!accessToken) {
      return jsonResponse({ success: false, error: "Sign in to continue." }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user: requester },
    } = await supabase.auth.getUser(accessToken);
    if (!requester) {
      return jsonResponse({ success: false, error: "Your session has expired." }, 401);
    }

    const body = await request.json().catch(() => ({})) as {
      target_user_id?: string;
    };
    const targetUserId = String(body.target_user_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return jsonResponse({ success: false, error: "Choose a valid account." }, 400);
    }

    if (targetUserId === requester.id) {
      return jsonResponse(
        { success: false, error: "You cannot delete your own administrator account." },
        400,
      );
    }

    const { data: target, error: targetError } = await supabase.auth.admin.getUserById(targetUserId);
    if (targetError || !target.user) {
      return jsonResponse({ success: false, error: "That account could not be found." }, 404);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      console.error("Unable to delete account:", deleteError.message);
      return jsonResponse(
        { success: false, error: "The account could not be deleted. Try again." },
        500,
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Administrator access required.";
    const status = message.includes("authentication") ? 401 : 403;
    return jsonResponse({ success: false, error: message }, status);
  }
});
