"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Plus, ScanLine } from "lucide-react";
import BarcodeScanner from "@/components/barcode-scanner";
import { parseGs1 } from "@/lib/gs1";
import { matchesTerm } from "@/lib/text-match";
import { estimateShelfLife, formatProvenance } from "@/lib/shelf-life";
import { isDietConflict, resolveItemDiet, DIET_PREFERENCE_LABEL, type DietPreference } from "@/lib/diet";
import {
  STORAGE_OPTIONS,
  OPENED_DAYS_OPTIONS,
  daysLeftAfterMove,
  daysLeftAfterOpening,
  daysUntilDate,
  type ExpirySource,
} from "@/lib/item-tracking";
import type { StorageLocation } from "@/lib/temperature";

export interface NewItem {
  name: string;
  daysLeft: number;
  expirySource: ExpirySource;
  storage: StorageLocation | null;
  openedAt: string | null;
}

interface AddItemModalProps {
  userDiet: DietPreference;
  /** False until db/supabase-schema-item-tracking.sql has run: storage and
   * opened are then not offered, because there is nowhere to keep them. */
  trackingAvailable: boolean;
  onAdd: (item: NewItem) => Promise<boolean>;
  onClose: () => void;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/**
 * Add an item by hand — loose produce from the sabzi-wala, anything without a
 * barcode, or a pack the barcode database does not know.
 *
 * The person's own information always beats the app's: a date typed off the
 * pack is used as-is; only when there is none does the shelf-life estimate
 * fill in, and the form shows which one it is going to use before saving.
 */
export function AddItemModal({ userDiet, trackingAvailable, onAdd, onClose }: AddItemModalProps) {
  const [name, setName] = useState("");
  const [packDate, setPackDate] = useState("");
  const [storage, setStorage] = useState<StorageLocation | null>(null);
  const [opened, setOpened] = useState(false);
  const [openedDays, setOpenedDays] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState(false);

  const trimmed = name.trim();
  const estimate = trimmed ? estimateShelfLife(trimmed) : null;
  const dateDays = packDate ? daysUntilDate(packDate) : null;
  const expirySource: ExpirySource = dateDays !== null ? "user" : null;
  const effectiveStorage = storage ?? estimate?.storage ?? null;

  // What the item will show, step by step, so the preview and the save agree.
  let preview: { daysLeft: number; note: string } | null = null;
  if (estimate) {
    let daysLeft = dateDays ?? estimate.days;
    let note = dateDays !== null ? "From the date you entered." : estimate.explanation;
    if (trackingAvailable && storage && storage !== estimate.storage) {
      const moved = daysLeftAfterMove(trimmed, daysLeft, estimate.storage, storage, expirySource);
      daysLeft = moved.daysLeft;
      if (!moved.changed && moved.reason) note = `${note} ${moved.reason}`;
    }
    if (trackingAvailable && opened && openedDays) {
      daysLeft = daysLeftAfterOpening(daysLeft, openedDays);
    }
    preview = { daysLeft, note };
  }

  const itemDiet = trimmed ? resolveItemDiet(trimmed) : "veg";
  const dietBlocked = !!trimmed && isDietConflict(userDiet, itemDiet);

  // The barcode identifies the product, not this pack's date, so a scan only
  // fills in the name. The use-by date is still typed by hand, as it is on
  // the pack. Not found in the database is a normal outcome: say so and let
  // the name be typed.
  const handleScanned = async (decoded: string) => {
    setScanning(false);
    setError(null);
    const code = parseGs1(decoded)?.lookupCode ?? decoded;
    setLooking(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,quantity`);
      const data = await res.json();
      const product = data?.status === 1 ? (data.product as { product_name?: string; brands?: string; quantity?: string } | undefined) : undefined;
      const base = product?.product_name?.trim();
      if (!base) {
        setError("That barcode isn't in the product database. Type the name instead.");
        return;
      }
      const brand = product?.brands?.split(",")[0]?.trim();
      const withBrand = brand && !matchesTerm(base.toLowerCase(), brand.toLowerCase()) ? `${brand} ${base}` : base;
      setName(withBrand.slice(0, 80));
    } catch {
      setError("Couldn't look that barcode up. Check your connection, or type the name.");
    } finally {
      setLooking(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!trimmed) return setError("Enter the item's name.");
    if (trimmed.length > 80) return setError("Keep the name under 80 characters.");
    if (packDate && dateDays === null) return setError("That date doesn't look right.");
    if (trackingAvailable && opened && !openedDays) return setError("Pick how soon it should be used once opened.");
    if (dietBlocked || !preview) return;

    setSaving(true);
    const ok = await onAdd({
      name: trimmed,
      daysLeft: preview.daysLeft,
      expirySource,
      storage: trackingAvailable ? effectiveStorage : null,
      openedAt: trackingAvailable && opened ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (ok) onClose();
    else setError("Couldn't save that. Check your connection and try again.");
  };

  const chip = (active: boolean) =>
    `min-h-11 px-3 rounded-xl text-xs font-semibold transition-all ${
      active ? "bg-foreground text-background" : "neu-raised-sm text-foreground/70 hover:text-foreground"
    }`;

  // The scanner is a full-screen layer of its own, so it replaces the form
  // while open instead of sitting underneath this dialog.
  if (scanning) {
    return (
      <BarcodeScanner
        onScan={(decoded) => { void handleScanned(decoded); }}
        onClose={() => setScanning(false)}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-heading"
        className="neu-panel w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="add-item-heading" className="text-lg font-bold tracking-tight">Add an item</h3>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="add-item-name" className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Name</label>
              <button
                type="button"
                onClick={() => { setError(null); setScanning(true); }}
                disabled={looking}
                className="min-h-11 flex items-center gap-1.5 text-xs font-semibold text-foreground/70 hover:text-foreground disabled:opacity-60"
              >
                {looking ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                {looking ? "Looking it up…" : "Scan barcode"}
              </button>
            </div>
            <input
              id="add-item-name"
              type="text"
              autoFocus
              maxLength={80}
              placeholder="e.g. Tomatoes, Amul Taaza Milk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="neu-field w-full rounded-xl px-4 py-3 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-item-date" className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">
              Use-by date <span className="normal-case tracking-normal font-normal text-foreground/50">(from the pack, optional)</span>
            </label>
            <input
              id="add-item-date"
              type="date"
              value={packDate}
              onChange={(e) => setPackDate(e.target.value)}
              className="neu-field w-full rounded-xl px-4 py-3 text-base"
            />
            <p className="text-[11px] text-foreground/55">Type the date printed on the pack. A barcode doesn&apos;t carry it, and a date from the pack beats any estimate.</p>
          </div>

          {trackingAvailable && (
            <>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Where is it kept?</p>
                <div role="group" aria-label="Where is it kept" className="grid grid-cols-3 gap-2">
                  {STORAGE_OPTIONS.map((o) => (
                    <button key={o.id} type="button" aria-pressed={effectiveStorage === o.id} onClick={() => setStorage(o.id)} className={chip(effectiveStorage === o.id)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Already opened?</p>
                <div role="group" aria-label="Already opened" className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={!opened} onClick={() => setOpened(false)} className={chip(!opened)}>No, sealed</button>
                  <button type="button" aria-pressed={opened} onClick={() => setOpened(true)} className={chip(opened)}>Yes, opened</button>
                </div>
                {opened && (
                  <div className="pt-1">
                    <p className="text-[11px] text-foreground/60 mb-1.5">Use within how many days of opening? Most packs print this.</p>
                    <div role="group" aria-label="Use within days of opening" className="flex flex-wrap gap-2">
                      {OPENED_DAYS_OPTIONS.map((d) => (
                        <button key={d} type="button" aria-pressed={openedDays === d} onClick={() => setOpenedDays(d)} className={chip(openedDays === d)}>
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {preview && !dietBlocked && (
            <div className="rounded-2xl bg-foreground/5 border border-border/60 p-3">
              <p className="text-sm font-semibold text-foreground">Will show {days(preview.daysLeft)} left</p>
              <p className="text-[11px] text-foreground/60 mt-0.5 leading-relaxed">{preview.note}</p>
              {dateDays === null && estimate && (
                <p className="text-[10px] text-foreground/45 mt-1">{formatProvenance(estimate)}</p>
              )}
            </div>
          )}

          {dietBlocked && (
            <p role="alert" className="text-xs text-danger-strong leading-relaxed">
              {trimmed} doesn&apos;t fit your {DIET_PREFERENCE_LABEL[userDiet].toLowerCase()} diet, so it would not show in your pantry.
              You can change your diet from the profile menu.
            </p>
          )}

          {error && <p role="alert" className="text-xs text-danger-strong">{error}</p>}

          <button
            type="submit"
            disabled={saving || !trimmed || dietBlocked}
            className="w-full min-h-12 bg-foreground text-background rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Add to pantry
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
