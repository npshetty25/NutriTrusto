"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Upload, Loader2, X, Check } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { estimateShelfLife } from "@/lib/shelf-life";
import { isDietConflict, resolveItemDiet, type DietPreference } from "@/lib/diet";
import type { NewItem } from "@/components/add-item-modal";

interface ProducePhotoModalProps {
  userDiet: DietPreference;
  trackingAvailable: boolean;
  adjustEstimate: (name: string, days: number) => { days: number; note: string | null };
  /** `quiet` stops it announcing each item; the dialog reports once for the lot. */
  onAdd: (item: NewItem, quiet?: boolean) => Promise<boolean>;
  onClose: () => void;
  onDone: (added: number, failed: number) => void;
}

type Found = { name: string; blocked: boolean; picked: boolean };

/**
 * One photo of the day's shopping, no packaging: it names what it can see and
 * the person ticks what is right before anything is added. The model is only
 * ever trusted for names; the days come from the same shelf-life table as an
 * item typed by hand.
 */
export function ProducePhotoModal({ userDiet, trackingAvailable, adjustEstimate, onAdd, onClose, onDone }: ProducePhotoModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [reading, setReading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    setError(null);
    setFound(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setReading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await apiFetch("/api/scan-produce", { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Couldn't read that photo. Try again in better light.");
        return;
      }
      const names = data.items as string[];
      if (names.length === 0) {
        setError("We couldn't see any food we could name. Try a closer photo, or add them by hand.");
        return;
      }
      setFound(names.map((name) => {
        const blocked = isDietConflict(userDiet, resolveItemDiet(name));
        return { name, blocked, picked: !blocked };
      }));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setReading(false);
    }
  };

  const toggle = (name: string) =>
    setFound((list) => list?.map((f) => (f.name === name && !f.blocked ? { ...f, picked: !f.picked } : f)) ?? null);

  const add = async () => {
    const chosen = (found ?? []).filter((f) => f.picked);
    if (chosen.length === 0) return;
    setAdding(true);
    let added = 0;
    for (const f of chosen) {
      const est = estimateShelfLife(f.name);
      const ok = await onAdd(
        {
          name: f.name,
          daysLeft: adjustEstimate(f.name, est.days).days,
          expirySource: null,
          expiryKind: null,
          expiryDate: null,
          quantity: null,
          storage: trackingAvailable ? est.storage : null,
          openedAt: null,
        },
        true
      );
      if (ok) added += 1;
    }
    setAdding(false);
    onDone(added, chosen.length - added);
    onClose();
  };

  const picked = found?.filter((f) => f.picked).length ?? 0;

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="produce-heading" className="neu-panel w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 id="produce-heading" className="text-lg font-bold tracking-tight">Photo of fresh produce</h3>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-foreground/60 mb-4 leading-relaxed">For vegetables, fruit and herbs with no barcode. You check the list before anything is added.</p>

        <div className="w-full h-40 rounded-2xl border-2 border-dashed border-border bg-foreground/3 flex items-center justify-center overflow-hidden relative">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your photo" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center space-y-1">
              <Camera size={26} className="mx-auto text-foreground/30" />
              <p className="text-xs text-foreground/40">No photo yet</p>
            </div>
          )}
          {reading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin text-white" />
              <p className="text-xs text-white font-semibold">Looking...</p>
            </div>
          )}
        </div>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" aria-label="Take a photo of produce" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void read(f); }} />
        <input ref={galleryRef} type="file" accept="image/*" aria-label="Choose a photo of produce" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void read(f); }} />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => cameraRef.current?.click()} disabled={reading || adding}
            className="min-h-11 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40">
            <Camera size={15} /> Camera
          </button>
          <button onClick={() => galleryRef.current?.click()} disabled={reading || adding}
            className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold disabled:opacity-40">
            <Upload size={15} /> Gallery
          </button>
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-danger-strong leading-relaxed">{error}</p>}

        {found && (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">We can see</p>
            <ul className="space-y-1.5">
              {found.map((f) => (
                <li key={f.name}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={f.picked}
                    disabled={f.blocked}
                    onClick={() => toggle(f.name)}
                    className="w-full min-h-11 flex items-center gap-3 rounded-xl border border-border px-3 text-left disabled:opacity-50"
                  >
                    <span className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${f.picked ? "bg-safe border-safe text-white" : "border-border"}`}>
                      {f.picked && <Check size={12} />}
                    </span>
                    <span className="text-sm font-medium">{f.name}</span>
                    {f.blocked && <span className="ml-auto text-[11px] text-foreground/55">not in your diet</span>}
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => { void add(); }}
              disabled={adding || picked === 0}
              className="w-full min-h-12 mt-1 bg-foreground text-background rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {adding && <Loader2 size={15} className="animate-spin" />}
              Add {picked} {picked === 1 ? "item" : "items"} to pantry
            </button>
            <p className="text-[11px] text-foreground/50 leading-relaxed">Days left are our estimates for each. Edit any card if you know better.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
