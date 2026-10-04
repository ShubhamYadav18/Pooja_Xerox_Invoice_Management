import { readFileSync } from "node:fs";
import { Pool } from "pg";

const line = readFileSync(".env", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL is missing from .env");
const pool = new Pool({ connectionString: line.slice("DATABASE_URL=".length).replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });

const updates = [
  { billNumber: "VS0001", supplierName: "Volcano Systems", billDate: "2026-06-01" },
  { billNumber: "2200", supplierName: "Tokyo Enterprises", billDate: "2026-06-05" },
  { billNumber: "56", supplierName: "F.M.S. ENTERPRISES", billDate: "2026-06-09" }
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profile = await client.query<{ id: string }>("SELECT id FROM \"BusinessProfile\" WHERE code = 'POOJA_XEROX' AND \"isActive\" = true");
    if (profile.rowCount !== 1) throw new Error("The active POOJA_XEROX profile was not found");
    const profileId = profile.rows[0].id;
    for (const update of updates) {
      const result = await client.query(`UPDATE "Purchase" SET "billDate" = $1, "updatedAt" = NOW() WHERE "profileId" = $2 AND "supplierName" = $3 AND "billNumber" = $4 AND notes = 'Imported from the supplied 2026 purchase worksheets.'`, [`${update.billDate}T12:00:00.000Z`, profileId, update.supplierName, update.billNumber]);
      if (result.rowCount !== 1) throw new Error(`Expected exactly one imported purchase for ${update.supplierName} / ${update.billNumber}`);
    }
    await client.query("COMMIT");
    const june = await client.query(`SELECT COUNT(*)::int AS count, SUM("taxableAmount") AS taxable, SUM("cgstAmount") AS cgst, SUM("sgstAmount") AS sgst, SUM("igstAmount") AS igst, SUM("totalAmount") AS total FROM "Purchase" WHERE "profileId" = $1 AND "billDate" >= DATE '2026-06-01' AND "billDate" < DATE '2026-07-01'`, [profileId]);
    console.log(JSON.stringify({ moved: updates.length, juneTotals: june.rows[0] }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
