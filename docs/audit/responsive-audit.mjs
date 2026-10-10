// Phase 0 responsiveness audit. Runs against a locally started production build.
// Supabase is mocked at the network layer: no request ever reaches the real project.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = process.env.OUT_DIR;
const TAG = process.env.TAG || "before";
const REF = "ileghmcyotmlahlmyszj";
if (!OUT) throw new Error("OUT_DIR required");
fs.mkdirSync(OUT, { recursive: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
const fakeJwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated", exp })}.sig`;
const USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "audit@example.test",
  app_metadata: {},
  user_metadata: { full_name: "Audit User", dietary_preference: "vegetarian" },
  created_at: new Date().toISOString(),
};
const SESSION = {
  access_token: fakeJwt,
  refresh_token: "audit-refresh",
  token_type: "bearer",
  expires_in: 31536000,
  expires_at: exp,
  user: USER,
};

const today = new Date().toISOString().slice(0, 10);
const names = [
  ["Full Cream Milk 500ml", 1],
  ["Whole Wheat Bread", 2],
  ["Paneer 200g", 3],
  ["Fresh Spinach", 4],
  ["Curd 400g", 6],
  ["Basmati Rice 5kg", 300],
  ["Toor Dal 1kg", 240],
  ["Tomato Ketchup", 120],
];
const ITEMS = names.map(([name, days_left], i) => ({
  id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`,
  user_id: USER.id,
  name,
  days_left,
  risk: days_left <= 2 ? "high" : days_left <= 7 ? "medium" : "low",
  purchase_date: today,
  created_at: new Date().toISOString(),
  household_id: null,
  ingredients_text: null,
  health_score: null,
}));

async function newContext(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: viewport.width < 500 });
  await ctx.route(/supabase\.co/, async (route) => {
    const url = route.request().url();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rest/v1/pantry_items") && /select=\*/.test(url)) return json(ITEMS);
    if (url.includes("/rest/v1/")) return json([]);
    return json({});
  });
  await ctx.addInitScript(([key, session]) => {
    try { localStorage.setItem(key, JSON.stringify(session)); } catch {}
  }, [`sb-${REF}-auth-token`, SESSION]);
  return ctx;
}

const measure = () => {
  const vw = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch]';
  const small = [];
  let total = 0;
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    if (el.closest("[aria-hidden=true]")) continue;
    // File inputs here are intentionally hidden and driven by a visible button.
    if (el instanceof HTMLInputElement && el.type === "file") continue;
    total++;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      small.push({
        tag: el.tagName.toLowerCase(),
        w: Math.round(r.width),
        h: Math.round(r.height),
        label: (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
      });
    }
  }
  const overflowers = [];
  if (sw > vw) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && visible(el)) {
        overflowers.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), right: Math.round(r.right) });
        if (overflowers.length >= 8) break;
      }
    }
  }
  return { clientWidth: vw, scrollWidth: sw, hScroll: sw > vw, interactiveVisible: total, under44: small.length, smallSample: small.slice(0, 12), overflowers };
};

const PAGES = [
  { name: "login", url: "/login", authed: false },
  { name: "privacy", url: "/privacy", authed: false },
  { name: "dashboard", url: "/", authed: true },
  { name: "recipes", url: "/recipes", authed: true },
];
const VIEWPORTS = [
  { label: "375x812", width: 375, height: 812 },
  { label: "768x1024", width: 768, height: 1024 },
];

const browser = await chromium.launch();
const results = [];
for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    const ctx = p.authed ? await newContext(browser, vp) : await browser.newContext({ viewport: vp, hasTouch: true, isMobile: vp.width < 500 });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).slice(0, 160)));
    await page.goto(BASE + p.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const file = `${p.name}-${vp.label}-${TAG}.png`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: true });
    const m = await page.evaluate(measure);
    results.push({ page: p.name, viewport: vp.label, finalUrl: page.url().replace(BASE, ""), screenshot: file, ...m, consoleErrors: consoleErrors.slice(0, 5) });
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, `metrics-${TAG}.json`), JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(`${r.page.padEnd(10)} ${r.viewport.padEnd(9)} -> ${r.finalUrl.padEnd(10)} hScroll=${r.hScroll} (sw ${r.scrollWidth}/cw ${r.clientWidth})  interactive=${r.interactiveVisible} under44=${r.under44}  consoleErrors=${r.consoleErrors.length}`);
}
