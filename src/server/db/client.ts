import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getEnv } from "../env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run queries: the pool-backed database or an open transaction. */
export type Executor = Database | Transaction;

type Handles = { pool: Pool; db: Database };

const globalForDb = globalThis as unknown as { __aiseoDb?: Handles };

export function createDatabase(connectionString: string, max = 10): Handles {
  const pool = new Pool({ connectionString, max, idleTimeoutMillis: 30_000 });
  pool.on("error", (error) => {
    console.error("[db] idle client error", { message: error.message });
  });
  return { pool, db: drizzle({ client: pool, schema }) };
}

function handles(): Handles {
  if (!globalForDb.__aiseoDb) {
    const env = getEnv();
    globalForDb.__aiseoDb = createDatabase(env.DATABASE_URL, env.DATABASE_POOL_MAX);
  }
  return globalForDb.__aiseoDb;
}

export function getDb(): Database {
  return handles().db;
}

export function getPool(): Pool {
  return handles().pool;
}

export { schema };
