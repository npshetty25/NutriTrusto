/**
 * Row-level-security tests, run against a real Postgres (PGlite — Postgres 17
 * compiled to WASM) with the project's actual migration files applied in
 * order. Nothing here is string-matching on SQL text for its verdict: the
 * policies are executed as the `authenticated` role with a JWT subject set,
 * the way PostgREST does it.
 *
 * What this stands in for: Supabase. Only the pieces the migrations lean on
 * are stubbed — the `auth` schema (users table, auth.uid()), the `anon` and
 * `authenticated` roles, and the `supabase_realtime` publication. Everything
 * else is the real file from db/.
 *
 * What it cannot prove: that the production database has these migrations
 * applied. The repo has no migration ledger; see docs/audit/PHASE0_AUDIT.md.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_DIR = resolve(__dirname);
const MIGRATIONS = [
  "supabase-schema.sql",
  "supabase-schema-additions.sql",
  "supabase-schema-hardening.sql",
  "supabase-schema-household-guard.sql",
];

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const CAROL = "00000000-0000-4000-8000-00000000000c";

const SUPABASE_STUBS = `
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  -- Supabase grants table privileges to these roles by default; RLS is what
  -- then decides which rows they can touch.
  alter default privileges in schema public grant all on tables to authenticated;
  alter default privileges in schema public grant execute on functions to authenticated;

  create publication supabase_realtime;
`;

/**
 * `extra` are additional files, relative to db/, applied after the real
 * migrations. Used to test a proposed migration without adopting it.
 */
async function freshDatabase(extra: string[] = []): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of [...MIGRATIONS, ...extra]) {
    await db.exec(readFileSync(resolve(DB_DIR, file), "utf8"));
  }
  await db.exec(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ('${ALICE}', 'alice@example.test', '{"full_name":"Alice"}'),
       ('${BOB}',   'bob@example.test',   '{"full_name":"Bob"}'),
       ('${CAROL}', 'carol@example.test', '{"full_name":"Carol"}')`
  );
  return db;
}

/** Run `fn` as an authenticated user, then drop back to the superuser. */
async function as<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const ids = (rows: Array<Record<string, unknown>>, col: string) => rows.map((r) => String(r[col])).sort();

describe("migrations", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDatabase();
  }, 60_000);
  afterAll(async () => db.close());

  it("apply cleanly, in order, to an empty database", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' order by 1`
    );
    expect(rows.map((r) => r.tablename)).toEqual([
      "household_members",
      "households",
      "item_outcomes",
      "pantry_items",
      "scan_history",
      "shopping_list_items",
    ]);
  });

  it("enable row-level security on every public table", async () => {
    const { rows } = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public'`
    );
    expect(rows.filter((r) => !r.rowsecurity)).toEqual([]);
  });

  it("give every table at least one policy", async () => {
    const { rows } = await db.query<{ tablename: string; n: number }>(
      `select t.tablename, count(p.policyname)::int as n
         from pg_tables t
         left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
        where t.schemaname = 'public'
        group by t.tablename`
    );
    expect(rows.filter((r) => r.n === 0)).toEqual([]);
  });
});

