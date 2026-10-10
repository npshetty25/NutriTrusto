// Phase 1 verification against a local production build (`next start`).
//
//   node verify-phase1.mjs dialogs   mobile-emulated camera capture + overlay tap targets
//   node verify-phase1.mjs pwa       installability, manifest, icons, service worker,
//                                    then STOPS the server and checks the offline page
//
// Supabase, Open Food Facts and /api/analyze-food are mocked at the network
// layer; nothing reaches a real service. The offline check uses a genuinely
// stopped server rather than emulation, because service-worker fetches are
// not reliably covered by Playwright's setOffline.
import { chromium, devices } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2];
const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = process.env.OUT_DIR;
const REF = "ileghmcyotmlahlmyszj";
fs.mkdirSync(OUT, { recursive: true });
const TAG = process.env.TAG || "after";
const save = (name, obj) => fs.writeFileSync(path.join(OUT, name.replace(/.json$/, `-${TAG}.json`)), JSON.stringify(obj, null, 2));

// ───────────── mocks (same shapes the app reads) ─────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 31536000;
const USER = {
  id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated",
  email: "audit@example.test", app_metadata: {}, user_metadata: { full_name: "Audit User", dietary_preference: "vegetarian" },
  created_at: new Date().toISOString(),
};
const SESSION = {
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, role: "authenticated", exp })}.sig`,
  refresh_token: "audit-refresh", token_type: "bearer", expires_in: 31536000, expires_at: exp, user: USER,
};
const today = new Date().toISOString().slice(0, 10);
const ITEMS = [["Full Cream Milk 500ml", 1], ["Whole Wheat Bread", 2], ["Paneer 200g", 3], ["Fresh Spinach", 4]].map(([name, d], i) => ({
  id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`, user_id: USER.id, name, days_left: d,
  risk: d <= 2 ? "high" : "medium", purchase_date: today, created_at: new Date().toISOString(),
  household_id: null, ingredients_text: null, health_score: null,
}));
const ANALYSIS = {
  is_food: true, health_score: "3.1", health_grade_text: "Fair", processing_level: "Processed",
  data_accuracy_warning: "⚠️ This product's nutrition data isn't in our database yet. Score is estimated from ingredients only.",
  macronutrients: { total_sugars_g: "N/A", sodium_mg: "N/A", saturated_fat_g: "N/A", fibre_g: "N/A", protein_g: "N/A" },
  concerns: ["High in saturated fat"], positives: ["Contains no artificial colours"],
  alternatives: [{ name: "Keep this as occasional choice", score: "4.0" }],
};
const OFF_PRODUCT = {
  status: 1,
  product: {
    product_name: "Salted Butter", brands: "Audit Dairy", quantity: "100 g",
    ingredients_text: "Pasteurised cream, salt", categories: "Dairy, Butter", nutriscore_grade: "d",
    nutriments: { "saturated-fat_100g": 50 },
  },
};

async function authedContext(browser, opts) {
  const ctx = await browser.newContext(opts);
  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  await ctx.route(/supabase\.co/, (route) => {
    const url = route.request().url();
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.includes("/auth/v1/user")) return json(route, USER);
    if (url.includes("/rest/v1/pantry_items") && /select=\*/.test(url)) return json(route, ITEMS);
    if (url.includes("/rest/v1/")) return json(route, []);
    return json(route, {});
  });
  await ctx.route(/world\.openfoodfacts\.org/, (route) => json(route, OFF_PRODUCT));
  await ctx.route("**/api/analyze-food", (route) => json(route, ANALYSIS));
  await ctx.addInitScript(([key, session]) => { try { localStorage.setItem(key, JSON.stringify(session)); } catch {} }, [`sb-${REF}-auth-token`, SESSION]);
  return ctx;
}

// Counts interactive elements that are actually on top at their own centre
// point (so controls hidden under a backdrop are not counted) and are < 44px.
const measureTop = () => {
  const out = { total: 0, small: [] };
  const sel = 'a[href], button, input:not([type=hidden]):not([type=file]), select, textarea, [role=button]';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
    const cy = r.top + r.height / 2;
    if (cy < 0 || cy > innerHeight) continue;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) continue;
    out.total++;
    if (r.width < 43.5 || r.height < 43.5) {
      out.small.push({
        tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height),
        label: (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
      });
    }
  }
  out.under44 = out.small.length;
  out.inputsUnder16px = [...document.querySelectorAll("input:not([type=hidden]):not([type=file]), textarea, select")]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== "none"; })
    .map((e) => ({ label: (e.getAttribute("placeholder") || e.getAttribute("aria-label") || e.type || "").slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) }))
    .filter((x) => x.px < 16);
  out.hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  return out;
};

