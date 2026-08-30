/**
 * Exports every shelf-life row to CSV for the Phase 2 report appendix.
 *
 *   npx tsx scripts/export-shelf-life-csv.mts > shelf-life-table.csv
 *
 * Emits the full provenance, not just the numbers, so a reader can see which
 * figures are sourced and which are estimates. Rows with a weak anchor or an
 * extrapolation carry it in their own columns rather than being presented as
 * equivalent to the rest.
 */
import { SHELF_LIFE_ROWS, DATA_VERSION } from "../src/lib/shelf-life-data.js";
import { ASSUMED_STORAGE_C, adjustDays } from "../src/lib/temperature.js";

const csv = (v: unknown): string => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const HEADERS = [
  "id", "keys", "days_at_ref", "ref_temp_c", "assumed_storage", "assumed_temp_c",
  "days_as_shown", "tier", "model", "ea_kj_mol", "source", "confidence",
  "source_caveat", "extrapolation_warning", "chilling_sensitive",
  "chilling_injury_mode", "chilling_threshold_c", "degradation_mode",
  "data_version", "effective_date",
];

console.log(HEADERS.join(","));

for (const row of SHELF_LIFE_ROWS) {
  const targetC = ASSUMED_STORAGE_C[row.storage];
  const shown = Math.max(
    1,
    Math.floor(adjustDays(row.days, row.refTempC, targetC, { eaKJ: row.eaKJ, lookupOnly: row.lookupOnly }))
  );
  const model = row.lookupOnly ? "lookup (no model)" : row.eaKJ ? "Arrhenius" : "Q10=3";

  console.log([
    row.id,
    row.keys.join("; "),
    row.days,
    row.refTempC,
    row.storage,
    targetC,
    shown,
    row.tier,
    model,
    row.eaKJ ?? "",
    row.source,
    row.confidence,
    row.source_caveat ?? "",
    row.extrapolation_warning ?? "",
    row.chilling_sensitive ? "yes" : "no",
    row.chilling_sensitive?.injury_mode ?? "",
    row.chilling_sensitive?.min_safe_temp_c ?? "",
    row.degradation_mode ?? "",
    row.data_version,
    row.effective_date,
  ].map(csv).join(","));
}

console.error(`\n${SHELF_LIFE_ROWS.length} rows, data_version ${DATA_VERSION}`);