describe("42P17 — infinite recursion in a self-referencing policy", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDatabase();
    await as(db, ALICE, () => db.query(`select * from public.create_household('Alice home')`));
  }, 60_000);
  afterAll(async () => db.close());

  it("reading household_members, households and pantry_items does not recurse", async () => {
    await as(db, ALICE, async () => {
      await expect(db.query(`select * from public.household_members`)).resolves.toBeDefined();
      await expect(db.query(`select * from public.households`)).resolves.toBeDefined();
      await expect(db.query(`select * from public.pantry_items`)).resolves.toBeDefined();
    });
  });

  it("writing a pantry item that depends on household membership does not recurse", async () => {
    await as(db, ALICE, async () => {
      await expect(
        db.query(`insert into public.pantry_items (user_id, name, days_left) values ('${ALICE}', 'Milk', 3)`)
      ).resolves.toBeDefined();
    });
  });

  it("no policy on household_members references household_members in its expression", async () => {
    const { rows } = await db.query<{ policyname: string; qual: string | null; with_check: string | null }>(
      `select policyname, qual, with_check from pg_policies
        where schemaname = 'public' and tablename = 'household_members'`
    );
    expect(rows.length).toBeGreaterThan(0);
    const offenders = rows.filter((r) => /household_members/i.test(`${r.qual ?? ""} ${r.with_check ?? ""}`));
    expect(offenders).toEqual([]);
  });

  it("routes the membership lookup through a security-definer function with a pinned search_path", async () => {
    const { rows } = await db.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      `select prosecdef, proconfig from pg_proc
        where proname = 'my_household_ids' and pronamespace = 'public'::regnamespace`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(true);
    expect(rows[0].proconfig).toContain("search_path=public");
  });

  it("negative control: a naive self-referencing policy DOES raise 42P17", async () => {
    // If this ever stops raising, the guards above are no longer proving anything.
    const bad = await freshDatabase();
    try {
      await bad.exec(`
        drop policy "Members can view household membership" on public.household_members;
        create policy naive_recursive on public.household_members for select
          using (household_id in (
            select household_id from public.household_members where user_id = auth.uid()
          ));
      `);
      await as(bad, ALICE, async () => {
        await expect(bad.query(`select * from public.household_members`)).rejects.toMatchObject({ code: "42P17" });
      });
    } finally {
      await bad.close();
    }
  }, 60_000);
});