// ───────────── modes ─────────────
if (mode === "pwa") {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  const result = {};

  await page.goto(BASE + "/login", { waitUntil: "load" });
  result.swRegistration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, state: reg.active && reg.active.state, script: reg.active && reg.active.scriptURL };
  });
  await page.reload({ waitUntil: "load" });
  result.controlledAfterReload = await page.evaluate(() => !!navigator.serviceWorker.controller);

  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Page.enable");
  const inst = await cdp.send("Page.getInstallabilityErrors");
  const man = await cdp.send("Page.getAppManifest");
  result.installabilityErrors = inst.installabilityErrors;
  result.manifestErrors = man.errors;
  result.head = await page.evaluate(() => ({
    manifestLink: document.querySelector('link[rel="manifest"]')?.getAttribute("href") || null,
    appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") || null,
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") || null,
    appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]')?.getAttribute("content") || null,
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") || null,
  }));
  const manifest = JSON.parse(man.data || "{}");
  result.manifest = { id: manifest.id, name: manifest.name, start_url: manifest.start_url, scope: manifest.scope, display: manifest.display, background_color: manifest.background_color, theme_color: manifest.theme_color };
  result.icons = [];
  for (const ic of manifest.icons || []) {
    const info = await page.evaluate(async (src) => {
      const r = await fetch(src);
      const blob = await r.blob();
      let dims = null;
      try { const bmp = await createImageBitmap(blob); dims = `${bmp.width}x${bmp.height}`; } catch {}
      return { status: r.status, type: r.headers.get("content-type"), bytes: blob.size, dims };
    }, ic.src);
    result.icons.push({ src: ic.src, declared: ic.sizes, purpose: ic.purpose || "any", ...info });
  }
  // The worker precaches the offline page on install; confirm it is really there.
  result.offlinePageCached = await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const k of keys) { if (await (await caches.open(k)).match("/offline.html")) return k; }
    return null;
  });

  // ── Stop the real server, then navigate. This is a genuine network failure.
  // Find the server by its command line: port-based lookups have returned
  // nothing on this machine even while the port was bound.
  const found = execSync(
    `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match 'next.dist.bin.next' -and $_.CommandLine -match 'start' } | Select-Object -ExpandProperty ProcessId) -join ','"`
  ).toString().trim();
  result.stoppedServerPids = found;
  if (!found) throw new Error("could not find the server process; refusing to report an offline result");
  for (const pid of found.split(",").filter(Boolean)) execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
  // Prove it is really down before trusting anything that follows.
  let stillUp = true;
  try { await fetch(BASE + "/login", { signal: AbortSignal.timeout(2000) }); } catch { stillUp = false; }
  result.serverReallyDown = !stillUp;
  if (stillUp) throw new Error("server still answering; offline result would be meaningless");
  await new Promise((r) => setTimeout(r, 1500));

  const probe = async (url) => {
    try {
      const resp = await page.goto(BASE + url, { waitUntil: "load", timeout: 15000 });
      return {
        url, status: resp && resp.status(),
        fromServiceWorker: resp ? resp.fromServiceWorker() : null,
        title: await page.title(),
        h1: await page.locator("h1").first().innerText(),
        tryAgainButton: (await page.getByRole("button", { name: "Try again" }).count()) === 1,
      };
    } catch (e) { return { url, error: String(e).slice(0, 200) }; }
  };
  result.offline = [await probe("/login"), await probe("/recipes"), await probe("/privacy")];
  await page.screenshot({ path: path.join(OUT, "offline-375x812-after.png") });

  save("pwa-check.json", result);
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

