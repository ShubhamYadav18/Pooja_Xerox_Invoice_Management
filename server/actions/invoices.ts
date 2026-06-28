"use server";

import { Prisma, TaxMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validations";
import { writeAudit } from "@/server/audit";
import { requireAdmin } from "@/server/authz";
import { getActiveProfile, getActiveProfileId, getActiveSettings } from "@/server/profile";

async function getNextInvoiceNumber(profileId: string) {
  const profile = await prisma.businessProfile.findUniqueOrThrow({ where: { id: profileId } });
  const invoices = await prisma.invoice.findMany({
    where: { profileId },
    select: { invoiceNumber: true }
  });
  const lastNumber = invoices.reduce((max, invoice) => {
    if (!/^\d+$/.test(invoice.invoiceNumber)) return max;
    return Math.max(max, Number(invoice.invoiceNumber));
  }, profile.invoiceNumberFloor);

  return String(lastNumber + 1);
}

function getBillingMonth(invoiceDate: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  }).format(invoiceDate);
}

function parseInvoiceForm(formData: FormData) {
  const raw = {
    invoiceNumber: formData.get("invoiceNumber"),
    invoiceDate: formData.get("invoiceDate"),
    customerId: formData.get("customerId"),
    notes: formData.get("notes"),
    status: formData.get("status") || "ISSUED",
    sourceTemplateId: formData.get("sourceTemplateId") || undefined,
    items: JSON.parse(String(formData.get("items") ?? "[]")) as unknown
  };
  return invoiceSchema.parse(raw);
}

