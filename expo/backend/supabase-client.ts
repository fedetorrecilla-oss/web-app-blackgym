import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for the Gym Turnos API. Uses the SERVICE ROLE
// key (never the public/anon key) because this backend is the single
// trusted source of truth for the whole gym's data and needs unrestricted
// read/write access — it is never exposed to the mobile app directly.
//
// Both env vars are set as secrets in the hosting dashboard (Render), never
// committed to this repo.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // Fail loudly and immediately at boot rather than silently returning
  // empty data on every request — a missing env var here means the
  // deploy is misconfigured, not that the gym has no students yet.
  throw new Error(
    "[supabase-client] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. " +
      "Set them as environment variables in the Render dashboard for this service.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // This is a server process, not a browser session — no need to persist
    // or auto-refresh an auth session.
    persistSession: false,
    autoRefreshToken: false,
  },
});
