/**
 * Applies Drizzle migrations, installs/updates the pg-boss schema and creates
 * the pipeline queues. Run once per deploy (Railway pre-deploy command):
 *   npm run db:migrate
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { getEnv } from "../env";
import { createBoss } from "../pipeline/boss";
import { ensureQueues } from "../pipeline/queues";
import { createDatabase } from "./client";

export async function runMigrations(connectionString: string): Promise<void> {
  const { db, pool } = createDatabase(connectionString, 2);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }

  const boss = createBoss("migrate", connectionString);
  await boss.start();
  try {
    await ensureQueues(boss);
  } finally {
    await boss.stop({ graceful: false, close: true });
  }
}

const isEntrypoint = process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js");

if (isEntrypoint) {
  runMigrations(getEnv().DATABASE_URL)
    .then(() => {
      console.log("[migrate] database and job queues are up to date");
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("[migrate] failed", error);
      process.exit(1);
    });
}
