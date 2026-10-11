import type { BrowserContext, Page, Route } from "@playwright/test";

/**
 * An in-memory stand-in for the three things the browser talks to:
 *
 *   - Supabase Auth and PostgREST (tables, filters, RPCs)
 *   - Open Food Facts
 *   - this app's own /api/* routes, which in turn need Gemini
 *
 * It is stateful on purpose: a row added in one step is returned by the next
 * GET, so "add an item, reload, still there" is a real assertion.
 *
 * What it is NOT: a model of row-level security or of PostgREST's full query
 * language. It implements the verbs and filters this app actually uses
 * (eq, in, is, neq; order; limit; embedded household select; single-object
 * responses). RLS is tested separately, against a real Postgres, in
 * db/rls.test.ts.
 */

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "https://e2e.supabase.test";
export const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
export const SESSION_KEY = `sb-${PROJECT_REF}-auth-token`;

type Row = Record<string, unknown>;
export type RecordedRequest = { method: string; path: string; query: string; body: unknown };

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uuid = () => crypto.randomUUID();

export const TEST_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "asha@example.test",
  app_metadata: {},
  user_metadata: { full_name: "Asha Rao", dietary_preference: "vegetarian" },
  created_at: "2026-01-01T00:00:00.000Z",
};

export function sessionFor(user = TEST_USER) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  return {
    access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, role: "authenticated", exp })}.sig`,
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: exp,
    user,
  };
}

export const OFF_BUTTER = {
  status: 1,
  product: {
    product_name: "Salted Butter",
    brands: "Amul",
    quantity: "100 g",
    ingredients_text: "Pasteurised cream, salt",
    categories: "Dairy, Butter",
    nutriscore_grade: "d",
    nutriments: { "saturated-fat_100g": 50, sugars_100g: 0.5, sodium_100g: 0.8 },
  },
};

export const ANALYSIS_OK = {
  is_food: true,
  health_score: "3.1",
  health_grade_text: "Fair",
  processing_level: "Minimally Processed",
  data_accuracy_warning: "Score computed from verified nutrition label data.",
  macronutrients: { total_sugars_g: "0.5 g", sodium_mg: "315 mg", saturated_fat_g: "50.0 g", fibre_g: "N/A", protein_g: "N/A" },
  concerns: [{ title: "High saturated fat", level: "High Risk", details: "50.0 g saturated fat per 100g." }],
  positives: [{ title: "Lower sugar", level: "Positive", details: "0.5 g sugar per 100g." }],
  alternatives: [],
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-expose-headers": "*",
};

export class FakeBackend {
  tables: Record<string, Row[]> = {
    pantry_items: [],
    shopping_list_items: [],
    scan_history: [],
    item_outcomes: [],
    households: [],
    household_members: [],
  };
  requests: RecordedRequest[] = [];
  user = TEST_USER;
  /** Emails that fail password sign-in, mapped to the message Supabase would send. */
  rejectedLogins = new Map<string, string>([["wrong@example.test", "Invalid login credentials"]]);
  off: unknown = OFF_BUTTER;
  api: Record<string, { status?: number; body: unknown }> = {
    "analyze-food": { body: ANALYSIS_OK },
    categorize: {
      body: {
        success: true,
        source: "model",
        modelVersion: "category-v1",
        predictions: [{ name: "Amul Salted Butter 100 g", category: "dairy", confidence: 0.91 }],
      },
    },
  };

  seedPantry(rows: Array<{ name: string; days_left: number; purchase_date?: string }>) {
    for (const r of rows) {
      this.tables.pantry_items.push({
        id: uuid(),
        user_id: this.user.id,
        risk: r.days_left <= 2 ? "high" : r.days_left <= 7 ? "medium" : "low",
        purchase_date: r.purchase_date ?? new Date().toISOString(),
        created_at: new Date().toISOString(),
        household_id: null,
        ingredients_text: null,
        health_score: null,
        ...r,
      });
    }
  }

  seedShopping(names: string[]) {
    names.forEach((name, i) =>
      this.tables.shopping_list_items.push({
        id: uuid(),
        user_id: this.user.id,
        name,
        source_recipe: null,
        checked: false,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
      })
    );
  }

  /** Requests to a table/verb, for asserting what the UI actually sent. */
  sent(method: string, table: string) {
    return this.requests.filter((r) => r.method === method && r.path === `/rest/v1/${table}`);
  }

  async install(context: BrowserContext, { signedIn = false }: { signedIn?: boolean } = {}) {
    if (signedIn) {
      await context.addInitScript(
        ([key, session]) => {
          try {
            localStorage.setItem(key as string, JSON.stringify(session));
          } catch {
            /* storage unavailable */
          }
        },
        [SESSION_KEY, sessionFor(this.user)] as const
      );
    }

    await context.route(/\.supabase\.test\//, (route) => this.handleSupabase(route));
    await context.route(/openfoodfacts\.(org|net)\//, (route) => this.json(route, this.off));
    await context.route(/\/api\/[a-z-]+(\?.*)?$/, (route) => this.handleApi(route));
  }

  /** The realtime socket is accepted and left silent; polling-free, no errors. */
  async quietRealtime(page: Page) {
    await page.routeWebSocket(/realtime/, () => {
      /* hold the connection open and say nothing */
    });
  }

  // ───────────────────────── handlers ─────────────────────────

  private json(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
    return route.fulfill({
      status,
      contentType: "application/json",
      headers: { ...CORS, ...headers },
      body: JSON.stringify(body),
    });
  }

  private async handleApi(route: Route) {
    const url = new URL(route.request().url());
    // Only this app's own routes; the app's origin is the page's, not supabase.
    if (url.hostname !== "localhost") return route.fallback();
    const name = url.pathname.replace(/^\/api\//, "");
    this.requests.push({
      method: route.request().method(),
      path: url.pathname,
      query: url.search,
      body: route.request().postData() ?? null,
    });
    const canned = this.api[name];
    if (!canned) return this.json(route, { error: `no fake for /api/${name}` }, 501);
    return this.json(route, canned.body, canned.status ?? 200);
  }

  private async handleSupabase(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    let body: unknown = null;
    const raw = req.postData();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    this.requests.push({ method, path: url.pathname, query: url.search, body });

    if (url.pathname.startsWith("/auth/v1/")) return this.handleAuth(route, url, method, body);
    if (url.pathname.startsWith("/rest/v1/rpc/")) return this.handleRpc(route, url.pathname.split("/").pop()!, body);
    if (url.pathname.startsWith("/rest/v1/")) return this.handleTable(route, url, method, body);
    return this.json(route, {});
  }

  private handleAuth(route: Route, url: URL, method: string, body: unknown) {
    const path = url.pathname.replace("/auth/v1", "");
    if (path === "/token") {
      const { email } = (body ?? {}) as { email?: string };
      const rejection = email ? this.rejectedLogins.get(email) : undefined;
      if (rejection) {
        return this.json(route, { code: 400, error_code: "invalid_credentials", msg: rejection }, 400);
      }
      return this.json(route, sessionFor(this.user));
    }
    if (path === "/user" && method === "GET") return this.json(route, this.user);
    if (path === "/logout") return route.fulfill({ status: 204, headers: CORS });
    if (path === "/signup") {
      const { email, data } = (body ?? {}) as { email?: string; data?: Record<string, unknown> };
      // Email confirmation required: a user, and no session.
      return this.json(route, { id: uuid(), email, user_metadata: data ?? {}, aud: "authenticated", role: "" });
    }
    return this.json(route, {});
  }

  private handleRpc(route: Route, fn: string, body: unknown) {
    const args = (body ?? {}) as Record<string, string>;
    if (fn === "create_household") {
      const household = {
        id: uuid(),
        name: args.new_name || "My Household",
        invite_code: Math.random().toString(16).slice(2, 14).padEnd(12, "0"),
        created_by: this.user.id,
        created_at: new Date().toISOString(),
      };
      this.tables.households.push(household);
      this.tables.household_members.push({
        household_id: household.id,
        user_id: this.user.id,
        joined_at: new Date().toISOString(),
      });
      return this.json(route, [{ id: household.id, name: household.name, invite_code: household.invite_code }]);
    }
    if (fn === "join_household_by_code") {
      const target = this.tables.households.find((h) => h.invite_code === args.code);
      if (!target) {
        return this.json(route, { code: "P0001", message: "Invalid invite code", details: null, hint: null }, 400);
      }
      this.tables.household_members.push({ household_id: target.id, user_id: this.user.id, joined_at: new Date().toISOString() });
      return this.json(route, target.id);
    }
    if (fn === "household_impact_leaderboard") return this.json(route, []);
    return this.json(route, null);
  }

  private handleTable(route: Route, url: URL, method: string, body: unknown) {
    const table = url.pathname.replace("/rest/v1/", "");
    const rows = (this.tables[table] ??= []);
    const wantsObject = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const wantsRepresentation = (route.request().headers()["prefer"] ?? "").includes("return=representation");

    const matches = (row: Row) => {
      for (const [col, spec] of url.searchParams) {
        if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(col)) continue;
        const dot = spec.indexOf(".");
        const op = spec.slice(0, dot);
        const val = spec.slice(dot + 1);
        const cell = row[col];
        if (op === "eq" && String(cell) !== val) return false;
        if (op === "neq" && String(cell) === val) return false;
        if (op === "is" && String(cell ?? "null") !== val) return false;
        if (op === "in") {
          const list = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""));
          if (!list.includes(String(cell))) return false;
        }
      }
      return true;
    };

    const shape = (list: Row[]) => {
      const select = url.searchParams.get("select") ?? "*";
      let out = list;
      if (table === "household_members" && select.includes("households(")) {
        out = list.map((m) => ({ ...m, households: this.tables.households.find((h) => h.id === m.household_id) ?? null }));
      }
      return out;
    };

    const respond = (list: Row[], status = 200) => {
      if (wantsObject) {
        if (list.length !== 1) {
          return this.json(route, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: null, hint: null }, 406);
        }
        return this.json(route, list[0], status);
      }
      return this.json(route, list, status);
    };

    if (method === "GET") {
      let result = rows.filter(matches);
      const orders = url.searchParams.getAll("order");
      if (orders.length) {
        result = [...result].sort((a, b) => {
          for (const o of orders) {
            const [col, dir = "asc"] = o.split(".");
            const av = a[col] as string | number | boolean | null;
            const bv = b[col] as string | number | boolean | null;
            if (av === bv) continue;
            const cmp = (av ?? "") < (bv ?? "") ? -1 : 1;
            return dir === "desc" ? -cmp : cmp;
          }
          return 0;
        });
      }
      const limit = Number(url.searchParams.get("limit"));
      if (Number.isFinite(limit) && limit > 0) result = result.slice(0, limit);
      return respond(shape(result));
    }

    if (method === "POST") {
      const incoming = (Array.isArray(body) ? body : [body]) as Row[];
      const created = incoming.map((r) => ({
        id: uuid(),
        created_at: new Date().toISOString(),
        ...(table === "shopping_list_items" ? { checked: false, source_recipe: null } : {}),
        ...(table === "pantry_items" ? { household_id: null, ingredients_text: null, health_score: null } : {}),
        ...r,
      }));
      rows.push(...created);
      if (wantsRepresentation) return respond(created, 201);
      return route.fulfill({ status: 201, headers: CORS });
    }

    if (method === "PATCH") {
      const touched = rows.filter(matches);
      for (const r of touched) Object.assign(r, body as Row);
      if (wantsRepresentation) return respond(touched);
      return route.fulfill({ status: 204, headers: CORS });
    }

    if (method === "DELETE") {
      const doomed = new Set(rows.filter(matches));
      this.tables[table] = rows.filter((r) => !doomed.has(r));
      return route.fulfill({ status: 204, headers: CORS });
    }

    return this.json(route, []);
  }
}
