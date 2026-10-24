"use client";

import { useEffect, useState } from "react";
import { Heart, Plus, Trash2, ArrowLeft, Loader2, CircleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { lockedDietScope, type DietPreference } from "@/lib/diet";
import {
  customRecipeAllowed,
  customRecipeDiet,
  rowToCustomRecipe,
  type CustomRecipe,
} from "@/lib/custom-recipes";
import { CustomRecipeModal } from "@/components/custom-recipe-modal";
import { VegMark } from "@/components/veg-mark";

interface MyRecipesProps {
  userDiet: DietPreference;
}

const COLUMNS = "id, name, ingredients, steps, is_favourite, created_at";

/**
 * Your own recipes, kept like a playlist: favourites float to the top, and a
 * heart shows and changes which ones are favourites. Each person sees only
 * their own, enforced by row-level security on custom_recipes.
 */
export function MyRecipes({ userDiet }: MyRecipesProps) {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<CustomRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<CustomRecipe | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("custom_recipes")
        .select(COLUMNS)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (fetchError) {
        // Most often the table has not been created yet — say so, rather
        // than showing an empty list that looks like nothing was saved.
        setNeedsSetup(true);
      } else {
        setNeedsSetup(false);
        setRecipes((data ?? []).map((row) => rowToCustomRecipe(row)));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const locked = lockedDietScope(userDiet) !== null;
  const visible = recipes
    .filter((r) => !locked || customRecipeAllowed(userDiet, r.ingredients))
    .filter((r) => !favouritesOnly || r.isFavourite)
    .sort((a, b) => Number(b.isFavourite) - Number(a.isFavourite));
  const hiddenByDiet = recipes.length - recipes.filter((r) => !locked || customRecipeAllowed(userDiet, r.ingredients)).length;

  const save = async (value: Pick<CustomRecipe, "name" | "ingredients" | "steps">): Promise<boolean> => {
    if (!user) return false;
    const { data, error: insertError } = await supabase
      .from("custom_recipes")
      .insert([{ user_id: user.id, ...value }])
      .select(COLUMNS)
      .single();
    if (insertError || !data) return false;
    setRecipes((prev) => [rowToCustomRecipe(data), ...prev]);
    return true;
  };

  const toggleFavourite = async (recipe: CustomRecipe) => {
    const next = !recipe.isFavourite;
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, isFavourite: next } : r)));
    setOpen((o) => (o && o.id === recipe.id ? { ...o, isFavourite: next } : o));
    const { error: updateError } = await supabase
      .from("custom_recipes")
      .update({ is_favourite: next })
      .eq("id", recipe.id);
    if (updateError) {
      // Put it back exactly as it was, and say so.
      setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, isFavourite: recipe.isFavourite } : r)));
      setOpen((o) => (o && o.id === recipe.id ? { ...o, isFavourite: recipe.isFavourite } : o));
      setError("Couldn't update the favourite. Try again.");
    }
  };

  const remove = async (recipe: CustomRecipe) => {
    const { error: deleteError } = await supabase.from("custom_recipes").delete().eq("id", recipe.id);
    if (deleteError) {
      setError("Couldn't delete that recipe. Try again.");
      return;
    }
    setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    setOpen(null);
    setConfirmingDelete(false);
  };

  if (open) {
    const diet = customRecipeDiet(open.ingredients);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setOpen(null); setConfirmingDelete(false); }}
            className="flex items-center gap-2 text-sm font-medium text-foreground/60 hover:text-foreground min-h-11"
          >
            <ArrowLeft size={16} /> Back to my recipes
          </button>
          <button
            onClick={() => toggleFavourite(open)}
            aria-pressed={open.isFavourite}
            aria-label={open.isFavourite ? "Remove from favourites" : "Add to favourites"}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/5 hover:bg-foreground/10"
          >
            <Heart size={18} className={open.isFavourite ? "fill-danger text-danger-strong" : "text-foreground/50"} />
          </button>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-foreground/40 mb-1">My recipe</p>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <VegMark diet={diet} size={20} />
            {open.name}
          </h2>
        </div>

        <div>
          <h3 className="font-bold text-sm mb-2">Ingredients</h3>
          <ul className="space-y-1.5 text-sm text-foreground/80">
            {open.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-2"><span className="text-foreground/30">•</span>{ing}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-sm mb-2">Steps</h3>
          <ol className="space-y-2 text-sm text-foreground/80 list-decimal pl-5">
            {open.steps.map((step, i) => (<li key={i}>{step}</li>))}
          </ol>
        </div>

        <div className="pt-2 border-t border-border">
          {confirmingDelete ? (
            <div className="flex gap-2">
              <button onClick={() => setConfirmingDelete(false)} className="flex-1 min-h-11 border border-border rounded-xl text-sm font-semibold">Keep it</button>
              <button onClick={() => remove(open)} className="flex-1 min-h-11 bg-danger text-white rounded-xl text-sm font-bold">Delete recipe</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} className="flex items-center gap-2 text-sm font-semibold text-danger-strong min-h-11">
              <Trash2 size={15} /> Delete this recipe
            </button>
          )}
        </div>
        {error && <p role="alert" className="text-xs text-danger-strong">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-lg tracking-tight">My recipes</h2>
          <p className="text-[11px] text-foreground/50">Your own recipes. Favourites go to the top.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          disabled={needsSetup}
          className="flex items-center gap-1.5 bg-foreground text-background text-xs font-bold px-3 min-h-11 rounded-xl hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={14} /> New recipe
        </button>
      </div>

      {recipes.length > 0 && (
        <div role="group" aria-label="Show" className="grid grid-cols-2 gap-2">
          {[
            { id: false, label: "All" },
            { id: true, label: "Favourites" },
          ].map((f) => (
            <button
              key={String(f.id)}
              aria-pressed={favouritesOnly === f.id}
              onClick={() => setFavouritesOnly(f.id)}
              className={`min-h-11 rounded-xl text-xs font-bold ${favouritesOnly === f.id ? "bg-foreground text-background" : "neu-raised-sm text-foreground/70"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {needsSetup ? (
        <div className="text-center py-12 px-6">
          <div className="w-14 h-14 rounded-2xl neu-raised flex items-center justify-center mx-auto mb-3 text-foreground/40">
            <CircleAlert size={22} />
          </div>
          <p className="text-sm font-semibold">My recipes needs one database step</p>
          <p className="text-xs text-foreground/60 mt-1 leading-relaxed">
            Run db/supabase-schema-custom-recipes.sql in Supabase, then come back. Nothing else in the app is affected.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-foreground/40"><Loader2 size={22} className="animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 px-6">
          <p className="text-sm font-semibold">{recipes.length === 0 ? "No recipes of your own yet" : "Nothing to show here"}</p>
          <p className="text-xs text-foreground/60 mt-1 leading-relaxed">
            {recipes.length === 0
              ? "Write down a recipe you cook at home, and it will be kept here."
              : favouritesOnly ? "Heart a recipe to see it here." : `${hiddenByDiet} of your recipes don't fit your diet, so they are hidden.`}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {visible.map((r) => (
            <li key={r.id}>
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl pr-2">
                <button onClick={() => setOpen(r)} className="flex-1 min-w-0 flex items-center gap-2 px-4 py-3.5 text-left min-h-11">
                  <VegMark diet={customRecipeDiet(r.ingredients)} size={14} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{r.name}</span>
                    <span className="block text-[11px] text-foreground/50">{r.ingredients.length} ingredients · {r.steps.length} steps</span>
                  </span>
                </button>
                <button
                  onClick={() => toggleFavourite(r)}
                  aria-pressed={r.isFavourite}
                  aria-label={`${r.isFavourite ? "Remove" : "Add"} ${r.name} ${r.isFavourite ? "from" : "to"} favourites`}
                  className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-foreground/5 shrink-0"
                >
                  <Heart size={16} className={r.isFavourite ? "fill-danger text-danger-strong" : "text-foreground/40"} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hiddenByDiet > 0 && visible.length > 0 && !favouritesOnly && (
        <p className="text-[11px] text-foreground/50">{hiddenByDiet} of your recipes don&apos;t fit your diet, so they are hidden.</p>
      )}
      {error && <p role="alert" className="text-xs text-danger-strong">{error}</p>}

      {creating && (
        <CustomRecipeModal userDiet={userDiet} onSave={save} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