describe("household isolation", () => {
  let db: PGlite;
  let aliceHousehold: { id: string; invite_code: string };

  beforeAll(async () => {
    db = await freshDatabase();
    const created = await as(db, ALICE, () =>
      db.query<{ id: string; name: string; invite_code: string }>(`select * from public.create_household('Alice home')`)
    );
    aliceHousehold = created.rows[0];
    await as(db, ALICE, async () => {
      await db.query(
        `insert into public.pantry_items (user_id, household_id, name, days_left)
         values ('${ALICE}', '${aliceHousehold.id}', 'Shared paneer', 4)`
      );
      await db.query(`insert into public.pantry_items (user_id, name, days_left) values ('${ALICE}', 'Private ghee', 90)`);
    });
  }, 60_000);
  afterAll(async () => db.close());

  it("create_household makes the caller a member in the same call and issues a 12-character code", async () => {
    expect(aliceHousehold.invite_code).toMatch(/^[0-9a-f]{12}$/);
    const { rows } = await as(db, ALICE, () =>
      db.query<{ user_id: string }>(`select user_id from public.household_members`)
    );
    expect(ids(rows, "user_id")).toEqual([ALICE]);
  });

  it("a stranger sees no households, members or pantry items of someone else's household", async () => {
    await as(db, CAROL, async () => {
      expect((await db.query(`select * from public.households`)).rows).toHaveLength(0);
      expect((await db.query(`select * from public.household_members`)).rows).toHaveLength(0);
      expect((await db.query(`select * from public.pantry_items`)).rows).toHaveLength(0);
    });
  });

  it("an invite code cannot be looked up by browsing the households table", async () => {
    const { rows } = await as(db, CAROL, () =>
      db.query(`select id from public.households where invite_code = '${aliceHousehold.invite_code}'`)
    );
    expect(rows).toHaveLength(0);
  });

  it("joining by code grants access to shared items but never to the owner's private ones", async () => {
    const joined = await as(db, BOB, () =>
      db.query<{ join_household_by_code: string }>(`select * from public.join_household_by_code('${aliceHousehold.invite_code}')`)
    );
    expect(joined.rows[0].join_household_by_code).toBe(aliceHousehold.id);

    const { rows } = await as(db, BOB, () => db.query<{ name: string }>(`select name from public.pantry_items`));
    expect(rows.map((r) => r.name)).toEqual(["Shared paneer"]);
  });

  it("joining twice is idempotent", async () => {
    await as(db, BOB, () => db.query(`select public.join_household_by_code('${aliceHousehold.invite_code}')`));
    const { rows } = await db.query(`select * from public.household_members where user_id = '${BOB}'`);
    expect(rows).toHaveLength(1);
  });

  it("rejects an unknown invite code without revealing anything else", async () => {
    await as(db, CAROL, async () => {
      await expect(db.query(`select public.join_household_by_code('does-not-exist')`)).rejects.toThrow(
        /Invalid invite code/
      );
    });
  });

  it("cannot insert a pantry item that belongs to another user", async () => {
    await as(db, CAROL, async () => {
      await expect(
        db.query(`insert into public.pantry_items (user_id, name, days_left) values ('${ALICE}', 'Forged', 1)`)
      ).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("cannot add another user to a household", async () => {
    await as(db, CAROL, async () => {
      await expect(
        db.query(`insert into public.household_members (household_id, user_id) values ('${aliceHousehold.id}', '${BOB}')`)
      ).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("the leaderboard returns aggregates for the caller's own household only", async () => {
    await db.exec(
      `insert into public.item_outcomes (user_id, name, category, outcome, days_left_at_removal)
       values ('${ALICE}', 'Milk', 'dairy', 'used', 2), ('${BOB}', 'Bread', 'grain', 'expired', 0),
              ('${CAROL}', 'Secret', 'other', 'used', 1)`
    );
    const member = await as(db, ALICE, () =>
      db.query<{ user_id: string }>(`select user_id from public.household_impact_leaderboard()`)
    );
    expect(ids(member.rows, "user_id")).toEqual([ALICE, BOB]);

    const stranger = await as(db, CAROL, () => db.query(`select user_id from public.household_impact_leaderboard()`));
    expect(stranger.rows).toHaveLength(0);
  });

  it("deletes a household once its last member leaves", async () => {
    const solo = await as(db, CAROL, () =>
      db.query<{ id: string }>(`select * from public.create_household('Carol solo')`)
    );
    await as(db, CAROL, () => db.query(`delete from public.household_members where household_id = '${solo.rows[0].id}'`));
    const { rows } = await db.query(`select * from public.households where id = '${solo.rows[0].id}'`);
    expect(rows).toHaveLength(0);
  });
});

/**
 * supabase-schema-household-v2.sql, applied on top of the earlier
 * migrations. Run in production by the owner on 2026-10-27.
 */
describe("households v2", () => {
  let db: PGlite;
  let hid: string;
  let code: string;
  const names = async (user: string, table = "pantry_items") =>
    (await as(db, user, () => db.query<{ name: string }>(`select name from public.${table} order by name`))).rows.map((r) => r.name);

  beforeAll(async () => {
    db = await freshDatabase(["supabase-schema-household-v2.sql"]);
    const r = await as(db, ALICE, () =>
      db.query<{ id: string; invite_code: string }>(`select * from public.create_household('Rao family')`)
    );
    hid = r.rows[0].id;
    code = r.rows[0].invite_code;
    // Bob has private items from before he joins.
    await as(db, BOB, () =>
      db.query(`insert into public.pantry_items (user_id, name, days_left) values ('${BOB}', 'Bob atta', 90), ('${BOB}', 'Bob milk', 2)`)
    );
    await as(db, BOB, () => db.query(`select public.join_household_by_code('${code}')`));
  }, 60_000);
  afterAll(async () => db.close());

  it("a member's items from before they joined stay private until they share them", async () => {
    expect(await names(ALICE)).toEqual([]);
    const shared = await as(db, BOB, () =>
      db.query<{ share_my_items_with_household: number }>(`select public.share_my_items_with_household()`)
    );
    expect(shared.rows[0].share_my_items_with_household).toBe(2);
    expect(await names(ALICE)).toEqual(["Bob atta", "Bob milk"]);
  });

  it("lists members by name, never by email, and marks the creator", async () => {
    const { rows } = await as(db, BOB, () =>
      db.query<{ display_name: string; is_creator: boolean }>(`select display_name, is_creator from public.household_members_list()`)
    );
    expect(rows).toEqual([
      { display_name: "Alice", is_creator: true },
      { display_name: "Bob", is_creator: false },
    ]);
    const stranger = await as(db, CAROL, () => db.query(`select * from public.household_members_list()`));
    expect(stranger.rows).toHaveLength(0);
  });

  it("allows one household per person, but re-joining your own is harmless", async () => {
    await as(db, BOB, async () => {
      await expect(db.query(`select * from public.create_household('Second home')`)).rejects.toThrow(/already in a household/);
      await expect(db.query(`select public.join_household_by_code('${code}')`)).resolves.toBeDefined();
    });
    const other = await as(db, CAROL, () =>
      db.query<{ invite_code: string }>(`select * from public.create_household('Carol home')`)
    );
    await as(db, BOB, async () => {
      await expect(
        db.query(`select public.join_household_by_code('${other.rows[0].invite_code}')`)
      ).rejects.toThrow(/already in a household/);
    });
  });

  it("shares a shopping list within the household, and not outside it", async () => {
    await as(db, ALICE, () =>
      db.query(`insert into public.shopping_list_items (user_id, household_id, name) values ('${ALICE}', '${hid}', 'Onions')`)
    );
    expect(await names(BOB, "shopping_list_items")).toEqual(["Onions"]);
    expect(await names(CAROL, "shopping_list_items")).toEqual([]);
    await as(db, CAROL, async () => {
      await expect(
        db.query(`insert into public.shopping_list_items (user_id, household_id, name) values ('${CAROL}', '${hid}', 'Injected')`)
      ).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("only the creator can replace the invite code, and the old one stops working", async () => {
    await as(db, BOB, async () => {
      await expect(db.query(`select public.new_household_invite_code()`)).rejects.toMatchObject({ code: "42501" });
    });
    const fresh = await as(db, ALICE, () =>
      db.query<{ new_household_invite_code: string }>(`select public.new_household_invite_code()`)
    );
    expect(fresh.rows[0].new_household_invite_code).toMatch(/^[0-9a-f]{12}$/);
    expect(fresh.rows[0].new_household_invite_code).not.toBe(code);
    await db.query(`delete from public.household_members where user_id = '${CAROL}'`);
    await as(db, CAROL, async () => {
      await expect(db.query(`select public.join_household_by_code('${code}')`)).rejects.toThrow(/Invalid invite code/);
    });
    code = fresh.rows[0].new_household_invite_code;
  });

  it("only the creator can remove a member, whose items go back to them", async () => {
    await as(db, BOB, async () => {
      await expect(db.query(`select public.remove_household_member('${ALICE}')`)).rejects.toMatchObject({ code: "42501" });
    });
    await as(db, ALICE, () => db.query(`select public.remove_household_member('${BOB}')`));
    expect(await names(ALICE)).toEqual([]);
    expect(await names(BOB)).toEqual(["Bob atta", "Bob milk"]);
    const { rows } = await db.query(`select * from public.household_members where user_id = '${BOB}'`);
    expect(rows).toHaveLength(0);
  });

  it("leaving takes your items with you; the last one out deletes the household", async () => {
    await as(db, BOB, () => db.query(`select public.join_household_by_code('${code}')`));
    await as(db, BOB, () => db.query(`select public.share_my_items_with_household()`));
    await as(db, ALICE, () =>
      db.query(`insert into public.pantry_items (user_id, household_id, name, days_left) values ('${ALICE}', '${hid}', 'Alice paneer', 3)`)
    );
    expect(await names(BOB)).toEqual(["Alice paneer", "Bob atta", "Bob milk"]);

    await as(db, BOB, () => db.query(`select public.leave_household()`));
    expect(await names(BOB)).toEqual(["Bob atta", "Bob milk"]);
    expect(await names(ALICE)).toEqual(["Alice paneer"]);

    await as(db, ALICE, () => db.query(`select public.leave_household()`));
    expect((await db.query(`select * from public.households where id = '${hid}'`)).rows).toHaveLength(0);
    expect(await names(ALICE)).toEqual(["Alice paneer"]);
  });
});

/**
 * The pantry_items policy accepts `auth.uid() = user_id` in WITH CHECK without
 * looking at household_id, so on its own it would let a non-member write into
 * someone else's household. supabase-schema-household-guard.sql closes that
 * with a trigger (applied to production 2026-10-19); these tests keep it closed.
 */
describe("cross-household writes on pantry_items", () => {
  const injectAsNonMember = async (db: PGlite, householdId: string) => {
    await as(db, CAROL, () =>
      db.query(
        `insert into public.pantry_items (user_id, household_id, name, days_left)
         values ('${CAROL}', '${householdId}', 'Injected by a non-member', 1)`
      )
    );
  };

  describe("with every migration applied", () => {
    let db: PGlite;
    let householdId: string;
    beforeAll(async () => {
      db = await freshDatabase();
      const r = await as(db, ALICE, () =>
        db.query<{ id: string }>(`select * from public.create_household('Alice home')`)
      );
      householdId = r.rows[0].id;
    }, 60_000);
    afterAll(async () => db.close());

    it("a non-member cannot insert a row into another user's household", async () => {
      await expect(injectAsNonMember(db, householdId)).rejects.toMatchObject({ code: "42501" });
    });
  });

  describe("the guard, case by case", () => {
    let db: PGlite;
    let householdId: string;
    beforeAll(async () => {
      db = await freshDatabase();
      const r = await as(db, ALICE, () =>
        db.query<{ id: string }>(`select * from public.create_household('Alice home')`)
      );
      householdId = r.rows[0].id;
    }, 60_000);
    afterAll(async () => db.close());

    it("refuses an insert into a household the caller is not in", async () => {
      await expect(injectAsNonMember(db, householdId)).rejects.toMatchObject({ code: "42501" });
    });

    it("refuses moving the caller's own row into that household", async () => {
      await as(db, CAROL, () =>
        db.query(`insert into public.pantry_items (user_id, name, days_left) values ('${CAROL}', 'Carol private', 5)`)
      );
      await as(db, CAROL, async () => {
        await expect(
          db.query(`update public.pantry_items set household_id = '${householdId}' where name = 'Carol private'`)
        ).rejects.toMatchObject({ code: "42501" });
      });
    });

    it("still lets a member write into their own household", async () => {
      await as(db, ALICE, async () => {
        await expect(
          db.query(
            `insert into public.pantry_items (user_id, household_id, name, days_left)
             values ('${ALICE}', '${householdId}', 'Shared rice', 60)`
          )
        ).resolves.toBeDefined();
      });
    });

    it("still lets a user write private items and edit them without changing the household", async () => {
      await as(db, BOB, async () => {
        await db.query(`insert into public.pantry_items (user_id, name, days_left) values ('${BOB}', 'Bob dal', 120)`);
        await expect(
          db.query(`update public.pantry_items set days_left = 100 where name = 'Bob dal'`)
        ).resolves.toBeDefined();
      });
    });

    it("lets a former member keep editing their own historical rows", async () => {
      // Bob joins, shares an item, leaves; the row keeps its household_id.
      const code = (
        await db.query<{ invite_code: string }>(`select invite_code from public.households where id = '${householdId}'`)
      ).rows[0].invite_code;
      await as(db, BOB, () => db.query(`select public.join_household_by_code('${code}')`));
      await as(db, BOB, () =>
        db.query(
          `insert into public.pantry_items (user_id, household_id, name, days_left)
           values ('${BOB}', '${householdId}', 'Bob shared oil', 30)`
        )
      );
      await as(db, BOB, () => db.query(`delete from public.household_members where user_id = '${BOB}'`));
      await as(db, BOB, async () => {
        await expect(
          db.query(`update public.pantry_items set name = 'Bob oil (renamed)' where name = 'Bob shared oil'`)
        ).resolves.toBeDefined();
      });
    });

    it("does not interfere with the SQL editor or service role (no JWT subject)", async () => {
      await expect(
        db.query(
          `insert into public.pantry_items (user_id, household_id, name, days_left)
           values ('${ALICE}', '${householdId}', 'Admin seeded', 10)`
        )
      ).resolves.toBeDefined();
    });
  });
});
