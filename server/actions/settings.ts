"use server";

import { revalidatePath } from "next/cache";
import { settingsSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/server/audit";
import { requireAdmin } from "@/server/authz";

export async function updateSettings(profileId: string | null, formData: FormData) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid settings");
  }

  const current = profileId
    ? await prisma.businessSettings.findFirst({ where: { profileId } })
    : await prisma.businessSettings.findFirst();
  const settings = current
    ? await prisma.businessSettings.update({ where: { id: current.id }, data: parsed.data })
    : await prisma.businessSettings.create({ data: { ...parsed.data, profileId } });

  await writeAudit("SETTINGS_UPDATE", "BusinessSettings", settings.id);
  revalidatePath("/settings");
}
