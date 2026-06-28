import { InvoiceForm } from "@/features/invoices/invoice-form";
import { TemplateInvoiceForm } from "@/features/invoices/template-invoice-form";
import { createInvoice, generateInvoiceFromTemplate } from "@/server/actions/invoices";
import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/server/profile";

export default async function NewInvoicePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; duplicate?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const profileId = await getActiveProfileId();
  const [customers, templateCustomers, duplicate] = await Promise.all([
    prisma.customer.findMany({
      where: { profileId },
      include: { branches: true, templates: { where: { isActive: true } } },
      orderBy: { companyName: "asc" }
    }),
    prisma.customer.findMany({
      where: { profileId, templates: { some: { isActive: true } } },
      include: {
        branches: { orderBy: { name: "asc" } },
        templates: {
          where: { isActive: true },
          include: { items: { orderBy: [{ sortOrder: "asc" }, { srNo: "asc" }] } },
          orderBy: { name: "asc" }
        }
      },
      orderBy: { companyName: "asc" }
    }),
    params.duplicate
      ? prisma.invoice.findUnique({
          where: { id: params.duplicate },
          include: { items: { orderBy: { srNo: "asc" } } }
        })
      : null
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Invoice</h1>
        <p className="text-sm text-muted-foreground">
          Select a customer template, confirm the date, enter the monthly meter values, and generate the fixed-format bill.
        </p>
      </div>
      {params.mode === "custom" || duplicate ? (
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
          action={createInvoice}
          error={params.error}
          initialInvoice={
            duplicate
              ? {
                  invoiceNumber: "",
                  invoiceDate: new Date().toISOString().slice(0, 10),
                  customerId: duplicate.customerId,
                  status: "ISSUED",
                  notes: duplicate.notes,
                  items: duplicate.items.map((item) => ({
                    branchId: item.branchId ?? "",
                    particulars: item.particulars,
                    sacCode: item.sacCode,
                    uom: item.uom,
                    qty: Number(item.qty),
                    rate: Number(item.rate)
                  }))
                }
              : undefined
          }
        />
      ) : (
        <TemplateInvoiceForm
          customers={templateCustomers.map((customer) => ({
            id: customer.id,
            companyName: customer.companyName,
            branches: customer.branches.map((branch) => ({
              id: branch.id,
              name: branch.name,
              address: branch.address
            })),
            templates: customer.templates.map((template) => ({
              id: template.id,
              customerId: template.customerId,
              name: template.name,
              code: template.code,
              billToAddress: template.billToAddress,
              billToGstin: template.billToGstin,
              billToState: template.billToState,
              billToStateCode: template.billToStateCode,
              placeLabel: template.placeLabel,
              machineModel: template.machineModel,
              poNumber: template.poNumber,
              taxMode: template.taxMode,
              cgstRate: Number(template.cgstRate),
              sgstRate: Number(template.sgstRate),
              igstRate: Number(template.igstRate),
              items: template.items.map((item) => ({
                id: item.id,
                srNo: item.srNo,
                branchId: item.branchId,
                itemType: item.itemType,
                particulars: item.particulars,
                sacCode: item.sacCode,
                uom: item.uom,
                qty: Number(item.qty),
                rate: Number(item.rate),
                amount: Number(item.amount),
                startCount: item.startCount,
                endCount: item.endCount,
                freeQty: item.freeQty === null ? null : Number(item.freeQty)
              }))
            }))
          }))}
          action={generateInvoiceFromTemplate}
          error={params.error}
        />
      )}
    </div>
  );
}
