"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ArrowRight, Leaf, Info, Carrot, Apple, Milk, Drumstick, Wheat, CupSoda, Croissant, Snowflake, Candy, Package } from "lucide-react";
import { inferItemCategory } from "@/lib/item-category";
import { ALLERGEN_LABELS, type AllergenTag } from "@/lib/allergens";
import { VegMark } from "@/components/veg-mark";
import type { ItemDietType } from "@/lib/diet";

export type RiskLevel = "high" | "medium" | "low";

interface PantryCardProps {
  id: string;
  name: string;
  daysLeft: number;
  risk: RiskLevel;
  purchaseDate: string;
  // The genuine 1-5 NutriTrust score from a barcode scan, or null/undefined
  // when this item was never scanned. Never invent one: the card previously
  // derived an A-E grade from the item name's character count.
  healthScore?: string | null;
  dietMatch?: boolean;
  // The exact wording, decided by the caller from the user's preference and
  // the item's own type. A boolean could only ever say "Matches Diet" or
  // "Diet Warning", which cannot distinguish "contains egg" from "is meat".
  dietLabel?: string;
  /** Drives the Indian veg/non-veg mark. */
  itemDiet?: ItemDietType;
  /** True when the reading came from the name alone, with no ingredient list. */
  dietUnverified?: boolean;
  // null/undefined = no ingredient data was available for this item, so
  // allergen content is genuinely unknown — must not be shown as "safe".
  // [] = ingredient data exists and no common allergen keyword matched.
  // non-empty = ingredient data exists and these allergens were detected.
  detectedAllergens?: AllergenTag[] | null;
  healthierAlternative?: string;
  // Rendered in the card's own footer. These used to be free-floating
  // buttons absolutely positioned over the card by the dashboard, which
  // meant they overlapped whatever the card happened to render last.
  actions?: ReactNode;
}

// The readout colours are calibrated as fills. Used as a 30px numeral on a
// light ground they measured 2.49:1 (warning) and 2.65:1 (safe) — the
// biggest element on the card, and the number the product exists to
// produce, failing even the 3:1 large-text threshold. The -strong variants
// are the same hues taken down in lightness until they clear it.
// Wording a person would use, not a status enum. "Critical" is a severity
// level; "Eat today" is an instruction, which is what the user actually
// wants from a card telling them food is about to die.
const riskConfig = {
  high: { label: "Eat today", color: "text-danger-strong", bar: "bg-danger" },
  medium: { label: "Eat this week", color: "text-warning-strong", bar: "bg-warning" },
  low: { label: "Plenty of time", color: "text-safe-strong", bar: "bg-safe" },
};

