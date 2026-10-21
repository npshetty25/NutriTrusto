"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Leaf, Egg, UtensilsCrossed, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DietPreference } from "@/lib/diet";

type Choice = Exclude<DietPreference, "none">;

const CHOICES: { id: Choice; label: string; blurb: string; icon: typeof Leaf }[] = [
  { id: "veg", label: "Vegetarian", blurb: "No meat, fish or egg", icon: Leaf },
  { id: "eggtarian", label: "Eggtarian", blurb: "Egg is fine, no meat or fish", icon: Egg },
  { id: "non-veg", label: "Non-vegetarian", blurb: "I eat everything", icon: UtensilsCrossed },
];

/**
 * Asks how the person eats, once, when their account has no diet on it.
 *
 * Email sign-up asks this on the form. Google sign-in goes straight from
 * Google's consent screen back into the app, so a Google account arrived with
 * no preference at all — and the preference now decides what the pantry, the
 * notifications, the AI chat and the recipes are allowed to show. Without an
 * answer everything defaults to "show all", which for a vegetarian is exactly
 * the problem this app exists to avoid.
 *
 * Deliberately not dismissible: three taps, and the answer changes the whole
 * app. It can be changed later from the profile menu.
 */
export function DietPromptModal() {
  const [saving, setSaving] = useState<Choice | null>(null);
  const [error, setError] = useState(false);

  const choose = async (diet: Choice) => {
    if (saving) return;
    setSaving(diet);
    setError(false);
    // Stored on the auth user, the same place sign-up and the profile-menu
    // toggle write it. The resulting USER_UPDATED event re-renders the page,
    // which is what unmounts this prompt — nothing here closes it by hand.
    const { error: updateError } = await supabase.auth.updateUser({ data: { dietary_preference: diet } });
    if (updateError) {
      setSaving(null);
      setError(true);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="diet-prompt-heading"
        className="neu-panel w-full max-w-sm rounded-3xl p-5 animate-in zoom-in-95 duration-200"
      >
        <div className="w-11 h-11 rounded-2xl bg-brand/15 text-brand flex items-center justify-center mb-3">
          <Leaf size={20} />
        </div>
        <h3 id="diet-prompt-heading" className="font-bold text-lg tracking-tight text-foreground">
          How do you eat?
        </h3>
        <p className="text-sm text-foreground/70 leading-relaxed mt-1 mb-4">
          We&apos;ll only show food, recipes and reminders that fit. You can change this any time from your profile menu.
        </p>

        <div className="flex flex-col gap-2">
          {CHOICES.map(({ id, label, blurb, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { void choose(id); }}
              disabled={saving !== null}
              className="neu-raised-sm min-h-14 w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left transition-all hover:brightness-105 disabled:opacity-60"
            >
              <span className="w-9 h-9 rounded-xl bg-foreground/5 text-foreground/70 flex items-center justify-center shrink-0">
                {saving === id ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground leading-tight">{label}</span>
                <span className="block text-xs text-foreground/60 leading-tight mt-0.5">{blurb}</span>
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-danger-strong">
            Could not save that. Check your connection and try again.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
