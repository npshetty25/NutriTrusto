"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
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
  signUp: (name: string, email: string, password: string, dietaryPreference: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  household: HouseholdInfo | null;
  householdLoading: boolean;
  refreshHousehold: () => Promise<void>;
  // True once we've confirmed pantry_items.household_id actually exists
  // (i.e. supabase-schema-additions.sql has been run). Null while unknown.
  // Callers must gate on this before including household_id in an insert —
  // Postgrest rejects the whole insert if the column doesn't exist yet.
  householdSchemaReady: boolean | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [householdSchemaReady, setHouseholdSchemaReady] = useState<boolean | null>(null);

  const refreshHousehold = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      return;
    }
    setHouseholdLoading(true);
    const { data, error } = await supabase
      .from("household_members")
      .select("household_id, households(id, name, invite_code)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) {
      setHousehold(null);
      setHouseholdLoading(false);
      return;
    }

    const row = data[0] as unknown as { households: { id: string; name: string; invite_code: string } | null };
    if (row.households) {
      setHousehold({ id: row.households.id, name: row.households.name, inviteCode: row.households.invite_code });
    } else {
      setHousehold(null);
    }
    setHouseholdLoading(false);
  }, [user]);

  useEffect(() => {
    // Restore session on page load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      void refreshHousehold();
      // Cheap, one-time probe: does pantry_items.household_id exist yet?
      // Postgrest returns an error (missing column / schema cache) if the
      // migration hasn't been run — that's the only reliable way to tell,
      // short of failing a real insert.
      supabase.from("pantry_items").select("household_id").limit(1).then(({ error }) => {
        setHouseholdSchemaReady(!error);
      });
    } else {
      setHousehold(null);
      setHouseholdSchemaReady(null);
    }
  }, [user, refreshHousehold]);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUp = async (name: string, email: string, password: string, dietaryPreference: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, dietary_preference: dietaryPreference } },
    });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, household, householdLoading, refreshHousehold, householdSchemaReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
