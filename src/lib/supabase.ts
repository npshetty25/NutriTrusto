import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Nutri-Trust] Supabase env vars missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

// Read before the client is created: it signs the person in from the link and then clears the URL.
export const openedFromPasswordResetLink =
  typeof window !== 'undefined' && /(?:^|[#?&])type=recovery(?:&|$)/.test(`${window.location.hash}&${window.location.search}`);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