export async function createInvoice(formData: FormData) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const input = parseInvoiceForm(formData);
  const settings = await getActiveSettings();
  const cgstRate = Number(settings?.cgstPercent ?? 9);
  const sgstRate = Number(settings?.sgstPercent ?? 9);
  const totals = calculateInvoiceTotals(input.items, cgstRate, sgstRate);

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    include: { branches: true }
  });

  let billToName = customer.companyName;
  let billToAddress = customer.branches[0]?.address ?? customer.state;
  let billToGstin = customer.gstin;
  let billToState = customer.state;
  let billToStateCode = customer.stateCode;
  let sourceTemplateId = input.sourceTemplateId || undefined;
  let placeLabel = null;
  let machineModel = null;
  let poNumber = null;
  let taxMode: TaxMode = "CGST_SGST";

  if (input.sourceTemplateId) {
    const template = await prisma.invoiceTemplate.findUnique({
      where: { id: input.sourceTemplateId }
    });
    if (template) {
      billToName = template.billToName;
      billToAddress = template.billToAddress;
      billToGstin = template.billToGstin;
      billToState = template.billToState;
      billToStateCode = template.billToStateCode;
      placeLabel = template.placeLabel;
      machineModel = template.machineModel;
      poNumber = template.poNumber;
      taxMode = template.taxMode;
    }
  }

  try {
    const invoice = await prisma.invoice.create({
      data: {
        profileId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        customerId: input.customerId,
        sourceTemplateId,
        billToName,
        billToAddress,
        billToGstin,
        billToState,
        billToStateCode,
        placeLabel,
        machineModel,
        poNumber,
        taxMode,
        notes: input.notes,
        status: input.status,
        subtotal: totals.subtotal,
        cgstRate: totals.cgstRate,
        sgstRate: totals.sgstRate,
        igstRate: totals.igstRate,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal,
        amountInWords: totals.amountInWords,
        items: {
          create: input.items.map((item, index) => ({
            srNo: index + 1,
            branchId: item.branchId || undefined,
            particulars: item.particulars,
            sacCode: item.sacCode,
            uom: item.uom,
            qty: item.qty,
            rate: item.rate,
            amount: item.qty * item.rate
          }))
        }
      }
    });

    await writeAudit("CREATE", "Invoice", invoice.id, { invoiceNumber: invoice.invoiceNumber });
    revalidatePath("/invoices");
    redirect(`/invoices/${invoice.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/invoices/new?error=Invoice number already exists");
    }
    throw error;
  }
}

export async function updateInvoice(id: string, formData: FormData) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const existing = await prisma.invoice.findFirst({ where: { id, profileId } });
  if (!existing) throw new Error("Invoice not found in active profile");
  const input = parseInvoiceForm(formData);
  const settings = await getActiveSettings();
  const totals = calculateInvoiceTotals(input.items, Number(settings?.cgstPercent ?? 9), Number(settings?.sgstPercent ?? 9));

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    include: { branches: true }
  });

  let billToName = customer.companyName;
  let billToAddress = customer.branches[0]?.address ?? customer.state;
  let billToGstin = customer.gstin;
  let billToState = customer.state;
  let billToStateCode = customer.stateCode;
  let sourceTemplateId = input.sourceTemplateId || null;
  let placeLabel = null;
  let machineModel = null;
  let poNumber = null;
  let taxMode: TaxMode = "CGST_SGST";

  if (input.sourceTemplateId) {
    const template = await prisma.invoiceTemplate.findUnique({
      where: { id: input.sourceTemplateId }
    });
    if (template) {
      billToName = template.billToName;
      billToAddress = template.billToAddress;
      billToGstin = template.billToGstin;
      billToState = template.billToState;
      billToStateCode = template.billToStateCode;
      placeLabel = template.placeLabel;
      machineModel = template.machineModel;
      poNumber = template.poNumber;
      taxMode = template.taxMode;
    }
  }

  try {
    await prisma.$transaction([
      prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.update({
        where: { id },
        data: {
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          customerId: input.customerId,
          sourceTemplateId,
          billToName,
          billToAddress,
          billToGstin,
          billToState,
          billToStateCode,
          placeLabel,
          machineModel,
          poNumber,
          taxMode,
          notes: input.notes,
          status: input.status,
          subtotal: totals.subtotal,
          cgstRate: totals.cgstRate,
          sgstRate: totals.sgstRate,
          igstRate: totals.igstRate,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          taxAmount: totals.taxAmount,
          grandTotal: totals.grandTotal,
          amountInWords: totals.amountInWords,
          items: {
            create: input.items.map((item, index) => ({
              srNo: index + 1,
              branchId: item.branchId || undefined,
              particulars: item.particulars,
              sacCode: item.sacCode,
              uom: item.uom,
              qty: item.qty,
              rate: item.rate,
              amount: item.qty * item.rate
            }))
          }
        }
      })
    ]);
    await writeAudit("UPDATE", "Invoice", id, { invoiceNumber: input.invoiceNumber });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    redirect(`/invoices/${id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/invoices/${id}/edit?error=Invoice number already exists`);
    }
    throw error;
  }
}

export async function deleteInvoice(id: string) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const existing = await prisma.invoice.findFirst({ where: { id, profileId } });
  if (!existing) throw new Error("Invoice not found in active profile");
  await prisma.invoice.delete({ where: { id } });
  await writeAudit("DELETE", "Invoice", id);
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function generateInvoiceFromTemplate(formData: FormData) {
  await requireAdmin();
  const profileId = await getActiveProfileId();

  const invoiceDate = new Date(String(formData.get("invoiceDate") ?? ""));
  const templateId = String(formData.get("templateId") ?? "");
  const billingMonth = getBillingMonth(Number.isNaN(invoiceDate.getTime()) ? new Date() : invoiceDate);

  if (!templateId || Number.isNaN(invoiceDate.getTime())) {
    redirect("/invoices/new?error=Invoice date and template are required");
  }

  const template = await prisma.invoiceTemplate.findUnique({
    where: { id: templateId },
    include: {
      customer: true,
      items: { include: { branch: true }, orderBy: [{ sortOrder: "asc" }, { srNo: "asc" }] }
    }
  });

  if (!template) {
    redirect("/invoices/new?error=Selected template was not found");
  }

  const missingMeterReading = template.items.some((item) => {
    if (item.itemType !== "METER") return false;
    const startRaw = formData.get(`startCount:${item.id}`);
    const endRaw = formData.get(`endCount:${item.id}`);
    return startRaw === null || startRaw === "" || endRaw === null || endRaw === "";
  });

  if (missingMeterReading) {
    redirect("/invoices/new?error=Please enter start and end readings for all meter rows");
  }

  let generatedItems = template.items.map((item) => {
    const startRaw = formData.get(`startCount:${item.id}`);
    const endRaw = formData.get(`endCount:${item.id}`);
    const qtyRaw = formData.get(`qty:${item.id}`);
    const rateRaw = formData.get(`rate:${item.id}`);

    const startCount = startRaw === null || startRaw === "" ? null : Number(startRaw);
    const endCount = endRaw === null || endRaw === "" ? null : Number(endRaw);
    const rate = rateRaw === null || rateRaw === "" ? Number(item.rate) : Number(rateRaw);

    let qty = qtyRaw === null || qtyRaw === "" ? Number(item.qty) : Number(qtyRaw);
    if (item.itemType === "METER" && startCount !== null && startCount !== undefined && endCount !== null && endCount !== undefined) {
      qty = Math.max(0, Number(endCount) - Number(startCount) - Number(item.freeQty ?? 0));
    }

    const amount = item.itemType === "TEXT" ? 0 : item.itemType === "FIXED" ? Number(item.amount) : qty * rate;
    const countLine =
      item.itemType === "METER" && startCount !== null && startCount !== undefined && endCount !== null && endCount !== undefined
        ? `\nStart Count: ${startCount}   End Count: ${endCount}`
        : "";
    const freeLine = item.itemType === "METER" && Number(item.freeQty ?? 0) > 0 ? `\nLess Free Copies: ${item.freeQty}` : "";
    const monthLine = billingMonth && !item.particulars.includes("{billingMonth}") ? `\nFor the month of ${billingMonth}` : "";

    const particulars = item.particulars
      .replaceAll("{billingMonth}", billingMonth)
      .replaceAll("{periodFrom}", "")
      .replaceAll("{periodTo}", "");

    return {
      srNo: item.srNo,
      branchId: item.branchId || undefined,
      itemType: item.itemType,
      particulars: `${particulars}${countLine}${freeLine}${item.itemType === "FIXED" || item.itemType === "METER" ? monthLine : ""}`,
      sacCode: item.sacCode,
      uom: item.uom,
      startCount: startCount ?? undefined,
      endCount: endCount ?? undefined,
      freeQty: item.freeQty,
      qty,
      rate,
      amount
    };
  });

  const extraCopyEnabled = formData.get("extraCopyEnabled") === "on";
  if (extraCopyEnabled) {
    const extraCopyBranchId = String(formData.get("extraCopyBranchId") ?? "");
    const extraCopyQty = Number(formData.get("extraCopyQty") ?? 0);
    const extraCopyRate = Number(formData.get("extraCopyRate") ?? 0);

    if (!extraCopyBranchId || !Number.isFinite(extraCopyQty) || extraCopyQty <= 0 || !Number.isFinite(extraCopyRate) || extraCopyRate < 0) {
      redirect("/invoices/new?error=Please select branch, quantity and rate for extra copy");
    }

    const extraCopyBranch = await prisma.customerBranch.findFirst({
      where: { id: extraCopyBranchId, customerId: template.customerId }
    });

    if (!extraCopyBranch) {
      redirect("/invoices/new?error=Selected extra copy branch was not found");
    }

    const extraCopyItem = {
      srNo: 0,
      branchId: extraCopyBranch.id,
      itemType: "EXTRA_COPY" as const,
      particulars: `Extra Copy\nFor the month of ${billingMonth}`,
      sacCode: "997314",
      uom: "Nos",
      startCount: undefined,
      endCount: undefined,
      freeQty: null,
      qty: extraCopyQty,
      rate: extraCopyRate,
      amount: extraCopyQty * extraCopyRate
    };

    const branchRowIndex = generatedItems.findIndex((item) => item.branchId === extraCopyBranch.id);
    const insertIndex = branchRowIndex >= 0 ? branchRowIndex + 1 : generatedItems.length;
    generatedItems = [
      ...generatedItems.slice(0, insertIndex),
      extraCopyItem,
      ...generatedItems.slice(insertIndex)
    ].map((item, index) => ({ ...item, srNo: index + 1 }));
  } else {
    generatedItems = generatedItems.map((item, index) => ({ ...item, srNo: index + 1 }));
  }

  const taxableItems = generatedItems.filter((item) => item.itemType !== "TEXT");
  const totals = calculateInvoiceTotals(
    taxableItems,
    Number(template.cgstRate),
    Number(template.sgstRate),
    template.taxMode,
    Number(template.igstRate)
  );

  try {
    const invoiceNumber = await getNextInvoiceNumber(profileId);
    const invoice = await prisma.invoice.create({
      data: {
        profileId,
        invoiceNumber,
        invoiceDate,
        customerId: template.customerId,
        sourceTemplateId: template.id,
        billingMonth,
        billToName: template.billToName,
        billToAddress: template.billToAddress,
        billToGstin: template.billToGstin,
        billToState: template.billToState,
        billToStateCode: template.billToStateCode,
        placeLabel: template.placeLabel,
        machineModel: template.machineModel,
        poNumber: template.poNumber,
        taxMode: template.taxMode,
        notes: template.description,
        status: "ISSUED",
        subtotal: totals.subtotal,
        cgstRate: totals.cgstRate,
        sgstRate: totals.sgstRate,
        igstRate: totals.igstRate,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal,
        amountInWords: totals.amountInWords,
        items: {
          create: generatedItems.map((item) => ({
            srNo: item.srNo,
            branchId: item.branchId,
            itemType: item.itemType,
            particulars: item.particulars,
            sacCode: item.sacCode,
            uom: item.uom,
            startCount: item.startCount,
            endCount: item.endCount,
            freeQty: Number(item.freeQty ?? 0) || undefined,
            qty: item.qty,
            rate: item.rate,
            amount: item.amount
          }))
        }
      }
    });

    await writeAudit("CREATE", "Invoice", invoice.id, {
      invoiceNumber: invoice.invoiceNumber,
      sourceTemplateId: template.id
    });
    revalidatePath("/invoices");
    redirect(`/invoices/${invoice.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/invoices/new?error=Invoice number already exists");
    }
    throw error;
  }
}
