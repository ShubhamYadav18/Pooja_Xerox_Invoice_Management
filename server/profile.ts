import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const ACTIVE_PROFILE_COOKIE = "pooja-active-profile";
export const DEFAULT_PROFILE_CODE = "POOJA_XEROX";

export async function getProfiles() {
  return prisma.businessProfile.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" }
  });
}

export async function getActiveProfile() {
  const cookieStore = await cookies();
  const activeCode = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value ?? DEFAULT_PROFILE_CODE;
  const profile =
    (await prisma.businessProfile.findFirst({ where: { code: activeCode, isActive: true } })) ??
    (await prisma.businessProfile.findFirst({ where: { code: DEFAULT_PROFILE_CODE, isActive: true } })) ??
    (await prisma.businessProfile.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }));

  if (!profile) {
    throw new Error("No active business profile found");
  }

  return profile;
}

export async function getActiveProfileId() {
  return (await getActiveProfile()).id;
}

export async function getActiveSettings() {
  const profile = await getActiveProfile();
  return prisma.businessSettings.findFirst({
    where: { profileId: profile.id }
  });
}
