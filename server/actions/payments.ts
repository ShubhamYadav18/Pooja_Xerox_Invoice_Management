"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/server/audit";
import { requireAdmin } from "@/server/authz";
import { getActiveProfileId } from "@/server/profile";

export async function confirmInvoicePayment(invoiceId: string, formData: FormData) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, profileId } });
  if (!invoice) throw new Error("Invoice not found in active profile");

  const paidAtValue = String(formData.get("paidAt") ?? "");
  const paymentMode = String(formData.get("paymentMode") ?? "").trim();
  const paymentReference = String(formData.get("paymentReference") ?? "").trim();
  const paidAt = paidAtValue ? new Date(paidAtValue) : new Date();

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paymentStatus: "PAID",
      paidAt,
      paymentMode: paymentMode || undefined,
      paymentReference: paymentReference || undefined
    }
  });

  await writeAudit("UPDATE", "InvoicePayment", invoiceId, { paymentStatus: "PAID" });
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect("/payments");
}

export async function markInvoiceUnpaid(invoiceId: string) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, profileId } });
  if (!invoice) throw new Error("Invoice not found in active profile");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paymentStatus: "UNPAID",
      paidAt: null,
      paymentMode: null,
      paymentReference: null
    }
  });

  await writeAudit("UPDATE", "InvoicePayment", invoiceId, { paymentStatus: "UNPAID" });
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect("/payments");
}
