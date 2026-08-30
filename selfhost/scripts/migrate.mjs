import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(`create table if not exists schema_migrations (
    filename text primary key, applied_at timestamptz not null default now()
  )`);
  const directory = resolve(process.cwd(), "migrations");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const filename of files) {
    const exists = await client.query("select 1 from schema_migrations where filename=$1", [filename]);
    if (exists.rowCount) continue;
    const sql = await readFile(resolve(directory, filename), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations(filename) values($1)", [filename]);
      await client.query("commit");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
