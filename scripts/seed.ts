/*
 * Seeds the database: the super admin account (SUPER_ADMIN_EMAILS[0] / SUPER_ADMIN_PASSWORD) and one
 * demo site per category (demo-gypsum, demo-aluminum, demo-partition, demo-ceramic) with demo projects.
 * Safe to re-run: existing sites are skipped, the super admin password is reset to SUPER_ADMIN_PASSWORD.
 */
import "dotenv/config";
import { getDb } from "../src/lib/db/client";
import { superAdminEmails, upsertSuperAdmin, getUserByEmail, createUser } from "../src/lib/db/users";
import { getSiteBySlug } from "../src/lib/db/sites";
import { addMember } from "../src/lib/db/members";
import { provisionSite } from "../src/lib/provision";
import { CATEGORIES, CATEGORY_LABELS } from "../src/lib/types";
import { ROOT_DOMAIN } from "../src/lib/config";

async function main() {
  const db = await getDb();
  const email = superAdminEmails()[0] || "owner@example.com";
  const password = process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!";
  const owner = await upsertSuperAdmin(email, password, "Owner");
  console.log(`[seed] super admin ${owner.email} ready (password from SUPER_ADMIN_PASSWORD)`);

  const adminEmail = process.env.DEMO_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || "Admin123!";
  const admin = (await getUserByEmail(adminEmail)) || (await createUser({ email: adminEmail, password: adminPassword, name: "Demo Admin", isSuper: false }));

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
    console.log(`[seed] created ${slug} (template ${site.templateCode}) -> http://${hostname}${ROOT_DOMAIN.includes(":") ? ":" + ROOT_DOMAIN.split(":")[1] : ""}/  admin: ${adminEmail} / ${adminPassword}`);
  }
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
