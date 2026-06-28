import { redirect } from "next/navigation";
import { InvoiceForm } from "@/features/invoices/invoice-form";
import { updateInvoice } from "@/server/actions/invoices";
import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/server/profile";

export default async function EditInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const profileId = await getActiveProfileId();
  const [invoice, customers] = await Promise.all([
    prisma.invoice.findFirst({ where: { id, profileId }, include: { items: { orderBy: { srNo: "asc" } } } }),
    prisma.customer.findMany({
      where: { profileId },
      include: { branches: true, templates: { where: { isActive: true } } },
      orderBy: { companyName: "asc" }
    })
  ]);
  if (!invoice) redirect("/invoices");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Invoice</h1>
        <p className="text-sm text-muted-foreground">Update invoice details and line items.</p>
      </div>
      <InvoiceForm
        customers={customers.map((customer) => ({
          id: customer.id,
          companyName: customer.companyName,
          gstin: customer.gstin,
          state: customer.state,
          stateCode: customer.stateCode,
          branches: customer.branches.map((branch) => ({
            id: branch.id,
            name: branch.name,
            address: branch.address
          })),
          templates: customer.templates.map((template) => ({
            id: template.id,
            name: template.name,
            code: template.code,
            billToName: template.billToName,
            billToAddress: template.billToAddress,
            billToGstin: template.billToGstin,
            billToState: template.billToState,
            billToStateCode: template.billToStateCode
          }))
        }))}
        action={updateInvoice.bind(null, invoice.id)}
        error={query.error}
        initialInvoice={{
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          customerId: invoice.customerId,
          status: invoice.status,
          notes: invoice.notes,
          sourceTemplateId: invoice.sourceTemplateId,
          items: invoice.items.map((item) => ({
            branchId: item.branchId ?? "",
            particulars: item.particulars,
            sacCode: item.sacCode,
            uom: item.uom,
            qty: Number(item.qty),
            rate: Number(item.rate)
          }))
        }}
      />
    </div>
  );
}
