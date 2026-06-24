"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_PROFILE_COOKIE } from "@/server/profile";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/authz";

export async function switchProfile(formData: FormData) {
  await requireAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  const profile = await prisma.businessProfile.findFirst({
    where: { id: profileId, isActive: true }
  });

  if (!profile) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profile.code, {
    path: "/",
    sameSite: "lax",
    httpOnly: true
  });
  revalidatePath("/", "layout");
}
