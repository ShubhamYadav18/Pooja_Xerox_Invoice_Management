import { readFileSync } from "node:fs";
import { Pool } from "pg";

const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is missing from .env");
const pool = new Pool({ connectionString: line.slice("DATABASE_URL=".length).replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const result = await pool.query(
      `SELECT i."invoiceNumber", i."invoiceDate"::date AS date, i.subtotal, i."cgstAmount", i."sgstAmount", i."igstAmount", i."grandTotal"
       FROM "Invoice" i JOIN "BusinessProfile" p ON p.id = i."profileId"
       WHERE p.code = 'POOJA_XEROX' AND i.status <> 'CANCELLED' AND i."invoiceDate" >= DATE '2026-08-01' AND i."invoiceDate" < DATE '2026-09-01'
       ORDER BY i."invoiceNumber"`
    );
    const totals = await pool.query(
      `SELECT SUM(i.subtotal) AS taxable, SUM(i."cgstAmount") AS cgst, SUM(i."sgstAmount") AS sgst, SUM(i."igstAmount") AS igst, SUM(i."grandTotal") AS total
       FROM "Invoice" i JOIN "BusinessProfile" p ON p.id = i."profileId"
       WHERE p.code = 'POOJA_XEROX' AND i.status <> 'CANCELLED' AND i."invoiceDate" >= DATE '2026-08-01' AND i."invoiceDate" < DATE '2026-09-01'`
    );
    console.log(JSON.stringify({ invoices: result.rows, totals: totals.rows[0] }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
