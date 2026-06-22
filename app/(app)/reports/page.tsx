import Link from "next/link";
import { differenceInCalendarDays, endOfYear, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { Card, Input, LinkButton } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const range = {
    gte: params.from ? new Date(params.from) : undefined,
    lte: params.to ? new Date(`${params.to}T23:59:59`) : undefined
  };
  const where = {
    status: { not: "CANCELLED" as const },
    ...(params.from || params.to ? { invoiceDate: range } : {})
  };

  const [invoices, monthly, quarterly, yearly] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { customer: true },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.invoice.aggregate({
      where: { status: { not: "CANCELLED" }, invoiceDate: { gte: startOfMonth(now) } },
      _sum: { grandTotal: true }
    }),
    prisma.invoice.aggregate({
      where: { status: { not: "CANCELLED" }, invoiceDate: { gte: startOfQuarter(now) } },
      _sum: { grandTotal: true }
    }),
    prisma.invoice.aggregate({
      where: { status: { not: "CANCELLED" }, invoiceDate: { gte: startOfYear(now), lte: endOfYear(now) } },
      _sum: { grandTotal: true }
    })
  ]);

  const totalBilled = sum(invoices, "grandTotal");
  const taxableAmount = sum(invoices, "subtotal");
  const cgst = sum(invoices, "cgstAmount");
  const sgst = sum(invoices, "sgstAmount");
  const igst = sum(invoices, "igstAmount");
  const totalGst = sum(invoices, "taxAmount");
  const paidInvoices = invoices.filter((invoice) => invoice.paymentStatus === "PAID");
  const unpaidInvoices = invoices.filter((invoice) => invoice.paymentStatus === "UNPAID");
  const paidAmount = sum(paidInvoices, "grandTotal");
  const outstandingAmount = sum(unpaidInvoices, "grandTotal");
  const collectionRate = totalBilled > 0 ? Math.round((paidAmount / totalBilled) * 100) : 0;
  const oldestOutstanding = unpaidInvoices.reduce((oldest, invoice) => {
    const age = differenceInCalendarDays(now, invoice.invoiceDate);
    return Math.max(oldest, age);
  }, 0);
  const outstandingInvoices = [...unpaidInvoices]
    .sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 10);
  const agingBuckets = [
    buildAgingBucket(unpaidInvoices, now, "0-15 days", 0, 15),
    buildAgingBucket(unpaidInvoices, now, "16-30 days", 16, 30),
    buildAgingBucket(unpaidInvoices, now, "31-60 days", 31, 60),
    buildAgingBucket(unpaidInvoices, now, "60+ days", 61)
  ];
  const customerRows = buildCustomerRows(invoices).slice(0, 8);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Revenue, payment collection, GST, and customer follow-up in one place.</p>
        </div>
        <div className="grid gap-2 sm:flex">
          <LinkButton href={`/reports/export?from=${params.from ?? ""}&to=${params.to ?? ""}&format=csv`} variant="secondary" className="w-full sm:w-auto">Export CSV</LinkButton>
          <LinkButton href={`/reports/export?from=${params.from ?? ""}&to=${params.to ?? ""}&format=xls`} variant="secondary" className="w-full sm:w-auto">Export Excel</LinkButton>
        </div>
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <Input name="from" type="date" defaultValue={params.from} />
          <Input name="to" type="date" defaultValue={params.to} />
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply Range</button>
          <LinkButton href="/reports" variant="secondary" className="w-full md:w-auto">Clear</LinkButton>
        </form>
      </Card>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric title="Total Billed" value={formatCurrency(totalBilled)} note={`${invoices.length} invoices`} />
        <Metric title="Payment Received" value={formatCurrency(paidAmount)} note={`${paidInvoices.length} paid`} />
        <Metric title="Outstanding" value={formatCurrency(outstandingAmount)} note={`${unpaidInvoices.length} unpaid`} tone="warning" />
        <Metric title="Collection Rate" value={`${collectionRate}%`} note="Paid vs billed" />
        <Metric title="Oldest Pending" value={`${oldestOutstanding} days`} note="Unpaid invoice age" tone={oldestOutstanding > 30 ? "warning" : "default"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-4">
          <h2 className="font-semibold">GST Summary</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <ReportRow label="Taxable Amount" value={formatCurrency(taxableAmount)} />
            <ReportRow label="CGST" value={formatCurrency(cgst)} />
            <ReportRow label="SGST" value={formatCurrency(sgst)} />
            <ReportRow label="IGST" value={formatCurrency(igst)} />
            <ReportRow label="Total GST" value={formatCurrency(totalGst)} strong />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold">Quick Revenue View</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <MiniMetric title="This Month" value={formatCurrency(String(monthly._sum.grandTotal ?? 0))} />
            <MiniMetric title="This Quarter" value={formatCurrency(String(quarterly._sum.grandTotal ?? 0))} />
            <MiniMetric title="This Year" value={formatCurrency(String(yearly._sum.grandTotal ?? 0))} />
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <ReportRow label="Average Invoice Value" value={formatCurrency(invoices.length ? totalBilled / invoices.length : 0)} />
            <ReportRow label="Average Outstanding Invoice" value={formatCurrency(unpaidInvoices.length ? outstandingAmount / unpaidInvoices.length : 0)} />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {agingBuckets.map((bucket) => (
          <Card key={bucket.label} className="p-4">
            <p className="text-sm text-muted-foreground">{bucket.label}</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(bucket.amount)}</p>
            <p className="mt-1 text-sm">{bucket.count} invoices</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="border-b p-4">
            <h2 className="font-semibold">Follow Up First</h2>
            <p className="text-sm text-muted-foreground">Oldest unpaid invoices in the selected range.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Age</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {outstandingInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t">
                    <td className="p-3 font-medium">
                      <Link href={`/invoices/${invoice.id}`} className="text-primary hover:underline">
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="p-3">{invoice.customer.companyName}</td>
                    <td className="p-3">{formatDate(invoice.invoiceDate)}</td>
                    <td className="p-3">{differenceInCalendarDays(now, invoice.invoiceDate)} days</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(String(invoice.grandTotal))}</td>
                  </tr>
                ))}
                {outstandingInvoices.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                      No unpaid invoices in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b p-4">
            <h2 className="font-semibold">Customer Summary</h2>
            <p className="text-sm text-muted-foreground">Top customers by billed amount.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-right">Billed</th>
                  <th className="p-3 text-right">Pending</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.map((row) => (
                  <tr key={row.customerId} className="border-t">
                    <td className="p-3">
                      <p className="font-medium">{row.customerName}</p>
                      <p className="text-xs text-muted-foreground">{row.invoiceCount} invoices</p>
                    </td>
                    <td className="p-3 text-right">{formatCurrency(row.billed)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(row.outstanding)}</td>
                  </tr>
                ))}
                {customerRows.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-muted-foreground" colSpan={3}>
                      No customer data in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function sum<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function buildAgingBucket(
  invoices: { invoiceDate: Date; grandTotal: unknown }[],
  now: Date,
  label: string,
  minDays: number,
  maxDays?: number
) {
  const rows = invoices.filter((invoice) => {
    const age = differenceInCalendarDays(now, invoice.invoiceDate);
    return age >= minDays && (maxDays === undefined || age <= maxDays);
  });

  return {
    label,
    count: rows.length,
    amount: sum(rows, "grandTotal")
  };
}

function buildCustomerRows(
  invoices: {
    customerId: string;
    customer: { companyName: string };
    grandTotal: unknown;
    paymentStatus: "PAID" | "UNPAID";
  }[]
) {
  const rows = new Map<string, { customerId: string; customerName: string; billed: number; outstanding: number; invoiceCount: number }>();

  invoices.forEach((invoice) => {
    const current =
      rows.get(invoice.customerId) ??
      {
        customerId: invoice.customerId,
        customerName: invoice.customer.companyName,
        billed: 0,
        outstanding: 0,
        invoiceCount: 0
      };
    const amount = Number(invoice.grandTotal);
    current.billed += amount;
    current.invoiceCount += 1;
    if (invoice.paymentStatus === "UNPAID") current.outstanding += amount;
    rows.set(invoice.customerId, current);
  });

  return Array.from(rows.values()).sort((a, b) => b.billed - a.billed);
}

function Metric({
  title,
  value,
  note,
  tone = "default"
}: {
  title: string;
  value: React.ReactNode;
  note?: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card className={tone === "warning" ? "border-amber-300 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100" : "p-4"}>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
    </Card>
  );
}

function MiniMetric({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function ReportRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-3 font-semibold" : "flex justify-between"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
