import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, LinkButton } from "@/components/ui";
import { InvoiceTemplate } from "@/features/invoices/invoice-template";
import { PdfActions } from "@/features/invoices/pdf-actions";
import { deleteInvoice } from "@/server/actions/invoices";
import { prisma } from "@/lib/prisma";
import { getActiveProfileId, getActiveSettings } from "@/server/profile";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profileId = await getActiveProfileId();
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, profileId },
      include: {
        customer: true,
        items: { include: { branch: true }, orderBy: { srNo: "asc" } }
      }
    }),
    getActiveSettings()
  ]);
  if (!invoice) redirect("/invoices");
  if (!settings) notFound();

  return (
    <div>
      <div className="no-print mb-6 grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoice {invoice.invoiceNumber}</h1>
          <p className="text-sm text-muted-foreground">{invoice.customer.companyName}</p>
        </div>
        <div className="grid gap-2 sm:flex">
          <LinkButton href={`/invoices/${invoice.id}/edit`} variant="secondary" className="w-full sm:w-auto">Edit</LinkButton>
          <LinkButton href={`/invoices/new?duplicate=${invoice.id}`} variant="secondary" className="w-full sm:w-auto">Duplicate</LinkButton>
          <form action={deleteInvoice.bind(null, invoice.id)}>
            <Button variant="danger" className="w-full sm:w-auto">Delete</Button>
          </form>
        </div>
      </div>
      <PdfActions invoiceNumber={invoice.invoiceNumber} />
      <div id="invoice-preview" className="invoice-preview-mobile">
        <InvoiceTemplate invoice={invoice} settings={settings} />
      </div>
      <div className="no-print mt-4">
        <Link href="/invoices" className="text-sm text-primary hover:underline">Back to invoices</Link>
      </div>
    </div>
  );
}
