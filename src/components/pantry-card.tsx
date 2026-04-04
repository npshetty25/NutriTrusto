"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ArrowRight, Leaf, Info, Carrot, Apple, Milk, Drumstick, Wheat, CupSoda, Croissant, Snowflake, Candy, Package } from "lucide-react";
import { inferItemCategory } from "@/lib/item-category";

export type RiskLevel = "high" | "medium" | "low";
export type HealthRating = "A" | "B" | "C" | "D" | "E";

interface PantryCardProps {
  id: string;
  name: string;
  daysLeft: number;
  risk: RiskLevel;
  purchaseDate: string;
  healthRating?: HealthRating;
  dietMatch?: boolean;
  allergensSafe?: boolean;
  healthierAlternative?: string;
}

const riskConfig = {
  high: { label: "Critical", color: "text-danger", dot: "bg-danger" },
  medium: { label: "Expiring Soon", color: "text-warning", dot: "bg-warning" },
  low: { label: "Optimal", color: "text-safe", dot: "bg-safe" },
};

const ratingColor = {
  A: "bg-green-500", B: "bg-green-400", C: "bg-yellow-400", D: "bg-orange-500", E: "bg-red-500"
};

export function PantryCard({ name, daysLeft, risk, purchaseDate, healthRating = "B", dietMatch = true, allergensSafe = true, healthierAlternative }: PantryCardProps) {
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
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className="group relative p-4 sm:p-5 rounded-2xl border border-border bg-card sleek-shadow hover:border-foreground/20 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-foreground/6 border border-border flex items-center justify-center text-foreground/70 shrink-0">
              <ItemIcon size={14} />
            </div>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white ${ratingColor[healthRating]} shrink-0`}>
              {healthRating}
            </div>
            <h3 className="font-bold text-sm sm:text-[15px] text-foreground tracking-tight wrap-break-word leading-snug truncate">
              {name}
            </h3>
          </div>
          <p className="text-[11px] text-foreground/50 uppercase tracking-wider font-medium">Purchased {purchaseDate}</p>
        </div>

        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
          risk === "high"
            ? "bg-danger/10 border-danger/20 text-danger"
            : risk === "medium"
              ? "bg-warning/10 border-warning/20 text-warning"
              : "bg-safe/10 border-safe/20 text-safe"
        }`}>
          {config.label}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background p-3 mb-3">
        <div className="flex items-end justify-between gap-2 mb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-foreground/45">Days Remaining</p>
          <p className="text-xs font-semibold text-foreground/60">Freshness</p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm text-foreground font-medium">
            <span className={`${config.color} font-extrabold text-3xl tracking-tight`}>{daysLeft}</span>
            <span className="ml-1 text-xs text-foreground/60 font-semibold">day(s)</span>
          </p>
          <div className="w-24 h-2.5 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${freshnessWidthClass} ${
                risk === "high" ? "bg-danger" : risk === "medium" ? "bg-warning" : "bg-safe"
              }`}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${dietMatch ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
          {dietMatch ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {dietMatch ? "Matches Diet" : "Diet Warning"}
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${allergensSafe ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-orange-500/10 text-orange-600 dark:text-orange-400"}`}>
          <Info size={12} />
          {allergensSafe ? "Allergen Safe" : "Check Allergens"}
        </div>
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
