import { createClient } from "@supabase/supabase-js";

// Server-only client. The service role key never reaches the browser; every
// read of candidate data goes through a route handler on the server.
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}
