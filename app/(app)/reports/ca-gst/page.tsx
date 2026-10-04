import { endOfMonth, startOfMonth } from "date-fns";
import { Card, Input, LinkButton } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/server/profile";

function selectedMonth(value?: string) { return /^\d{4}-\d{2}$/.test(value ?? "") ? value! : new Date().toISOString().slice(0, 7); }
function value(amount: unknown) { return Number(amount ?? 0); }

export default async function CaGstReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const month = selectedMonth(params.month);
  const date = new Date(`${month}-01T00:00:00`);
  const profileId = await getActiveProfileId();
  const range = { gte: startOfMonth(date), lte: endOfMonth(date) };
  const [sales, purchases] = await Promise.all([
    prisma.invoice.aggregate({ where: { profileId, status: { not: "CANCELLED" }, invoiceDate: range }, _sum: { subtotal: true, cgstAmount: true, sgstAmount: true, igstAmount: true, grandTotal: true } }),
    prisma.purchase.aggregate({ where: { profileId, billDate: range }, _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, totalAmount: true } })
  ]);
  const output = { taxable: value(sales._sum.subtotal), cgst: value(sales._sum.cgstAmount), sgst: value(sales._sum.sgstAmount), igst: value(sales._sum.igstAmount), total: value(sales._sum.grandTotal) };
  const input = { taxable: value(purchases._sum.taxableAmount), cgst: value(purchases._sum.cgstAmount), sgst: value(purchases._sum.sgstAmount), igst: value(purchases._sum.igstAmount), total: value(purchases._sum.totalAmount) };
  const net = { cgst: output.cgst - input.cgst, sgst: output.sgst - input.sgst, igst: output.igst - input.igst };
  const netTotal = net.cgst + net.sgst + net.igst;
  return <div className="grid gap-6"><div className="grid gap-3 sm:flex sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold">CA Monthly GST Report</h1><p className="text-sm text-muted-foreground">Output GST, input tax credit, and a CA-ready Excel workbook.</p></div><LinkButton href={`/reports/ca-gst/export?month=${month}`}>Download Excel</LinkButton></div><Card className="p-4"><form className="flex flex-wrap items-end gap-3"><label className="grid gap-1.5 text-sm font-medium">Month<Input name="month" type="month" defaultValue={month} /></label><button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button></form></Card><section className="grid gap-4 lg:grid-cols-3"><Summary title="Sales / Output Tax" values={output} /><Summary title="Purchases / Input Credit" values={input} /><Card className="p-4"><h2 className="font-semibold">Net Tax Liability</h2><div className="mt-4 grid gap-3 text-sm"><Row label="Net CGST" amount={net.cgst} /><Row label="Net SGST" amount={net.sgst} /><Row label="Net IGST" amount={net.igst} /><Row label={netTotal >= 0 ? "Total Payable" : "Credit Carry Forward"} amount={Math.abs(netTotal)} strong /></div></Card></section><Card className="p-4 text-sm text-muted-foreground">The workbook includes sales, purchases, and the GST summary in one worksheet for {new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date)}. Cancelled sales invoices are excluded.</Card></div>;
}
function Summary({ title, values }: { title: string; values: { taxable: number; cgst: number; sgst: number; igst: number; total: number } }) { return <Card className="p-4"><h2 className="font-semibold">{title}</h2><div className="mt-4 grid gap-3 text-sm"><Row label="Taxable Value" amount={values.taxable} /><Row label="CGST" amount={values.cgst} /><Row label="SGST" amount={values.sgst} /><Row label="IGST" amount={values.igst} /><Row label="Bill Amount" amount={values.total} strong /></div></Card>; }
function Row({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) { return <div className={strong ? "flex justify-between border-t pt-2 font-semibold" : "flex justify-between"}><span>{label}</span><span>{formatCurrency(amount)}</span></div>; }
