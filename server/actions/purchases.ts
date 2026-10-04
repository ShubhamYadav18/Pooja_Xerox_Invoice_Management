"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { purchaseSchema } from "@/lib/validations";
import { writeAudit } from "@/server/audit";
import { requireAdmin } from "@/server/authz";
import { getActiveProfileId } from "@/server/profile";

function parsePurchaseForm(formData: FormData) {
  return purchaseSchema.parse({
    billNumber: formData.get("billNumber"),
    billDate: formData.get("billDate"),
    supplierName: formData.get("supplierName"),
    supplierGstin: formData.get("supplierGstin") || undefined,
    stateOfSupply: formData.get("stateOfSupply"),
    taxableAmount: formData.get("taxableAmount"),
    notes: formData.get("notes") || undefined,
    saveSupplier: formData.get("saveSupplier") === "on"
  });
}

function calculatePurchaseTax(taxableAmount: number, stateOfSupply: string) {
  const isMaharashtra = stateOfSupply.trim().toLowerCase() === "maharashtra";
  const cgstAmount = isMaharashtra ? round(taxableAmount * 0.09) : 0;
  const sgstAmount = isMaharashtra ? round(taxableAmount * 0.09) : 0;
  const igstAmount = isMaharashtra ? 0 : round(taxableAmount * 0.18);
  return {
    taxMode: isMaharashtra ? "CGST_SGST" as const : "IGST" as const,
    cgstRate: isMaharashtra ? 9 : 0,
    sgstRate: isMaharashtra ? 9 : 0,
    igstRate: isMaharashtra ? 0 : 18,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: round(taxableAmount + cgstAmount + sgstAmount + igstAmount)
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function saveSupplier(profileId: string, input: ReturnType<typeof parsePurchaseForm>) {
  if (!input.saveSupplier) return;
  await prisma.supplier.upsert({
    where: { profileId_name: { profileId, name: input.supplierName } },
    create: { profileId, name: input.supplierName, gstin: input.supplierGstin || null, state: input.stateOfSupply },
    update: { gstin: input.supplierGstin || null, state: input.stateOfSupply }
  });
}

export async function createPurchase(formData: FormData) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const input = parsePurchaseForm(formData);
  const tax = calculatePurchaseTax(input.taxableAmount, input.stateOfSupply);
  const { saveSupplier: shouldSaveSupplier, ...purchaseInput } = input;

  try {
    const purchase = await prisma.purchase.create({
      data: { profileId, ...purchaseInput, supplierGstin: input.supplierGstin || null, notes: input.notes || null, ...tax }
    });
    await saveSupplier(profileId, input);
    await writeAudit("CREATE", "Purchase", purchase.id, { billNumber: purchase.billNumber, supplierName: purchase.supplierName });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/purchases?error=A purchase bill with this supplier and bill number already exists");
    }
    throw error;
  }

  revalidatePath("/purchases");
  revalidatePath("/reports/ca-gst");
  redirect("/purchases");
}

export async function updatePurchase(id: string, formData: FormData) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const existing = await prisma.purchase.findFirst({ where: { id, profileId } });
  if (!existing) throw new Error("Purchase bill not found in active profile");
  const input = parsePurchaseForm(formData);
  const tax = calculatePurchaseTax(input.taxableAmount, input.stateOfSupply);
  const { saveSupplier: shouldSaveSupplier, ...purchaseInput } = input;

  try {
    await prisma.purchase.update({
      where: { id },
      data: { ...purchaseInput, supplierGstin: input.supplierGstin || null, notes: input.notes || null, ...tax }
    });
    await saveSupplier(profileId, input);
    await writeAudit("UPDATE", "Purchase", id, { billNumber: input.billNumber, supplierName: input.supplierName });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/purchases?error=A purchase bill with this supplier and bill number already exists");
    }
    throw error;
  }

  revalidatePath("/purchases");
  revalidatePath("/reports/ca-gst");
  redirect("/purchases");
}

export async function deletePurchase(id: string) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const existing = await prisma.purchase.findFirst({ where: { id, profileId } });
  if (!existing) throw new Error("Purchase bill not found in active profile");
  await prisma.purchase.delete({ where: { id } });
  await writeAudit("DELETE", "Purchase", id, { billNumber: existing.billNumber, supplierName: existing.supplierName });
  revalidatePath("/purchases");
  revalidatePath("/reports/ca-gst");
}
