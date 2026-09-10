/*
 * Seeds the database.
 *   npm run db:seed        -> only the super admin account (SUPER_ADMIN_EMAILS[0] / SUPER_ADMIN_PASSWORD)
 *   npm run db:seed:demo   -> additionally one demo site per category (demo-gypsum, demo-aluminum, ...)
 * Demo sites are refused in production (NODE_ENV=production or VERCEL) unless DEMO_ADMIN_PASSWORD is set
 * explicitly; locally a random admin password is generated and printed once when none is configured.
 * Safe to re-run: existing sites are skipped and the super admin password is reset to SUPER_ADMIN_PASSWORD.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { getDb } from "../src/lib/db/client";
import { superAdminEmails, upsertSuperAdmin, getUserByEmail, createUser } from "../src/lib/db/users";
import { getSiteBySlug } from "../src/lib/db/sites";
import { addMember } from "../src/lib/db/members";
import { provisionSite } from "../src/lib/provision";
import { CATEGORIES, CATEGORY_LABELS } from "../src/lib/types";
import { ROOT_DOMAIN } from "../src/lib/config";

const WITH_DEMO = process.argv.includes("--demo") || process.env.SEED_DEMO === "1";
const IS_PROD = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

async function main() {
  const db = await getDb();
  const email = superAdminEmails()[0];
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SUPER_ADMIN_EMAILS and SUPER_ADMIN_PASSWORD before seeding");
  if (password.length < 8 || ["ChangeMe123!", "Admin123!", "password"].includes(password)) throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters and not a placeholder value");
  const owner = await upsertSuperAdmin(email, password, "Owner");
  console.log(`[seed] super admin ${owner.email} ready`);

  if (WITH_DEMO) {
    if (IS_PROD && !process.env.DEMO_ADMIN_PASSWORD) throw new Error("Refusing to create demo sites in production without DEMO_ADMIN_PASSWORD");
    const adminEmail = process.env.DEMO_ADMIN_EMAIL || "admin@example.com";
    const generated = randomBytes(9).toString("base64url");
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD || generated;
    const existingAdmin = await getUserByEmail(adminEmail);
    const admin = existingAdmin || (await createUser({ email: adminEmail, password: adminPassword, name: "Demo Admin", isSuper: false }));
    if (!existingAdmin) console.log(`[seed] demo admin ${adminEmail} password: ${adminPassword}${process.env.DEMO_ADMIN_PASSWORD ? "" : " (generated — save it now)"}`);
    const port = ROOT_DOMAIN.includes(":") ? ":" + ROOT_DOMAIN.split(":")[1] : "";
    for (const category of CATEGORIES) {
      const slug = `demo-${category}`;
      if (await getSiteBySlug(slug)) {
        console.log(`[seed] ${slug} exists, skipping`);
        continue;
      }
      const { site, hostname } = await provisionSite({
        slug,
        name: CATEGORY_LABELS[category].ar,
        category,
        whatsapp: "96550000000",
        provisionVercel: process.env.SEED_VERCEL === "true",
      });
      await addMember(site.id, admin.id);
      console.log(`[seed] created ${slug} (template ${site.templateCode}) -> http://${hostname}${port}/`);
    }
  }
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
