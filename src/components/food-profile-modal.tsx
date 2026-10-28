"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { ALLERGEN_LABELS, type AllergenTag } from "@/lib/allergens";
import { readProfile, type FoodProfile } from "@/lib/food-profile";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TAGS = Object.keys(ALLERGEN_LABELS) as AllergenTag[];

const toggled = <T,>(list: T[], v: T): T[] => (new Set(list).has(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Allergies, Jain food and fasting days, on top of the veg / egg / non-veg choice. */
export function FoodProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<FoodProfile>(() => readProfile(user?.user_metadata));
  const allergies = new Set(profile.allergies);
  const fasting = new Set(profile.fastingDays);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const toggleAllergy = (tag: AllergenTag) => setProfile((p) => ({ ...p, allergies: toggled(p.allergies, tag) }));
  const toggleDay = (d: number) => setProfile((p) => ({ ...p, fastingDays: toggled(p.fastingDays, d).sort() }));

  const save = async () => {
    setSaving(true);
    setError(false);
    const { error: updateError } = await supabase.auth.updateUser({ data: { food_profile: profile } });
    setSaving(false);
    if (updateError) {
      setError(true);
      return;
    }
    onClose();
  };

  const chip = (on: boolean) =>
    `min-h-11 px-3 rounded-xl text-xs font-semibold transition-all ${on ? "bg-foreground text-background" : "neu-raised-sm text-foreground/70 hover:text-foreground"}`;
  const label = "text-[11px] font-semibold uppercase tracking-widest text-foreground/60";

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="food-profile-title" className="neu-panel w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div>
            <h3 id="food-profile-title" className="font-bold text-sm tracking-tight">Food preferences</h3>
            <p className="text-[11px] text-foreground/55">On top of veg, egg or non-veg</p>
          </div>
          <button onClick={onClose} aria-label="Close food preferences" className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="space-y-2">
            <p className={label}>Allergies</p>
            <div role="group" aria-label="Allergies" className="flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <button key={t} type="button" aria-pressed={allergies.has(t)} onClick={() => toggleAllergy(t)} className={chip(allergies.has(t))}>
                  {ALLERGEN_LABELS[t]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-foreground/55 leading-relaxed">
              Items whose name or ingredients mention one get a warning, and recipes and plans leave them out. This is a help, not a medical check: always read the label.
            </p>
          </div>

          <div className="space-y-2">
            <p className={label}>Jain food</p>
            <button type="button" aria-pressed={profile.jain} onClick={() => setProfile((p) => ({ ...p, jain: !p.jain }))} className={`${chip(profile.jain)} w-full`}>
              {profile.jain ? "On: no onion, garlic or root vegetables" : "Off"}
            </button>
          </div>

          <div className="space-y-2">
            <p className={label}>Fasting days</p>
            <div role="group" aria-label="Fasting days" className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d, i) => (
                <button key={d} type="button" aria-pressed={fasting.has(i)} onClick={() => toggleDay(i)} className={`${chip(fasting.has(i))} px-0`}>
                  {d}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-foreground/55">The weekly plan leaves these days empty.</p>
          </div>

          {error && <p role="alert" className="text-xs text-danger-strong">Could not save that. Check your connection and try again.</p>}

          <button onClick={() => { void save(); }} disabled={saving} className="w-full min-h-12 bg-foreground text-background rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
