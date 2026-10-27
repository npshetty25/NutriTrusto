import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Household actions, each working with or without
 * db/supabase-schema-household-v2.sql.
 *
 * With it, each action is one SECURITY DEFINER function that does the whole
 * job atomically (leave AND take your items back). Without it, the actions
 * the existing policies allow are done from here, and the ones they do not
 * (member names, removing someone, a new code) report `unavailable`, so the
 * dialog hides them rather than failing.
 */

export interface HouseholdMember {
  userId: string;
  displayName: string;
  joinedAt: string | null;
  isCreator: boolean;
}

/** PostgREST "function not in the schema cache", or Postgres "undefined function". */
export const isMissingFunction = (error: PostgrestError | null | undefined) =>
  !!error && (error.code === "PGRST202" || error.code === "42883");

/** Raised by v2 when joining or creating while already in a household. */
export const isAlreadyInHousehold = (error: PostgrestError | null | undefined) => !!error && error.code === "P0002";

/** The members of my household, or `unavailable` before the v2 migration. */
export async function fetchMembers(): Promise<HouseholdMember[] | "unavailable" | "error"> {
  const { data, error } = await supabase.rpc("household_members_list");
  if (isMissingFunction(error)) return "unavailable";
  if (error || !Array.isArray(data)) return "error";
  return (data as Array<{ user_id: string; display_name: string; joined_at: string | null; is_creator: boolean }>).map((m) => ({
    userId: m.user_id,
    displayName: m.display_name,
    joinedAt: m.joined_at,
    isCreator: !!m.is_creator,
  }));
}

/** How many of my items are not in any household. */
export async function countPrivateItems(userId: string): Promise<number> {
  const { data, error } = await supabase.from("pantry_items").select("id").eq("user_id", userId).is("household_id", null);
  return error || !data ? 0 : data.length;
}

/** Puts my private items into my household. Returns how many moved, or null on failure. */
export async function shareMyItems(userId: string, householdId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("share_my_items_with_household");
  if (!error && typeof data === "number") return data;
  if (!isMissingFunction(error)) return null;

  // Before v2: the pantry policy and the guard trigger already allow a
  // member to move their own rows into their own household.
  const moved = await supabase
    .from("pantry_items")
    .update({ household_id: householdId })
    .eq("user_id", userId)
    .is("household_id", null)
    .select("id");
  return moved.error ? null : moved.data?.length ?? 0;
}

/**
 * Leaves my household and takes my items back to my private pantry.
 * Before v2 the two steps are separate requests: items first, so a failure
 * part-way leaves me still a member rather than gone with my food stranded.
 */
export async function leaveHousehold(userId: string, householdId: string): Promise<boolean> {
  const { error } = await supabase.rpc("leave_household");
  if (!error) return true;
  if (!isMissingFunction(error)) return false;

  const back = await supabase
    .from("pantry_items")
    .update({ household_id: null })
    .eq("user_id", userId)
    .eq("household_id", householdId);
  if (back.error) return false;
  const left = await supabase.from("household_members").delete().eq("household_id", householdId).eq("user_id", userId);
  return !left.error;
}

export async function renameHousehold(householdId: string, name: string): Promise<boolean> {
  const { error } = await supabase.from("households").update({ name }).eq("id", householdId);
  return !error;
}

export async function removeMember(memberId: string): Promise<boolean> {
  const { error } = await supabase.rpc("remove_household_member", { member_id: memberId });
  return !error;
}

/** A fresh invite code; the old one stops working. Null on failure. */
export async function newInviteCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc("new_household_invite_code");
  return error || typeof data !== "string" ? null : data;
}

/** The link that opens the app with the join dialog filled in. */
export const inviteLink = (code: string) =>
  typeof window === "undefined" ? `?join=${code}` : `${window.location.origin}/?join=${encodeURIComponent(code)}`;

/** Invite codes are 8 or 12 hex characters; anything else is not one. */
export const looksLikeInviteCode = (code: string) => /^[0-9a-f]{8}([0-9a-f]{4})?$/i.test(code.trim());

/** Where a join code from an invite link waits while the person signs in. */
export const PENDING_JOIN_KEY = "pending-household-join";
