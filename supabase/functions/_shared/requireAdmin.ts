import { createClient } from "jsr:@supabase/supabase-js@2";

export async function requireAdmin(
  request: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  // Allows trusted function-to-function calls such as matchup backfills.
  if (token && token === serviceRoleKey) return;
  if (!token) throw new Error("Administrator authentication required.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) throw new Error("Administrator authentication required.");

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) throw new Error("Administrator access required.");
}
