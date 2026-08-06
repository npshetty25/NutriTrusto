"use client";

import { useEffect, useState } from "react";
import { X, ChefHat, Clock, Loader2, RefreshCw } from "lucide-react";

interface CustomRecipe {
  title: string;
  prepTime: string;
  usesItems: string[];
  ingredients: string[];
  steps: string[];
}

interface CustomRecipeModalProps {
  itemNames: string[];
  dietaryPreference: string;
  onClose: () => void;
}

export default function CustomRecipeModal({ itemNames, dietaryPreference, onClose }: CustomRecipeModalProps) {
  const [recipe, setRecipe] = useState<CustomRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-pantry-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemNames, dietaryPreference }),
      });
      const data = await res.json();
      if (data.success) {
        setRecipe(data.recipe);
      } else {
        setError("Couldn't generate a recipe right now. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
            <ChefHat size={14} />
          </div>
          <h3 className="font-bold text-sm tracking-tight truncate">Custom Pantry Recipe</h3>
        </div>
        <button
          onClick={onClose}
          title="Close recipe"
          aria-label="Close recipe"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-foreground/50">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-sm">Cooking up something from your pantry...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-danger">{error}</p>
            <button onClick={generate} className="text-sm font-semibold underline">Try again</button>
          </div>
        )}

        {recipe && !loading && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold tracking-tight">{recipe.title}</h2>
              <div className="flex items-center gap-1.5 text-foreground/50 text-xs mt-1">
                <Clock size={12} /> {recipe.prepTime}
              </div>
            </div>

            {recipe.usesItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recipe.usesItems.map((name) => (
                  <span key={name} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-safe/10 text-safe border border-safe/20">
                    Uses: {name}
                  </span>
                ))}
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-foreground/50 mb-2">Ingredients</h4>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2">
                    <span className="text-foreground/30">•</span> {ing}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-foreground/50 mb-2">Steps</h4>
              <ol className="space-y-3">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-foreground/8 border border-border flex items-center justify-center text-[11px] font-bold text-foreground/60">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <button
              onClick={generate}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-foreground/5 transition-colors"
            >
              <RefreshCw size={14} /> Generate another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
