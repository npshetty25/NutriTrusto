import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Server-side gate for the API routes.
 *
 * Every route under /api calls Gemini, which costs money and has a quota.
 * They were all reachable by anyone who knew the URL — a plain POST to
 * /api/find-recipe returned a full recipe with no account, no cookie and no
 * token, so a stranger could drain the project's entire API budget from a
 * terminal.
 *
 * The check verifies the caller's Supabase access token against Supabase's
 * own auth server. That needs only the anon key, not the service-role key,
 * so no privileged secret has to exist in this codebase.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface AuthedUser {
  id: string;
  email?: string;
}

export const unauthorized = () =>
  NextResponse.json(
    { success: false, error: "You need to be signed in to do that." },
    { status: 401 }
  );

/**
 * Returns the authenticated user, or null when the request has no valid
 * token. Deliberately says nothing about *why* it failed — an attacker
 * learns nothing from the difference between "no token" and "expired token".
 */
export async function getRequestUser(req: Request): Promise<AuthedUser | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  try {
    // A per-request client, never a module-level one: a shared client would
    // carry one caller's session into the next request on a warm lambda.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email ?? undefined };
  } catch {
    return null;
  }
}
