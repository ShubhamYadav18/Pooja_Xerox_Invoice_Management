import { readFileSync } from "node:fs";
import { Pool } from "pg";

const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is missing from .env");
const pool = new Pool({ connectionString: line.slice("DATABASE_URL=".length).replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS purchases, COUNT(DISTINCT ("profileId", "supplierName", "billNumber"))::int AS unique_purchases, COUNT(*) FILTER (WHERE "totalAmount" <> "taxableAmount" + "cgstAmount" + "sgstAmount" + "igstAmount")::int AS invalid_totals FROM "Purchase"`);
    const invalid = await pool.query(`SELECT "billNumber", "supplierName", "billDate"::date AS date, "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount", "totalAmount" FROM "Purchase" WHERE "totalAmount" <> "taxableAmount" + "cgstAmount" + "sgstAmount" + "igstAmount"`);
    console.log(JSON.stringify({ ...result.rows[0], invalid: invalid.rows }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
