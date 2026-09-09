import fs from "node:fs";
import path from "node:path";

/**
 * Minimal database adapter with two backends:
 *  - Supabase Postgres (production) through postgres.js when DATABASE_URL is set
 *  - Embedded PGlite (local development / tests) when DATABASE_URL is empty
 * All queries use $1..$n placeholders so the same SQL runs on both.
 */
export interface DbClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
  close(): Promise<void>;
  backend: "postgres" | "pglite";
}

type Globals = typeof globalThis & { __dkDbPromise?: Promise<DbClient> };

function migrationsDir() {
  return path.join(process.cwd(), "supabase", "migrations");
}

export async function runMigrations(db: DbClient): Promise<string[]> {
  await db.exec(`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);
  const applied = new Set((await db.query<{ name: string }>(`select name from _migrations`)).map((r) => r.name));
  const dir = migrationsDir();
  const files = fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const done: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(/*turbopackIgnore: true*/ path.join(dir, f), "utf8");
    await db.exec(sql);
    await db.query(`insert into _migrations(name) values ($1) on conflict do nothing`, [f]);
    done.push(f);
  }
  return done;
}

async function createPostgres(url: string): Promise<DbClient> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX || 3),
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : "require",
  });
  const client: DbClient = {
    backend: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as never[]);
      return rows as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text);
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
  if (process.env.AUTO_MIGRATE === "true") await runMigrations(client);
  return client;
}

async function createPglite(): Promise<DbClient> {
  const { PGlite } = await import("@electric-sql/pglite");
  const memory = process.env.PGLITE_MEMORY === "1" || process.env.NODE_ENV === "test";
  const dataDir = memory ? undefined : process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data", "pglite");
  if (dataDir) fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  const client: DbClient = {
    backend: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query<T>(text, params);
      return res.rows;
    },
    async exec(text: string) {
      await pg.exec(text);
    },
    async close() {
      await pg.close();
    },
  };
  await runMigrations(client);
  return client;
}

export function getDb(): Promise<DbClient> {
  const g = globalThis as Globals;
  if (!g.__dkDbPromise) {
    const url = process.env.DATABASE_URL?.trim();
    g.__dkDbPromise = url ? createPostgres(url) : createPglite();
    g.__dkDbPromise.catch(() => {
      g.__dkDbPromise = undefined;
    });
  }
  return g.__dkDbPromise;
}

/** Test helper: close and forget the current connection. */
export async function resetDb() {
  const g = globalThis as Globals;
  const p = g.__dkDbPromise;
  g.__dkDbPromise = undefined;
  if (p) {
    try {
      const db = await p;
      await db.close();
    } catch {
      /* ignore */
    }
  }
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(text, params);
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

export function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  return iso(v);
}

export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof v === "bigint") return Number(v);
  return 0;
}

export function json(v: unknown): string {
  return JSON.stringify(v ?? null);
}

export function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}
