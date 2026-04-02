import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mock-supabase-url.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

// This is a client for Supabase. We will use it for database interactions.
// For the MVP prototype, if no env vars are provided, this will just warn or fail gracefully.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
