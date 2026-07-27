"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { branchSchema, customerSchema, templateSchema, templateItemSchema } from "@/lib/validations";
import { writeAudit } from "@/server/audit";
import { requireAdmin } from "@/server/authz";
import { getActiveProfileId } from "@/server/profile";

export async function createCustomer(formData: FormData) {
  await requireAdmin();
  const profileId = await getActiveProfileId();
  const parsed = customerSchema.parse(Object.fromEntries(formData));
  const customer = await prisma.customer.create({ data: { ...parsed, profileId } });
  await writeAudit("CREATE", "Customer", customer.id, { companyName: customer.companyName });
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = customerSchema.parse(Object.fromEntries(formData));
  await prisma.customer.update({ where: { id }, data: parsed });
  await writeAudit("UPDATE", "Customer", id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  await requireAdmin();
  try {
    await prisma.customer.delete({ where: { id } });
    await writeAudit("DELETE", "Customer", id);
    revalidatePath("/customers");
    redirect("/customers");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      redirect(`/customers/${id}?error=Customer has invoices and cannot be deleted`);
    }
    throw error;
  }
}

export async function createBranch(formData: FormData) {
  await requireAdmin();
  const parsed = branchSchema.parse(Object.fromEntries(formData));
  const branch = await prisma.customerBranch.create({ data: parsed });
  await writeAudit("CREATE", "CustomerBranch", branch.id, { customerId: branch.customerId });
  revalidatePath(`/customers/${branch.customerId}`);
}

export async function updateBranch(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = branchSchema.parse(Object.fromEntries(formData));
  const branch = await prisma.customerBranch.update({ where: { id }, data: parsed });
  await writeAudit("UPDATE", "CustomerBranch", branch.id, { customerId: branch.customerId });
  revalidatePath(`/customers/${branch.customerId}`);
}

export async function deleteBranch(id: string, customerId: string) {
  await requireAdmin();
  await prisma.customerBranch.delete({ where: { id } });
  await writeAudit("DELETE", "CustomerBranch", id, { customerId });
  revalidatePath(`/customers/${customerId}`);
}

export async function updateTemplate(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = templateSchema.parse(Object.fromEntries(formData));
  const template = await prisma.invoiceTemplate.update({
    where: { id },
    data: parsed
  });
  await writeAudit("UPDATE", "InvoiceTemplate", id, { name: template.name });
  revalidatePath(`/customers/${template.customerId}`);
}

export async function updateTemplateItem(id: string, formData: FormData) {
  await requireAdmin();
  const data = {
    particulars: String(formData.get("particulars") ?? ""),
    sacCode: String(formData.get("sacCode") ?? "997314"),
    uom: String(formData.get("uom") ?? ""),
    qty: Number(formData.get("qty") ?? 1),
    rate: Number(formData.get("rate") ?? 0),
    amount: Number(formData.get("amount") ?? 0),
    branchId: formData.get("branchId") ? String(formData.get("branchId")) : undefined,
    itemType: (formData.get("itemType") as "FIXED" | "METER" | "EXTRA_COPY" | "TEXT") ?? "FIXED"
  };
  data.amount = data.qty * data.rate;
  const item = await prisma.invoiceTemplateItem.update({ where: { id }, data });
  const template = await prisma.invoiceTemplate.findUnique({ where: { id: item.templateId }, select: { customerId: true } });
  await writeAudit("UPDATE", "InvoiceTemplateItem", id, { templateId: item.templateId });
  if (template) revalidatePath(`/customers/${template.customerId}`);
}

export async function addTemplateItem(formData: FormData) {
  await requireAdmin();
  const parsed = templateItemSchema.parse(Object.fromEntries(formData));
  parsed.amount = parsed.qty * parsed.rate;
  const lastItem = await prisma.invoiceTemplateItem.findFirst({
    where: { templateId: parsed.templateId },
    orderBy: { srNo: "desc" }
  });
  const item = await prisma.invoiceTemplateItem.create({
    data: {
      ...parsed,
      branchId: parsed.branchId || undefined,
      srNo: (lastItem?.srNo ?? 0) + 1,
      sortOrder: (lastItem?.sortOrder ?? 0) + 1
    }
  });
  const template = await prisma.invoiceTemplate.findUnique({ where: { id: parsed.templateId }, select: { customerId: true } });
  await writeAudit("CREATE", "InvoiceTemplateItem", item.id, { templateId: parsed.templateId });
  if (template) revalidatePath(`/customers/${template.customerId}`);
}

export async function deleteTemplateItem(id: string, templateId: string) {
  await requireAdmin();
  await prisma.invoiceTemplateItem.delete({ where: { id } });
  const template = await prisma.invoiceTemplate.findUnique({ where: { id: templateId }, select: { customerId: true } });
  await writeAudit("DELETE", "InvoiceTemplateItem", id, { templateId });
  if (template) revalidatePath(`/customers/${template.customerId}`);
}

export async function deleteTemplate(id: string) {
  await requireAdmin();
  const template = await prisma.invoiceTemplate.findUnique({
    where: { id },
    select: { customerId: true, _count: { select: { invoices: true } } }
  });
  if (!template) throw new Error("Template not found");
  if (template._count.invoices > 0) {
    redirect(`/customers/${template.customerId}?error=Template has invoices and cannot be deleted. Deactivate it instead.`);
  }
  await prisma.invoiceTemplateItem.deleteMany({ where: { templateId: id } });
  await prisma.invoiceTemplate.delete({ where: { id } });
  await writeAudit("DELETE", "InvoiceTemplate", id);
  revalidatePath(`/customers/${template.customerId}`);
}

