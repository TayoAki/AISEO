import { PgBoss } from "pg-boss";

import { getEnv } from "../env";

export const BOSS_SCHEMA = "pgboss";

type BossRole = "web" | "worker" | "migrate";

/**
 * pg-boss instances. The web process only sends jobs (no maintenance, no
 * schedules, no migrations); the worker owns supervision and scheduling;
 * the migrate script installs the schema.
 */
export function createBoss(role: BossRole, connectionString = getEnv().DATABASE_URL): PgBoss {
  const boss = new PgBoss({
    connectionString,
    schema: BOSS_SCHEMA,
    application_name: `aiseo-${role}`,
    max: role === "worker" ? 6 : 3,
    supervise: role === "worker",
    schedule: role === "worker",
    migrate: role !== "web",
    createSchema: role !== "web",
    instanceName: `aiseo-${role}`,
  });
  boss.on("error", (error: Error & { queue?: string }) => {
    console.error(`[pg-boss:${role}] error`, { queue: error.queue, stack: error.stack ?? error.message });
  });
  return boss;
}

const globalForBoss = globalThis as unknown as { __aiseoWebBoss?: Promise<PgBoss> };

/** Lazily started, process-wide sender used by Next.js route handlers. */
export function getWebBoss(): Promise<PgBoss> {
  if (!globalForBoss.__aiseoWebBoss) {
    const boss = createBoss("web");
    globalForBoss.__aiseoWebBoss = boss.start().catch((error: unknown) => {
      globalForBoss.__aiseoWebBoss = undefined;
      throw error;
    });
  }
  return globalForBoss.__aiseoWebBoss;
}
