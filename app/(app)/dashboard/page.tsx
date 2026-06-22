import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Card, LinkButton } from "@/components/ui";
import { DashboardCharts } from "@/features/dashboard/dashboard-charts";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const [customers, invoices, currentMonth, gst, recentInvoices, recentCustomers] = await Promise.all([
    prisma.customer.count(),
    prisma.invoice.count(),
    prisma.invoice.aggregate({ where: { invoiceDate: { gte: monthStart, lte: monthEnd } }, _sum: { grandTotal: true } }),
    prisma.invoice.aggregate({ _sum: { taxAmount: true } }),
    prisma.invoice.findMany({ include: { customer: true }, orderBy: { invoiceDate: "desc" }, take: 6 }),
    prisma.customer.findMany({ orderBy: { createdAt: "desc" }, take: 6 })
  ]);

  const trendMonths = Array.from({ length: 6 }).map((_, index) => startOfMonth(subMonths(now, 5 - index)));
  const trend = await Promise.all(
    trendMonths.map(async (date) => {
      const result = await prisma.invoice.aggregate({
        where: { invoiceDate: { gte: date, lte: endOfMonth(date) } },
        _sum: { grandTotal: true, taxAmount: true },
        _count: true
      });
      return {
        label: format(date, "MMM"),
        revenue: Number(result._sum.grandTotal ?? 0),
        gst: Number(result._sum.taxAmount ?? 0),
        count: result._count
      };
    })
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Revenue, GST and recent activity at a glance.</p>
        </div>
        <LinkButton href="/invoices/new" className="w-full sm:w-auto">Create Invoice</LinkButton>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric title="Total Customers" value={customers} />
        <Metric title="Total Invoices" value={invoices} />
        <Metric title="Current Month Revenue" value={formatCurrency(String(currentMonth._sum.grandTotal ?? 0))} />
        <Metric title="Total GST Collected" value={formatCurrency(String(gst._sum.taxAmount ?? 0))} />
      </section>

      <DashboardCharts trend={trend} />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <TableTitle title="Recent Invoices" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <tbody>
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t">
                    <td className="p-3 font-medium">{invoice.invoiceNumber}</td>
                    <td className="p-3">{invoice.customer.companyName}</td>
                    <td className="p-3 text-right">{formatCurrency(String(invoice.grandTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <TableTitle title="Recently Added Customers" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <tbody>
                {recentCustomers.map((customer) => (
                  <tr key={customer.id} className="border-t">
                    <td className="p-3 font-medium">{customer.companyName}</td>
                    <td className="p-3">{customer.gstin || "-"}</td>
                    <td className="p-3 text-right">{formatDate(customer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

function TableTitle({ title }: { title: string }) {
  return <div className="border-b p-4 font-semibold">{title}</div>;
}
