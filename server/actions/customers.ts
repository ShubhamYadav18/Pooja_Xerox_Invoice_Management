"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { branchSchema, customerSchema } from "@/lib/validations";
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
