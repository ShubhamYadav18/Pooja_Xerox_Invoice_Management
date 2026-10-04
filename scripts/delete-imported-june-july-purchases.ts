import { readFileSync } from "node:fs";
import { Pool } from "pg";

const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is missing from .env");
const pool = new Pool({ connectionString: line.slice("DATABASE_URL=".length).replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const records = await client.query(`SELECT id, "billNumber", "supplierName", "billDate"::date AS date FROM "Purchase" WHERE notes = 'Imported from the supplied 2026 purchase worksheets.' AND "billDate" >= DATE '2026-06-01' AND "billDate" < DATE '2026-08-01' ORDER BY "billDate"`);
    if (records.rowCount !== 8) throw new Error(`Expected 8 imported June/July purchases, found ${records.rowCount}`);
    const deleted = await client.query(`DELETE FROM "Purchase" WHERE notes = 'Imported from the supplied 2026 purchase worksheets.' AND "billDate" >= DATE '2026-06-01' AND "billDate" < DATE '2026-08-01' RETURNING "billNumber", "supplierName", "billDate"::date AS date`);
    if (deleted.rowCount !== 8) throw new Error(`Expected to delete 8 purchases, deleted ${deleted.rowCount}`);
    await client.query("COMMIT");
    console.log(JSON.stringify({ deleted: deleted.rows }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
