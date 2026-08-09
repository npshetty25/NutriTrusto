"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Scale, Search, ChevronDown } from "lucide-react";
import {
  ADDITIVE_ENTRIES,
  DIRECTION_LABELS,
  LAST_REVIEWED,
  type AdditiveEntry,
  type DivergenceDirection,
} from "@/lib/additive-divergence";

interface AdditiveReferenceModalProps {
  onClose: () => void;
}

const JURISDICTION_LABELS: Record<string, string> = {
  india: "India",
  eu: "European Union",
  us: "United States",
  uk: "United Kingdom",
  japan: "Japan",
};

const DIRECTION_ORDER: DivergenceDirection[] = [
  "india-permits",
  "labelling-differs",
  "india-restricts",
];

function EntryRow({ entry }: { entry: AdditiveEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 py-3 text-left group"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight text-foreground">
            {entry.name}
            {entry.eNumber && (
              <span className="ml-1.5 font-mono text-[11px] font-semibold text-foreground/45">
                {entry.eNumber}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/55">
            {DIRECTION_LABELS[entry.direction]}
          </p>
        </div>
        <ChevronDown
          size={15}
          className={`mt-0.5 shrink-0 text-foreground/35 transition-transform duration-200 group-hover:text-foreground/60 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="pb-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs leading-relaxed text-foreground/75">{entry.summary}</p>

          <dl className="rounded-xl border border-border/70 divide-y divide-border/70 overflow-hidden">
            {Object.entries(entry.status).map(([jurisdiction, status]) => (
              <div key={jurisdiction} className="flex items-baseline gap-3 px-3 py-2">
                <dt className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-foreground/45">
                  {JURISDICTION_LABELS[jurisdiction] ?? jurisdiction}
                </dt>
                <dd className="text-[11px] leading-relaxed text-foreground/80">{status}</dd>
              </div>
            ))}
          </dl>

          <p className="text-[11px] leading-relaxed text-foreground/45">
            <span className="font-semibold uppercase tracking-widest text-[10px]">Source</span>
            <br />
            {entry.source}
          </p>
        </div>
      )}
    </div>
  );
}

export function AdditiveReferenceModal({ onClose }: AdditiveReferenceModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? ADDITIVE_ENTRIES.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.eNumber ?? "").toLowerCase().includes(q) ||
            e.keywords.some((k) => k.includes(q))
        )
      : ADDITIVE_ENTRIES;

    return DIRECTION_ORDER.map((direction) => ({
      direction,
      entries: matches.filter((e) => e.direction === direction),
    })).filter((g) => g.entries.length > 0);
  }, [query]);

  const total = ADDITIVE_ENTRIES.length;

  // Portalled for the same reason as every other modal opened from
  // ProfileDropdown: the dropdown lives inside the page's backdrop-blurred
  // header, which would otherwise become the containing block for "fixed".
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Additive reference"
        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Scale size={16} className="text-foreground/60 shrink-0" />
            <h3 className="font-bold text-sm tracking-tight truncate">Additive Reference</h3>
          </div>
          <button
            onClick={onClose}
            title="Close additive reference"
            aria-label="Close additive reference"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 pb-3 shrink-0 space-y-3">
          <p className="text-[11px] leading-relaxed text-foreground/55">
            Substances whose permitted status differs between India and other major
            authorities. These are records of what regulators decided, with dates —
            not a judgement about whether a food is safe.
          </p>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/35 pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${total} substances...`}
              aria-label="Search additives"
              className="neu-inset w-full rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-foreground/35 border border-border/40 focus:outline-none focus:ring-2 focus:ring-foreground/15 transition-all"
            />
          </div>
        </div>

        <div className="px-4 pb-4 overflow-y-auto">
          {grouped.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground/50">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            grouped.map((group) => (
              <section key={group.direction} className="mb-5 last:mb-0">
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-foreground/45">
                  {DIRECTION_LABELS[group.direction]}
                </h4>
                <div>
                  {group.entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              </section>
            ))
          )}

          <p className="mt-2 pt-3 border-t border-border text-[11px] leading-relaxed text-foreground/40">
            Hand-maintained list, last checked {LAST_REVIEWED}. It covers {total} substances
            and is not an exhaustive screen — a product may contain additives this list
            does not track.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
