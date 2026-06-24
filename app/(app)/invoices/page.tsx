import Link from "next/link";
import { Card, Input, LinkButton, Select } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getActiveProfileId } from "@/server/profile";

export default async function InvoicesPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    customerId?: string;
    status?: "DRAFT" | "ISSUED" | "CANCELLED";
    from?: string;
    to?: string;
    minAmount?: string;
    maxAmount?: string;
  }>;
}) {
  const params = await searchParams;
  const profileId = await getActiveProfileId();
  const customers = await prisma.customer.findMany({
    where: { profileId },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true }
  });
  const invoices = await prisma.invoice.findMany({
    where: {
      profileId,
      AND: [
        params.customerId ? { customerId: params.customerId } : {},
        params.status ? { status: params.status } : {},
        params.from || params.to
          ? {
              invoiceDate: {
                gte: params.from ? new Date(params.from) : undefined,
                lte: params.to ? new Date(`${params.to}T23:59:59`) : undefined
              }
            }
          : {},
        params.minAmount || params.maxAmount
          ? {
              grandTotal: {
                gte: params.minAmount ? Number(params.minAmount) : undefined,
                lte: params.maxAmount ? Number(params.maxAmount) : undefined
              }
            }
          : {},
        params.q
          ? {
              OR: [
                { invoiceNumber: { contains: params.q, mode: "insensitive" } },
                { customer: { companyName: { contains: params.q, mode: "insensitive" } } },
                { customer: { gstin: { contains: params.q, mode: "insensitive" } } }
              ]
            }
          : {}
      ]
    },
    include: { customer: true },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }]
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground">View, edit, print, download and duplicate invoices.</p>
        </div>
        <LinkButton href="/invoices/new" className="w-full sm:w-auto">New Invoice</LinkButton>
      </div>
      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <form className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Input name="q" defaultValue={params.q} placeholder="Invoice, customer or GSTIN" />
            <Select name="customerId" defaultValue={params.customerId ?? ""}>
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              <option value="ISSUED">Issued</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Input name="from" type="date" defaultValue={params.from} />
            <Input name="to" type="date" defaultValue={params.to} />
            <Input name="minAmount" type="number" min="0" step="0.01" defaultValue={params.minAmount} placeholder="Min amount" />
            <div className="flex gap-2">
              <Input name="maxAmount" type="number" min="0" step="0.01" defaultValue={params.maxAmount} placeholder="Max amount" />
              <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button>
            </div>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Invoice Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Payment</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t">
                  <td className="p-3 font-medium">
                    <Link href={`/invoices/${invoice.id}`} className="text-primary hover:underline">
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="p-3">{formatDate(invoice.invoiceDate)}</td>
                  <td className="p-3">{invoice.customer.companyName}</td>
                  <td className="p-3">{formatCurrency(String(invoice.grandTotal))}</td>
                  <td className="p-3">{invoice.status}</td>
                  <td className="p-3">{invoice.paymentStatus === "PAID" ? "Paid" : "Unpaid"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
