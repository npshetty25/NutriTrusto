"use client";

import { useState } from "react";
import { Leaf, Egg, UtensilsCrossed, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { normalizeDietPreference, type DietPreference } from "@/lib/diet";

/**
 * Lets someone change the dietary preference on their account.
 *
 * It could only ever be set once, during sign-up, and was then unreachable.
 * Diet is not a fixed property of a person: people become vegetarian, keep
 * Shravan, or change during a pregnancy. Being permanently locked to the
 * choice made on a sign-up form is the opposite of treating diet as
 * first-class product logic.
 *
 * The preference drives the item warnings, the default pantry filter, and
 * the dietary rule enforced on generated recipes, so it has to be editable
 * where the rest of the account settings live.
 */

const OPTIONS: { id: Exclude<DietPreference, "none">; label: string; icon: typeof Leaf }[] = [
  { id: "veg", label: "Veg", icon: Leaf },
  { id: "eggtarian", label: "Egg", icon: Egg },
  { id: "non-veg", label: "All", icon: UtensilsCrossed },
];

export function DietPreferenceToggle() {
  const { user } = useAuth();
  const current = normalizeDietPreference(String(user?.user_metadata?.dietary_preference || "none"));
  const [saving, setSaving] = useState<DietPreference | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const handleSelect = async (diet: DietPreference) => {
    if (diet === current || saving) return;
    setSaving(diet);
    setError(false);

    // Stored on the auth user rather than a profile table, because that is
    // where sign-up already puts it and where every reader looks for it.
    const { error: updateError } = await supabase.auth.updateUser({
      data: { dietary_preference: diet },
    });

    setSaving(null);
    if (updateError) {
      setError(true);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50">Diet</p>
        {saved && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-safe-strong">
            <Check size={11} /> Saved
          </span>
        )}
      </div>
      <div role="group" aria-label="Dietary preference" className="flex items-center gap-1 bg-foreground/5 p-1 rounded-full border border-border/50">
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { void handleSelect(id); }}
            disabled={saving !== null}
            title={
              id === "veg" ? "Vegetarian — no meat, fish or egg"
              : id === "eggtarian" ? "Eggtarian — egg is fine, no meat or fish"
              : "No restriction"
            }
            aria-pressed={current === id}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[11px] font-bold transition-all disabled:opacity-60 ${
              current === id ? "bg-card text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground/80"
            }`}
          >
            {saving === id ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-[11px] text-danger-strong">Could not save that. Check your connection and try again.</p>
      )}
    </div>
  );
}
