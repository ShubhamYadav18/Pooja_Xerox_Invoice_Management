import { endOfMonth, startOfMonth } from "date-fns";
import { Card, Input, LinkButton } from "@/components/ui";
import { DeletePurchaseButton, PurchaseFormDialog } from "@/features/purchases/purchase-form-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/server/profile";

function selectedMonth(value?: string) {
  return /^\d{4}-\d{2}$/.test(value ?? "") ? value! : new Date().toISOString().slice(0, 7);
}

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ month?: string; error?: string }> }) {
  const params = await searchParams;
  const month = selectedMonth(params.month);
  const monthDate = new Date(`${month}-01T00:00:00`);
  const profileId = await getActiveProfileId();
  const dateRange = { gte: startOfMonth(monthDate), lte: endOfMonth(monthDate) };
  const [purchases, suppliers, totals] = await Promise.all([
    prisma.purchase.findMany({ where: { profileId, billDate: dateRange }, orderBy: [{ billDate: "desc" }, { createdAt: "desc" }] }),
    prisma.supplier.findMany({ where: { profileId }, orderBy: { name: "asc" }, select: { id: true, name: true, gstin: true, state: true } }),
    prisma.purchase.aggregate({ where: { profileId, billDate: dateRange }, _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, totalAmount: true } })
  ]);
  const cgst = Number(totals._sum.cgstAmount ?? 0);
  const sgst = Number(totals._sum.sgstAmount ?? 0);
  const igst = Number(totals._sum.igstAmount ?? 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-semibold">Purchases</h1><p className="text-sm text-muted-foreground">Supplier purchase bills and GST input tax credit.</p></div>
        <div className="flex flex-wrap gap-2"><LinkButton href={`/reports/ca-gst?month=${month}`} variant="secondary">CA GST Report</LinkButton><PurchaseFormDialog suppliers={suppliers} /></div>
      </div>
      {params.error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{params.error}</div> : null}
      <Card className="p-4"><form className="flex flex-wrap items-end gap-3"><label className="grid gap-1.5 text-sm font-medium">Month<Input name="month" type="month" defaultValue={month} /></label><button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button></form></Card>
      <section className="grid gap-4 md:grid-cols-4"><Metric title="Total Purchases" value={formatCurrency(String(totals._sum.totalAmount ?? 0))} /><Metric title="Input CGST" value={formatCurrency(cgst)} /><Metric title="Input SGST" value={formatCurrency(sgst)} /><Metric title="Input IGST" value={formatCurrency(igst)} /></section>
      <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Bill No.</th><th className="p-3">Date</th><th className="p-3">Supplier</th><th className="p-3">GSTIN</th><th className="p-3">State</th><th className="p-3 text-right">Taxable</th><th className="p-3 text-right">CGST</th><th className="p-3 text-right">SGST</th><th className="p-3 text-right">IGST</th><th className="p-3 text-right">Total</th><th className="p-3">Actions</th></tr></thead><tbody>
        {purchases.map((purchase) => <tr key={purchase.id} className="border-t"><td className="p-3 font-medium">{purchase.billNumber}</td><td className="p-3">{formatDate(purchase.billDate)}</td><td className="p-3">{purchase.supplierName}</td><td className="p-3">{purchase.supplierGstin || "-"}</td><td className="p-3">{purchase.stateOfSupply}</td><td className="p-3 text-right">{formatCurrency(String(purchase.taxableAmount))}</td><td className="p-3 text-right">{formatCurrency(String(purchase.cgstAmount))}</td><td className="p-3 text-right">{formatCurrency(String(purchase.sgstAmount))}</td><td className="p-3 text-right">{formatCurrency(String(purchase.igstAmount))}</td><td className="p-3 text-right font-medium">{formatCurrency(String(purchase.totalAmount))}</td><td className="p-3"><div className="flex gap-2"><PurchaseFormDialog suppliers={suppliers} purchase={purchase} /><DeletePurchaseButton purchaseId={purchase.id} /></div></td></tr>)}
        {purchases.length === 0 ? <tr><td className="p-8 text-center text-muted-foreground" colSpan={11}>No purchase bills recorded for this month.</td></tr> : null}
      </tbody></table></div></Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) { return <Card className="p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p></Card>; }
