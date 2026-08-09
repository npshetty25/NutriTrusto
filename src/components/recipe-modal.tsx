"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Clock, Play, RefreshCw, ShoppingCart, Loader2 } from "lucide-react";

export interface GeneratedRecipe {
  title: string;
  prepTime: string;
  usesItems: string[];
  ingredients: string[];
  steps: string[];
  rescueNote: string;
  videoSearchUrl: string;
}

interface RecipeModalProps {
  recipe: GeneratedRecipe;
  onClose: () => void;
  onTryAnother: () => void;
  isRegenerating: boolean;
  onAddMissing?: () => void;
  isAddingToShoppingList?: boolean;
}

export function RecipeModal({
  recipe,
  onClose,
  onTryAnother,
  isRegenerating,
  onAddMissing,
  isAddingToShoppingList,
}: RecipeModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={recipe.title}
        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-base tracking-tight leading-snug">{recipe.title}</h3>
            <div className="flex items-center gap-1.5 text-foreground/50 text-xs mt-1">
              <Clock size={12} /> {recipe.prepTime}
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close recipe"
            aria-label="Close recipe"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {recipe.rescueNote && (
            <p className="text-xs leading-relaxed text-foreground/70 bg-foreground/5 border border-border/50 rounded-xl p-3">
              {recipe.rescueNote}
            </p>
          )}

          {recipe.usesItems.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/45 mb-2">
                Uses from your pantry
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {recipe.usesItems.map((name) => (
                  <span
                    key={name}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-safe/10 text-safe border border-safe/20"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recipe.ingredients.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/45 mb-2">
                Ingredients
              </h4>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-[13px] text-foreground/80 flex gap-2">
                    <span className="text-foreground/30 shrink-0">•</span> {ing}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recipe.steps.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/45 mb-2">Steps</h4>
              <ol className="space-y-3">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="text-[13px] text-foreground/80 flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-foreground/8 border border-border flex items-center justify-center text-[11px] font-bold text-foreground/60">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-foreground/40">
            Written for the items you have, so it won&apos;t match any single published recipe. The link below
            searches YouTube for the dish if you&apos;d rather watch someone cook it.
          </p>
        </div>

        <div className="shrink-0 border-t border-border p-3 grid grid-cols-2 gap-2">
          <a
            href={recipe.videoSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Play size={12} fill="currentColor" /> Watch on YouTube
          </a>
          <button
            onClick={onTryAnother}
            disabled={isRegenerating}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-foreground/5 transition-colors disabled:opacity-60"
          >
            {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Another idea
          </button>
          {onAddMissing && (
            <button
              onClick={onAddMissing}
              disabled={isAddingToShoppingList}
              className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-foreground/5 transition-colors disabled:opacity-60"
            >
              {isAddingToShoppingList ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
              Add missing ingredients to shopping list
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
