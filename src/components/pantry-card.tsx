"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ArrowRight, Leaf, Info } from "lucide-react";

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className="group relative p-4 rounded-xl border border-border bg-card sleek-shadow hover:border-foreground/20 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3 border-b border-border/50 pb-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white ${ratingColor[healthRating]}`}>
              {healthRating}
            </div>
            <h3 className="font-bold text-sm text-foreground tracking-tight">{name}</h3>
          </div>
          <p className="text-[11px] text-foreground/50 uppercase tracking-wider font-medium ml-8">Purchased {purchaseDate}</p>
        </div>
        
        <div className="flex flex-col items-end">
           <p className="text-[10px] text-foreground/50 uppercase tracking-wider font-semibold mb-1">Shelf Life</p>
           <div className="bg-foreground/5 px-2 py-1 rounded-md">
             <p className="text-xs text-foreground font-medium">
               <span className={`${config.color} font-bold text-lg tracking-tight`}>{daysLeft}</span> days
             </p>
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
           <span className="text-[9px] uppercase font-bold tracking-widest text-foreground/40">Profile Match</span>
           <div className="flex-1 h-px bg-border/50"></div>
        </div>
        
        <div className="flex flex-wrap gap-2">
           <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold ${dietMatch ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
             {dietMatch ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
             {dietMatch ? "Matches Diet" : "Diet Warning"}
           </div>
           
           <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-foreground/5 text-foreground/70">
             <Info size={12} /> Allergens Safe (Soon)
           </div>
        </div>

        {healthierAlternative && (
          <div className="mt-1 bg-foreground/5 rounded-lg p-2.5 border border-border/50 flex flex-col gap-1.5">
             <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-foreground/50 tracking-wider">
               <Leaf size={10} /> Tailored Alternative
             </div>
             <p className="text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
               Consider <ArrowRight size={10} className="opacity-50" /> <span className="text-foreground">{healthierAlternative}</span>
             </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
