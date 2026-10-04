import { readFileSync } from "node:fs";
import { Pool } from "pg";

const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is missing from .env");
const pool = new Pool({ connectionString: line.slice("DATABASE_URL=".length).replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const result = await pool.query(
      `SELECT 'sales' AS category, SUM(i.subtotal) AS taxable, SUM(i."cgstAmount") AS cgst, SUM(i."sgstAmount") AS sgst, SUM(i."igstAmount") AS igst, SUM(i."grandTotal") AS total
       FROM "Invoice" i JOIN "BusinessProfile" p ON p.id = i."profileId" WHERE p.code = 'POOJA_XEROX' AND i.status <> 'CANCELLED' AND i."invoiceDate" >= DATE '2026-06-01' AND i."invoiceDate" < DATE '2026-07-01'
       UNION ALL
       SELECT 'purchases' AS category, SUM(pu."taxableAmount") AS taxable, SUM(pu."cgstAmount") AS cgst, SUM(pu."sgstAmount") AS sgst, SUM(pu."igstAmount") AS igst, SUM(pu."totalAmount") AS total
       FROM "Purchase" pu JOIN "BusinessProfile" p ON p.id = pu."profileId" WHERE p.code = 'POOJA_XEROX' AND pu."billDate" >= DATE '2026-06-01' AND pu."billDate" < DATE '2026-07-01'`
    );
    const invoices = await pool.query(
      `SELECT i."invoiceNumber", i."invoiceDate"::date AS date, c."companyName", i.subtotal, i."cgstAmount", i."sgstAmount", i."igstAmount", i."grandTotal"
       FROM "Invoice" i JOIN "BusinessProfile" p ON p.id = i."profileId" JOIN "Customer" c ON c.id = i."customerId"
       WHERE p.code = 'POOJA_XEROX' AND i.status <> 'CANCELLED' AND i."invoiceDate" >= DATE '2026-06-01' AND i."invoiceDate" < DATE '2026-07-01' ORDER BY i."invoiceNumber"`
    );
    console.log(JSON.stringify({ totals: result.rows, invoices: invoices.rows }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