if (mode === "dialogs") {
  const browser = await chromium.launch();
  const ctx = await authedContext(browser, { ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  const report = { device: "Pixel 7 (Chromium emulation)", viewport: devices["Pixel 7"].viewport, steps: [] };
  const step = (name, data) => { report.steps.push({ step: name, ...data }); console.log(name, "=>", JSON.stringify(data)); };
  const chooserAttrs = async (clickFn) => {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), clickFn()]);
    const el = chooser.element();
    return { capture: await el.getAttribute("capture"), accept: await el.getAttribute("accept"), label: (await el.getAttribute("aria-label")) || (await el.getAttribute("title")) };
  };
  const summary = (m) => ({ interactive: m.total, under44: m.under44, small: m.small, inputsUnder16px: m.inputsUnder16px, hScroll: m.hScroll });

  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.getByText("Full Cream Milk 500ml").first().waitFor({ timeout: 15000 });
  step("dashboard closed", summary(await page.evaluate(measureTop)));

  // Receipt flow
  await page.getByRole("button", { name: /^Receipt$/ }).click();
  await page.getByText("Take Photo").waitFor();
  step("receipt menu open", summary(await page.evaluate(measureTop)));
  step("receipt > Take Photo", await chooserAttrs(() => page.getByText("Take Photo").click()));
  step("receipt > Choose from Gallery (control)", await chooserAttrs(() => page.getByText("Choose from Gallery").click()));

  // Barcode > manual entry > scan result dialog
  const openAndSubmitBarcode = async () => {
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").waitFor();
  };
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.getByText("Full Cream Milk 500ml").first().waitFor({ timeout: 15000 });
  await openAndSubmitBarcode();
  step("barcode scanner open", summary(await page.evaluate(measureTop)));
  await page.getByPlaceholder("e.g., 8901234567890").fill("8901234567890");
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await page.getByRole("dialog").waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  step("scan result dialog open", summary(await page.evaluate(measureTop)));

  // Expiry-date scanner, opened from the dialog
  await page.getByRole("button", { name: /Scan date/ }).click();
  await page.getByText("Tips for best results").waitFor();
  step("expiry scanner open", summary(await page.evaluate(measureTop)));
  step("expiry scanner > Camera", await chooserAttrs(() => page.getByRole("button", { name: /^Camera$/ }).click()));
  step("expiry scanner > Gallery (control)", await chooserAttrs(() => page.getByRole("button", { name: /^Gallery$/ }).click()));

  // Nutrition-label scanner: fresh load so the previous modal is gone.
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.getByText("Full Cream Milk 500ml").first().waitFor({ timeout: 15000 });
  await openAndSubmitBarcode();
  await page.getByPlaceholder("e.g., 8901234567890").fill("8901234567890");
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await page.getByRole("dialog").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Scan the nutrition label/ }).click();
  await page.getByText("Scan Nutrition Label").waitFor();
  step("label scanner open", summary(await page.evaluate(measureTop)));
  step("label scanner > Camera", await chooserAttrs(() => page.getByRole("button", { name: /^Camera$/ }).click()));
  step("label scanner > Gallery (control)", await chooserAttrs(() => page.getByRole("button", { name: /^Gallery$/ }).click()));

  save("dialogs-check.json", report);
  await browser.close();
}

if (mode === "overlays") {
  const browser = await chromium.launch();
  const ctx = await authedContext(browser, { ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  const report = { device: "Pixel 7 (Chromium emulation)", overlays: [] };
  const fresh = async () => {
    await page.goto(BASE + "/", { waitUntil: "load" });
    await page.getByText("Full Cream Milk 500ml").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
  };
  const profile = () => page.locator('button[aria-haspopup="menu"]');
  const cases = [
    ["profile menu", async () => { await page.waitForTimeout(800); await profile().click(); await page.locator("[role=menu]").first().waitFor({ timeout: 8000 }); }],
    ["notifications panel", async () => { await page.getByRole("button", { name: "Open notifications" }).click(); await page.waitForTimeout(500); }],
    ["Ask AI chat", async () => { await page.getByRole("button", { name: /Ask AI/ }).first().click(); await page.waitForTimeout(500); }],
    ["edit item dialog", async () => { const b = page.getByRole("button", { name: /^Edit / }).first(); await b.evaluate((el) => el.scrollIntoView({ block: "center" })); await b.click(); await page.getByRole("dialog").waitFor({ timeout: 8000 }); }],
    ["household settings", async () => { await profile().click(); await page.getByRole("menuitem", { name: /Household Settings/ }).click(); await page.waitForTimeout(600); }],
    ["shopping list", async () => { await profile().click(); await page.getByRole("menuitem", { name: /Shopping List/ }).click(); await page.waitForTimeout(600); }],
    ["scan history", async () => { await profile().click(); await page.getByRole("menuitem", { name: /Scan History/ }).click(); await page.waitForTimeout(600); }],
    ["impact dashboard", async () => { await profile().click(); await page.getByRole("menuitem", { name: /Impact Dashboard/ }).click(); await page.waitForTimeout(800); }],
  ];
  for (const [name, open] of cases) {
    if (process.env.ONLY && !name.includes(process.env.ONLY)) continue;
    try {
      await fresh();
      await open();
      const m = await page.evaluate(measureTop);
      const row = { overlay: name, interactive: m.total, under44: m.under44, small: m.small, inputsUnder16px: m.inputsUnder16px.filter((x) => x.label !== "Search your pantry…"), hScroll: m.hScroll };
      report.overlays.push(row);
      console.log(name.padEnd(22), "interactive", m.total, "under44", m.under44, JSON.stringify(m.small.map((s) => `${s.label} ${s.w}x${s.h}`)));
    } catch (e) {
      report.overlays.push({ overlay: name, error: String(e).split("\n")[0].slice(0, 160) });
      console.log(name.padEnd(22), "ERROR", String(e).split("\n")[0].slice(0, 160));
    }
  }
  save("overlays-check.json", report);
  await browser.close();
}
