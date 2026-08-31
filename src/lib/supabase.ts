import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // The app will show a setup screen if env vars are missing.
}

export const supabase = createClient(
  url || "https://missing.supabase.co",
  anon || "missing-key",
);

export const envReady = Boolean(url && anon);
