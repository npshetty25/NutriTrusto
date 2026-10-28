"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, UtensilsCrossed, AlertTriangle } from "lucide-react";
import type { NewItem } from "@/components/add-item-modal";
import { isDietConflict, resolveItemDiet, DIET_PREFERENCE_LABEL, type DietPreference } from "@/lib/diet";
import { LEFTOVER_CITATION, leftoverName, leftoverPlan } from "@/lib/leftovers";
import { dateInDays, STORAGE_OPTIONS } from "@/lib/item-tracking";
import type { StorageLocation } from "@/lib/temperature";

interface LeftoverModalProps {
  /** A dish name to start from, e.g. the recipe that was just cooked. */
  initialName?: string;
  userDiet: DietPreference;
  onAdd: (item: NewItem) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Cooked food that is left over. It is a pantry item with its own date: how long
 * it keeps depends on how it was stored, not on what the dish is, so none of the
 * shelf-life table applies (lib/leftovers.ts has the rules and their source).
 */
export function LeftoverModal({ initialName = "", userDiet, onAdd, onClose }: LeftoverModalProps) {
  const [name, setName] = useState(initialName);
  const [storage, setStorage] = useState<StorageLocation>("fridge");
  const [leftOut, setLeftOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const plan = leftoverPlan(storage, leftOut);
  const full = trimmed ? leftoverName(trimmed) : "";
  const dietBlocked = !!full && isDietConflict(userDiet, resolveItemDiet(full));

  const chip = (active: boolean) =>
    `min-h-11 px-3 rounded-xl text-xs font-semibold transition-all ${active ? "bg-foreground text-background" : "neu-raised-sm text-foreground/70 hover:text-foreground"}`;

  const submit = async () => {
    setError(null);
    if (!trimmed) return setError("What is it? For example: dal, rice, paneer sabzi.");
    if (full.length > 80) return setError("Keep the name under 80 characters.");
    if (!plan.ok || dietBlocked) return;
    setSaving(true);
    const ok = await onAdd({
      name: full,
      daysLeft: plan.days,
      expirySource: "user",
      expiryKind: "use_by",
      expiryDate: dateInDays(plan.days),
      quantity: null,
      storage,
      openedAt: null,
    });
    setSaving(false);
    if (ok) onClose();
    else setError("Couldn't save that. Check your connection and try again.");
  };

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="leftover-heading" className="neu-panel w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 id="leftover-heading" className="text-lg font-bold tracking-tight">Save leftovers</h3>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20">
            <X size={16} />
          </button>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="space-y-1.5">
            <label htmlFor="leftover-name" className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">What is left</label>
            <input
              id="leftover-name"
              type="text"
              autoFocus
              maxLength={70}
              placeholder="e.g. dal tadka, jeera rice"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="neu-field w-full rounded-xl px-4 py-3 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Where is it now?</p>
            <div role="group" aria-label="Where is it now" className="grid grid-cols-3 gap-2">
              {STORAGE_OPTIONS.map((o) => (
                <button key={o.id} type="button" aria-pressed={storage === o.id} onClick={() => setStorage(o.id)} className={chip(storage === o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Was it out for more than 2 hours after cooking?</p>
            <div role="group" aria-label="Out for more than 2 hours" className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={!leftOut} onClick={() => setLeftOut(false)} className={chip(!leftOut)}>No</button>
              <button type="button" aria-pressed={leftOut} onClick={() => setLeftOut(true)} className={chip(leftOut)}>Yes</button>
            </div>
          </div>

          {plan.ok ? (
            !dietBlocked && trimmed && (
              <div className="rounded-2xl bg-foreground/5 border border-border/60 p-3">
                <p className="text-sm font-semibold">{plan.days === 0 ? "Eat it today" : `Keeps ${plan.days} days`}</p>
                <p className="text-[11px] text-foreground/60 mt-0.5 leading-relaxed">{plan.note}</p>
                <p className="text-[10px] text-foreground/45 mt-1">{LEFTOVER_CITATION}</p>
              </div>
            )
          ) : (
            <p role="alert" className="flex gap-2 text-xs text-danger-strong leading-relaxed">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {plan.reason}
            </p>
          )}

          {dietBlocked && (
            <p role="alert" className="text-xs text-danger-strong leading-relaxed">
              {trimmed} doesn&apos;t fit your {DIET_PREFERENCE_LABEL[userDiet].toLowerCase()} diet, so it would not show in your pantry.
            </p>
          )}
          {error && <p role="alert" className="text-xs text-danger-strong">{error}</p>}

          <button
            type="submit"
            disabled={saving || !trimmed || !plan.ok || dietBlocked}
            className="w-full min-h-12 bg-foreground text-background rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <UtensilsCrossed size={15} />}
            Add to pantry
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
