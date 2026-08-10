"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ArrowRight, Leaf, Info, Scale, Carrot, Apple, Milk, Drumstick, Wheat, CupSoda, Croissant, Snowflake, Candy, Package } from "lucide-react";
import { inferItemCategory } from "@/lib/item-category";
import { ALLERGEN_LABELS, type AllergenTag } from "@/lib/allergens";
import { type AdditiveEntry } from "@/lib/additive-divergence";

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
  // null/undefined = no ingredient data was available for this item, so
  // allergen content is genuinely unknown — must not be shown as "safe".
  // [] = ingredient data exists and no common allergen keyword matched.
  // non-empty = ingredient data exists and these allergens were detected.
  detectedAllergens?: AllergenTag[] | null;
  // Same null/[] contract as detectedAllergens: null means no ingredient
  // data was available, [] means none of the tracked substances matched.
  divergentAdditives?: AdditiveEntry[] | null;
  healthierAlternative?: string;
}

const riskConfig = {
  high: { label: "Critical", color: "text-danger", dot: "bg-danger" },
  medium: { label: "Expiring Soon", color: "text-warning", dot: "bg-warning" },
  low: { label: "Optimal", color: "text-safe", dot: "bg-safe" },
};

export function PantryCard({ name, daysLeft, risk, purchaseDate, healthScore, dietMatch = true, detectedAllergens, divergentAdditives, healthierAlternative }: PantryCardProps) {
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
  const freshnessPercent = Math.max(0, Math.min(100, Math.round((daysLeft / 14) * 100)));
  const freshnessWidthClass =
    freshnessPercent >= 95 ? "w-full" :
    freshnessPercent >= 85 ? "w-11/12" :
    freshnessPercent >= 75 ? "w-9/12" :
    freshnessPercent >= 65 ? "w-8/12" :
    freshnessPercent >= 55 ? "w-7/12" :
    freshnessPercent >= 45 ? "w-6/12" :
    freshnessPercent >= 35 ? "w-5/12" :
    freshnessPercent >= 25 ? "w-4/12" :
    freshnessPercent >= 15 ? "w-3/12" :
    freshnessPercent >= 8 ? "w-2/12" :
    freshnessPercent > 0 ? "w-1/12" :
    "w-0";

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
            <h3 className="font-bold text-sm sm:text-[15px] text-foreground tracking-tight wrap-break-word leading-snug truncate">
              {name}
            </h3>
          </div>
          <p className="text-[11px] text-foreground/60 uppercase tracking-wider font-medium">Purchased {purchaseDate}</p>
        </div>

        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
          risk === "high"
            ? "bg-danger/15 border-danger/30 text-danger-strong dark:text-danger"
            : risk === "medium"
              ? "bg-warning/15 border-warning/30 text-warning-strong dark:text-warning"
              : "bg-safe/15 border-safe/30 text-safe-strong dark:text-safe"
        }`}>
          {config.label}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background p-3 mb-3">
        <div className="flex items-end justify-between gap-2 mb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-foreground/60">Days Remaining</p>
          <p className="text-xs font-semibold text-foreground/60">Freshness</p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm text-foreground font-medium">
            <span className={`${config.color} font-extrabold text-3xl tracking-tight`}>{daysLeft}</span>
            <span className="ml-1 text-xs text-foreground/60 font-semibold">{daysLeft === 1 ? "day" : "days"} left</span>
          </p>
          <div className="w-24 h-2.5 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${freshnessWidthClass} ${
                risk === "high" ? "bg-danger" : risk === "medium" ? "bg-warning" : "bg-safe"
              }`}
            />
          </div>
        </div>

        {daysLeft === 0 && (
          <p className="mt-2 text-[11px] leading-relaxed font-semibold text-danger">
            {name} has likely spoiled. Remove it, or use it now if it still seems fine.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${dietMatch ? "bg-safe/15 text-safe-strong dark:text-safe" : "bg-danger/15 text-danger-strong dark:text-danger"}`}>
          {dietMatch ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {dietMatch ? "Matches Diet" : "Diet Warning"}
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
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-warning/15 text-warning-strong dark:text-warning">
            <ShieldAlert size={12} />
            Contains {detectedAllergens.map((tag) => ALLERGEN_LABELS[tag]).join(", ")}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-foreground/8 text-foreground/70">
            <ShieldCheck size={12} />
            No Common Allergens
          </div>
        )}

        {/* Regulatory annotation, deliberately uncoloured — see The
            Annotation Rule in DESIGN.md. A citation is not a reading, and
            an amber chip here would read as danger when it only means two
            authorities disagree. */}
        {divergentAdditives && divergentAdditives.length > 0 && (
          <div
            title={divergentAdditives.map((a) => a.summary).join("\n\n")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-foreground/8 text-foreground/70"
          >
            <Scale size={12} />
            {divergentAdditives.length === 1
              ? `${divergentAdditives[0].eNumber ?? divergentAdditives[0].name} differs by region`
              : `${divergentAdditives.length} additives differ by region`}
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
    </motion.div>
  );
}
