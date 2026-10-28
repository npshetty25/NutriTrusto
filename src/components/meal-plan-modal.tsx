"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarDays, ShoppingCart, Loader2, Check } from "lucide-react";
import { planWeek, shoppingForPlan, type PlanItem } from "@/lib/meal-plan";
import type { FoodProfile } from "@/lib/food-profile";

interface MealPlanModalProps {
  items: PlanItem[];
  dietaryPreference: string;
  profile: FoodProfile;
  /** Adds the names to the shopping list; resolves true when saved. */
  onAddToShopping: (names: string[], source: string) => Promise<boolean>;
  onClose: () => void;
}

const dayLabel = (offset: number) => {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-IN", { weekday: "long" });
};

export function MealPlanModal({ items, dietaryPreference, profile, onAddToShopping, onClose }: MealPlanModalProps) {
  const plan = useMemo(() => planWeek(items, dietaryPreference, 7, { profile }), [items, dietaryPreference, profile]);
  const toBuy = useMemo(() => shoppingForPlan(plan), [plan]);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const addAll = async () => {
    setAdding(true);
    const ok = await onAddToShopping(toBuy, "Weekly plan");
    setAdding(false);
    if (ok) setAdded(true);
  };

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="meal-plan-title" className="neu-panel w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-safe/15 text-safe flex items-center justify-center"><CalendarDays size={17} /></span>
            <div>
              <h3 id="meal-plan-title" className="font-bold text-sm tracking-tight">Plan my week</h3>
              <p className="text-[11px] text-foreground/55">Dinners that use what goes off first</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close meal plan" title="Close meal plan" className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {plan.length === 0 ? (
            <p className="text-sm text-foreground/65 leading-relaxed py-6 text-center">
              Nothing here makes a dish we know yet. Add a vegetable, paneer, dal or eggs and try again.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {plan.map((m) => (
                  <li key={m.day} className="rounded-xl bg-foreground/5 border border-border/50 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">{dayLabel(m.day)}</p>
                    {m.fasting ? (
                      <p className="font-semibold text-sm mt-0.5 text-foreground/60">Fasting day</p>
                    ) : (
                      <>
                        <p className="font-semibold text-sm mt-0.5">{m.dish}</p>
                        <p className="text-[11px] text-foreground/60 mt-0.5">Uses {m.uses.join(", ")}</p>
                        {m.toBuy.length > 0 && <p className="text-[11px] text-foreground/60">Buy: {m.toBuy.join(", ")}</p>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] leading-relaxed text-foreground/50">
                A suggestion from the dishes we know, not a nutrition plan. Check anything you are unsure of before you cook it.
              </p>
              {toBuy.length > 0 && (
                <button
                  onClick={() => { void addAll(); }}
                  disabled={adding || added}
                  className="w-full min-h-11 rounded-xl bg-foreground text-background text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : added ? <Check size={14} /> : <ShoppingCart size={14} />}
                  {added ? "Added to your shopping list" : `Add ${toBuy.length} to shopping list`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
