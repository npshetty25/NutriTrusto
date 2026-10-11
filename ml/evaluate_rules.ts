/**
 * Scores the app's existing keyword inferrer (src/lib/item-category.ts) on the
 * SAME held-out names the model was tested on, so the two are comparable.
 *
 *   npx vite-node -c vitest.config.ts ml/evaluate_rules.ts
 *
 * Writes ml/artifacts/rule_predictions.json; ml/compare.py turns it into
 * metrics. `unknown` is the inferrer's "no keyword matched" answer; it is
 * counted as wrong, which is what a user would experience.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inferItemCategory } from "../src/lib/item-category";

const rows = JSON.parse(readFileSync("ml/artifacts/test_set.json", "utf8")) as Array<{ name: string; label: string }>;
const out = rows.map((r) => ({ ...r, predicted: inferItemCategory(r.name) }));
writeFileSync("ml/artifacts/rule_predictions.json", JSON.stringify(out, null, 1));
const unknown = out.filter((r) => r.predicted === "unknown").length;
console.log(`scored ${out.length} names; ${unknown} fell through to "unknown"`);
