"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { fetchMembers, type HouseholdMember } from "@/lib/household";
import type { User, Session } from "@supabase/supabase-js";

export interface HouseholdInfo {
  id: string;
  name: string;
  inviteCode: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  /** needsConfirmation: false when Supabase signed the user straight in (email confirmation off). */
  signUp: (name: string, email: string, password: string, dietaryPreference: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  /** Redirects to Google. Only offered when NEXT_PUBLIC_GOOGLE_SIGNIN=1. */
  signInWithGoogle: () => Promise<{ error?: string }>;
  household: HouseholdInfo | null;
  householdLoading: boolean;
  refreshHousehold: () => Promise<void>;
  /** Members of my household, by name. Empty until db/supabase-schema-household-v2.sql has run. */
  householdMembers: HouseholdMember[];
  /** True once the v2 household functions exist; null while unknown or with no household. */
  householdV2Ready: boolean | null;
  /** shopping_list_items.household_id exists (v2), so the list can be shared. */
  sharedShoppingReady: boolean | null;
  // True once we've confirmed pantry_items.household_id actually exists
  // (i.e. db/supabase-schema-additions.sql has been run). Null while unknown.
  // Callers must gate on this before including household_id in an insert —
  // Postgrest rejects the whole insert if the column doesn't exist yet.
  householdSchemaReady: boolean | null;
  // Same idea, for pantry_items.ingredients_text (added in a later append
  // to the same migration file). Independent from householdSchemaReady —
  // a user may have run the file before this column was added to it.
  ingredientsSchemaReady: boolean | null;
  // Same pattern again, for pantry_items.health_score. Until this column
  // exists the item card shows "not scanned" rather than inventing a grade.
  healthScoreSchemaReady: boolean | null;
  // Same pattern, for storage / opened_at / expiry_source
  // (db/supabase-schema-item-tracking.sql). Until true, the storage and
  // opened controls stay hidden and nothing writes those columns.
  trackingSchemaReady: boolean | null;
  // pantry_items.quantity / expiry_kind and the recipe_feedback table
  // (db/supabase-schema-accuracy.sql). Until true, the quantity field and the
  // recipe feedback buttons stay hidden.
  accuracySchemaReady: boolean | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Supabase re-announces the same session each time the tab becomes visible; an equal user keeps its old object.
const sameUser = (a: User | null, b: User | null) => a === b || (!!a && !!b && JSON.stringify(a) === JSON.stringify(b));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [householdSchemaReady, setHouseholdSchemaReady] = useState<boolean | null>(null);
  const [ingredientsSchemaReady, setIngredientsSchemaReady] = useState<boolean | null>(null);
  const [healthScoreSchemaReady, setHealthScoreSchemaReady] = useState<boolean | null>(null);
  const [trackingSchemaReady, setTrackingSchemaReady] = useState<boolean | null>(null);
  const [accuracySchemaReady, setAccuracySchemaReady] = useState<boolean | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [householdV2Ready, setHouseholdV2Ready] = useState<boolean | null>(null);
  const [sharedShoppingReady, setSharedShoppingReady] = useState<boolean | null>(null);

  const refreshHousehold = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setHouseholdMembers([]);
      return;
    }
    const loadMembers = async () => {
      const members = await fetchMembers();
      setHouseholdV2Ready(members !== "unavailable");
      setHouseholdMembers(Array.isArray(members) ? members : []);
    };
    setHouseholdLoading(true);
    const { data, error } = await supabase
      .from("household_members")
      .select("household_id, households(id, name, invite_code)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) {
      setHousehold(null);
      setHouseholdMembers([]);
      setHouseholdLoading(false);
      return;
    }

    const row = data[0] as unknown as { households: { id: string; name: string; invite_code: string } | null };
    if (row.households) {
      setHousehold({ id: row.households.id, name: row.households.name, inviteCode: row.households.invite_code });
      await loadMembers();
    } else {
      setHousehold(null);
      setHouseholdMembers([]);
    }
    setHouseholdLoading(false);
  }, [user]);

  useEffect(() => {
    const applySession = (next: Session | null) => {
      setSession(next);
      setUser((prev) => (sameUser(prev, next?.user ?? null) ? prev : next?.user ?? null));
    };

    // Restore session on page load
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      setLoading(false);
    });

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      // The loading flag has to flip before the request starts, so the first
      // paint after sign-in shows a spinner rather than "no household".
      // This is a fetch-on-change effect, which is what effects are for; the
      // rule objects to the synchronous setHouseholdLoading(true) inside.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refreshHousehold();
      // Cheap, one-time probe: does pantry_items.household_id exist yet?
      // Postgrest returns an error (missing column / schema cache) if the
      // migration hasn't been run — that's the only reliable way to tell,
      // short of failing a real insert.
      supabase.from("pantry_items").select("household_id").limit(1).then(({ error }) => {
        setHouseholdSchemaReady(!error);
      });
      supabase.from("shopping_list_items").select("household_id").limit(1).then(({ error }) => {
        setSharedShoppingReady(!error);
      });
      supabase.from("pantry_items").select("health_score").limit(1).then(({ error }) => {
        setHealthScoreSchemaReady(!error);
      });

      supabase.from("pantry_items").select("ingredients_text").limit(1).then(({ error }) => {
        setIngredientsSchemaReady(!error);
      });
      supabase.from("pantry_items").select("storage, opened_at, expiry_source").limit(1).then(({ error }) => {
        setTrackingSchemaReady(!error);
      });
      Promise.all([
        supabase.from("pantry_items").select("quantity, expiry_kind").limit(1),
        supabase.from("recipe_feedback").select("id").limit(1),
      ]).then(([columns, feedback]) => {
        setAccuracySchemaReady(!columns.error && !feedback.error);
      });
    } else {
      setHousehold(null);
      setHouseholdMembers([]);
      setHouseholdV2Ready(null);
      setSharedShoppingReady(null);
      setHouseholdSchemaReady(null);
      setIngredientsSchemaReady(null);
      setHealthScoreSchemaReady(null);
      setTrackingSchemaReady(null);
      setAccuracySchemaReady(null);
    }
  }, [user, refreshHousehold]);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUp = async (name: string, email: string, password: string, dietaryPreference: string): Promise<{ error?: string; needsConfirmation?: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, dietary_preference: dietaryPreference } },
    });
    if (error) return { error: error.message };
    // A session back means the project does not require email confirmation.
    return { needsConfirmation: !data.session };
  };

  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, signInWithGoogle, household, householdLoading, refreshHousehold, householdMembers, householdV2Ready, sharedShoppingReady, householdSchemaReady, ingredientsSchemaReady, healthScoreSchemaReady, trackingSchemaReady, accuracySchemaReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
