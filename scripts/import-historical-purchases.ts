import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is missing from .env");
const pool = new Pool({ connectionString: line.slice("DATABASE_URL=".length).replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });

const purchases = [
  { billNumber: "VS0445", billDate: "2026-07-03", supplierName: "Volcano Systems", supplierGstin: "27AGRPP7868A1ZT", state: "Maharashtra", taxable: 15250, cgst: 1372.5, sgst: 1372.5, igst: 0, total: 17995 },
  { billNumber: "VS0498", billDate: "2026-07-14", supplierName: "Volcano Systems", supplierGstin: "27AGRPP7868A1ZT", state: "Maharashtra", taxable: 5200, cgst: 468, sgst: 468, igst: 0, total: 6136 },
  { billNumber: "2299", billDate: "2026-07-07", supplierName: "Tokyo Enterprises", supplierGstin: "27AERPC6059G1Z9", state: "Maharashtra", taxable: 6375, cgst: 573.75, sgst: 573.75, igst: 0, total: 7522.5 },
  { billNumber: "157", billDate: "2026-07-28", supplierName: "F.M.S. ENTERPRISES", supplierGstin: "24EVJPS4588G1ZW", state: "Gujarat", taxable: 17150, cgst: 0, sgst: 0, igst: 3087, total: 20237 },
  { billNumber: "26-27 181", billDate: "2026-07-11", supplierName: "Hari Om Electronics", supplierGstin: "27BNFPG1636M1ZV", state: "Maharashtra", taxable: 101694, cgst: 9153, sgst: 9153, igst: 0, total: 120000 },
  { billNumber: "VS0001", billDate: "2026-04-01", supplierName: "Volcano Systems", supplierGstin: "27AGRPP7868A1ZT", state: "Maharashtra", taxable: 113500, cgst: 10215, sgst: 10215, igst: 0, total: 133930 },
  { billNumber: "2200", billDate: "2026-05-05", supplierName: "Tokyo Enterprises", supplierGstin: "27AERPC6059G1Z9", state: "Maharashtra", taxable: 9650, cgst: 868.5, sgst: 868.5, igst: 0, total: 11387 },
  { billNumber: "56", billDate: "2026-05-09", supplierName: "F.M.S. ENTERPRISES", supplierGstin: "24EVJPS4588G1ZW", state: "Gujarat", taxable: 12250, cgst: 0, sgst: 0, igst: 2205, total: 14455 }
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profile = await client.query<{ id: string }>("SELECT id FROM \"BusinessProfile\" WHERE code = 'POOJA_XEROX' AND \"isActive\" = true");
    if (profile.rowCount !== 1) throw new Error("The active POOJA_XEROX profile was not found");
    const profileId = profile.rows[0].id;

    for (const purchase of purchases) {
      const existing = await client.query("SELECT id FROM \"Purchase\" WHERE \"profileId\" = $1 AND \"supplierName\" = $2 AND \"billNumber\" = $3", [profileId, purchase.supplierName, purchase.billNumber]);
      if (existing.rowCount) throw new Error(`Purchase ${purchase.supplierName} / ${purchase.billNumber} already exists; nothing was imported`);
    }

    for (const purchase of purchases) {
      const now = new Date();
      await client.query(`INSERT INTO "Supplier" (id, "profileId", name, gstin, state, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $6) ON CONFLICT ("profileId", name) DO UPDATE SET gstin = EXCLUDED.gstin, state = EXCLUDED.state, "updatedAt" = EXCLUDED."updatedAt"`, [randomUUID(), profileId, purchase.supplierName, purchase.supplierGstin, purchase.state, now]);
      await client.query(`INSERT INTO "Purchase" (id, "profileId", "billNumber", "billDate", "supplierName", "supplierGstin", "stateOfSupply", "taxMode", "taxableAmount", "cgstRate", "sgstRate", "igstRate", "cgstAmount", "sgstAmount", "igstAmount", "totalAmount", notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"TaxMode", $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18)`, [randomUUID(), profileId, purchase.billNumber, `${purchase.billDate}T12:00:00.000Z`, purchase.supplierName, purchase.supplierGstin, purchase.state, purchase.igst ? "IGST" : "CGST_SGST", purchase.taxable, purchase.igst ? 0 : 9, purchase.igst ? 0 : 9, purchase.igst ? 18 : 0, purchase.cgst, purchase.sgst, purchase.igst, purchase.total, "Imported from the supplied 2026 purchase worksheets.", now]);
    }
    await client.query("COMMIT");
    const totals = await client.query(`SELECT TO_CHAR("billDate", 'YYYY-MM') AS month, COUNT(*)::int AS count, SUM("totalAmount") AS total FROM "Purchase" WHERE "profileId" = $1 AND "billDate" >= DATE '2026-04-01' AND "billDate" < DATE '2026-08-01' GROUP BY 1 ORDER BY 1`, [profileId]);
    console.log(JSON.stringify({ imported: purchases.length, monthlyTotals: totals.rows }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
