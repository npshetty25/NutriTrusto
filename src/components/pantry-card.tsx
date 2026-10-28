"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ArrowRight, Leaf, Info, ChevronDown, Carrot, Apple, Milk, Drumstick, Wheat, CupSoda, Croissant, Snowflake, Candy, Package } from "lucide-react";
import { inferItemCategory } from "@/lib/item-category";
import { ALLERGEN_LABELS, type AllergenTag } from "@/lib/allergens";
import { VegMark } from "@/components/veg-mark";
import type { ItemDietType } from "@/lib/diet";
import { dietChipClasses } from "@/lib/colour-semantics";
import { StoragePanel, type IfStoredDifferently } from "@/components/storage-panel";
import { dueDateFromToday, parsePurchaseDate } from "@/lib/item-age";
import { dueLine, pastDateMessage, type DateKind, type DateOrigin } from "@/lib/date-kind";

export type RiskLevel = "high" | "medium" | "low";

interface PantryCardProps {
  id: string;
  name: string;
  daysLeft: number;
  /** Days beyond the date; 0 while still within it (including the day itself). */
  daysPastEstimate?: number;
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
  /**
   * What the chip says. Derived from the literal day count, not the risk
   * band: once the bands became relative, a long-life staple in its last
   * tenth banded "high", and a chip reading "Eat today" on a sealed bag of
   * rice with a month left would be plainly wrong. Colour still comes from
   * the band; the words come from the deadline.
   */
  riskLabel?: string;
  /** Where the shelf-life figure came from, shown verbatim. */
  shelfLifeCitation?: string;
  shelfLifeConfidence?: "high" | "medium" | "low";
  /** "Estimates based on typical Indian storage conditions". */
  storageDisclaimer?: string;
  /**
   * What this item would keep for in the fridge / on the shelf / in the
   * freezer. The engine has computed this since the shelf-life hardening
   * pass; until now nothing rendered it — the largest gap between what the
   * app can do and what it does.
   */
  ifStoredDifferently?: IfStoredDifferently;
  /** Where this item is actually assumed to be kept, to highlight that column. */
  currentStorage?: "fridge" | "counter" | "freezer";
  /** Short facts the person told us: "In the fridge", "Opened 3 Oct", "Date from pack". */
  trackingTags?: string[];
  /** What this account avoids that the item contains ("You avoid: nuts", "Not Jain"), shown as warnings. */
  profileWarnings?: string[];
  /** Where the date came from: the pack, the person, or (null) our estimate. */
  expirySource?: DateOrigin;
  /** Use-by (safety) or best-before (quality), when known. */
  expiryKind?: DateKind | null;
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

// dd/mm — the household convention in the product's home market. The card
// used to print ISO ("PURCHASED 2026-08-06") in an India-first product. A
// bare date is read as that day here, not as midnight UTC.
const formatDayMonth = (iso: string) =>
  parsePurchaseDate(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export function PantryCard({ name, daysLeft, daysPastEstimate = 0, risk, purchaseDate, healthScore, dietMatch = true, dietLabel, itemDiet = "veg", dietUnverified = false, riskLabel, shelfLifeCitation, shelfLifeConfidence, storageDisclaimer, ifStoredDifferently, currentStorage, trackingTags, profileWarnings, expirySource = null, expiryKind = null, detectedAllergens, healthierAlternative, actions }: PantryCardProps) {
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
  const isPast = daysPastEstimate > 0;
  const isDueToday = !isPast && daysLeft <= 0;
  // A best-before date is about quality, not safety (FSSAI's definitions), so
  // a pack past it reads as "check it", in amber, rather than as a danger.
  const tone: RiskLevel = isPast && expiryKind === "best_before" ? "medium" : risk;
  const config = riskConfig[tone];
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

  // Relative to today on purpose: daysLeft is already "days remaining as of
  // this render". This card is only ever rendered on the client, after auth,
  // so there is no server snapshot for it to disagree with.
  const expiryLabel = formatDayMonth(dueDateFromToday(daysLeft, daysPastEstimate));

  const chipTone =
    tone === "high"
      ? "bg-danger/15 text-danger-strong"
      : tone === "medium"
        ? "bg-warning/15 text-warning-strong"
        : "bg-safe/15 text-safe-strong";
  const hasDetails = !!shelfLifeCitation || !!ifStoredDifferently || !!storageDisclaimer || !!healthierAlternative;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      whileHover={{ y: -4 }}
      className="neu-pressable group relative p-4 sm:p-5 rounded-2xl"
    >
      {/* The reading leads. The day count is the one number this product
          exists to produce, so it sits at the card's top right at full
          display size, coloured by its band; the name and dates read beside
          it. Everything about where the number came from is one tap away
          below, instead of a tall nested panel on every card — on a phone a
          pantry of seven items used to be a dozen screens of grey. */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center text-foreground/70 shrink-0" aria-hidden>
          <ItemIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          {/* Two lines of the full column fit any real product name; one
              line beside the badges cut "Whole Wheat Bread" to "Whole ...". */}
          <h3 title={name} className="font-bold text-[15px] sm:text-base text-foreground tracking-tight leading-snug line-clamp-2 wrap-break-word">
            {name}
          </h3>
          {/* The date itself, named for what it is: "Use by" only for a
              use-by, "Best before" for a best-before, and our own estimate
              says it is one. Every card used to say "Use by", a safety
              claim, even for a guess. */}
          <p className="mt-0.5 text-[11px] text-foreground/60 font-medium">
            {dueLine({ kind: expiryKind, origin: expirySource, date: expiryLabel, daysLeft, daysPast: daysPastEstimate })}
            <span className="text-foreground/40"> · bought {formatDayMonth(purchaseDate)}</span>
          </p>
        </div>
        {/* Days left, "Today" on the date itself, or days past it — a pack a
            day over and a month over used to read the same "0 days left". */}
        <div className="text-right shrink-0 -mt-1">
          <p className={`${config.color} font-extrabold ${isDueToday ? "text-3xl" : "text-4xl"} leading-none tracking-tight tabular-nums`}>
            {isPast ? daysPastEstimate : isDueToday ? "Today" : daysLeft}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest font-semibold text-foreground/55">
            {isPast ? (daysPastEstimate === 1 ? "day past" : "days past") : isDueToday ? "last day" : daysLeft === 1 ? "day left" : "days left"}
          </p>
        </div>
      </div>

      {/* Same thresholds as the chip, so bar and words can never disagree. */}
      <div className="mt-3 h-2 w-full rounded-full bg-foreground/10 overflow-hidden" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-500 ${freshnessWidthClass} ${config.bar}`} />
      </div>

      {isPast && (
        // Says what we know — the date has passed — not what we don't:
        // whether the food is actually off. Only the person holding it can
        // tell, and telling them it has spoiled bins food that is still good.
        // Not shown on the day itself, which is still within the date.
        <p className={`mt-3 text-[11px] leading-relaxed font-semibold ${tone === "medium" ? "text-warning-strong" : "text-danger"}`}>
          {pastDateMessage(expiryKind, !!expirySource) ?? `Our estimate for ${name} has run out. Look at it and smell it before you use it.`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${chipTone}`}>
          {riskLabel ?? config.label}
        </span>
        {/* Tone comes from lib/colour-semantics. A "Non-Veg" chip rendered
            green with a tick, which collides with the mandated Indian
            vegetarian mark. */}
        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${dietChipClasses(itemDiet, !dietMatch)}`}>
          <VegMark diet={itemDiet} unverified={dietUnverified} size={11} />
          {dietLabel ?? (dietMatch ? "Matches Diet" : "Diet Warning")}
        </span>
        {/* Allergen state stays on the face of the card: "unknown" must be
            as visible as "safe" would have been. */}
        {detectedAllergens == null ? (
          <span
            title="No ingredient data was available for this item, so allergen content couldn't be checked"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-foreground/8 text-foreground/70"
          >
            <Info size={11} />
            Allergens Unknown
          </span>
        ) : detectedAllergens.length > 0 ? (
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-warning/15 text-warning-strong">
            <ShieldAlert size={11} />
            Contains {detectedAllergens.map((tag) => ALLERGEN_LABELS[tag]).join(", ")}
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-foreground/8 text-foreground/70">
            <ShieldCheck size={11} />
            No Common Allergens
          </span>
        )}
        <span
          title={hasScore ? `NutriTrust score ${score.toFixed(1)} out of 5` : "Not scanned — no NutriTrust score"}
          className={`px-2 py-1 rounded-lg text-[10px] font-bold tabular-nums ${scoreTone}`}
        >
          {hasScore ? `Score ${score.toFixed(1)}` : "Not scanned"}
        </span>
        {profileWarnings?.map((w) => (
          <span key={w} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-danger/15 text-danger-strong">
            <ShieldAlert size={11} />
            {w}
          </span>
        ))}
        {trackingTags?.map((tag) => (
          <span key={tag} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-foreground/6 text-foreground/70">
            {tag}
          </span>
        ))}
      </div>

      {hasDetails && (
        <details className="group/details mt-2">
          <summary className="min-h-11 flex items-center justify-between gap-2 cursor-pointer list-none text-[11px] font-semibold text-foreground/60 hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span>
              Where this number comes from
              {shelfLifeConfidence === "low" && <span className="ml-1.5 font-normal text-foreground/45">· rough guess</span>}
            </span>
            <ChevronDown size={14} className="transition-transform group-open/details:rotate-180" />
          </summary>
          <div className="rounded-xl neu-inset p-3 space-y-2">
            {/* "Sourced" and "Rough guess" must not look alike. Low confidence
                gets a dashed underline rather than a colour — the same "guess,
                not a label" convention VegMark uses for an unverified diet. */}
            {shelfLifeCitation && (
              <p
                className={`text-[11px] leading-relaxed text-foreground/65 ${
                  shelfLifeConfidence === "low" ? "underline decoration-dashed decoration-foreground/30 underline-offset-2" : ""
                }`}
              >
                {shelfLifeCitation}
              </p>
            )}
            {ifStoredDifferently && <StoragePanel data={ifStoredDifferently} currentStorage={currentStorage} />}
            {!ifStoredDifferently && storageDisclaimer && (
              <p className="text-[10px] leading-relaxed text-foreground/45">{storageDisclaimer}</p>
            )}
            {healthierAlternative && (
              <p className="pt-2 border-t border-border/50 text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
                <Leaf size={12} className="text-foreground/50" /> Better alternative
                <ArrowRight size={10} className="opacity-50" /> <span className="text-foreground">{healthierAlternative}</span>
              </p>
            )}
          </div>
        </details>
      )}

      {actions && <div className={`${hasDetails ? "mt-2" : "mt-4"} pt-3 border-t border-border/60`}>{actions}</div>}
    </motion.div>
  );
}
