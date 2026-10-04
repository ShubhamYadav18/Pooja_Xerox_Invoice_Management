import { readFileSync } from "node:fs";
import { Pool } from "pg";

const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is missing from .env");

const pool = new Pool({
  connectionString: line.slice("DATABASE_URL=".length).replace(/^"|"$/g, ""),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE "Purchase"
       SET "cgstAmount" = 751.50,
           "sgstAmount" = 751.50,
           "updatedAt" = NOW()
       WHERE "billNumber" = '2327'
         AND "supplierName" = 'Tokyo Enterprises'
         AND "taxableAmount" = 8350.00
         AND "totalAmount" = 9853.00
       RETURNING "id", "billNumber", "supplierName", "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount", "totalAmount"`
    );

    if (result.rowCount !== 1) {
      throw new Error(`Expected exactly one Tokyo Enterprises bill 2327 record, found ${result.rowCount ?? 0}.`);
    }

    await client.query("COMMIT");
    console.log(JSON.stringify(result.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
