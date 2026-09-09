/* Applies supabase/migrations/*.sql to DATABASE_URL (Supabase) or to the local PGlite database. */
import "dotenv/config";
import { getDb, runMigrations } from "../src/lib/db/client";

async function main() {
  const db = await getDb();
  const done = await runMigrations(db);
  console.log(`[migrate] backend=${db.backend} applied=${done.length ? done.join(", ") : "nothing new"}`);
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
