import { Pool } from "pg";

const globalForDb = globalThis as unknown as { ritmPool?: Pool };

export const db = globalForDb.ritmPool ?? new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://ritm:ritm@localhost:5432/ritm",
  max: 10,
  idleTimeoutMillis: 30_000,
});

if (process.env.NODE_ENV !== "production") globalForDb.ritmPool = db;
