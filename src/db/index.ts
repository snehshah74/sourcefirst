import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * One Postgres database, two drivers:
 *  - DATABASE_URL set  → real Postgres (Neon, Supabase, RDS…) via node-postgres
 *  - not set           → embedded Postgres (PGlite) stored in ./data/pg, zero setup for local dev
 * Migrations in ./drizzle are applied automatically on first use.
 */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");
const g = globalThis as unknown as { __sfdb?: Promise<DB> };

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
    const pool = new Pool({
      connectionString: url,
      // Serverless functions each hold their own pool, so keep it small (free Postgres tiers cap connections).
      max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 2 : 5)),
      idleTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: false }, // Supabase/Neon require TLS
    });
    const db = drizzle(pool, { schema });
    if (process.env.SKIP_MIGRATIONS !== "1") {
      // Two cold starts migrating at once would collide; an advisory lock makes them take turns.
      // Migrate on the same connection that holds the lock, so even a 1-connection pool can't deadlock.
      const client = await pool.connect();
      try {
        await client.query("select pg_advisory_lock(727001)");
        await migrate(drizzle(client, { schema }), { migrationsFolder: MIGRATIONS });
      } finally {
        await client.query("select pg_advisory_unlock(727001)").catch(() => {});
        client.release();
      }
    }
    return db as unknown as DB;
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Vercel's filesystem is read-only, so production needs a hosted Postgres (e.g. Supabase free tier). See DEPLOY.md.");
  }
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pg");
  fs.mkdirSync(dir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__sfdb) {
    g.__sfdb = connect().catch((e) => {
      g.__sfdb = undefined;
      throw e;
    });
  }
  return g.__sfdb;
}

export { schema };
