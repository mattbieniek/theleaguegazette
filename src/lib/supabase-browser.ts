import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl) {
  throw new Error("Missing PUBLIC_SUPABASE_URL.");
}

if (!supabasePublishableKey) {
  throw new Error("Missing PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
}

export const supabaseBrowser = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);