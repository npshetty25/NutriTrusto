import { supabase } from "@/lib/supabase";

/**
 * Client-side counterpart to lib/api-auth.ts. Attaches the caller's Supabase
 * access token to every /api request, so the server can verify who is asking.
 *
 * Use this instead of a bare fetch() for anything under /api — a bare fetch
 * now comes back 401.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
