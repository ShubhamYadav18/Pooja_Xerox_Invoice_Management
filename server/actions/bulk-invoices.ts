"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/authz";
import { getActiveProfile, getActiveSettings } from "@/server/profile";

export interface MonthOption {
  key: string;
  label: string;
  count: number;
  totalAmount: number;
}

export async function getAvailableInvoiceMonths(): Promise<MonthOption[]> {
  await requireAdmin();
  const profile = await getActiveProfile();

  const invoices = await prisma.invoice.findMany({
    where: { profileId: profile.id, status: { not: "CANCELLED" } },
    select: {
      id: true,
      billingMonth: true,
      invoiceDate: true,
      grandTotal: true
    },
    orderBy: { invoiceDate: "desc" }
  });

  const formatter = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });

  const monthMap = new Map<string, { count: number; totalAmount: number; latestDate: Date }>();

  for (const inv of invoices) {
    const monthKey = inv.billingMonth?.trim() || formatter.format(new Date(inv.invoiceDate));
    const current = monthMap.get(monthKey) || {
      count: 0,
      totalAmount: 0,
      latestDate: new Date(inv.invoiceDate)
    };
    current.count += 1;
    current.totalAmount += Number(inv.grandTotal);
    if (new Date(inv.invoiceDate) > current.latestDate) {
      current.latestDate = new Date(inv.invoiceDate);
    }
    monthMap.set(monthKey, current);
  }

  const options: MonthOption[] = Array.from(monthMap.entries())
    .sort((a, b) => b[1].latestDate.getTime() - a[1].latestDate.getTime())
    .map(([key, data]) => ({
      key,
      label: key,
      count: data.count,
      totalAmount: Math.round(data.totalAmount * 100) / 100
    }));

  return options;
}

export async function getInvoicesForMonth(monthKey: string) {
  await requireAdmin();
  const profile = await getActiveProfile();
  const settings = await getActiveSettings();

  if (!settings) {
    return { success: false, error: "Business settings not found for active profile." };
  }

  // Parse monthKey to build fallback date range if needed
  // Example monthKey: "September 2026"
  const parts = monthKey.split(" ");
  let dateRangeFilter: { gte?: Date; lte?: Date } | undefined;
  if (parts.length === 2) {
    const monthIndex = new Date(`${parts[0]} 1, ${parts[1]}`).getMonth();
    const year = Number(parts[1]);
    if (!isNaN(monthIndex) && !isNaN(year)) {
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      dateRangeFilter = { gte: start, lte: end };
    }
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      profileId: profile.id,
      status: { not: "CANCELLED" },
      OR: [
        { billingMonth: monthKey },
        ...(dateRangeFilter ? [{ invoiceDate: dateRangeFilter }] : [])
      ]
    },
    include: {
      customer: true,
      items: {
        include: { branch: true },
        orderBy: { srNo: "asc" }
      }
    },
    orderBy: [{ invoiceDate: "asc" }, { invoiceNumber: "asc" }]
  });

  // Next.js Server Action serialization
  const serialized = JSON.parse(
    JSON.stringify({
      invoices,
      settings,
      profileName: profile.name
    })
  );

  return {
    success: true,
    invoices: serialized.invoices,
    settings: serialized.settings,
    profileName: serialized.profileName
  };
}
