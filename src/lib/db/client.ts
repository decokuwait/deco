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
  /** Runs every statement in one transaction on one connection (the migration advisory lock needs both). */
  execTransaction(statements: string[]): Promise<void>;
  close(): Promise<void>;
  backend: "postgres" | "pglite";
}

type Globals = typeof globalThis & { __dkDbPromise?: Promise<DbClient> };

function migrationsDir() {
  return path.join(process.cwd(), "supabase", "migrations");
}

const MIGRATION_LOCK = 7241001;

function migrationFiles(): string[] {
  return fs
    .readdirSync(/*turbopackIgnore: true*/ migrationsDir())
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Migration files not yet recorded in `_migrations` — all of them on a database that was never migrated. Read-only. */
export async function pendingMigrations(db: DbClient): Promise<string[]> {
  const [bookkeeping] = await db.query<{ present: boolean }>(`select to_regclass('public._migrations') is not null as present`);
  const applied = new Set(bookkeeping?.present ? (await db.query<{ name: string }>(`select name from _migrations`)).map((r) => r.name) : []);
  return migrationFiles().filter((f) => !applied.has(f));
}

/**
 * Applies pending SQL files from supabase/migrations. All pending files run inside ONE transaction that
 * holds an advisory lock, so concurrent cold starts (AUTO_MIGRATE on Vercel) serialise instead of racing.
 * Migration files are written idempotently (IF NOT EXISTS / DROP IF EXISTS) so a repeated run is harmless.
 */
export async function runMigrations(db: DbClient): Promise<string[]> {
  await db.exec(`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);
  const pending = await pendingMigrations(db);
  if (!pending.length) return [];
  const dir = migrationsDir();
  const statements = [`select pg_advisory_xact_lock(${MIGRATION_LOCK});`];
  for (const f of pending) {
    statements.push(fs.readFileSync(/*turbopackIgnore: true*/ path.join(dir, f), "utf8"));
    statements.push(`insert into _migrations(name) values ('${f.replace(/'/g, "''")}') on conflict do nothing;`);
  }
  await db.execTransaction(statements);
  return pending;
}

async function createPostgres(url: string): Promise<DbClient> {
  const postgres = (await import("postgres")).default;
  // Our queries pass JSON as already-stringified text into `$n::jsonb` casts. postgres.js would otherwise
  // run its own JSON serializer on that string (double encoding), so json/jsonb parameters pass through verbatim.
  const passthrough = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
  const sql = postgres(url, {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX || 3),
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : "require",
    types: {
      json: { to: 114, from: [114], serialize: passthrough, parse: (x: string) => JSON.parse(x) },
      jsonb: { to: 3802, from: [3802], serialize: passthrough, parse: (x: string) => JSON.parse(x) },
    },
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
    // postgres.js refuses a BEGIN it did not issue itself (it would leak a transaction across the pool), so
    // the statements go through sql.begin, which reserves one connection and commits or rolls back as a unit.
    async execTransaction(statements: string[]) {
      await sql.begin(async (t) => {
        for (const stmt of statements) await t.unsafe(stmt);
      });
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
    async execTransaction(statements: string[]) {
      await pg.exec(["begin;", ...statements, "commit;"].join("\n"));
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
    if (!url && (process.env.VERCEL || process.env.DK_REQUIRE_DATABASE_URL === "true")) {
      // Serverless file systems are read-only and ephemeral: the embedded database is for local use only.
      const err = new Error("DATABASE_URL is not set. Configure the Supabase connection string in the Vercel project environment variables.");
      return Promise.reject(Object.assign(err, { code: "DB_NOT_CONFIGURED" }));
    }
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

/** What an operator can act on when the database fails, or null for an ordinary query error. */
export type DbFailure = "config" | "unreachable" | "auth" | "schema";

// SQLSTATE codes (postgres.js and PGlite both attach them as `code`) plus Node / driver network codes.
const SCHEMA_CODES = new Set(["42P01", "42703", "42704", "3F000"]); // undefined table / column / object, invalid schema
const AUTH_CODES = new Set(["28P01", "28000", "3D000"]); // invalid password, no pg_hba entry, unknown database
const NETWORK_CODES = new Set([
  ...["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH", "EPIPE"],
  ...["CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED"],
  ...["08000", "08001", "08003", "08006", "53300", "57P01", "57P02", "57P03"],
]);

/**
 * Sorts a database error into the bucket an operator can fix: DATABASE_URL missing or malformed, host not
 * reachable (wrong host, IPv6-only direct connection, paused project), credentials rejected, or migrations
 * not applied. Errors about the query itself (a constraint violation, a syntax error) return null so callers
 * keep treating them as bugs.
 */
export function classifyDbError(e: unknown): DbFailure | null {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: unknown }).code ?? "") : "";
  if (code === "DB_NOT_CONFIGURED" || code === "ERR_INVALID_URL") return "config";
  if (SCHEMA_CODES.has(code)) return "schema";
  if (AUTH_CODES.has(code)) return "auth";
  if (NETWORK_CODES.has(code)) return "unreachable";
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (/password authentication failed|tenant or user not found|no pg_hba\.conf entry/i.test(msg)) return "auth";
  if (/(relation|table|column) .* does not exist/i.test(msg)) return "schema";
  if (/timeout|timed out|ECONN|ENOTFOUND|socket hang up|certificate|\bssl\b|\btls\b/i.test(msg)) return "unreachable";
  return null;
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(text, params);
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Timestamp as an ISO string for output (API responses, rendering). Lossy, and in two ways: the drivers hand
 * timestamps over as JS Date objects, which hold milliseconds where Postgres stores microseconds, and
 * postgres.js truncates timestamps it sends *as parameters* the same way. A timestamp read from a row can
 * therefore never be compared back to that row, not even via col::text. Compare something the driver leaves
 * alone (a hash, an id) or keep the timestamp inside a single server-side statement.
 */
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
