import { STORAGE_DISCLAIMER } from "@/lib/temperature";

export interface IfStoredDifferently {
  fridge: number | null;
  counter: number;
  freezer: number | null;
  suppressedReason?: string;
}

interface StorageOptionProps {
  label: string;
  days: number | null;
  isCurrent?: boolean;
}

function formatDays(days: number): string {
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `~${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const rounded = Math.round(days);
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

function StorageOption({ label, days, isCurrent }: StorageOptionProps) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 ${
        isCurrent ? "bg-foreground/8" : ""
      }`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide text-foreground/50">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${days === null ? "text-foreground/30" : "text-foreground/80"}`}>
        {days === null ? "—" : formatDays(days)}
      </span>
    </div>
  );
}

/**
 * "If stored differently" — the engine has produced this figure for every
 * item since the shelf-life hardening pass, and until now it rendered
 * nowhere. One shared component so the pantry card and the scan-result sheet
 * can't drift the way the provenance string once did.
 *
 * `null` on fridge or freezer is not missing data — it is the engine
 * declining to answer, either because the item suffers chilling injury with
 * no sourced threshold, its failure mode isn't temperature-modelled (bread),
 * or the conversion would extrapolate too far outside the model's fitted
 * range (a generic Q10 fallback stretched across 22 °C, which is how a
 * potato came out at 314 days before this guard existed). `suppressedReason`
 * names why, and is shown rather than swallowed.
 */
export function StoragePanel({
  data,
  currentStorage,
}: {
  data: IfStoredDifferently;
  currentStorage?: "fridge" | "counter" | "freezer";
}) {
  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-foreground/40 mb-1">
        If stored differently
      </p>
      <div className="flex items-stretch justify-between gap-1">
        <StorageOption label="Fridge" days={data.fridge} isCurrent={currentStorage === "fridge"} />
        <StorageOption label="Shelf" days={data.counter} isCurrent={currentStorage === "counter"} />
        <StorageOption label="Freezer" days={data.freezer} isCurrent={currentStorage === "freezer"} />
      </div>
      {data.suppressedReason && (
        <p className="text-[10px] leading-relaxed text-foreground/45 mt-1">
          {/* "—" above is not silence: this line is why. */}
          Fridge/freezer guidance withheld: {data.suppressedReason}.
        </p>
      )}
      <p className="text-[10px] leading-relaxed text-foreground/40 mt-1">{STORAGE_DISCLAIMER}</p>
    </div>
  );
}