const DAY_MS = 86_400_000;
// dd/mm — the household convention in the product's home market. The card
// used to print ISO ("PURCHASED 2026-08-06") in an India-first product.
const formatDayMonth = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export function PantryCard({ name, daysLeft, risk, purchaseDate, healthScore, dietMatch = true, dietLabel, itemDiet = "veg", dietUnverified = false, detectedAllergens, healthierAlternative, actions }: PantryCardProps) {
  const score = healthScore != null ? Number.parseFloat(healthScore) : NaN;
  const hasScore = Number.isFinite(score);
  // Same thresholds the nutrition trend chart uses, so one score reads the
  // same everywhere in the app.
  const scoreTone = !hasScore
    ? "bg-foreground/8 text-foreground/60"
    : score >= 3.5
      ? "bg-safe/15 text-safe"
      : score >= 2.5
        ? "bg-warning/15 text-warning"
        : "bg-danger/15 text-danger";
  const config = riskConfig[risk];
  const category = inferItemCategory(name);

  const categoryIconMap = {
    vegetable: Carrot,
    fruit: Apple,
    dairy: Milk,
    meat: Drumstick,
    grain: Wheat,
    beverage: CupSoda,
    bakery: Croissant,
    frozen: Snowflake,
    snack: Candy,
    pantry: Package,
    unknown: Package,
  } as const;

  const ItemIcon = categoryIconMap[category];
  // The bar used to be daysLeft/14 — the same fixed divisor the dashboard
  // metric documents as removed for being un-winnable. It made a 13-day
  // item show an amber "expiring" chip beside a nearly-full bar, and an
  // expired item show an empty grey track that read as "no data" rather
  // than "gone". It now runs off the same thresholds as the chip beside it,
  // so the two can never disagree.
  const freshnessWidthClass =
    daysLeft <= 0 ? "w-full" :
    risk === "high" ? (daysLeft <= 1 ? "w-1/12" : "w-2/12") :
    risk === "medium" ? (daysLeft <= 5 ? "w-5/12" : "w-6/12") :
    daysLeft >= 14 ? "w-full" : daysLeft >= 10 ? "w-10/12" : "w-8/12";

  // Reading the clock during render is impure, but the expiry date is
  // genuinely relative to now: daysLeft is already "days remaining as of
  // this render", computed by the dashboard from purchase_date + shelf life.
  // This card is only ever rendered on the client, after auth, so there is
  // no server snapshot for it to disagree with.
  // eslint-disable-next-line react-hooks/purity
  const expiryLabel = formatDayMonth(new Date(Date.now() + daysLeft * DAY_MS).toISOString());

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      whileHover={{ y: -4 }}
      className="neu-pressable group relative p-4 sm:p-5 rounded-2xl"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-foreground/6 border border-border flex items-center justify-center text-foreground/70 shrink-0">
              <ItemIcon size={14} />
            </div>
            <div
              title={hasScore ? `NutriTrust score ${score.toFixed(1)} out of 5` : "Not scanned — no score available"}
              className={`h-6 px-1.5 rounded-md flex items-center justify-center text-[11px] font-bold tabular-nums shrink-0 ${scoreTone}`}
            >
              {hasScore ? score.toFixed(1) : "—"}
            </div>
            <VegMark diet={itemDiet} unverified={dietUnverified} size={15} />
            <h3 title={name} className="font-bold text-sm sm:text-[15px] text-foreground tracking-tight leading-snug truncate">
              {name}
            </h3>
          </div>
          {/* An expiry tracker that never printed an expiry date. The
              purchase date was the only date on the card — the one that
              doesn't matter — leaving the user to hold the shelf life in
              their head. */}
          <p className="text-[11px] text-foreground/60 uppercase tracking-wider font-medium">
            {daysLeft > 0 ? `Use by ${expiryLabel}` : `Was due ${expiryLabel}`}
            <span className="text-foreground/40 normal-case tracking-normal"> · bought {formatDayMonth(purchaseDate)}</span>
          </p>
        </div>

        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
          risk === "high"
            ? "bg-danger/15 border-danger/30 text-danger-strong"
            : risk === "medium"
              ? "bg-warning/15 border-warning/30 text-warning-strong"
              : "bg-safe/15 border-safe/30 text-safe-strong"
        }`}>
          {config.label}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background p-3 mb-3">
        <div className="flex items-end justify-between gap-2 mb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-foreground/60">Time left</p>
          <p className="text-xs font-semibold text-foreground/60">Freshness</p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm text-foreground font-medium">
            <span className={`${config.color} font-extrabold text-3xl tracking-tight`}>{daysLeft}</span>
            <span className="ml-1 text-xs text-foreground/60 font-semibold">{daysLeft === 1 ? "day" : "days"} left</span>
          </p>
          <div className="w-24 h-2.5 rounded-full bg-foreground/10 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${freshnessWidthClass} ${config.bar}`} />
          </div>
        </div>

        {daysLeft === 0 && (
          <p className="mt-2 text-[11px] leading-relaxed font-semibold text-danger">
            {name} has likely spoiled. Remove it, or use it now if it still seems fine.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${dietMatch ? "bg-safe/15 text-safe-strong" : "bg-danger/15 text-danger-strong"}`}>
          {dietMatch ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {dietLabel ?? (dietMatch ? "Matches Diet" : "Diet Warning")}
        </div>

        {detectedAllergens == null ? (
          <div
            title="No ingredient data was available for this item, so allergen content couldn't be checked"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-foreground/8 text-foreground/70"
          >
            <Info size={12} />
            Allergens Unknown
          </div>
        ) : detectedAllergens.length > 0 ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-warning/15 text-warning-strong">
            <ShieldAlert size={12} />
            Contains {detectedAllergens.map((tag) => ALLERGEN_LABELS[tag]).join(", ")}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-foreground/8 text-foreground/70">
            <ShieldCheck size={12} />
            No Common Allergens
          </div>
        )}

      </div>

      {healthierAlternative && (
        <div className="mt-3 bg-foreground/5 rounded-xl p-3 border border-border/50 flex flex-col gap-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-foreground/50 tracking-wider">
            <Leaf size={10} /> Better Alternative
          </div>
          <p className="text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
            Try <ArrowRight size={10} className="opacity-50" /> <span className="text-foreground">{healthierAlternative}</span>
          </p>
        </div>
      )}

      {actions && <div className="mt-4 pt-3 border-t border-border/60">{actions}</div>}
    </motion.div>
  );
}
