// A hand-rolled spot check, NOT a mutation-testing framework: ten deliberate
// faults chosen by hand in the auth, rate-limit, upload and scoring code, each
// applied in turn, with the relevant tests run and the file restored. A
// surviving mutant means a test is missing or too weak. Run from the repo
// root: `node scripts/mutation-spot-check.mjs`.
import { execSync } from "node:child_process";
import fs from "node:fs";
const M = [
  { id: "rate-limit off-by-one", file: "src/lib/rate-limit.ts", from: "if (bucket.hits.length >= max) {", to: "if (bucket.hits.length > max) {", tests: "src/lib/rate-limit.test.ts src/app/api/extract" },
  { id: "rate-limit never expires", file: "src/lib/rate-limit.ts", from: "bucket.hits = bucket.hits.filter((t) => now - t < windowMs);", to: "bucket.hits = bucket.hits;", tests: "src/lib/rate-limit.test.ts" },
  { id: "upload: trust claimed type (skip magic bytes)", file: "src/lib/upload-validation.ts", from: "if (!match) {", to: "if (false) {", tests: "src/lib/upload-validation.test.ts src/app/api/extract" },
  { id: "upload: size limit off", file: "src/lib/upload-validation.ts", from: "if (file.size > MAX_UPLOAD_BYTES) {", to: "if (file.size > MAX_UPLOAD_BYTES * 100) {", tests: "src/lib/upload-validation.test.ts" },
  { id: "expiry: 360-day year", file: "src/app/api/scan-expiry-date/route.ts", from: "if (unit === \"years\") return Math.round(n * 365);", to: "if (unit === \"years\") return Math.round(n * 360);", tests: "src/app/api/scan-expiry-date" },
  { id: "expiry: allow negative days", file: "src/app/api/scan-expiry-date/route.ts", from: "Math.max(0, Math.min(MAX_DAYS_LEFT,", to: "Math.max(-9999, Math.min(MAX_DAYS_LEFT,", tests: "src/app/api/scan-expiry-date" },
  { id: "auth: ignore Supabase error", file: "src/lib/api-auth.ts", from: "if (error || !data?.user) return null;", to: "if (!data?.user) return null;", tests: "src/lib/api-auth.test.ts" },
  { id: "auth: fail OPEN on exception", file: "src/lib/api-auth.ts", from: "} catch {\n    return null;\n  }\n}", to: "} catch {\n    return { id: \"anonymous\" };\n  }\n}", tests: "src/lib/api-auth.test.ts" },
  { id: "analyze: drop sodium penalty", file: "src/app/api/analyze-food/route.ts", from: "score100 -= 18;", to: "score100 -= 0;", tests: "src/app/api/analyze-food" },
  { id: "extract: no 3650 clamp", file: "src/app/api/extract/route.ts", from: "Math.max(1, Math.min(3650, Math.round(raw)))", to: "Math.max(1, Math.round(raw))", tests: "src/app/api/extract" },
];
const results = [];
for (const m of M) {
  const orig = fs.readFileSync(m.file, "utf8");
  const crlf = orig.includes("\r\n");
  const from = crlf ? m.from.replace(/\n/g, "\r\n") : m.from;
  const to = crlf ? m.to.replace(/\n/g, "\r\n") : m.to;
  if (!orig.includes(from)) { results.push({ id: m.id, outcome: "SKIPPED (anchor not found)" }); continue; }
  fs.writeFileSync(m.file, orig.replace(from, to));
  let outcome;
  try { execSync(`npx vitest run ${m.tests}`, { stdio: "pipe" }); outcome = "SURVIVED  <-- tests did not notice"; }
  catch { outcome = "killed"; }
  finally { fs.writeFileSync(m.file, orig); }
  results.push({ id: m.id, outcome });
  console.log(m.id.padEnd(48), outcome);
}
const killed = results.filter((r) => r.outcome === "killed").length;
console.log(`\n${killed}/${results.length} mutants killed`);
