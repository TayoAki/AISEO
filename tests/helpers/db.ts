import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { createDatabase, type Database } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { report, user } from "@/server/db/schema";

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://aiseo:aiseo@127.0.0.1:5432/aiseo_test";

/** Drops everything and re-applies migrations (Drizzle + pg-boss). */
export async function resetTestDatabase(): Promise<void> {
  const { db, pool } = createDatabase(TEST_DATABASE_URL, 1);
  try {
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema if exists pgboss cascade`);
    await db.execute(sql`create schema public`);
  } finally {
    await pool.end();
  }
  await runMigrations(TEST_DATABASE_URL);
}

export function openTestDatabase(max = 20) {
  return createDatabase(TEST_DATABASE_URL, max);
}

export async function createTestUser(db: Database, overrides: Partial<typeof user.$inferInsert> = {}) {
  const id = overrides.id ?? `usr_${randomUUID().replaceAll("-", "")}`;
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: "Test User",
      email: `${id}@example.com`,
      emailVerified: true,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("failed to create test user");
  return row;
}

/** Inserts a report holding a reservation on `bucketId` (the caller reserved the unit). */
export async function createReservedReport(db: Database, userId: string, bucketId: string) {
  const [row] = await db
    .insert(report)
    .values({
      userId,
      type: "keyword",
      title: "test keyword",
      input: { type: "keyword", keyword: "test keyword", country: "US" },
      tier: "free",
      usageBucketId: bucketId,
      idempotencyKey: randomUUID(),
    })
    .returning();
  if (!row) throw new Error("failed to create test report");
  return row;
}
