"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/authz";
import { writeAudit } from "@/server/audit";
import { getActiveProfileId } from "@/server/profile";

/**
 * Toggles the automated payment reminder emails on/off for the active profile.
 * The cron reads this flag before sending — no redeployment needed.
 */
export async function toggleReminderEmails(enabled: boolean) {
  await requireAdmin();
  const profileId = await getActiveProfileId();

  const current = profileId
    ? await prisma.businessSettings.findFirst({ where: { profileId } })
    : await prisma.businessSettings.findFirst();

  if (current) {
    await prisma.businessSettings.update({
      where: { id: current.id },
      data: { reminderEmailsEnabled: enabled },
    });
  } else {
    // Settings row doesn't exist yet — create a minimal placeholder
    // (the user should save full settings first, but this is safe)
    await prisma.businessSettings.create({
      data: {
        profileId,
        businessName: "",
        businessAddress: "",
        gstNumber: "",
        terms: "",
        reminderEmailsEnabled: enabled,
      },
    });
  }

  await writeAudit(
    "SETTINGS_UPDATE",
    "BusinessSettings",
    current?.id ?? "new",
    { reminderEmailsEnabled: enabled }
  );

  revalidatePath("/settings");
  return { success: true, enabled };
}

/** Read-only: returns the current toggle state for the active profile. */
export async function getReminderEmailsEnabled(): Promise<boolean> {
  await requireAdmin();
  const profileId = await getActiveProfileId();

  const settings = profileId
    ? await prisma.businessSettings.findFirst({ where: { profileId }, select: { reminderEmailsEnabled: true } })
    : await prisma.businessSettings.findFirst({ select: { reminderEmailsEnabled: true } });

  // Default to true if no settings row exists yet
  return settings?.reminderEmailsEnabled ?? true;
}
