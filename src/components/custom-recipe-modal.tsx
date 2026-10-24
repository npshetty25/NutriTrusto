"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Save } from "lucide-react";
import type { DietPreference } from "@/lib/diet";
import { CUSTOM_RECIPE_LIMITS, dietWarning, validateCustomRecipe, linesFrom, type CustomRecipe } from "@/lib/custom-recipes";

interface CustomRecipeModalProps {
  userDiet: DietPreference;
  onSave: (value: Pick<CustomRecipe, "name" | "ingredients" | "steps">) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Write your own recipe: a name, one ingredient per line, one step per line.
 * The diet warning updates as the ingredients are typed, so a vegetarian who
 * writes "chicken" sees why it will be hidden before saving, not after.
 */
export function CustomRecipeModal({ userDiet, onSave, onClose }: CustomRecipeModalProps) {
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ingredientLines = linesFrom(ingredients);
  const warning = ingredientLines.length > 0 ? dietWarning(userDiet, ingredientLines) : null;

  const submit = async () => {
    setError(null);
    const checked = validateCustomRecipe({ name, ingredients, steps });
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setSaving(true);
    const ok = await onSave(checked.value);
    setSaving(false);
    if (ok) onClose();
    else setError("Couldn't save that recipe. Check your connection and try again.");
  };

  const field = "w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:outline-none focus:ring-1 focus:ring-foreground/20";
  const label = "text-[11px] font-semibold uppercase tracking-widest text-foreground/60";

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-recipe-heading"
        className="neu-panel w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="custom-recipe-heading" className="text-lg font-bold tracking-tight">New recipe</h3>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="space-y-1.5">
            <label htmlFor="custom-recipe-name" className={label}>Name</label>
            <input
              id="custom-recipe-name"
              type="text"
              autoFocus
              maxLength={CUSTOM_RECIPE_LIMITS.name}
              placeholder="e.g. Amma's dal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-recipe-ingredients" className={label}>Ingredients</label>
            <textarea
              id="custom-recipe-ingredients"
              rows={6}
              placeholder={"200 g toor dal\n1 onion\n1 tsp cumin"}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              className={field}
            />
            <p className="text-[11px] text-foreground/55">One ingredient per line.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-recipe-steps" className={label}>Steps</label>
            <textarea
              id="custom-recipe-steps"
              rows={6}
              placeholder={"Pressure-cook the dal until soft.\nFry the cumin and onion in ghee.\nPour in and simmer."}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className={field}
            />
            <p className="text-[11px] text-foreground/55">One step per line.</p>
          </div>

          {warning && (
            <p role="status" className="rounded-xl bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning-strong leading-relaxed">
              {warning}
            </p>
          )}

          {error && <p role="alert" className="text-xs text-danger-strong">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-12 bg-foreground text-background rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save recipe
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
