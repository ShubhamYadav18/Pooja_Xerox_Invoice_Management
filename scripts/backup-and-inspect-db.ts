import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is missing from .env");
const connectionString = line.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
  const tables = (await pool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  )).rows;
  const data: Record<string, unknown[]> = {};
  for (const { table_name: tableName } of tables) {
    const quotedName = `"${tableName.replaceAll('"', '""')}"`;
    data[tableName] = (await pool.query(`SELECT * FROM ${quotedName}`)).rows;
  }

  const directory = join(process.cwd(), "backups");
  const filename = `database-backup-${new Date().toISOString().replaceAll(":", "-")}.json`;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), JSON.stringify({ createdAt: new Date().toISOString(), tables: data }, null, 2), "utf8");

  const migration = (await pool.query<{ migration_name: string; logs: string | null; started_at: Date; finished_at: Date | null; rolled_back_at: Date | null }>(
    "SELECT migration_name, logs, started_at, finished_at, rolled_back_at FROM \"_prisma_migrations\" WHERE migration_name = '20260623174500_business_profiles'"
  )).rows;
  const profileColumns = (await pool.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name = 'BusinessProfile') OR (table_name IN ('BusinessSettings', 'Customer', 'Invoice', 'InvoiceTemplate') AND column_name = 'profileId')) ORDER BY table_name, column_name"
  )).rows;
  const profileIndexes = (await pool.query(
    "SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('BusinessProfile', 'BusinessSettings', 'Customer', 'Invoice', 'InvoiceTemplate') ORDER BY tablename, indexname"
  )).rows;
  const profileForeignKeys = (await pool.query(
    "SELECT conname FROM pg_constraint WHERE contype = 'f' AND conname IN ('BusinessSettings_profileId_fkey', 'Customer_profileId_fkey', 'Invoice_profileId_fkey', 'InvoiceTemplate_profileId_fkey') ORDER BY conname"
  )).rows;
  console.log(JSON.stringify({ backup: join("backups", filename), tableCount: tables.length, migration, profileColumns, profileIndexes, profileForeignKeys }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
