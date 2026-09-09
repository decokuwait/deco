/* Shared helpers for the Playwright based QA scripts (screenshots + end-to-end flows). */
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";

export interface QaEnv {
  port: number;
  root: string;
  dataDir: string;
}

export function qaEnv(name: string, defaultPort: number): QaEnv {
  const port = Number(process.env.QA_PORT || defaultPort);
  const root = `localhost:${port}`;
  const dataDir = path.join(process.cwd(), ".data", `pglite-${name}`);
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = root;
  process.env.DATABASE_URL = "";
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.LOCAL_UPLOADS_DIR = path.join(process.cwd(), ".data", `uploads-${name}`);
  process.env.SUPER_ADMIN_EMAILS = "owner@example.com";
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(process.env.LOCAL_UPLOADS_DIR, { recursive: true, force: true });
  return { port, root, dataDir };
}

export async function portFree(p: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(p);
  });
}

export async function waitFor(url: string, ms = 90000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
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

export function startServer(port: number, verbose = !!process.env.QA_VERBOSE): ChildProcess {
  const server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "-p", String(port)], {
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  server.stdout?.on("data", (d) => verbose && process.stdout.write(d));
  server.stderr?.on("data", (d) => process.stdout.write(d));
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

/** Seeds owner + site admin + one demo site with pixels; returns ids and session tokens. */
export async function seedQa(opts: { slug: string; name: string; category: "gypsum" | "aluminum" | "partition" | "ceramic"; templateCode: string }) {
  const { getDb, resetDb } = await import("../src/lib/db/client");
  const { upsertSuperAdmin, createUser, createSession } = await import("../src/lib/db/users");
  const { provisionSite } = await import("../src/lib/provision");
  const { addMember } = await import("../src/lib/db/members");
  const { listProjects } = await import("../src/lib/db/projects");
  await getDb();
  const owner = await upsertSuperAdmin("owner@example.com", "Owner123!");
  const admin = await createUser({ email: "admin@example.com", password: "Admin123!", isSuper: false, name: "Site Admin" });
  const { site } = await provisionSite({ slug: opts.slug, name: opts.name, category: opts.category, templateCode: opts.templateCode, whatsapp: "96550000000", provisionVercel: false });
  await addMember(site.id, admin.id);
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
