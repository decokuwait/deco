/* Shared helpers for the QA scripts (smoke, screenshots, end-to-end flows). */
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";

export interface QaEnv {
  port: number;
  root: string;
  dataDir: string;
}

/** Production credentials must never leak into a QA run (real bucket uploads, real Vercel domain registrations). */
const PRODUCTION_ONLY = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL", "VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID", "AUTO_MIGRATE", "VERCEL", "DK_REQUIRE_DATABASE_URL"];

export function qaEnv(name: string, defaultPort: number): QaEnv {
  const port = Number(process.env.QA_PORT || defaultPort);
  const root = `localhost:${port}`;
  const dataDir = path.join(process.cwd(), ".data", `pglite-${name}`);
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = root;
  process.env.DATABASE_URL = "";
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.LOCAL_UPLOADS_DIR = path.join(process.cwd(), ".data", `uploads-${name}`);
  process.env.SUPER_ADMIN_EMAILS = "owner@example.com";
  process.env.SUPER_ADMIN_PASSWORD = "Owner123!";
  for (const k of PRODUCTION_ONLY) delete process.env[k];
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(process.env.LOCAL_UPLOADS_DIR, { recursive: true, force: true });
  return { port, root, dataDir };
}

/** `next start` needs a build; failing early beats a 90 s wait for a server that never answers. */
export function assertBuild() {
  if (!fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) throw new Error("No production build found: run `npm run build` first");
}

export async function portFree(p: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(p);
  });
}

const exits = new WeakMap<ChildProcess, Promise<number | null>>();

/** Polls until the server answers, or rejects as soon as the server process exits (with its last stderr lines). */
export async function waitFor(url: string, ms = 90000, server?: ChildProcess) {
  const start = Date.now();
  const exited = server ? exits.get(server) : undefined;
  while (Date.now() - start < ms) {
    if (exited) {
      const code = await Promise.race([exited, new Promise<undefined>((r) => setTimeout(() => r(undefined), 0))]);
      if (code !== undefined) throw new Error(`server exited early with code ${code}\n${stderrTail.get(server!) ?? ""}`);
    }
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start: ${url}`);
}

const stderrTail = new WeakMap<ChildProcess, string>();

export function startServer(port: number, verbose = !!process.env.QA_VERBOSE): ChildProcess {
  assertBuild();
  const server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "-p", String(port)], {
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  server.stdout?.on("data", (d) => verbose && process.stdout.write(d));
  server.stderr?.on("data", (d) => {
    process.stdout.write(d);
    stderrTail.set(server, ((stderrTail.get(server) ?? "") + String(d)).slice(-2000));
  });
  exits.set(server, new Promise((resolve) => server.once("exit", (code) => resolve(code))));
  return server;
}

export async function stopServer(server: ChildProcess) {
  if (process.platform === "win32" && server.pid) {
    await new Promise<void>((resolve) => {
      const k = spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore" });
      k.on("exit", () => resolve());
      k.on("error", () => resolve());
    });
  }
  server.kill();
  await new Promise((r) => setTimeout(r, 1000));
}

/** Seeds owner + site admin + one demo site; returns ids and session tokens. */
export async function seedQa(opts: { slug: string; name: string; category: "gypsum" | "aluminum" | "partition" | "ceramic"; templateCode: string; pixel?: { platform: "meta"; pixelId: string; accessToken: string } }) {
  const { getDb, resetDb } = await import("../src/lib/db/client");
  const { upsertSuperAdmin, createUser, createSession } = await import("../src/lib/db/users");
  const { provisionSite } = await import("../src/lib/provision");
  const { addMember } = await import("../src/lib/db/members");
  const { listProjects } = await import("../src/lib/db/projects");
  const { upsertPixel } = await import("../src/lib/db/pixels");
  await getDb();
  const owner = await upsertSuperAdmin("owner@example.com", "Owner123!");
  const admin = await createUser({ email: "admin@example.com", password: "Admin123!", isSuper: false, name: "Site Admin" });
  // The QA site is a showcase on purpose: the suite drives the demo projects and media. Both flags are
  // explicit because provisioning now defaults to "no invented content" and "paused until published".
  const { site } = await provisionSite({ slug: opts.slug, name: opts.name, category: opts.category, templateCode: opts.templateCode, whatsapp: "96550000000", demo: true, status: "active", provisionVercel: false });
  await addMember(site.id, admin.id);
  if (opts.pixel) await upsertPixel(site.id, opts.pixel.platform, { pixelId: opts.pixel.pixelId, accessToken: opts.pixel.accessToken, active: true });
  const { token: adminToken } = await createSession(admin.id);
  const { token: superToken } = await createSession(owner.id);
  const projects = await listProjects(site.id);
  await resetDb();
  return { owner, admin, site, adminToken, superToken, projects };
}

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
