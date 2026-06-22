import Link from "next/link";
import { Button, Card, Input, Select } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { confirmInvoicePayment, markInvoiceUnpaid } from "@/server/actions/payments";

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: "PAID" | "UNPAID"; customerId?: string }>;
}) {
  const params = await searchParams;
  const [customers, invoices, paidSummary, unpaidSummary] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true }
    }),
    prisma.invoice.findMany({
      where: {
        AND: [
          params.status ? { paymentStatus: params.status } : {},
          params.customerId ? { customerId: params.customerId } : {},
          params.q
            ? {
                OR: [
                  { invoiceNumber: { contains: params.q, mode: "insensitive" } },
                  { customer: { companyName: { contains: params.q, mode: "insensitive" } } },
                  { paymentReference: { contains: params.q, mode: "insensitive" } }
                ]
              }
            : {}
        ]
      },
      include: { customer: true },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.invoice.aggregate({ where: { paymentStatus: "PAID" }, _sum: { grandTotal: true }, _count: true }),
    prisma.invoice.aggregate({ where: { paymentStatus: "UNPAID" }, _sum: { grandTotal: true }, _count: true })
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">Confirm whether payment has been received for each invoice.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric title="Unpaid Invoices" value={unpaidSummary._count} amount={formatCurrency(String(unpaidSummary._sum.grandTotal ?? 0))} />
        <Metric title="Paid Invoices" value={paidSummary._count} amount={formatCurrency(String(paidSummary._sum.grandTotal ?? 0))} />
        <Metric title="Total Tracked" value={paidSummary._count + unpaidSummary._count} amount={formatCurrency(String(Number(paidSummary._sum.grandTotal ?? 0) + Number(unpaidSummary._sum.grandTotal ?? 0)))} />
      </section>

      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]">
            <Input name="q" defaultValue={params.q} placeholder="Invoice, customer or reference" />
            <Select name="customerId" defaultValue={params.customerId ?? ""}>
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={params.status ?? ""}>
              <option value="">All payments</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PAID">Paid</option>
            </Select>
            <Button>Filter</Button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Invoice</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Confirm</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t align-top">
                  <td className="p-3 font-medium">
                    <Link href={`/invoices/${invoice.id}`} className="text-primary hover:underline">
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="p-3">{formatDate(invoice.invoiceDate)}</td>
                  <td className="p-3">{invoice.customer.companyName}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(String(invoice.grandTotal))}</td>
                  <td className="p-3">
                    {invoice.paymentStatus === "PAID" ? (
                      <div className="grid gap-1">
                        <span className="font-semibold text-emerald-600">Paid</span>
                        <span className="text-muted-foreground">{invoice.paidAt ? formatDate(invoice.paidAt) : "-"}</span>
                        {invoice.paymentMode ? <span>{invoice.paymentMode}</span> : null}
                        {invoice.paymentReference ? <span className="text-muted-foreground">{invoice.paymentReference}</span> : null}
                      </div>
                    ) : (
                      <span className="font-semibold text-amber-600">Unpaid</span>
                    )}
                  </td>
                  <td className="p-3">
                    {invoice.paymentStatus === "PAID" ? (
                      <form action={markInvoiceUnpaid.bind(null, invoice.id)}>
                        <Button variant="secondary" className="h-9">Mark Unpaid</Button>
                      </form>
                    ) : (
                      <form action={confirmInvoicePayment.bind(null, invoice.id)} className="grid gap-2 md:grid-cols-[150px_150px_1fr_auto]">
                        <Input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                        <Select name="paymentMode" defaultValue="">
                          <option value="">Mode</option>
                          <option value="Cash">Cash</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="UPI">UPI</option>
                        </Select>
                        <Input name="paymentReference" placeholder="Reference / note" />
                        <Button className="h-10">Confirm</Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={6}>
                    No invoices found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({ title, value, amount }: { title: string; value: number; amount: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm">{amount}</p>
    </Card>
  );
}
