"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Clock, Play, RefreshCw, ShoppingCart, Loader2, Check, ChevronDown } from "lucide-react";

export interface GeneratedRecipe {
  title: string;
  prepTime: string;
  fromPantry: { item: string; quantity: string }[];
  usesItems: string[];
  toBuy: string[];
  staples: string[];
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
  // Collapsed by default: the decision — "does this save my food and what
  // must I buy?" — is answerable without reading a single step.
  const [showSteps, setShowSteps] = useState(false);
  const [showStaples, setShowStaples] = useState(false);

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
        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-3 border-b border-border shrink-0">
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

        <div className="flex-1 overflow-y-auto">
          {/* The answer, before any reading: what it saves, what it costs. */}
          <div className="grid grid-cols-2 gap-px bg-border border-b border-border shrink-0">
            <div className="bg-card px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Saves</p>
              <p className="text-2xl font-bold tracking-tight text-safe tabular-nums leading-tight">
                {recipe.fromPantry.length}
              </p>
              <p className="text-[11px] text-foreground/50">of your items</p>
            </div>
            <div className="bg-card px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/45">To buy</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums leading-tight">{recipe.toBuy.length}</p>
              <p className="text-[11px] text-foreground/50">
                {recipe.toBuy.length === 0 ? "nothing needed" : recipe.toBuy.length === 1 ? "ingredient" : "ingredients"}
              </p>
            </div>
          </div>

          <div className="p-4 space-y-5">
            {recipe.fromPantry.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/45 mb-2">
                  From your pantry
                </h4>
                <ul className="space-y-1.5">
                  {recipe.fromPantry.map((row) => (
                    <li key={row.item} className="flex items-start gap-2.5 text-[13px]">
                      <Check size={14} className="text-safe shrink-0 mt-0.5" />
                      <span className="text-foreground/85">
                        <span className="font-semibold text-foreground">{row.item}</span>
                        {row.quantity && <span className="text-foreground/60"> — {row.quantity}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recipe.toBuy.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/45 mb-2">
                  You&apos;ll need to buy
                </h4>
                <ul className="space-y-1.5">
                  {recipe.toBuy.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px]">
                      <ShoppingCart size={13} className="text-foreground/40 shrink-0 mt-0.5" />
                      <span className="text-foreground/85">{ing}</span>
                    </li>
                  ))}
                </ul>
                {onAddMissing && (
                  <button
                    onClick={onAddMissing}
                    disabled={isAddingToShoppingList}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-foreground/5 transition-colors disabled:opacity-60"
                  >
                    {isAddingToShoppingList ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                    Add {recipe.toBuy.length} to shopping list
                  </button>
                )}
              </div>
            )}

            {recipe.staples.length > 0 && (
              <div>
                <button
                  onClick={() => setShowStaples((v) => !v)}
                  aria-expanded={showStaples}
                  className="w-full flex items-center justify-between gap-2 text-left group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/45">
                    Kitchen staples ({recipe.staples.length})
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-foreground/35 transition-transform duration-200 ${showStaples ? "rotate-180" : ""}`}
                  />
                </button>
                {showStaples && (
                  <p className="mt-2 text-[12px] leading-relaxed text-foreground/55 animate-in fade-in duration-200">
                    {recipe.staples.join(" · ")}
                  </p>
                )}
              </div>
            )}

            {recipe.steps.length > 0 && (
              <div className="border-t border-border pt-4">
                <button
                  onClick={() => setShowSteps((v) => !v)}
                  aria-expanded={showSteps}
                  className="w-full flex items-center justify-between gap-2 text-left"
                >
                  <span className="text-sm font-bold tracking-tight">
                    {showSteps ? "Hide" : "Show"} the {recipe.steps.length} steps
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-foreground/40 transition-transform duration-200 ${showSteps ? "rotate-180" : ""}`}
                  />
                </button>
                {showSteps && (
                  <ol className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {recipe.steps.map((step, i) => (
                      <li key={i} className="text-[13px] text-foreground/80 flex gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-foreground/8 border border-border flex items-center justify-center text-[11px] font-bold text-foreground/60 tabular-nums">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-foreground/40">
              Written for the items you have, so it won&apos;t match any single published recipe.
            </p>
          </div>
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
        </div>
      </div>
    </div>,
    document.body
  );
}
