"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Sparkles, X } from "lucide-react";

export interface TourStep {
  title: string;
  body: string;
  /** Matches a `data-tour="…"` attribute on the real control being explained.
   * Omitted on the welcome step, which has nothing to point at yet. */
  target?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Nutri-Trust",
    body: "This is your pantry — everything you've got, and how long it's good for. Three quick things, then it's yours.",
  },
  {
    title: "Scan a receipt",
    body: "Just got back from a grocery run? Scan the receipt and every item on it gets added at once.",
    target: "receipt",
  },
  {
    title: "Scan a barcode",
    body: "Scan any packaged product to see its nutrition and whether it fits your diet — then add it to your pantry in one tap.",
    target: "barcode",
  },
  {
    title: "Ask your pantry anything",
    body: "Not sure what's expiring, or what to cook with it? Ask the AI assistant.",
    target: "askAi",
  },
];

const STORAGE_PREFIX = "onboarding-seen-";

export function hasSeenOnboarding(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_PREFIX + userId) === "1";
  } catch {
    return true; // storage unavailable — do not pester with a tour that can never be dismissed-and-remembered
  }
}

export function markOnboardingSeen(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, "1");
  } catch {
    // Nothing to do — the tour will just show again next time, which is the
    // same experience as a user who clears their browser data.
  }
}

interface OnboardingTourProps {
  onFinish: () => void;
}

/**
 * A short, skippable walkthrough: one centred welcome card, then three small
 * cards anchored to the real bottom-nav buttons they describe (receipt,
 * barcode, AI chat) via `data-tour` attributes on those buttons in page.tsx.
 *
 * Deliberately NOT a full-screen blocking modal for steps 2–4: a light dim
 * plus a highlight ring around the real button, so the actual UI stays
 * visible while it's being explained, rather than a wall hiding the thing
 * being pointed at.
 */
export function OnboardingTour({ onFinish }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isWelcome = stepIndex === 0;

  useEffect(() => {
    const measure = () => {
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      setTargetRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    if (!step.target) return;
    // The bottom nav is fixed, so scroll never moves it — only resize
    // (rotation, the md: two-column breakpoint) can move the target.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.target]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onFinish]);

  const next = () => {
    if (isLast) onFinish();
    else setStepIndex((i) => i + 1);
  };
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-base text-foreground leading-snug">{step.title}</h3>
        <button
          onClick={onFinish}
          title="Skip tour"
          aria-label="Skip tour"
          className="w-8 h-8 -mt-1 -mr-1 shrink-0 flex items-center justify-center rounded-full text-foreground/40 hover:bg-foreground/10 hover:text-foreground transition-colors"
        >
          <X size={15} />
        </button>
      </div>
      <p className="text-sm text-foreground/70 leading-relaxed mb-4">{step.body}</p>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-foreground/40 tabular-nums">
          {stepIndex + 1} of {TOUR_STEPS.length}
        </p>
        <div className="flex items-center gap-2">
          {!isWelcome && (
            <button
              onClick={back}
              className="min-h-11 px-3 rounded-xl text-sm font-semibold text-foreground/70 hover:bg-foreground/5 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            className="min-h-11 px-4 flex items-center gap-1.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {isLast ? "Done" : "Next"}
            {!isLast && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-80" role="dialog" aria-modal="true" aria-label="App tour">
      {/* Light dim throughout — step 2+ keep the real UI legible underneath;
          the welcome step has nothing behind it worth seeing yet, so the
          same low opacity still reads as deliberate rather than broken. */}
      <div className="absolute inset-0 bg-black/20 animate-in fade-in duration-200" onClick={isWelcome ? undefined : onFinish} />

      {targetRect && (
        <div
          className="absolute rounded-2xl ring-4 ring-brand pointer-events-none transition-all duration-300"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {isWelcome ? (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="neu-panel w-full max-w-sm rounded-3xl p-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-11 h-11 rounded-2xl bg-brand/15 text-brand flex items-center justify-center mb-3">
              <Sparkles size={20} />
            </div>
            {cardBody}
          </div>
        </div>
      ) : (
        // No caret: the glowing ring around the real button (above) is what
        // actually points at it, and stays correctly positioned regardless
        // of how tall this card renders at a given step's text length —
        // a caret glued to the card's own edge would need to also track the
        // target's x-position in the card's OWN coordinate space, which is
        // a second measurement this card does not need to carry.
        <div className="absolute inset-x-4 flex justify-center" style={{ bottom: 104 }}>
          <div className="w-full max-w-sm neu-panel rounded-3xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {cardBody}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
